# LabHub

**damilab** 내부용 연구 대시보드 — 실험 / 저널 / 마일스톤 / 할 일 / 논문 / 릴리즈
/ 프로젝트별 Wiki를 한 곳에 정리하는 Next.js 앱. 운영 주소
**https://labhub.damilab.cc**.

LabHub는 연구원이 자기 노트북에서 직접 돌리는 Claude Code 플러그인 마켓플레이스도
함께 제공합니다 (3종). 일상의 progress 노트를 대시보드로 자동 동기화해줍니다.

## 안에 뭐가 있나

- **웹앱** — Next.js 16 + Prisma 7 (better-sqlite3 어댑터) + NextAuth (GitHub
  OAuth) + Tailwind. 단일 SQLite 파일 `prisma/dev.db`.
- **REST API** — Bearer-JWT 인증된 `/api/...` 엔드포인트. 토큰은 GitHub Device
  Flow로 발급 (`POST /api/auth/device/exchange`). 스킬에서 호출하는 모든 모델
  (entries / milestones / todos / runs / flow-events / wiki-types /
  wiki-entities)을 커버.
- **3개 스킬** (`skills/` 아래, 각각 별도 Claude Code 플러그인):
  - `labhub` — 실험 run을 채팅에서 기록
  - `labhub-flow-ingest` — `progress_*.md` → Flow J 뷰 (events + task links)
    동기화
  - `labhub-wiki-ingest` — `progress_*.md` → Wiki entity (LLM-merge upsert)
    동기화

## 연구원이 스킬을 처음 깔 때

마켓플레이스는 GitHub 리포 `apple4ree/research_dashboard`에 있습니다.

```bash
# 1) 마켓플레이스 추가
/plugin marketplace add apple4ree/research_dashboard

# 2) 원하는 스킬 설치
/plugin install labhub@labhub
/plugin install labhub-flow-ingest@labhub
/plugin install labhub-wiki-ingest@labhub

# 3) 토큰 한 번만 발급 (~/.config/labhub/token.json 생성)
/labhub login
```

토큰 만료는 길게 잡혀 있어요. ingest 도중 401이 뜨면 `/labhub login` 다시.

## 새 SKILL.md가 풀렸을 때 업데이트하는 법

```bash
# 마켓플레이스 메타데이터를 GitHub에서 다시 받아옴 (이게 핵심)
/plugin marketplace update labhub

# 그 다음 실제 플러그인 갱신
/plugin update labhub-wiki-ingest@labhub

/reload-plugins
```

`/reload-plugins`만으로는 **GitHub fetch가 일어나지 않습니다** — 로컬 캐시만
다시 읽음. marketplace.json의 `version`이 그대로면 캐시 무효화도 안 되니, 새
릴리즈는 항상 마켓플레이스 버전을 올려야 합니다.

캐시가 꼬여서 안 되면:
```bash
/plugin uninstall labhub-wiki-ingest@labhub
/plugin install labhub-wiki-ingest@labhub
```

## 스킬 1: `labhub` (run 로깅)

자연어로 말하면 스킬이 API를 두드립니다.

```
> labhub: 새 run 시작 — tick-agent에 v4 fresh 25-iter
> labhub: 방금 그 run 성공으로 마감, summary는 "fee 벽 0/80 돌파"
```

내부적으로 `POST /api/runs`, `PATCH /api/runs/:id`. 슬러그는 채팅에서 사용자가
언급한 걸 기본값으로 잡고, task / run id는
`GET /api/projects/<slug>/todos`에서 골라옵니다.

## 스킬 2: `labhub-flow-ingest` (Flow J 뷰)

`./progress/<연구원>/progress_<YYYYMMDD>_<HHMM>.md` 형식으로 매일 진행
기록을 쌓는 프로젝트용. 스킬은:

1. `~/.config/labhub/token.json` 읽음
2. `GET /api/projects/<slug>/todos` 와 `/flow-events` 로 기존 컨텍스트 가져옴
3. 현재 디렉터리에서 `./progress/*/progress_*.md` 글롭 → 이미 ingest된 source
   목록과 diff
4. 각 새 파일에 대해: Read 도구로 본문 → LLM이
   `{title, summary, tone, bullets, numbers, taskIds}` 추출 → `POST /api/flow-events`
5. 어떤 event가 들어갔고 어느 task에 묶였는지 요약 보고

멱등(idempotent): 이미 ingest된 파일을 다시 돌려도 변경 없음. 한 파일을
재처리하려면 그 한 건의 페이로드에만 `overwrite: true`로.

```
> labhub-flow-ingest tick-agent
> tick-agent의 progress 정리해줘
```

progress 파일 양식: `docs/progress-format.md` 참고.

## 스킬 3: `labhub-wiki-ingest` (Wiki)

flow의 wiki 짝꿍. 같은 입력 (progress 마크다운)을 받지만, 출력은 잘 정리된 누적
지식 베이스 — 관리자가 정의한 분류(WikiType: 예 `attack`, `defense`,
`concept`)에 묶인 entity들.

1. 토큰 검사 (flow와 동일)
2. `GET /api/projects/<slug>/wiki-types`
   - **비어 있으면?** stop 안 하고 사용자한테 어떤 분류를 만들지 묻고
     `POST /api/wiki-types`로 즉석 생성. 채팅에서 안 나가도 됨.
3. `GET /api/projects/<slug>/wiki-entities` (light list + sourceFiles dedupe용)
4. 로컬 `./progress/*/progress_*.md` 워크 → 이미 어느 entity의 sourceFiles에
   들어가 있는 파일은 제외
5. 각 새 파일에 대해:
   - LLM 1단계: 후보 추출 (기존 entity 매칭 vs 신규 entity 생성)
   - 매칭: `GET .../wiki-entities/<id>` 풀 본문 → LLM 2단계가 기존 본문 + 새
     스니펫을 통합 → `POST /api/wiki-entities` (upsert)
   - 신규: LLM이 type+슬러그+이름 골라서 `POST /api/wiki-entities`

멱등: 각 entity가 자기에게 기여한 파일명들을 `sourceFiles`에 기록.
재실행 시 그 파일들은 건너뜀.

```
> labhub-wiki-ingest tick-agent
> tick-agent의 wiki 정리해줘
```

## 대시보드에서 직접 편집

Flow event와 Wiki entity는 **브라우저에서 바로 수정/삭제** 가능합니다.

- **Flow** (`/projects/<slug>/flow`) — event 카드 우측 상단에 `편집` / `삭제`
  버튼. 편집은 인라인 폼 (제목, 요약, tone, bullets, numbers, 연결된 task).
  삭제는 두 번 클릭 확인.
- **Wiki** (`/projects/<slug>/wiki`) — entity 카드에 호버하면 `편집` / `삭제`
  노출. 상세 페이지(`/wiki/<id>`)에도 동일 버튼. 편집은 별도 페이지
  `/wiki/<id>/edit`로 이동 — 좌측 마크다운 에디터 + 우측 라이브 프리뷰.
- **Wiki types** — `/projects/<slug>/wiki` 상단의 인라인 매니저로 type
  추가/삭제. 같은 동작이 `POST /api/wiki-types` /
  `DELETE /api/projects/<slug>/wiki-types/<key>`로도 노출돼 있어서 스킬 흐름에
  쓸 수 있음.

## Entry artifact 파일 첨부

저널 entry에 외부 URL 대신 **파일을 직접 업로드**할 수 있어요.

- 각 artifact 행을 `🔗 URL` / `📄 File` 토글
- 파일당 **최대 100MB** (Cloudflare 무료 티어 한도. 그 이상은 lab 서버에
  SCP로 직접 옮긴 뒤 URL 모드로 등록하는 게 안전.)
- 저장된 파일은 `prisma/uploads/<entryId>/<artifactId>-<filename>`에
  보관되고 URL은 `/api/uploads/<artifactId>`로 자동 설정 — 인증된 사용자만
  다운로드 가능
- 편집할 때 기존 파일은 메타데이터만 표시. 교체는 "행 삭제 후 재추가" 방식

## 로컬 개발

```bash
pnpm install
pnpm db:push          # prisma/dev.db 생성/업데이트
pnpm dev              # http://localhost:3000

pnpm test             # 전체 Playwright 스위트 (api + cli + smoke)
pnpm typecheck        # tsc --noEmit
pnpm lint             # eslint
pnpm build            # 프로덕션 빌드
```

Node 버전을 바꿨다면 better-sqlite3 네이티브 바인딩을 그 버전에 맞춰
재빌드해야 합니다 (운영 pm2는 Node v20 사용):

```bash
PATH=/usr/bin:$PATH pnpm rebuild better-sqlite3
```

> ⚠️ **주의**: 현재 Playwright 테스트는 운영 `prisma/dev.db`에 직접 씁니다.
> `pnpm test`를 운영 서버에서 돌리면 `testbot` 멤버 + `phase1-test` 프로젝트
> + 2개 wiki type이 다시 시드돼요. 테스트 환경 분리(별도 DB)는 추후 작업
> 항목.

## 배포

운영은 lab 서버에서 pm2 (`labhub-app`)로 돌고, Cloudflare 터널이 TLS
종단 + localhost 프록시. 재배포:

```bash
git push origin main
PATH=/usr/bin:$PATH pnpm build
pm2 restart labhub-app
```

`pm2 restart`만 하면 기존 `.next` 빌드를 그대로 재기동할 뿐입니다 — 새 코드를
반영하려면 반드시 `pnpm build` 먼저.

## 리포 구조

```
app/                  # Next.js app router 페이지 + 라우트 핸들러
  api/                #   - REST 엔드포인트 (Bearer JWT)
  projects/[slug]/    #   - 프로젝트별 페이지 (flow, wiki, papers, …)
components/           # React 컴포넌트, 도메인별
lib/
  actions/            # 서버 액션 (NextAuth 세션 기반)
  api/                # Bearer 인증 헬퍼 + 에러 코드 union
  queries/            # Prisma 읽기 경로
  types.ts            # 공유 TypeScript 타입 (events, models)
prisma/schema.prisma  # 데이터 모델의 단일 출처
prisma/uploads/       # entry artifact 파일 저장소 (gitignored)
scripts/              # 관리용 CLI (예: flow-ingest-cli — 스킬 V1 폴백)
skills/               # Claude Code 플러그인 (스킬당 폴더 1개)
tests/
  api/                # Bearer-API 통합 테스트
  cli/                # CLI 통합 테스트
  smoke/              # Playwright UI 스모크
docs/superpowers/specs # 단계별 설계 스펙
```

## 설계 스펙

각 주요 기능은 **brainstorming → spec → plan → 구현** 순서로 거쳤어요.
스펙 문서들은 `docs/superpowers/specs/`에 남아 있고, 그동안의 결정 맥락
(왜 이렇게 됐는지)을 그대로 보존합니다.

- Phase 5 — `2026-04-27-labhub-flow-ingest-v2.md`
- Phase 6 — `2026-04-27-labhub-wiki-ingest.md`
- Phase 7 — `2026-04-27-flow-wiki-edit.md`

## 운영 / 연락

대시보드 관리자는 **Minseok** (`dgu`). 새로 들어온 lab 멤버는:

1. https://labhub.damilab.cc 에 GitHub 계정으로 로그인
2. Minseok에게 `Member` 행 확인 + 참여 프로젝트 추가 요청
3. 마켓플레이스에서 스킬 설치 후 `/labhub login` 한 번
