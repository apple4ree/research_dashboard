# LabHub Skill — Phase 2 (Claude Code Skill)

**Date:** 2026-04-26
**Status:** Design approved, ready for implementation plan

## Motivation

Phase 1 added a JWT-authenticated REST API to LabHub
(`POST /api/auth/device/exchange`, `GET /api/me`, `POST /api/runs`,
`PATCH /api/runs/:id`). Phase 2 wraps that API as a Claude Code skill so
researchers can log experiment runs from inside their Claude Code chat
without learning curl, juggling tokens, or leaving the terminal.

The intended interaction:

```
User:  /labhub start a run for klass-unlearning called temp-sweep
Claude: ✓ Started exp-te35xn (klass-unlearning / temp-sweep)
        https://labhub.damilab.cc/projects/klass-unlearning/experiments/exp-te35xn

(later, after experiment finishes)

User:  /labhub 끝났어, 1시간 걸렸고 잘 됐어
Claude: ✓ Marked exp-te35xn as success (1h)
```

## Goals

1. One natural-language slash command (`/labhub <text>`) that maps to the
   four Phase 1 endpoints.
2. GitHub Device Flow for first-time auth — user opens a URL, types a
   code, done. No copy-pasting tokens.
3. Persistent JWT across Claude Code sessions (30-day TTL matches
   Phase 1's JWT lifetime).
4. Self-contained: one folder under `~/.claude/skills/labhub/`, distributable
   by copying that folder.

## Non-goals (explicit)

- Multiple slash commands (no `/labhub-login`, `/labhub-run-start`, etc.).
  One skill, natural-language args.
- Subcommand syntax (`/labhub run start --name=…`). The skill exists to
  add LLM interpretation on top of curl; arg parsing defeats the point.
- Generic "any LabHub deployment" support. URL and OAuth client_id are
  hardcoded for `https://labhub.damilab.cc`. A second deployment would
  fork the skill folder and re-hardcode.
- A wrapper around training scripts (`python train.py` integration).
  That's better served by a 4-line curl in the script. Phase 3+ if ever.
- Any GET-list endpoints (no `/labhub list runs`). Phase 1 didn't expose
  them; Phase 2 doesn't need them.
- Refresh tokens. Expiry → re-run device flow.

## Architecture

```
~/.claude/skills/labhub/
├── SKILL.md              # frontmatter + agent-facing instructions
├── README.md             # human-facing setup & usage notes
└── scripts/
    └── device-flow.sh    # GitHub Device Flow polling (~40 lines bash)
```

Single user-level skill. No plugin packaging — the user (or admin) drops
the folder under `~/.claude/skills/` and it's live. Distribution to other
lab members is `git clone` + `cp -r`.

`SKILL.md` is a fixed text file the LLM reads when the skill is invoked.
It contains the API endpoint table, status/duration parsing rules, error
mapping, and disambiguation policy. The agent re-derives the appropriate
curl call from the user's natural-language request each time, applying
the rules from SKILL.md.

`scripts/device-flow.sh` is the only piece factored out: GitHub's polling
loop with `authorization_pending` / `slow_down` handling is fiddly enough
that hand-rolling it from a Markdown description per invocation is a
recipe for subtle bugs. The script writes the LabHub `/api/auth/device/
exchange` response to stdout; the agent captures it and writes the JWT
to disk.

### Constants (hardcoded in SKILL.md)

```bash
LABHUB_URL="https://labhub.damilab.cc"
GITHUB_CLIENT_ID="<from LabHub CLI OAuth App>"  # public; safe to commit
```

`LABHUB_URL` can be overridden by env var of the same name (for dev
testing against `http://localhost:3000`).

### Frontmatter

```yaml
---
name: labhub
description: |
  Log experiment runs to LabHub from chat. Use when the user wants to
  start a run, mark a run as finished/failed, check their LabHub login,
  or sign in. Pass the natural-language request as the argument.
---
```

The `description` is written so Claude can also auto-invoke the skill
when the user implicitly asks (e.g., "run 시작했다고 적어둬" — Claude
infers LabHub is the relevant tool). Explicit `/labhub …` always works.

## Components

### SKILL.md sections

The body of `SKILL.md` is structured for the agent to read top-to-bottom
on each invocation:

1. **Constants** — `LABHUB_URL`, `GITHUB_CLIENT_ID`, token file path.
2. **Token check** — read `~/.config/labhub/token.json`, verify
   `expiresAt` is in the future. If missing/expired, decide whether the
   request needs auth (most do) and prompt `/labhub login` first.
3. **Intent classification table** — map user phrasing to one of:
   `login` | `logout` | `whoami` | `run.start` | `run.update`.
4. **Status & duration parsers** — Korean/English natural-language hints.
5. **API call recipes** — one curl per endpoint, with required and
   optional fields.
6. **Output format** — what to print to the user.
7. **Error response handling** — table of `{error: code}` → user-facing
   line.
8. **Disambiguation policy** — when to ask vs guess.

### scripts/device-flow.sh

Pure bash + curl. Uses `node -e` for JSON parsing (no jq dependency;
Node is universally available on these machines). Takes
`(client_id, labhub_url)` as positional args. Writes the LabHub exchange
response (`{token, expiresAt, member}`) to stdout. Errors to stderr,
non-zero exit on any failure. Polls every `interval` seconds, doubling
on `slow_down`, exits on `expired_token` or `access_denied`.

## Data flow

### `/labhub login` (first-time auth)

1. Agent invokes `bash scripts/device-flow.sh "$GITHUB_CLIENT_ID"
   "$LABHUB_URL"`.
2. Script POSTs to `https://github.com/login/device/code`, parses out
   `device_code`, `user_code`, `verification_uri`, `interval`.
3. Script prints `Open: …` and `Code: …` to stdout for the agent to
   relay to the user.
4. Script polls `https://github.com/login/oauth/access_token` until
   GitHub returns an access token (or fails).
5. Script POSTs that access token to
   `$LABHUB_URL/api/auth/device/exchange`; LabHub returns
   `{token, expiresAt, member}`.
6. Script prints the LabHub response JSON to stdout.
7. Agent writes `~/.config/labhub/token.json` with that JSON, mode 0600.
8. Agent prints `✓ Logged in as <displayName> (@<login>)`.

### `/labhub start a run for X called Y`

1. Agent reads `~/.config/labhub/token.json`. If missing/expired →
   prompt `/labhub login` and stop.
2. Agent extracts `name=Y, projectSlug=X` from the request.
3. Agent runs `curl -fsS -X POST "$LABHUB_URL/api/runs" -H
   "Authorization: Bearer $TOKEN" -d '{name, projectSlug,
   status: "in_progress"}'`.
4. On 201, parse `id` from response. Print `✓ Started <id> (X / Y)` and
   the project URL.
5. On 401 → token expired/invalid → suggest `/labhub login`.
6. On 404 → project_not_found, surface hint and optionally suggest a
   close slug.

### `/labhub the run finished, 1h, success`

1. Find the most recent run id from conversation history (the response
   to a previous `run.start` in this chat). If none, ask user.
2. Parse status from natural language ("success", "failure", "cancelled").
3. Parse duration ("1h" → 3600).
4. PATCH `$LABHUB_URL/api/runs/<id>` with `{status, durationSec, summary?}`.
5. On 200, print `✓ Marked <id> as <status> (<dur>)`.
6. On 404 (run not found) → likely id mismatch; ask user to confirm id.

## State

- **Persistent (across sessions):** JWT token in
  `~/.config/labhub/token.json`. File mode 0600. Created by the agent
  after device-flow.sh succeeds.
- **Per-session (in conversation):** the most recent run id the agent
  saw in a `run.start` response. The agent uses this to resolve "the run"
  / "그 run" references. Forgotten when the conversation ends — by
  design (no on-disk session state, YAGNI).
- **No DB writes from skill side.** All state mutation goes through the
  LabHub API.

## Error handling

| Condition | Skill response |
|---|---|
| 401 `missing_token` / `invalid_token` | `✗ Not logged in. Run /labhub login.` |
| 401 `expired_token` | `✗ Token expired. Run /labhub login to refresh.` |
| 401 `unknown_member` | `✗ Token member not found in LabHub. Contact admin.` |
| 401 `github_verify_failed` | `✗ GitHub rejected the access token. Try /labhub login again.` |
| 400 `invalid_request` | Show `hint` verbatim, point to the missing field. |
| 404 `project_not_found` | Show `hint`. If a near-miss slug is plausible, suggest it. |
| 404 `run_not_found` | `✗ Run id not found. Double-check the id (e.g., exp-te35xn).` |
| Network error / 5xx | `✗ Cannot reach LabHub at <URL>. Check status.` |
| Token file corrupted (JSON parse fail) | Delete file, prompt `/labhub login`. |

**Policy on missing required fields:** ask once, briefly. Don't guess.
e.g., user says "run 시작" with no name/project → agent asks
`"어느 프로젝트의 어떤 이름의 run인가요?"` and waits.

**Policy on ambiguous status:** if the natural-language doesn't clearly
map to one of the five RunStatus values, ask. Don't default to `success`.

**Concurrent operations:** "run 5개 시작" → 5 sequential POSTs, print
each result on success, stop and report on first failure.

## Testing

Phase 2 testing is intentionally light:

1. **Device-flow script polling** — optional bash test that runs
   `scripts/device-flow.sh` against a fake local GitHub endpoint
   (e.g., `python -m http.server` with canned responses). Verifies the
   `authorization_pending` → `slow_down` → success path. Skip if it
   gets fiddly; the polling loop is small enough to eyeball.
2. **End-to-end manual smoke** — README documents the full path:
   create OAuth App → paste client_id → `/labhub login` → start run →
   finish run → verify in LabHub UI. Run once after install.

No automated end-to-end test of the skill itself, because doing so
would require mocking Claude Code's slash-command runtime. The skill
is small enough that a single manual smoke + the Phase 1 API tests
already cover the failure surface.

## Setup checklist (for the lab admin)

This is what the admin (=current user) does once before sharing the
skill with other lab members:

1. Go to https://github.com/settings/applications/new
   - Application name: `LabHub CLI`
   - Homepage URL: `https://labhub.damilab.cc`
   - Authorization callback URL: `https://labhub.damilab.cc` (unused
     for Device Flow, but GitHub requires the field)
   - Enable Device Flow.
2. Copy the Client ID from the resulting OAuth App page.
3. Paste it into `SKILL.md` as the value of `GITHUB_CLIENT_ID`.
4. Test: `/labhub login` → browser → `/labhub start a run for
   phase1-test called smoke` → verify in LabHub UI.
5. Distribute the `~/.claude/skills/labhub/` folder to other lab members
   (or git-commit it to a shared dotfiles repo).

## Acceptance criteria

- `~/.claude/skills/labhub/SKILL.md` parseable as a Claude Code skill
  (valid frontmatter, `description` triggers correctly).
- `~/.claude/skills/labhub/scripts/device-flow.sh` is executable and
  exits cleanly on a successful flow.
- `/labhub login` (against the real labhub.damilab.cc) writes a valid
  JWT to `~/.config/labhub/token.json`.
- `/labhub start a run for phase1-test called <anything>` creates a run
  visible at `https://labhub.damilab.cc/projects/phase1-test/experiments`.
- `/labhub the run finished` (in the same conversation) PATCHes the
  same run to `success`.
- README.md documents the OAuth App setup step end-to-end.
- A second lab member can clone the skill folder, run `/labhub login`,
  and reach the create-run flow without editing any files.

## Out-of-scope (later phases)

- Phase 3: `/labhub release …`, `/labhub paper …` once those POST endpoints
  exist.
- Phase 4: `/labhub list runs` once a GET-list endpoint exists.
- Phase 5: Journal entry auto-creation from skill-driven runs.
- Refresh tokens (still re-device-flow on expiry).
- Per-project default slug (so user doesn't have to repeat `klass-unlearning`
  every time).
- Multi-deployment support (config file with URL + client_id).
