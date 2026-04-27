---
name: labhub-flow-ingest
description: |
  Pull progress markdown files from a research project's git checkout, run LLM
  extraction, and populate LabHub Flow J view (FlowEvents + task links).
  Trigger: "labhub-flow-ingest <slug>", "flow ingest", "<slug>의 progress 정리해줘",
  "wiki ingest" (currently flow only — wiki is a separate phase).
---

# labhub-flow-ingest

Auto-populate the LabHub Flow J view (`/projects/<slug>/flow`) from a project's
git progress files. One project per invocation.

## When to invoke

User says something like:
- `labhub-flow-ingest tick-agent`
- "tick-agent의 progress 정리해줘"
- "flow ingest tick-agent"

If they don't supply a slug, ask: `"어느 프로젝트의 progress를 ingest 할까요?"`.

## Constants

```
LABHUB_REPO  = /home/dgu/research_dashboard       (or $LABHUB_REPO env override)
CLI          = $LABHUB_REPO/scripts/flow-ingest-cli.ts
RUNNER       = pnpm tsx $CLI
```

The CLI must run from `LABHUB_REPO` (it uses cwd-relative `prisma/dev.db`).
Always `cd $LABHUB_REPO` before invoking.

## Hard requirements

- The project must have BOTH `Project.githubRepo` and `Project.localPath` set
  in the LabHub DB. The CLI errors out otherwise — surface that to the user
  with the SQL fix:
  `UPDATE Project SET githubRepo='owner/repo', localPath='/abs/path' WHERE slug='<slug>'`.

## Procedure

### Step 1: get-project metadata

```bash
cd $LABHUB_REPO
pnpm tsx scripts/flow-ingest-cli.ts get-project --slug <SLUG>
```

JSON output:
- `project.localPath` — git checkout root.
- `project.githubRepo` — `owner/repo`.
- `tasks[]` — TodoItem rows (`id, bucket, title, goal, subtasks, status`). Used in
  Step 4 for task mapping.
- `wikiTypes[]` — informational in V1; ignore for flow ingest.
- `ingestedSources[]` — already-processed progress filenames.

If the CLI errors with "githubRepo / localPath not set", stop and tell the user
to fix it. Don't auto-set; that's an admin call.

### Step 2: git pull

```bash
cd <project.localPath>
git pull --ff-only
```

If this errors (non-ff, conflicts, network), stop and report. Don't try to
recover automatically. After pulling, `cd $LABHUB_REPO` to be ready for CLI calls.

### Step 3: list-new-progress

```bash
cd $LABHUB_REPO
pnpm tsx scripts/flow-ingest-cli.ts list-new-progress --slug <SLUG>
```

Returns `{progressRoot, files: [{path, source, ingested}]}`. Without `--force`,
only `ingested: false` files need processing.

If `files.length === 0`, tell user "no new progress files since last ingest" and stop.

### Step 4: per-file extract → apply

For each file with `ingested: false`:

#### 4a. Read the markdown body

Use the **Read tool** on `file.path` (absolute path from list-new-progress).

#### 4b. Construct the apply payload

Following the schema in `docs/progress-format.md` and the body markdown
(`Context` / `Done` / `Numbers` / `Next` sections — all optional):

```json
{
  "projectSlug": "<SLUG>",
  "event": {
    "date": "<YYYY-MM-DD HH:mm — extract from filename or frontmatter>",
    "source": "<file.source — bare filename>",
    "title": "<≤30 chars; punchy summary; in result tone include the headline metric>",
    "summary": "<2-3 sentence what+why+result>",
    "tone": "milestone | result | pivot | design | incident",
    "bullets": ["<short fact 1>", "<short fact 2>"],
    "numbers": [{"label": "<short metric name>", "value": "<value string>"}],
    "tags": ["<theme-tag>", "<activity-tag>"]
  },
  "taskIds": [13, 14, 16],
  "overwrite": false
}
```

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

**Bullets** — 0-5 short facts, usually from the file's `Done` / 결과 section.
Omit (or empty array) if nothing fits.

**Numbers** — 0-4 most important metrics, `{label, value}` shape. Skip if
the progress has no numerical data.

**Tags** — informational only in V1; skip if unsure.

**taskIds** — compare progress against `tasks[]` from Step 1. Pick tasks the
progress actually advances (`task.text` / `task.goal` / `task.subtasks` is
mentioned or clearly implied in the body). 1-3 typical, occasionally 0 or
more. **False positives are worse than false negatives** — drop ambiguous
mappings.

#### 4c. Apply via CLI stdin

```bash
echo '<JSON>' | pnpm tsx scripts/flow-ingest-cli.ts apply
```

Or with heredoc:

```bash
pnpm tsx scripts/flow-ingest-cli.ts apply <<'EOF'
{
  "projectSlug": "...",
  "event": { ... },
  "taskIds": [...],
  "overwrite": false
}
EOF
```

Success → `{"ok": true, "eventId": <int>, "mode": "created", "taskLinks": <count>}`.

Failure → stderr message, non-zero exit. **Skip that file, continue with the
next one**, summarize all failures at the end.

### Step 5: Summary report

After processing all files, tell the user:

```
✓ Ingested <N>/<M> progress files into <SLUG>:
  - 2026-04-26 10:30  result    "trigger_fake × MELON 0.305"  → 2 tasks
  - 2026-04-27 14:00  design    "5종 ablation 라운드 설계"     → 1 task
  - 2026-04-27 16:00  incident  "YAML 파싱 버그"               → 0 tasks
  ⨯ progress_20260427_2300.md  — apply failed: <reason>

  https://labhub.damilab.cc/projects/<SLUG>/flow
```

## Failure modes

| Symptom | Action |
|---|---|
| `get-project` says githubRepo / localPath missing | Tell user to set via UI or SQL; stop. |
| `git pull` non-ff or conflicts | Show git output; ask user to resolve manually; stop. |
| Empty `files[]` | "No new progress files." Stop. |
| `apply` rejects tone | Re-pick tone, retry once. |
| `apply` rejects taskIds | Drop the unknown ids, retry. |
| `apply` says "already exists" without `--force` | The user re-running on the same file — skip and note. |
| Network / DB / unknown error | Surface the message, stop, leave whatever's done done. |

## Re-running

This skill is idempotent without `--force`: same progress files don't double-insert.
If the user wants to re-process (e.g., they edited an old file), they can:

1. Pass `overwrite: true` in the apply payload for that single file, OR
2. Manually delete the FlowEvent row in DB and re-invoke.

V1 keeps re-runs simple: opt-in to overwrite on a per-file basis.

## Cost notes

- One progress file ≈ 5K tokens in the LLM step (body + tasks context).
- 6 files ≈ 30K tokens, ~1-2 minutes wallclock.
- Run within Claude Max plan; no extra API charge.
