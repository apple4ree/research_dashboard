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

- `/wiki-types` → `{ types: [{ key, label, description }] }`.

  **If empty array — interactive bootstrap (don't stop):**
  1. Ask the user:

     > "이 프로젝트엔 WikiType이 아직 없어요. 어떤 분류로 wiki를 만들까요?
     > 예시: `attack` (공격 변종), `defense` (방어 기법), `concept` (개념 정의),
     > `method` (실험 방법), `finding` (발견). key/label 쌍으로 알려주세요
     > (e.g., `attack:Attacks, concept:Concepts`)."

  2. 사용자가 답하면 한 줄당 1개씩 다음 호출:
     ```bash
     curl -fsSL -X POST "$LABHUB_URL/api/wiki-types" \
       -H "Authorization: Bearer $TOKEN" \
       -H 'Content-Type: application/json' \
       -d '{"projectSlug":"<SLUG>","key":"attack","label":"Attacks","description":"공격 변종"}'
     ```
     - 201 `created` / 200 `updated` (idempotent) → 기록.
     - 400 `invalid_request` (key가 `/^[a-z0-9_-]+$/` 미스매치 등) → 사용자에게 다시 물어 정정.
     - 404 `project_not_found` → stop.

  3. 모두 만든 뒤 `GET /wiki-types` 재호출하여 갱신된 목록을 받아 다음 단계로 진행.

  사용자가 만들기 거부하거나 입력 못 받으면 그때 stop, "프로젝트 wiki에서 직접 정의해 주세요" 안내.

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
