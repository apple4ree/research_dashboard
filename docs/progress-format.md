# Progress file format for `labhub-flow-ingest`

Researchers writing daily progress notes for a project tracked in LabHub:
follow this layout so the `labhub-flow-ingest` skill can extract clean
events and link them to your tasks automatically.

## File location and name

```
<Project.localPath>/progress/<your-id>/progress_<YYYYMMDD>_<HHMM>.md
```

- `<your-id>` is your researcher folder (`dgu`, `ys`, `jane`, …).
- `<YYYYMMDD>_<HHMM>` is the local time you started writing the entry.
- One file = one event. If a single session covers multiple distinct things,
  consider splitting into two files.

Example: `/home/dgu/research/tick-agent/progress/dgu/progress_20260427_1400.md`.

## Recommended body structure

```markdown
---
date: 2026-04-27 14:00
researcher: dgu
---

# <한 줄 제목>

## Context
<왜 이걸 했나, 1-2 문단. 다른 진척과의 관계.>

## Done
- <짧은 사실 1>
- <짧은 사실 2>
- <짧은 사실 3>

## Numbers / Metrics
| metric | value |
|---|---|
| MELON ASR | 0.305 |
| sweep iterations | 105 |

## Next
- <후속 계획 / 다음 단계>
```

The skill's LLM accepts free-form markdown too — the structure is a strong
**recommendation** for extraction quality, not a parser requirement.

## What ends up where

| File section | Goes into FlowEvent field |
|---|---|
| `# 한 줄 제목` | `title` (≤30 chars, possibly trimmed) |
| `## Context` | `summary` (2-3 sentences synthesized) |
| `## Done` | `bullets[]` (one bullet per "fact") |
| `## Numbers` | `numbers[]` (`{label, value}` rows) |
| Implicit from content | `tone`, `tags`, `taskIds` |

## Tone (one per file)

The skill picks one tone capturing the "central change" reported:

- **milestone** — setup, new tooling, start of a major change
- **result** — a completed experiment with results
- **pivot** — direction change, hypothesis abandoned
- **design** — designing a new experiment / structure
- **incident** — debugging, outages, post-hoc fixes

If your progress mixes tones (e.g., "we got a result and then pivoted"),
pick the dominant one — usually the one that affects what happens next.

## Tasks (auto-mapped)

The skill compares your progress against the project's existing
`/projects/<slug>/flow` tasks. A task is linked if its title / goal /
subtasks are mentioned. Typically 1-3 tasks per progress.

If your progress doesn't move any existing task forward, that's fine — the
event still gets created with no links.

## Re-running and edits

- The skill identifies new files by filename. If you edit an already-ingested
  file and re-run the skill, by default the event won't be re-extracted (idempotent).
- To force re-extraction on a file: pass `overwrite: true` in that file's
  apply payload (the skill chooses), or delete the matching `FlowEvent` row in
  the LabHub DB and re-invoke the skill.

## Examples

### result

```markdown
---
date: 2026-04-27 14:00
researcher: dgu
---

# trigger_fake × MELON 첫 sweep

## Context
attack 전체 set에 대해 benchmark의 첫 측정. baseline은 trigger_static.

## Done
- MELON 105개 instance에 대해 ASR 측정
- baseline (trigger_static) 대비 +18%p 개선
- 일부 instance는 leak 의심 — 다음 step에 분리

## Numbers
| metric | value |
|---|---|
| trigger_fake ASR | 0.305 |
| trigger_static ASR (baseline) | 0.124 |
| n | 105 |

## Next
- leak suspects 5개 manual inspection
- ablation: trigger length 짧게 → ASR 변화 측정
```

→ Extracted: `tone=result`, `title="trigger_fake × MELON 0.305"`,
`numbers=[{label:'trigger_fake ASR',value:'0.305'},…]`, mapped to whichever
task currently tracks "trigger_fake benchmark".

### pivot

```markdown
# sysframe 폐기 → trigger_fake 설계

## Context
sysframe 접근으로 한 주 진행했지만 instruction sandwich가 너무 fragile.
authority framing 대신 trigger token 으로 전환 결정.

## Done
- sysframe 마지막 측정: ASR 0.087 (너무 낮음)
- trigger_fake 변형 3개 후보 설계
- 다음 주 우선순위: trigger_fake → MELON benchmark
```

→ Extracted: `tone=pivot`, `title="sysframe 폐기 → trigger_fake"`, mapped to
the task that tracked "attack 설계 결정".
