# Skill Automation — Phase 1 (API + Device Flow Auth)

**Date:** 2026-04-26
**Status:** Design approved, ready for implementation plan

## Motivation

LabHub는 현재 모든 데이터를 사람이 UI를 통해 입력해야 한다. 연구실
사용자는 이미 Claude Code를 일상적으로 사용하고 있으므로, 데이터 입력을
Claude Code skill로 자동화하면 손쉽게 채워질 수 있다.

본 Phase는 그 첫 단계로, **LabHub에 외부 API와 인증 인프라를 추가**한다.
Skill 자체는 Phase 2에서 구현한다.

## Goals

1. Claude Code skill이 LabHub에 ExperimentRun을 생성/갱신할 수 있는
   REST API endpoint 제공.
2. GitHub Device Flow로 인증해서 사용자에게 토큰 복붙 부담을 주지
   않음.
3. 인증된 사용자를 LabHub Member에 매핑. GitHub login으로 매칭, 없으면
   auto-create.

## Non-goals

- Skill 자체 구현 (Phase 2).
- Project metadata sync (GitHub webhook 없이 가기로 결정함, Phase 3).
- Journal entry 자동 생성 (Phase 5).

## Architecture

```
[Skill] ──device flow──> [GitHub OAuth]
   │                          │
   │ ─── github_access_token ─┘
   │
   │ POST /api/auth/device/exchange
   │   { github_access_token }
   │
   ▼
[LabHub] ─── verify with GitHub ───> [GitHub /user]
   │
   │ Member lookup by githubLogin (or auto-create)
   │ Issue self-signed JWT (30-day expiry)
   │
   ◄── { token, expiresAt, member }
   │
   │ POST /api/runs   Authorization: Bearer <JWT>
   │   { name, projectSlug, status, summary?, durationSec? }
   │
   ▼
[LabHub] ─── verify JWT ───> resolve memberLogin
   │
   │ Create ExperimentRun, logActivity
   │
   ◄── { id }
```

JWT를 쓰는 이유는 매 요청마다 GitHub API를 부르지 않기 위함. JWT는
LabHub가 자체 secret으로 sign한다.

## GitHub OAuth App

기존 NextAuth용 OAuth App과는 별도의 "LabHub CLI" OAuth App을 만든다.

- Application name: `LabHub CLI`
- Device Flow: enabled
- Scopes: `read:user` (이메일/login 읽기 전용)
- 환경변수: `LABHUB_CLI_GITHUB_CLIENT_ID`

별도 App을 두는 이유는 (1) 사용자에게 "labhub-cli"라는 별도 ID가
보이고, (2) 권한 scope를 따로 관리할 수 있기 때문.

## Schema additions

기존 `Member` 모델에는 변경 없음 (`githubLogin` 컬럼이 이미 있음).

신규 테이블 없음. JWT는 stateless이므로 서버 저장 불필요.

## API endpoints

### POST `/api/auth/device/exchange`

**Auth**: 없음 (이게 인증 시작점).

**Request**:
```json
{ "github_access_token": "gho_..." }
```

**Behavior**:
1. GitHub `/user` 호출로 token verify. 실패하면 401.
2. 응답에서 `login`, `name`, `email`, `avatar_url` 추출.
3. `Member.findUnique({ where: { githubLogin: login } })`.
4. 없으면 auto-create:
   - `login`: GitHub login을 lowercase + slugify
   - `displayName`: GitHub `name`이 있으면 그것, 없으면 `login`
   - `role`: 기본값 `PhD`
   - `githubLogin`: GitHub login
   - `email`: GitHub email (있으면)
   - `avatarUrl`: GitHub avatar URL
   - `pinnedProjectSlugs`: `"[]"`
5. JWT 발급:
   - payload: `{ memberLogin, iat, exp }`
   - exp: 30일
   - sign: `LABHUB_JWT_SECRET`
6. Response.

**Response 200**:
```json
{
  "token": "eyJ...",
  "expiresAt": "2026-05-26T...",
  "member": { "login": "dgu", "displayName": "Dongyu" }
}
```

### POST `/api/runs`

**Auth**: `Authorization: Bearer <JWT>`.

**Request**:
```json
{
  "name": "klass-temp-sweep",
  "projectSlug": "klass-unlearning",
  "status": "in_progress",
  "summary": "T={0.5, 1.0, 2.0}",
  "durationSec": null
}
```

**Behavior**:
1. JWT verify, 실패시 401.
2. `memberLogin`이 Member에 존재하는지 확인. 없으면 401.
3. `Project.findUnique({ slug })`. 없으면 404 with helpful message:
   `"Project '{slug}' not found in LabHub. Create it via UI first or
    pass --project=<existing-slug>."`
4. `ExperimentRun.create`. ID는 `exp-<base36 timestamp>`.
5. `logActivity({ type: 'experiment', actorLogin, projectSlug,
   payload: { runId, action: 'started' } })`.
6. Response.

**Response 201**:
```json
{ "id": "exp-..." }
```

### PATCH `/api/runs/:id`

**Auth**: `Authorization: Bearer <JWT>`.

**Request** (모든 필드 optional):
```json
{
  "status": "success",
  "durationSec": 3600,
  "summary": "T=1.0 best (retention 0.80)"
}
```

**Behavior**:
1. JWT verify, 실패시 401.
2. `memberLogin`이 Member에 존재하는지 확인. 없으면 401.
3. Run 존재 확인. 없으면 404.
4. **Authorization 정책**: 인증된 모든 Member는 임의의 run을 수정할 수
   있음. 본인 소유 검증 없음.
5. Update.
6. status가 변경됐으면 `logActivity` (action: succeeded/failed/cancelled).
   `actorLogin`은 *수정한 사람* (`jwt.memberLogin`), run의
   `triggeredByLogin`이 아님 — 즉 다른 사람의 run을 cancel하면
   activity feed에 "X cancelled Y's run"으로 표시됨.
7. Response.

**Response 200**: 업데이트된 run의 도메인 객체.

### GET `/api/me`

**Auth**: `Authorization: Bearer <JWT>`.

스킬이 토큰 유효성 + 현재 멤버 정보 확인용으로 호출.

**Response 200**:
```json
{ "login": "dgu", "displayName": "Dongyu", "role": "PhD" }
```

## JWT specifics

- Library: `jose` (이미 NextAuth가 의존성으로 끌고 옴, 추가 설치 불필요).
- Algorithm: HS256.
- Secret: `LABHUB_JWT_SECRET` 환경변수, openssl로 생성한 32바이트 random.
- Claims: `{ sub: memberLogin, iat, exp }`. `aud`/`iss` 추가 가능하지만
  단일 deploy라 생략.

## Security considerations

- JWT secret은 `.env.local`에만 두고 절대 commit 안 함.
- Device flow exchange endpoint는 rate limit 필요 (10/min/IP). 일단
  Phase 1에서는 생략, 추후 reverse proxy 레벨에서 처리.
- HTTPS 필수. 사내 deploy라도 self-signed라도 TLS는 켜야 함.
- API endpoint는 `revalidatePath` 호출. 단, server actions와 달리
  redirect 안 함 (JSON response).

## Acceptance criteria

- `LABHUB_CLI_GITHUB_CLIENT_ID`, `LABHUB_JWT_SECRET` `.env.example`에 등록.
- `pnpm db:migrate`는 변경 없음 (schema 추가 없음).
- 다음 시나리오가 curl로 통과:
```bash
  # 1. 시뮬레이션: 이미 GitHub token이 있다고 가정
  TOKEN=$(curl -s -X POST localhost:3000/api/auth/device/exchange \
    -H 'Content-Type: application/json' \
    -d '{"github_access_token":"<test-token>"}' | jq -r .token)

  # 2. /api/me 호출
  curl -s localhost:3000/api/me -H "Authorization: Bearer $TOKEN"
  # → { "login": "...", ... }

  # 3. Run 생성
  curl -s -X POST localhost:3000/api/runs \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d '{"name":"test","projectSlug":"<existing>","status":"in_progress"}'
  # → { "id": "exp-..." }

  # 4. Run 종료
  curl -s -X PATCH localhost:3000/api/runs/exp-... \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d '{"status":"success","durationSec":120}'
```
- `pnpm build` clean.
- `pnpm exec tsc --noEmit` clean.
- 새 Playwright 테스트 추가:
  - `tests/api/auth-flow.spec.ts`: GitHub `/user`를 mock fetch로 stub해서
    device exchange → /api/me 흐름 테스트.
  - `tests/api/runs.spec.ts`: JWT 발급 후 run 생성/본인 run 업데이트/
    타인 run 업데이트(허용됨)/잘못된 JWT 거부.
- 기존 32개 Playwright 테스트 모두 pass.

## Out-of-scope (later phases)

- Skill 자체 (Phase 2).
- `/api/releases`, `/api/papers` POST endpoint (Phase 3, 4).
- Refresh token (Phase 1에선 만료시 재 device flow).
- Rate limiting (Phase 1에선 신뢰 환경 가정).