---
name: labhub-flow-ingest
description: |
  Walk a research project's local progress markdown, run LLM extraction, and
  POST each event to LabHub Flow J view via the REST API. Pure HTTP — works
  from any laptop with `/labhub login` done.
  Trigger: "labhub-flow-ingest <slug>", "flow ingest", "<slug>의 progress 정리해줘",
  "wiki ingest" (currently flow only — wiki is a separate phase).
---

# labhub-flow-ingest (V2)

Auto-populate the LabHub Flow J view (`/projects/<slug>/flow`) from progress
files in your **local** working directory. One project per invocation.

V2 is HTTP-only: no LabHub repo clone, no Prisma access, no `cd`. Authenticates
with the same Bearer token that `/labhub login` mints.

## When to invoke

User says something like:
- `labhub-flow-ingest tick-agent`
- "tick-agent의 progress 정리해줘"
- "flow ingest tick-agent"

If they don't supply a slug, ask: `"어느 프로젝트의 progress를 ingest 할까요?"`.

## Constants

```
LABHUB_URL  = https://labhub.damilab.cc            (or $LABHUB_URL env override)
TOKEN_FILE  = $HOME/.config/labhub/token.json      (set up by /labhub login)
```

## Step 0 — Auth precheck

Read `$TOKEN_FILE`, JSON-parse, verify `expiresAt` (ISO string) is in the
future. On any failure (missing file, parse error, expired) tell the user:

> "LabHub 토큰이 없거나 만료됐어요. `/labhub login` 먼저 실행해 주세요."

…and stop. Hold the JWT in `$TOKEN` for the rest of the run.

## Step 1 — Project metadata (HTTP)

```bash
TOKEN=$(jq -r .token "$TOKEN_FILE")

curl -fsSL -H "Authorization: Bearer $TOKEN" \
  "$LABHUB_URL/api/projects/<SLUG>/todos"

curl -fsSL -H "Authorization: Bearer $TOKEN" \
  "$LABHUB_URL/api/projects/<SLUG>/flow-events"
```

- `/todos` → `{ todos: [{ id, bucket, title, goal, subtasks, status, ... }] }`.
  Used in Step 3 for task mapping.
- `/flow-events` → `{ events: [{ id, source, title, tone, position, date }] }`.
  Extract the `source` strings, dedupe → `ingestedSources`.

If either call returns 404 `project_not_found`, stop and tell the user the
slug is wrong. If 401, the token expired mid-run — `/labhub login` again.

## Step 2 — Walk local progress dir

From the user's current working directory, glob:

```
./progress/*/progress_*.md
```

Diff against `ingestedSources` (compare the **bare filename** — basename of the
absolute path). Anything not in the set is a `newFile`.

If `newFiles.length === 0`, tell the user "no new progress files since last
ingest" and stop.

> The skill never `git pull`s. The user manages their own checkout. If they
> just edited a file and want it re-ingested, see "Re-running" below.

## Step 3 — Per file: extract → POST

For each `newFile`:

### 3a. Read the markdown body

Use the **Read tool** on the file's absolute path.

### 3b. Construct the apply payload

Following `docs/progress-format.md` plus the body markdown sections
(`Context` / `Done` / `Numbers` / `Next` — all optional):

```json
{
  "projectSlug": "<SLUG>",
  "event": {
    "date": "<YYYY-MM-DD HH:mm — extract from filename or frontmatter>",
    "source": "<bare filename, e.g. progress_20260427_1400.md>",
    "title": "<≤30 chars; punchy; results include the headline metric>",
    "summary": "<2-3 sentence what+why+result>",
    "tone": "milestone | result | pivot | design | incident",
    "bullets": ["<short fact 1>", "<short fact 2>"],
    "numbers": [{ "label": "<short metric>", "value": "<value string>" }],
    "tags": ["<theme>", "<activity>"],
    "bodyMarkdown": "<the unmodified contents of the source progress_*.md file you read in 3a>"
  },
  "taskIds": [13, 14, 16],
  "overwrite": false
}
```

**`bodyMarkdown`** — pass the raw markdown body verbatim (don't strip
frontmatter, don't reflow). The dashboard renders it inside each event
card's "원본 progress.md 보기" expandable so any lab member can see the
note even if they don't have the file on their laptop. Cap is 1MB; truncate
or skip the field for unusually large files.

**Tone — pick exactly one** (overlap is fine; pick the central change):

| Tone | When |
|---|---|
| `milestone` | Setup, new tooling, start of major change |
| `result` | Completed experiment with measurable outcome |
| `pivot` | Direction change, hypothesis abandoned |
| `design` | New experiment / structure design phase |
| `incident` | Debugging, outage, post-hoc fix |

**Title** — 30 chars max. For a `result`, include the headline number
("trigger_fake × MELON 0.305"). For a `pivot`, "X 폐기 → Y 설계" form.
Korean / English mix is fine.

**Bullets** — 0-5 short facts from the file's `Done` / 결과 section. Omit
(or empty array) if nothing fits.

**Numbers** — 0-4 most important metrics, `{label, value}` shape. Skip if no
numerical data.

**Tags** — informational; skip if unsure.

**taskIds** — compare against `todos[]` from Step 1. Pick tasks the progress
actually advances (`title` / `goal` / `subtasks` is mentioned or clearly
implied). 1-3 typical, occasionally 0. **False positives are worse than false
negatives** — drop ambiguous mappings.

**Citation discipline** (borrowed from llm-wiki-dami):
- The `source` field is mandatory and must be the exact bare filename of the
  progress file you read — never invent or reformat it. The dashboard uses
  it both for dedupe and as the link from each event card back to its
  source.
- Bullets and summary must paraphrase what the file says; **don't speculate
  beyond the source**. If the file is ambiguous, prefer a shorter bullet to
  a confident-but-fabricated one.
- Numbers must be quoted as written in the file (e.g. `"0.305"` not
  `"30.5%"` unless the file used the percentage form).

### 3c. POST to /api/flow-events

```bash
curl -sS -w '\n%{http_code}\n' \
  -X POST "$LABHUB_URL/api/flow-events" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d @- <<'EOF'
{ ...payload... }
EOF
```

Status-code handling:

- **201 `created`** — `{ ok, eventId, mode: 'created', taskLinks }`. Record and continue.
- **200 `updated`** — overwrite path took. Same body shape. Record and continue.
- **409 `event_already_exists`** — duplicate source without overwrite. Skip,
  note, continue.
- **400 `invalid_request`** — body has a problem (tone, taskIds). Read `hint`,
  fix and retry once for that file. If still 400, skip and note.
- **401** — token expired mid-run. Stop and ask user to `/labhub login`.
- **404 `project_not_found`** — slug is wrong. Stop.
- **5xx / network** — surface, skip the file, continue.

## Step 4 — Summary report

After processing all files:

```
✓ Ingested <N>/<M> progress files into <SLUG>:
  - 2026-04-26 10:30  result    "trigger_fake × MELON 0.305"  → 2 tasks
  - 2026-04-27 14:00  design    "5종 ablation 라운드 설계"     → 1 task
  - 2026-04-27 16:00  incident  "YAML 파싱 버그"               → 0 tasks
  ⨯ progress_20260427_2300.md  — POST failed: <reason>

  $LABHUB_URL/projects/<SLUG>/flow
```

## Re-running

This skill is idempotent: by default, same `source` returns 409 and is skipped.

If the user re-edited an old file and wants to overwrite, set `overwrite: true`
in the payload for that one file. The server deletes prior same-source events
(cascading task links) and inserts fresh.

## Cost notes

- One progress file ≈ 5K tokens in the LLM step (body + tasks context).
- 6 files ≈ 30K tokens, ~1-2 minutes wallclock.
- Runs within Claude Max plan; no extra API charge.
