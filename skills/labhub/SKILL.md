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
CLIENT_ID     = Ov23li51RQ8mtKGwzr5z
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
| "entry 추가", "회의록 정리", "journal 작성", "이 회의 정리해서 entry로" | `entry.create` |
| "그 entry 수정", "entry 슬라이드 추가", "edit entry" | `entry.update` |
| "그 entry 삭제", "delete entry" | `entry.delete` |
| "entries 목록", "지난 회의록 보여줘", "list entries" | `entry.list` |
| "milestone 추가", "마일스톤 추가" | `milestone.create` |
| "milestone 수정/삭제/보여줘" | `milestone.update` / `milestone.delete` / `milestone.list` |
| "todo 추가" | `todo.create` |
| "그거 done", "완료", "그 todo 끝" | `todo.update` (done flip) |
| "todo 삭제" | `todo.delete` |
| "내 todo 보여줘", "남은 todo는?" | `todo.list` |

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
The JWT remains valid until its `expiresAt`; this only removes the local copy. Anyone with the saved token (e.g., a backup) could still use it until it expires.

### `whoami`

```bash
TOKEN=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$HOME/.config/labhub/token.json','utf8'))['token'])")
RESP=$(curl -fsS "$LABHUB_URL/api/me" -H "Authorization: Bearer $TOKEN")
LOGIN=$(node -e "console.log(JSON.parse(process.argv[1]).login)" -- "$RESP")
DISPLAY=$(node -e "console.log(JSON.parse(process.argv[1]).displayName)" -- "$RESP")
ROLE=$(node -e "console.log(JSON.parse(process.argv[1]).role)" -- "$RESP")
```

Print: `✓ Logged in as <displayName> (@<login>) — role: <role>`.
Map errors per Step 4.

### `run.start`

Required from user: `name` and `projectSlug`. If either is missing,
ask once: `"어느 프로젝트의 어떤 이름의 run인가요?"`. Don't guess.

Optional: `summary` (short text) and `durationSec` (rare for a starting
run, but allowed).

Construct the body with `node -e` so user text in `name`/`slug`/`summary`
is JSON-escaped safely:

```bash
TOKEN=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$HOME/.config/labhub/token.json','utf8'))['token'])")
BODY=$(node -e 'console.log(JSON.stringify({name:process.argv[1],projectSlug:process.argv[2],status:"in_progress",...(process.argv[3]?{summary:process.argv[3]}:{}),...(process.argv[4]?{durationSec:Number(process.argv[4])}:{})}))' -- "<name>" "<slug>" "<summary or empty>" "<durationSec or empty>")
curl -fsS -X POST "$LABHUB_URL/api/runs" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "$BODY"
```

The actor (`triggeredByLogin`) is always the JWT holder. You cannot log a run on behalf of someone else — there is no API field for that.

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
look in the **current Claude Code conversation only** for the most recent
`id` printed by a *successful* `run.start` (a `✓ Started exp-…` line you
yourself printed in this conversation). If the conversation is fresh, the
prior `run.start` failed, or no such line exists, ask:
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
BODY=$(node -e 'const fields={};const a=process.argv;if(a[1])fields.status=a[1];if(a[2])fields.durationSec=Number(a[2]);if(a[3])fields.summary=a[3];console.log(JSON.stringify(fields))' -- "<status or empty>" "<durationSec or empty>" "<summary or empty>")
curl -fsS -X PATCH "$LABHUB_URL/api/runs/<id>" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "$BODY"
```

On 200, print:
```
✓ Marked <id> as <status> (<duration if known>, "<summary if any>")
```

### `entry.create`

Required from user: `projectSlug`, `title`, and either `summary` or enough material to write one. If projectSlug or title missing, ask.

Optional/inferred:
- `date`: defaults to today (`new Date().toISOString().slice(0,10)`).
- `type`: defaults to `meeting` unless content clearly indicates `report` / `experiment` / `review`.
- `tags`: extract from content when obvious (e.g., "회의" → `meeting`).
- `slides`: segment user's narrative into kind-tagged slides (`discovery` / `failure` / `implement` / `question` / `next` / `metric`).
- `artifacts`: any URLs in the user's input → candidate artifacts. **Confirm with the user before sending arbitrary URLs as artifacts.**

Body construction (use `node -e` since slides/artifacts contain free-form text):

```bash
TOKEN=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$HOME/.config/labhub/token.json','utf8'))['token'])")
BODY=$(node -e 'const data=JSON.parse(process.argv[1]); console.log(JSON.stringify(data))' -- "$JSON_PAYLOAD")
curl -fsS -X POST "$LABHUB_URL/api/entries" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "$BODY"
```

Where `$JSON_PAYLOAD` is the entire entry JSON object you constructed.

On 201, parse `id`. Print:
```
✓ Created <id> (<slug> / "<title>")
  $LABHUB_URL/projects/<slug>/entries/<id>
```

### `entry.update`

Resolve `id` from conversation: most recent `e-…` printed by `entry.create` in the **current** conversation. Else ask.

Send only the fields the user wants to change. **If you include `slides` or `artifacts` keys, all existing slides/artifacts will be replaced** — only do this when the user explicitly asks to redo them.

```bash
TOKEN=$(...)
BODY=$(node -e '...build partial body from user input...')
curl -fsS -X PATCH "$LABHUB_URL/api/entries/<id>" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "$BODY"
```

Print: `✓ Updated <id>`.

### `entry.delete`

```bash
TOKEN=$(...)
curl -fsS -X DELETE "$LABHUB_URL/api/entries/<id>" \
  -H "Authorization: Bearer $TOKEN"
```

Print: `✓ Deleted <id>`.

### `entry.list`

```bash
TOKEN=$(...)
RESP=$(curl -fsS "$LABHUB_URL/api/projects/<slug>/entries" -H "Authorization: Bearer $TOKEN")
```

Parse `entries[]` from response. Print up to 10 most recent as a compact list:
```
Recent entries in <slug>:
  e-...   2026-04-26  meeting      "주간 미팅 — temperature"
  e-...   2026-04-19  experiment   "T-sweep round 1"
  ...
```

If more than 10, mention `(<n> more)` after the list.

### `milestone.create`

Required: `projectSlug`, `date`, `label`, `status`.

Status mapping:
- "지난" / "past" / "완료된" → `past`
- "지금" / "now" / "진행 중" → `now`
- "예정" / "future" / "앞으로" → `future`

Default status: `future` if user describes a future event ("다음 달 마감"), otherwise ask.

```bash
TOKEN=$(...)
BODY=$(node -e 'console.log(JSON.stringify({projectSlug:process.argv[1],date:process.argv[2],label:process.argv[3],status:process.argv[4],...(process.argv[5]?{note:process.argv[5]}:{})}))' -- "<slug>" "<date>" "<label>" "<status>" "<note or empty>")
curl -fsS -X POST "$LABHUB_URL/api/milestones" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "$BODY"
```

Print: `✓ Added milestone "<label>" (<status>, <date>) to <slug>`.

### `milestone.update`

Resolve id from conversation or ask. Send only changed fields.

```bash
TOKEN=$(...)
BODY=$(...)
curl -fsS -X PATCH "$LABHUB_URL/api/milestones/<id>" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "$BODY"
```

### `milestone.delete`

```bash
TOKEN=$(...)
curl -fsS -X DELETE "$LABHUB_URL/api/milestones/<id>" \
  -H "Authorization: Bearer $TOKEN"
```

### `milestone.list`

```bash
TOKEN=$(...)
RESP=$(curl -fsS "$LABHUB_URL/api/projects/<slug>/milestones" -H "Authorization: Bearer $TOKEN")
```

Parse `milestones[]`. Print sorted by `position`:
```
Milestones in <slug>:
  [past] 2026-03-01  baseline complete
  [now]  2026-04-15  T-sweep underway
  [future] 2026-05-31  submission
```

### `todo.create`

Required: `projectSlug`, `bucket`, `text`.

Bucket mapping:
- "단기" / "short" / "이번 주" → `short`
- "중기" / "mid" / "이번 달" → `mid`
- "장기" / "long" / "이번 분기" → `long`

If user says just "todo 추가: 데이터 정제 리팩터" without a bucket, default to `short`.

```bash
TOKEN=$(...)
BODY=$(node -e 'console.log(JSON.stringify({projectSlug:process.argv[1],bucket:process.argv[2],text:process.argv[3]}))' -- "<slug>" "<bucket>" "<text>")
curl -fsS -X POST "$LABHUB_URL/api/todos" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "$BODY"
```

Print: `✓ Added todo "<text>" (<bucket>) to <slug>`.

### `todo.update`

Resolve id: only if **exactly one** todo was created in this conversation. Else ask which.

Common case is done-toggle:
```bash
TOKEN=$(...)
curl -fsS -X PATCH "$LABHUB_URL/api/todos/<id>" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"done":true}'
```

Print: `✓ Marked "<text>" as done`.

### `todo.delete`

```bash
TOKEN=$(...)
curl -fsS -X DELETE "$LABHUB_URL/api/todos/<id>" \
  -H "Authorization: Bearer $TOKEN"
```

### `todo.list`

```bash
TOKEN=$(...)
RESP=$(curl -fsS "$LABHUB_URL/api/projects/<slug>/todos" -H "Authorization: Bearer $TOKEN")
```

Print grouped by bucket, separating done from open:
```
Todos in <slug>:
  Short
    [ ] 데이터 정제 스크립트 리팩터
    [x] sweep notebook 작성
  Mid
    [ ] T-ablation 마무리
  Long
    [ ] 다음 venue 결정
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
| 404 | `entry_not_found` | `✗ Entry id not found. Double-check the id.` |
| 404 | `milestone_not_found` | `✗ Milestone id not found.` |
| 404 | `todo_not_found` | `✗ Todo id not found.` |
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
- "그 entry" / "마지막 entry" → most recent `e-…` printed by `entry.create` in this conversation. If absent, ask.
- "그 todo" — only resolvable if **exactly one** was created in this conversation; else ask which.
- Done-toggle ambiguous: "이거 done", but conversation has 3 todos → ask which.
- Entry without explicit `type` from user, no obvious cue → default to `meeting`. If summary clearly says "experiment" or "report" → that.
- Milestone without explicit `status` from user → ask, don't default.
- Todo without explicit bucket → default to `short`.
- Date defaults to today (current local date via `date +%Y-%m-%d` or `new Date().toISOString().slice(0,10)`).

**Bias toward asking over guessing. The user can always answer one
question; recovering from a bogus run created by a wrong guess is harder.**
