---
name: labhub-wiki-ingest
description: |
  Walk a research project's local progress markdown, extract wiki-relevant
  facts via LLM, and upsert WikiEntity rows in LabHub Wiki via the REST API.
  Pure HTTP — works from any laptop with `/labhub login` done.
  Trigger: "labhub-wiki-ingest <slug>", "wiki ingest <slug>",
  "<slug>의 wiki 정리해줘".
---

# labhub-wiki-ingest

Auto-update the LabHub Wiki (`/projects/<slug>/wiki`) from progress files in
your **local** working directory. One project per invocation. LLM-merge
upsert: existing entities accumulate well-edited bodies, new entities are
auto-created under existing WikiTypes.

## When to invoke

User says something like:
- `labhub-wiki-ingest tick-agent`
- "tick-agent의 wiki 정리해줘"
- "wiki ingest tick-agent"

If they don't supply a slug, ask: `"어느 프로젝트의 wiki를 ingest 할까요?"`.

## Constants

```
LABHUB_URL  = https://labhub.damilab.cc            (or $LABHUB_URL env override)
TOKEN_FILE  = $HOME/.config/labhub/token.json      (set up by /labhub login)
```

## Step 0 — Auth precheck

Read `$TOKEN_FILE`, JSON-parse, verify `expiresAt` is in the future. On any
failure (missing file, parse error, expired):

> "LabHub 토큰이 없거나 만료됐어요. `/labhub login` 먼저 실행해 주세요."

…and stop. Hold the JWT in `$TOKEN`.

## Step 1 — Wiki context

```bash
TOKEN=$(jq -r .token "$TOKEN_FILE")

curl -fsSL -H "Authorization: Bearer $TOKEN" \
  "$LABHUB_URL/api/projects/<SLUG>/wiki-types"

curl -fsSL -H "Authorization: Bearer $TOKEN" \
  "$LABHUB_URL/api/projects/<SLUG>/wiki-entities"
```

- `/wiki-types` → `{ types: [{ key, label, description }] }`. If empty array,
  stop and tell the user:

  > "이 프로젝트엔 WikiType이 없어요. 프로젝트 설정에서 분류(`attack`,
  > `concept` 같은)를 먼저 정의해 주세요."

- `/wiki-entities` → `{ entities: [{ id, type, name, status, summaryMarkdown,
  sourceFiles, lastSyncedAt }] }`. Build:
  - `existingById` map for matching candidates
  - `ingestedSet = ⋃ entity.sourceFiles` for per-file dedupe

If 404 `project_not_found`, stop. If 401, token expired mid-run — ask user to
`/labhub login` again.

## Step 2 — Walk local progress dir

From cwd:

```
./progress/*/progress_*.md
```

`newFiles = files where basename ∉ ingestedSet`. If empty, tell user "no new
progress files since last wiki ingest" and stop.

> The skill never `git pull`s. The user manages their own checkout.

## Step 3 — Per file

### 3a. Read body

Use the **Read tool** on the absolute path.

### 3b. LLM step 1 — Candidate extraction

Prompt the LLM with:
- `types[]` (key, label, description) — what categories exist
- `existingEntities[]` (id, type, name, summaryMarkdown) — what's already known
- the progress body

LLM emits a JSON array. Each item is **one** of:

```json
{ "match": "<existing-entity-id>", "newSnippet": "<short markdown extracted from this progress that updates the entity>" }
```

or

```json
{ "newEntity": {
    "type": "<one of the types[]>",
    "id":   "<slug-style /^[a-z0-9_-]+$/>",
    "name": "<display name>",
    "snippet": "<initial body markdown>"
  }
}
```

Empty array → no wiki content in this file → skip, continue.

**Guidance for the LLM:**
- Prefer `match` over `newEntity` when names overlap conceptually.
- Only choose a `newEntity.type` from the provided `types[]` keys.
- 0–3 candidates per file is typical. Don't force.

### 3c. Per candidate

#### Existing match
```bash
curl -fsSL -H "Authorization: Bearer $TOKEN" \
  "$LABHUB_URL/api/projects/<SLUG>/wiki-entities/<id>"
```
Get the full entity. **LLM step 2 (merge):** input = existing `bodyMarkdown`
+ `newSnippet`. Output = revised `bodyMarkdown` (well-organized, no
duplicates) + revised `summaryMarkdown` (1–2 sentence overview that absorbs
new info).

Build payload:
```json
{
  "projectSlug": "<SLUG>",
  "id": "<existing.id>",
  "type": "<existing.type>",
  "name": "<existing.name>",
  "status": "<existing.status>",
  "summaryMarkdown": "<merged summary>",
  "bodyMarkdown": "<merged body>",
  "sourceFiles": [<existing.sourceFiles>, "<currentFileBasename>"]   // dedupe
}
```

#### New entity
LLM already gave type/id/name/snippet. Build:
```json
{
  "projectSlug": "<SLUG>",
  "id": "<newEntity.id>",
  "type": "<newEntity.type>",
  "name": "<newEntity.name>",
  "status": "active",
  "summaryMarkdown": "<one-sentence summary derived from snippet>",
  "bodyMarkdown": "<newEntity.snippet>",
  "sourceFiles": ["<currentFileBasename>"]
}
```

#### POST the upsert
```bash
curl -sS -w '\n%{http_code}\n' \
  -X POST "$LABHUB_URL/api/wiki-entities" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d @- <<'EOF'
{ ...payload... }
EOF
```

Status-code handling:

- **201 `created`** / **200 `updated`** → record `mode` for summary, continue.
- **400 `invalid_request`** — read `hint`. If invalid `type`, drop or remap.
  If invalid `id` (non-slug), re-derive a slug. Retry once. Still failing →
  skip this candidate, note in summary.
- **401** → stop, ask user to `/labhub login`.
- **404 `project_not_found`** → stop.
- **404 `entity_not_found`** on a GET (`<id>`) — entity vanished between list
  and fetch. Treat as new entity, fall through to the "new entity" path.
- **5xx / network** — skip the file, continue.

## Step 4 — Summary report

```
✓ Wiki ingest <SLUG>: <M> progress files processed
  + trigger_universal     (attack)   updated  ← progress_20260427_1400.md
  + ablation_5way         (concept)  created  ← progress_20260427_1400.md
  ⨯ progress_20260428_1100.md  — POST failed: <reason>

  $LABHUB_URL/projects/<SLUG>/wiki
```

## Re-running

Idempotent: a progress file already in some entity's `sourceFiles` is
skipped on the next run. To re-process an edited progress file, delete its
basename from the relevant entity's `sourceFiles` (admin via DB or future
admin endpoint), then re-invoke.

## Cost notes

- LLM step 1 per file ≈ 5–8K tokens (types + entity light list + body).
- LLM step 2 per existing match ≈ 3–5K tokens (existing body + snippet).
- 6 files with ~2 candidates each ≈ 60–80K tokens, ~2–3 minutes wallclock.
- Runs within Claude Max plan; no extra API charge.
