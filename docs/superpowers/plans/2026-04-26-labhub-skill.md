# LabHub Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Claude Code skill at `skills/labhub/` (in this repo) that wraps Phase 1's REST API. After install, `/labhub <natural-language>` lets the user log/update experiment runs and authenticate via GitHub Device Flow without leaving chat.

**Architecture:** Source-of-truth lives in this repo under `skills/labhub/` so the skill versions alongside the API it calls. To use it locally, the README instructs `cp -r skills/labhub ~/.claude/skills/`. The skill is one frontmatter-headed `SKILL.md` plus one bundled bash script (`scripts/device-flow.sh`) that handles GitHub Device Flow polling. The agent reads SKILL.md on each invocation, classifies the user's request into one of five intents (`login`/`logout`/`whoami`/`run.start`/`run.update`), and runs the appropriate `curl` against `https://labhub.damilab.cc`. Token persists in `~/.config/labhub/token.json`.

**Tech Stack:** bash + curl + node (for JSON parsing — universally available, no `jq` dependency); LabHub Phase 1 JWT API; GitHub Device Flow (`/login/device/code` + `/login/oauth/access_token`).

---

## File Structure

```
skills/labhub/                     # NEW — source-of-truth in this repo
├── SKILL.md                       # frontmatter + agent-facing instructions (~250 lines)
├── README.md                      # human-facing install + admin setup notes
└── scripts/
    └── device-flow.sh             # bash polling loop (~50 lines)

docs/superpowers/specs/2026-04-26-labhub-skill-design.md   # already committed
docs/superpowers/plans/2026-04-26-labhub-skill.md          # THIS FILE
```

After install (Task 6), files also appear at `~/.claude/skills/labhub/` mirroring the source layout.

**No file in this plan exceeds ~300 lines.** SKILL.md is the largest by far and is naturally a single document, not split.

---

## TDD note

The skill is almost entirely documentation (SKILL.md = LLM instructions; README = human instructions). The only executable code is `scripts/device-flow.sh`. Per the spec, automated end-to-end testing of the skill is out of scope (would require mocking Claude Code's runtime). Therefore:

- **Task 2 (`device-flow.sh`)** has automated tests against a fake-GitHub local server.
- **Other tasks** validate via manual smoke (Task 6) and content review.

Each task still ends with a commit.

---

## Task 1: Scaffold the skill source folder

**Files:**
- Create: `skills/labhub/SKILL.md` (frontmatter only, body filled in Task 3)
- Create: `skills/labhub/README.md` (skeleton, body filled in Task 4)
- Create: `skills/labhub/scripts/device-flow.sh` (empty stub, real content in Task 2)

- [ ] **Step 1: Make the directory tree**

```bash
mkdir -p skills/labhub/scripts
```

- [ ] **Step 2: Write `skills/labhub/SKILL.md` with frontmatter + placeholder body**

```markdown
---
name: labhub
description: |
  Log experiment runs to LabHub from chat. Use when the user wants to
  start a run, mark a run as finished/failed, check their LabHub login,
  or sign in. Pass the natural-language request as the argument.
---

# LabHub Skill

(Instructions for the agent will be added in Task 3.)
```

- [ ] **Step 3: Write `skills/labhub/README.md` skeleton**

```markdown
# LabHub Skill

A Claude Code skill that wraps the LabHub REST API.

## Install

(Filled in Task 4.)

## Admin setup (one-time per LabHub deployment)

(Filled in Task 4.)

## Usage

(Filled in Task 4.)
```

- [ ] **Step 4: Write empty `skills/labhub/scripts/device-flow.sh`**

```bash
#!/usr/bin/env bash
# Real script written in Task 2.
exit 1
```

Mark executable:
```bash
chmod +x skills/labhub/scripts/device-flow.sh
```

- [ ] **Step 5: Verify the structure**

Run: `find skills/labhub -type f`
Expected:
```
skills/labhub/SKILL.md
skills/labhub/README.md
skills/labhub/scripts/device-flow.sh
```

- [ ] **Step 6: Commit**

```bash
git add skills/labhub
git commit -m "labhub skill: scaffold source folder under skills/labhub"
```

---

## Task 2: Implement `scripts/device-flow.sh` (TDD)

**Files:**
- Modify: `skills/labhub/scripts/device-flow.sh` (full implementation)
- Create: `skills/labhub/scripts/device-flow.test.sh` (bash test against a fake server)

The script implements the GitHub Device Flow polling loop and the
LabHub exchange. It takes two positional args: `(client_id, labhub_url)`.
Stdout: the LabHub `/api/auth/device/exchange` response JSON.
Stderr: progress lines for the user. Exit non-zero on any failure.

- [ ] **Step 1: Write the test scaffold**

`skills/labhub/scripts/device-flow.test.sh`:

```bash
#!/usr/bin/env bash
# Smoke test for device-flow.sh.
# Spins up a Python HTTP server that mimics GitHub + LabHub, runs the
# script, and asserts it walks through authorization_pending → success.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=$((40000 + RANDOM % 20000))
WORKDIR=$(mktemp -d)
trap 'kill $SERVER_PID 2>/dev/null; rm -rf "$WORKDIR"' EXIT

# Fake server: serves canned responses based on path + a counter.
cat > "$WORKDIR/server.py" <<'PY'
import http.server, json, sys
poll_count = 0

class H(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        global poll_count
        length = int(self.headers.get('content-length', 0))
        body = self.rfile.read(length).decode()
        path = self.path
        resp = None
        if path.endswith('/login/device/code'):
            resp = {'device_code': 'd1', 'user_code': 'ABCD-EFGH',
                    'verification_uri': 'https://github.com/login/device',
                    'interval': 1}
        elif path.endswith('/login/oauth/access_token'):
            poll_count += 1
            if poll_count < 2:
                resp = {'error': 'authorization_pending'}
            else:
                resp = {'access_token': 'gho_test'}
        elif path.endswith('/api/auth/device/exchange'):
            resp = {'token': 'eyJtest', 'expiresAt': '2099-01-01T00:00:00.000Z',
                    'member': {'login': 'testbot', 'displayName': 'Test'}}
        if resp is None:
            self.send_response(404); self.end_headers(); return
        body_bytes = json.dumps(resp).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body_bytes)))
        self.end_headers()
        self.wfile.write(body_bytes)
    def log_message(self, *a): pass

http.server.HTTPServer(('127.0.0.1', int(sys.argv[1])), H).serve_forever()
PY

python3 "$WORKDIR/server.py" "$PORT" &
SERVER_PID=$!

# Wait for server to be up.
for _ in $(seq 1 30); do
  curl -fsS -o /dev/null -X POST "http://127.0.0.1:$PORT/login/device/code" -d 'x=1' && break
  sleep 0.1
done

# Run the script with the fake server's URL substituted in.
# device-flow.sh hits api.github.com hardcoded — for the test we override
# via env vars LABHUB_GITHUB_DEVICE_URL and LABHUB_GITHUB_TOKEN_URL.
export LABHUB_GITHUB_DEVICE_URL="http://127.0.0.1:$PORT/login/device/code"
export LABHUB_GITHUB_TOKEN_URL="http://127.0.0.1:$PORT/login/oauth/access_token"

OUTPUT=$(bash "$SCRIPT_DIR/device-flow.sh" "test-client-id" "http://127.0.0.1:$PORT")

# Assert: stdout contains the expected token field.
if ! grep -q '"token":"eyJtest"' <<< "$OUTPUT"; then
  echo "FAIL: expected token in stdout, got: $OUTPUT" >&2
  exit 1
fi
echo "PASS"
```

Make executable:
```bash
chmod +x skills/labhub/scripts/device-flow.test.sh
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `bash skills/labhub/scripts/device-flow.test.sh`
Expected: FAIL — the stub script just `exit 1`s.

- [ ] **Step 3: Implement `scripts/device-flow.sh`**

Replace the stub at `skills/labhub/scripts/device-flow.sh` with:

```bash
#!/usr/bin/env bash
# GitHub Device Flow + LabHub /api/auth/device/exchange.
#
# Usage: device-flow.sh <github_client_id> <labhub_url>
# Stdout: LabHub exchange response JSON ({token, expiresAt, member}).
# Stderr: progress messages for the user.
# Exit 0 on success; non-zero on any error.
#
# Env overrides (for testing only):
#   LABHUB_GITHUB_DEVICE_URL  default: https://github.com/login/device/code
#   LABHUB_GITHUB_TOKEN_URL   default: https://github.com/login/oauth/access_token
set -euo pipefail

CLIENT_ID="${1:?usage: device-flow.sh <client_id> <labhub_url>}"
LABHUB_URL="${2:?usage: device-flow.sh <client_id> <labhub_url>}"
GH_DEVICE_URL="${LABHUB_GITHUB_DEVICE_URL:-https://github.com/login/device/code}"
GH_TOKEN_URL="${LABHUB_GITHUB_TOKEN_URL:-https://github.com/login/oauth/access_token}"

json_field() {
  # Usage: echo '<json>' | json_field <key>
  node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const v=JSON.parse(s)['$1'];process.stdout.write(v==null?'':String(v));})"
}

# 1) Request device + user code.
RESP=$(curl -fsS -X POST "$GH_DEVICE_URL" \
  -H 'Accept: application/json' \
  -d "client_id=$CLIENT_ID&scope=read:user")

DEVICE_CODE=$(echo "$RESP" | json_field device_code)
USER_CODE=$(echo "$RESP"   | json_field user_code)
VERIFY_URL=$(echo "$RESP"  | json_field verification_uri)
INTERVAL=$(echo "$RESP"    | json_field interval)
INTERVAL="${INTERVAL:-5}"

if [ -z "$DEVICE_CODE" ]; then
  echo "ERROR: GitHub did not return a device_code: $RESP" >&2
  exit 1
fi

# 2) Show the user what to do.
echo                                                       >&2
echo "  Open: $VERIFY_URL"                                 >&2
echo "  Code: $USER_CODE"                                  >&2
echo                                                       >&2
echo "Waiting for authorization..."                        >&2

# 3) Poll for access token.
while true; do
  sleep "$INTERVAL"
  POLL=$(curl -fsS -X POST "$GH_TOKEN_URL" \
    -H 'Accept: application/json' \
    -d "client_id=$CLIENT_ID&device_code=$DEVICE_CODE&grant_type=urn:ietf:params:oauth:grant-type:device_code")

  ERR=$(echo "$POLL" | json_field error)
  case "$ERR" in
    authorization_pending) continue ;;
    slow_down)             INTERVAL=$((INTERVAL + 5)); continue ;;
    expired_token|access_denied)
                           echo "ERROR: GitHub returned $ERR" >&2; exit 1 ;;
    "")                    break ;;
    *)                     echo "ERROR: GitHub returned $ERR ($POLL)" >&2; exit 1 ;;
  esac
done

GH_TOKEN=$(echo "$POLL" | json_field access_token)
if [ -z "$GH_TOKEN" ]; then
  echo "ERROR: no access_token in poll response: $POLL" >&2
  exit 1
fi

# 4) Exchange with LabHub.
EXCHANGE=$(curl -fsS -X POST "$LABHUB_URL/api/auth/device/exchange" \
  -H 'Content-Type: application/json' \
  -d "{\"github_access_token\":\"$GH_TOKEN\"}")

# 5) Stdout = exchange response (the agent will write it to disk).
echo "$EXCHANGE"
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `bash skills/labhub/scripts/device-flow.test.sh`
Expected: `PASS` (script polls once with `authorization_pending`, then succeeds, exchanges with the fake LabHub, prints the JSON containing `"token":"eyJtest"`).

- [ ] **Step 5: Verify direct invocation also works (bonus)**

Run:
```bash
bash skills/labhub/scripts/device-flow.sh 2>&1 | head -3 || true
```
Expected: usage error to stderr (no args supplied).

- [ ] **Step 6: Commit**

```bash
git add skills/labhub/scripts/device-flow.sh skills/labhub/scripts/device-flow.test.sh
git commit -m "labhub skill: device-flow.sh polling loop + bash test against fake gh/labhub server"
```

---

## Task 3: Write `SKILL.md` body

**Files:**
- Modify: `skills/labhub/SKILL.md` (replace placeholder body)

The body of SKILL.md is the LLM instruction set. The agent reads it
top-to-bottom on each invocation. Keep it ≤ ~250 lines so it fits
comfortably in the agent's working set.

- [ ] **Step 1: Replace `skills/labhub/SKILL.md` body with the full instruction set**

Frontmatter stays as-is. Replace the placeholder body with:

````markdown
---
name: labhub
description: |
  Log experiment runs to LabHub from chat. Use when the user wants to
  start a run, mark a run as finished/failed, check their LabHub login,
  or sign in. Pass the natural-language request as the argument.
---

# LabHub Skill

You are the LabHub agent. The user invoked you because they want to
interact with LabHub (https://labhub.damilab.cc), an internal research
dashboard with a JWT-authenticated REST API.

## Constants

```
LABHUB_URL    = https://labhub.damilab.cc   (or $LABHUB_URL env override)
CLIENT_ID     = REPLACE_WITH_GITHUB_CLIENT_ID
TOKEN_FILE    = $HOME/.config/labhub/token.json
SCRIPTS_DIR   = (this skill folder)/scripts
```

If the user has set `LABHUB_URL` in their environment, use that instead
of the default. This lets a developer point at `http://localhost:3000`.

## Step 1: Classify the user's intent

Pick exactly one based on what the user said:

| User said something like… | Intent |
|---|---|
| "login", "sign in", "로그인" | `login` |
| "logout", "sign out", "로그아웃" | `logout` |
| "me", "who am I", "내 정보", "토큰 살아있나" | `whoami` |
| "start a run", "X 프로젝트에 Y run 시작", "create a run" | `run.start` |
| "the run finished/succeeded/failed/cancelled", "그 run 끝났어/취소", "mark X as Y" | `run.update` |

If the request doesn't clearly match, ask a brief clarifying question.
**Never guess on intent.**

## Step 2: Auth precheck (skip for `login` intent)

For every intent except `login`, before making an API call:

1. Read `$TOKEN_FILE`. If missing → tell user `"✗ Not logged in. Run /labhub login."` and stop.
2. JSON-parse the file. If parse fails → delete the file, tell user `"✗ Token file corrupted. Run /labhub login again."` and stop.
3. Compare `expiresAt` (ISO timestamp) to current time. If expired → tell user `"✗ Token expired. Run /labhub login to refresh."` and stop.

Only proceed if all three checks pass. The token field is the JWT to send as `Authorization: Bearer <jwt>`.

## Step 3: Execute the intent

### `login`

```bash
mkdir -p "$HOME/.config/labhub"
EXCHANGE=$(bash "$SCRIPTS_DIR/device-flow.sh" "$CLIENT_ID" "$LABHUB_URL")
echo "$EXCHANGE" > "$HOME/.config/labhub/token.json"
chmod 600 "$HOME/.config/labhub/token.json"
```

Read back `member.login` and `member.displayName` from the saved file.
Print to user:
```
✓ Logged in as <displayName> (@<login>)
  Token saved to ~/.config/labhub/token.json (expires <expiresAt>)
```

If `device-flow.sh` exits non-zero, surface its stderr and stop.

### `logout`

```bash
rm -f "$HOME/.config/labhub/token.json"
```

Print: `✓ Logged out (token deleted).`

### `whoami`

```bash
TOKEN=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$HOME/.config/labhub/token.json'))['token'])")
curl -fsS "$LABHUB_URL/api/me" -H "Authorization: Bearer $TOKEN"
```

Print: `✓ Logged in as <displayName> (@<login>) — role: <role>`.
Map errors per Step 4.

### `run.start`

Required from user: `name` and `projectSlug`. If either is missing,
ask once: `"어느 프로젝트의 어떤 이름의 run인가요?"`. Don't guess.

Optional: `summary` (short text) and `durationSec` (rare for a starting
run, but allowed).

```bash
TOKEN=$(...)  # as in whoami
curl -fsS -X POST "$LABHUB_URL/api/runs" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"<name>\",\"projectSlug\":\"<slug>\",\"status\":\"in_progress\"$OPT_SUMMARY}"
```

(Use `node -e` to construct the body if escaping gets messy; don't hand-build JSON with quotes that may include user text.)

On 201 success, parse `id` from response and print:
```
✓ Started <id> (<slug> / <name>)
  $LABHUB_URL/projects/<slug>/experiments/<id>
```

On 404 `project_not_found`: surface `hint` from response, and if a near-miss slug is plausible (typo of an existing one), suggest it.

### `run.update`

Required: `id` (the run to update) and `status`.
Optional: `durationSec`, `summary`.

To resolve `id` when the user says "the run", "그 run", "it", "마지막 run":
look in conversation history for the most recent `id` you parsed from a
`run.start` response. If you can't find one, ask:
`"어느 run 인가요? id를 알려주세요 (예: exp-te35xn)"`.

Status mapping (natural language → API value):
- "성공" / "success" / "잘 됐어" / "completed" → `success`
- "실패" / "failure" / "터졌어" / "failed" → `failure`
- "취소" / "cancelled" / "cancel" → `cancelled`
- "큐" / "queued" / "대기" → `queued`
- (no status in request, but it's a `run.update` intent) → ask, don't default

If the natural language is ambiguous ("그저그래"), ask: `"성공/실패/취소 중 어떤 상태인가요?"`.

Duration mapping: parse natural language to seconds.
- `"1시간"` / `"1h"` → 3600
- `"30분"` / `"30m"` → 1800
- `"2h 10m"` → 7800
- not mentioned → don't include `durationSec` in the body

```bash
curl -fsS -X PATCH "$LABHUB_URL/api/runs/<id>" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "<json body with the fields the user provided>"
```

On 200, print:
```
✓ Marked <id> as <status> (<duration if known>, "<summary if any>")
```

## Step 4: Error response handling

The LabHub API returns `{ "error": "<code>", "hint"?: "<text>" }` on
non-2xx. Map by status + code:

| Status | error code | Show user |
|---|---|---|
| 401 | `missing_token` | `✗ Not logged in. Run /labhub login.` |
| 401 | `invalid_token` | `✗ Invalid token. Run /labhub login.` |
| 401 | `expired_token` | `✗ Token expired. Run /labhub login to refresh.` |
| 401 | `unknown_member` | `✗ Token member not found in LabHub. Contact admin.` |
| 401 | `github_verify_failed` | `✗ GitHub rejected the access token. Try /labhub login again.` |
| 400 | `invalid_request` | Show hint verbatim, name the missing field. |
| 404 | `project_not_found` | Show hint. If a near-miss slug is plausible, suggest it. |
| 404 | `run_not_found` | `✗ Run id not found. Double-check the id.` |
| any | (network error / 5xx) | `✗ Cannot reach LabHub at <URL>. Check status and try again.` |

When showing an error, prefix with `✗ ` and stop. Do not retry automatically.

## Step 5: Disambiguation policy (read once)

- Required field missing → ask once, briefly. Don't guess.
- Status word ambiguous → ask which of (success/failure/cancelled).
- "the run" with no recent run id → ask for id.
- Multiple plausible projects matching slug → ask which.
- Token expired mid-flow → don't auto-rerun login. Surface and stop.
- 5 runs requested in one message → make 5 sequential POST calls; print
  each result as it lands; on first failure stop and report which
  succeeded so far.

**Bias toward asking over guessing. The user can always answer one
question; recovering from a bogus run created by a wrong guess is harder.**
````

(In the section above, replace `REPLACE_WITH_GITHUB_CLIENT_ID` with the actual client_id once Task 5 is done.)

- [ ] **Step 2: Read it back to verify line count is reasonable**

Run: `wc -l skills/labhub/SKILL.md`
Expected: `< 300` (somewhere around 200).

- [ ] **Step 3: Commit**

```bash
git add skills/labhub/SKILL.md
git commit -m "labhub skill: SKILL.md body — intent table, recipes, error map, disambiguation policy"
```

---

## Task 4: Write `README.md`

**Files:**
- Modify: `skills/labhub/README.md` (replace skeleton with full content)

- [ ] **Step 1: Replace `skills/labhub/README.md` content**

````markdown
# LabHub Skill

A Claude Code skill that wraps [LabHub](https://labhub.damilab.cc)'s REST
API. After install, `/labhub <natural-language>` lets you log experiment
runs and authenticate via GitHub Device Flow without leaving your chat.

## Install

```bash
# From the research_dashboard repo root:
cp -r skills/labhub ~/.claude/skills/
```

That's it. Claude Code auto-discovers skills under `~/.claude/skills/`.
Type `/labhub login` in any Claude Code session to start.

## Admin setup (one-time per LabHub deployment)

If you're the lab admin distributing this skill for the first time:

1. Create a GitHub OAuth App at
   https://github.com/settings/applications/new:
   - **Application name:** `LabHub CLI`
   - **Homepage URL:** `https://labhub.damilab.cc`
   - **Authorization callback URL:** `https://labhub.damilab.cc`
     (unused for Device Flow but GitHub requires the field)
   - **Enable Device Flow:** ✅
2. Copy the **Client ID** from the OAuth App page (the `Ov23li…`
   string — it's public, safe to commit).
3. Open `skills/labhub/SKILL.md` and replace
   `REPLACE_WITH_GITHUB_CLIENT_ID` with that value.
4. Commit and push.
5. Lab members pull and re-`cp -r` to update.

## Usage

| You say | What happens |
|---|---|
| `/labhub login` | Opens GitHub Device Flow. Enter the printed code in your browser, click Authorize. JWT saved for 30 days. |
| `/labhub me` | Verifies the saved token and shows your LabHub identity. |
| `/labhub start a run for klass-unlearning called temp-sweep` | POSTs to `/api/runs`. Prints the new run id and project URL. |
| `/labhub the run finished, 1h, success` | PATCHes the run from this conversation to `success` with `durationSec=3600`. |
| `/labhub logout` | Deletes the local token. |

You can speak Korean or English; the skill handles both. The agent only
remembers "the run" within a single Claude Code session — across sessions,
say the run id explicitly (e.g., `/labhub mark exp-te35xn as failure`).

## Token storage

The skill writes `~/.config/labhub/token.json` (mode `0600`, owner-only).
The file contains a 30-day JWT plus the member identity. Wipe it any
time with `/labhub logout` or `rm ~/.config/labhub/token.json` — the next
API call will prompt you to re-login.

## Dev override

Pointing the skill at a non-prod LabHub for testing:

```bash
LABHUB_URL=http://localhost:3000 claude
```

Inside that session, `/labhub …` will hit `localhost:3000` instead of
`labhub.damilab.cc`. Note the JWT secret is per-deployment, so you'll
need to re-login when switching back to prod.

## Files

```
skills/labhub/
├── SKILL.md                 # LLM instructions (auto-loaded by Claude Code)
├── README.md                # this file
└── scripts/
    ├── device-flow.sh       # GitHub Device Flow polling loop
    └── device-flow.test.sh  # bash test against a fake GH/LabHub server
```

## Troubleshooting

**"Cannot reach LabHub" error** — the skill tried to hit
`https://labhub.damilab.cc` and failed. Check VPN / domain status. If
you're on a dev environment, set `LABHUB_URL` to the right URL.

**Stuck on "Waiting for authorization…"** — make sure you opened
https://github.com/login/device, typed the printed code, and clicked
Authorize. The polling loop times out after about 15 minutes.

**`/labhub login` says GitHub rejected the token** — the server-side
OAuth App's client_id is probably mis-set in `SKILL.md`. Compare the
value there to the actual OAuth App page on GitHub.

## Roadmap (later phases)

- Phase 3: `/labhub release …`, `/labhub paper …` (need new POST endpoints).
- Phase 4: `/labhub list runs` (need GET-list endpoints).
- Phase 5: Auto-link runs to journal entries.
````

- [ ] **Step 2: Commit**

```bash
git add skills/labhub/README.md
git commit -m "labhub skill: README — install, admin setup, usage, troubleshooting"
```

---

## Task 5: Create the GitHub OAuth App and paste the client_id

**Files:**
- Modify: `skills/labhub/SKILL.md` (replace `REPLACE_WITH_GITHUB_CLIENT_ID`)

This task is mostly manual on github.com.

- [ ] **Step 1: Create the OAuth App**

Open https://github.com/settings/applications/new and fill in:
- Application name: `LabHub CLI`
- Homepage URL: `https://labhub.damilab.cc`
- Authorization callback URL: `https://labhub.damilab.cc`
- Enable Device Flow: ✅ check the box

Click **Register application**.

- [ ] **Step 2: Copy the Client ID**

On the resulting page, copy the **Client ID** (e.g., `Ov23li…`).

- [ ] **Step 3: Paste it into SKILL.md**

```bash
sed -i "s|REPLACE_WITH_GITHUB_CLIENT_ID|<paste the actual id>|" skills/labhub/SKILL.md
```

(Replace `<paste the actual id>` with the real value, including the surrounding quotes if you'd like, though they're optional in the SKILL.md context block.)

- [ ] **Step 4: Verify the substitution**

```bash
grep CLIENT_ID skills/labhub/SKILL.md
```

Expected: `CLIENT_ID     = Ov23…` (or whatever the real id is). The `REPLACE_WITH_GITHUB_CLIENT_ID` sentinel should be gone.

- [ ] **Step 5: Commit**

```bash
git add skills/labhub/SKILL.md
git commit -m "labhub skill: paste LabHub CLI OAuth App client_id into SKILL.md"
```

---

## Task 6: Install + end-to-end manual smoke

**Files:** none — this task installs and validates.

- [ ] **Step 1: Install the skill**

```bash
cp -r skills/labhub ~/.claude/skills/
ls ~/.claude/skills/labhub/
```

Expected: `SKILL.md`, `README.md`, `scripts/`.

- [ ] **Step 2: Open a fresh Claude Code session**

In a new shell, run `claude` (or whatever launches Claude Code). The skill should appear in the slash menu (type `/` and look for `labhub`).

- [ ] **Step 3: `/labhub login`**

Type: `/labhub login`

Expected:
```
  Open: https://github.com/login/device
  Code: ABCD-EFGH

Waiting for authorization...
```

Open the URL in a browser, type the code, click Authorize.

After a few seconds:
```
✓ Logged in as <Your Name> (@<your-gh-handle>)
  Token saved to ~/.config/labhub/token.json (expires <date>)
```

Verify on disk:
```bash
ls -l ~/.config/labhub/token.json
```
Expected: file exists, permissions `-rw-------`.

- [ ] **Step 4: `/labhub me`**

Type: `/labhub me`

Expected:
```
✓ Logged in as <Your Name> (@<your-gh-handle>) — role: PhD
```

- [ ] **Step 5: `/labhub start a run`**

Type: `/labhub start a run for phase1-test called smoke-from-skill`

Expected:
```
✓ Started exp-… (phase1-test / smoke-from-skill)
  https://labhub.damilab.cc/projects/phase1-test/experiments/exp-…
```

Open the printed URL in a browser. Verify the run is visible in the LabHub UI's experiments list.

- [ ] **Step 6: `/labhub finish the run`**

In the same Claude Code conversation:

Type: `/labhub the run finished, 30 minutes, success`

Expected:
```
✓ Marked exp-… as success (30m)
```

Refresh the LabHub UI — the run status should now read "success" and the duration should show 30 minutes.

- [ ] **Step 7: `/labhub logout`**

Type: `/labhub logout`

Expected:
```
✓ Logged out (token deleted).
```

Verify:
```bash
ls ~/.config/labhub/token.json 2>&1
```
Expected: `No such file or directory`.

- [ ] **Step 8: (Optional) test that an unauthenticated call now fails gracefully**

Type: `/labhub me`

Expected:
```
✗ Not logged in. Run /labhub login.
```

- [ ] **Step 9: No commit needed for this task**

The smoke test doesn't change repo files. If anything is wrong, document the failure as a follow-up issue and revisit the relevant earlier task.

---

## Task 7: Final verification

**Files:** none.

- [ ] **Step 1: Confirm all files exist in source tree**

```bash
find skills/labhub -type f
```

Expected:
```
skills/labhub/SKILL.md
skills/labhub/README.md
skills/labhub/scripts/device-flow.sh
skills/labhub/scripts/device-flow.test.sh
```

- [ ] **Step 2: Confirm the bash test still passes**

```bash
bash skills/labhub/scripts/device-flow.test.sh
```

Expected: `PASS`.

- [ ] **Step 3: Confirm SKILL.md no longer contains the placeholder**

```bash
grep REPLACE_WITH_GITHUB_CLIENT_ID skills/labhub/SKILL.md && echo FAIL || echo OK
```

Expected: `OK` (placeholder removed in Task 5).

- [ ] **Step 4: Confirm Phase 1 test suite still passes**

The skill should not have touched any Phase 1 code, so this should be unchanged. Run as a defensive check:

```bash
pnpm exec playwright test tests/api/ --reporter=line
```

Expected: 14/14 pass (matching the Phase 1 final state).

- [ ] **Step 5: Confirm typecheck/lint/build still clean**

```bash
pnpm exec tsc --noEmit && pnpm lint && pnpm build
```

Expected: all clean.

---

## Self-Review

**1. Spec coverage** — every spec section maps to a task:

- Architecture / file layout (spec §Architecture) → Task 1
- `scripts/device-flow.sh` (spec §Components, §Data flow §login) → Task 2
- SKILL.md sections 1-8 (spec §Components, §Data flow, §Error handling, §State) → Task 3
- README + admin setup (spec §Setup checklist, §Acceptance criteria last item) → Tasks 4, 5
- Token storage at `~/.config/labhub/token.json` mode 0600 (spec §State) → Task 3 (in the `login` recipe) and verified in Task 6 Step 3
- 30-day JWT lifetime — comes from Phase 1, no skill task needed
- "Same conversation only" run-id memory (spec §State) → Task 3 SKILL.md `run.update` section
- Acceptance criteria 1-7 → Tasks 6 (smoke) + 7 (final verification)
- Out-of-scope items — explicitly absent from all tasks (no GET-list, no refresh tokens, no per-project default — by design)

No gaps.

**2. Placeholder scan** — searched the plan for "TBD"/"TODO"/"fill in"/"appropriate"/"as needed". No matches. The single literal `REPLACE_WITH_GITHUB_CLIENT_ID` token is intentional and resolved in Task 5.

**3. Type / name consistency** — `LABHUB_URL`, `CLIENT_ID`, `TOKEN_FILE`, intent names (`login`/`logout`/`whoami`/`run.start`/`run.update`), error codes (`missing_token`/`invalid_token`/`expired_token`/`unknown_member`/`github_verify_failed`/`invalid_request`/`project_not_found`/`run_not_found`), and the `RunStatus` values (`success`/`failure`/`in_progress`/`queued`/`cancelled`) all match the Phase 1 implementation and the spec verbatim. No drift.
