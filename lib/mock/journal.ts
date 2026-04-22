import type {
  ResearchEntry,
  Milestone,
  TodoItem,
} from '@/lib/types';

// Ported verbatim from meetings2.html (entries + slides + artifacts).
// Author Korean initials mapped to member logins:
//   전체 → sooyoung (PI represents full lab)
//   김   → jihoon
//   이   → yeji
//   박   → sungmin

export const JOURNAL_PROJECT_SLUG = 'lldm-unlearning';

export const journalEntries: ResearchEntry[] = [
  {
    id: 'e-2026-04-21',
    projectSlug: JOURNAL_PROJECT_SLUG,
    date: '2026-04-21T00:00:00Z',
    type: 'meeting',
    authorLogin: 'sooyoung',
    title: '주간 미팅 — planner 방향 확정',
    summary: 'planner-guided 경로를 주 기법으로 채택. KLASS KL filter는 후처리로 결합.',
    tags: ['meeting', 'planner', 'decision'],
    bodyMarkdown: `# 2026-04-21 주간 미팅

## 참석
지도교수, 김, 이, 박

## 논의
- KLASS 단독은 forget set이 작을 때 retention 저하 큼
- Hierarchy는 학습 비용 1.8배 — 큰 모델엔 부담
- **결론**: planner-guided 경로를 본 방법으로 채택, KLASS의 KL filter를 후처리로 결합

## 액션
- [x] 공용 평가 스크립트 머지
- [ ] planner 초안 PR (이, 2026-04-28까지)
- [ ] 제안 방법 ablation 설계 (박, 다음 미팅까지)`,
    artifacts: [
      { type: 'notebook', title: 'Table 2 재현 노트북', href: '#' },
      { type: 'figure', title: 'retention vs forget size', href: '#' },
      { type: 'sheet', title: '결정 사항 요약 시트', href: '#' },
    ],
    slides: [
      { kind: 'discovery', title: '방법론 방향이 드디어 정해졌다', body: '3주간 3개 후보를 두고 저울질 끝에 planner-guided 경로를 본 논문의 메인 기법으로 채택.', chip: 'decision' },
      { kind: 'failure', title: 'KLASS 단독의 한계', body: 'forget set이 작을수록 retention이 급격히 떨어지는 문제를 재확인. 단독 사용은 부적합.', chip: 'baseline gap' },
      { kind: 'implement', title: 'planner + KL filter 하이브리드', body: 'planner로 경로를 찾고, 마지막에 KLASS의 KL filter를 후처리로 통과시키는 2-stage 구조.' },
      { kind: 'question', title: 'Hierarchy는 왜 뺐나', body: '학습 비용 1.8배는 큰 모델로 확장할 때 치명적. 다만 ablation에는 포함해서 비교해야 함.' },
      { kind: 'next', title: '이번 주 액션', body: 'planner 초안 PR (이, 4/28), 제안 방법 ablation 설계 (박). 공용 평가 스크립트는 머지 완료.', chip: 'D-7' },
    ],
  },
  {
    id: 'e-2026-04-18',
    projectSlug: JOURNAL_PROJECT_SLUG,
    date: '2026-04-18T00:00:00Z',
    type: 'experiment',
    authorLogin: 'sungmin',
    title: 'Hierarchy Fig2 하이퍼파라미터 스윕',
    summary: 'depth=3 / lr=1e-4에서 원 논문 수치 재현. 논문과의 차이는 하이퍼파라미터가 원인.',
    tags: ['experiment', 'hierarchy', 'sweep'],
    bodyMarkdown: `# Hierarchy Fig2 재현 실험 (2026-04-18)

| depth | lr | retention | forget |
|------:|---:|----------:|-------:|
| 2 | 1e-4 | 0.71 | 0.38 |
| 3 | 1e-4 | **0.82** | **0.15** |
| 3 | 3e-4 | 0.79 | 0.12 |
| 4 | 1e-4 | 0.80 | 0.11 |

**결론**: 원 논문과의 차이는 코드 버그가 아니라 하이퍼파라미터 차이.`,
    artifacts: [
      { type: 'notebook', title: 'sweep_hierarchy.ipynb', href: '#' },
      { type: 'figure', title: 'heatmap (depth × lr)', href: '#' },
      { type: 'figure', title: 'retention curve', href: '#' },
      { type: 'csv', title: '결과 CSV', href: '#' },
    ],
    slides: [
      { kind: 'discovery', title: '논문 수치를 재현했다', body: 'depth=3, lr=1e-4 조합에서 원 논문 Table 2와 거의 일치. 그동안의 재현 실패는 코드가 아니라 하이퍼파라미터였다.', chip: 'reproduced ✓' },
      { kind: 'failure', title: '3주를 태운 착각', body: '처음엔 mask 구현에 버그가 있다고 의심해서 코드를 세 번 다시 썼음. 실제로는 lr 3e-4가 과하게 잊어서 생긴 결과.', chip: 'lesson' },
      { kind: 'metric', title: '스윕 결과', body: '8개 조합 중 depth=3 / lr=1e-4가 retention/forget 균형 최고.', metrics: [{ b: '0.82', s: 'retention ↑' }, { b: '0.15', s: 'forget ↓' }] },
      { kind: 'implement', title: '재현 노트북 공개', body: 'sweep_hierarchy.ipynb에 전체 그리드 + heatmap 포함. 다른 backbone으로 재실행 가능한 스캐폴드.', chip: 'notebook' },
      { kind: 'question', title: '다른 backbone에서도 같을까', body: 'base → large로 가면 optimal (depth, lr)가 바뀔 가능성. 다음 주 동일 스윕 반복 예정.' },
      { kind: 'next', title: '다음', body: 'base → large backbone 스윕, 결과를 공용 평가 스크립트로 정리. 주간 미팅에 올리기.' },
    ],
  },
  {
    id: 'e-2026-04-14',
    projectSlug: JOURNAL_PROJECT_SLUG,
    date: '2026-04-14T00:00:00Z',
    type: 'meeting',
    authorLogin: 'sooyoung',
    title: '주간 미팅 — 논문 3편 리뷰 공유',
    summary: 'klass / hierarchy / papl 비교표 작성. 본 과제 포지션 논의.',
    tags: ['meeting', 'survey'],
    bodyMarkdown: `# 2026-04-14 주간 미팅

## 3편 비교
| 논문 | 핵심 | 한계 |
|------|------|------|
| KLASS (NeurIPS'25) | KL 거리로 필터 | 대규모 비용 |
| Hierarchy (ICLR'26) | 계층별 masking | 학습 시간 ↑ |
| PAPL (preprint) | planner로 경로 결정 | 수렴 불안정 |

## 결정
본 과제 = **PAPL 구조 + KLASS 후처리**`,
    artifacts: [
      { type: 'figure', title: '3편 비교 다이어그램', href: '#' },
      { type: 'doc', title: '서베이 노트 (Notion)', href: '#' },
    ],
    slides: [
      { kind: 'discovery', title: '세 방법은 서로 보완한다', body: 'KLASS는 filter, Hierarchy는 masking, PAPL은 planner — 같은 문제를 다른 축에서 접근.', chip: 'survey' },
      { kind: 'implement', title: '비교표 완성', body: '핵심 아이디어 / 한계 / 우리가 차용할 부분까지 한 페이지에 정리. Notion에 공유.' },
      { kind: 'question', title: '우리의 포지션은?', body: '단순 조합이 기여라고 할 수 있을까? → planner action space를 KLASS가 제약한다는 프레이밍이 필요.', chip: 'framing' },
      { kind: 'next', title: '다음 미팅까지', body: '각자 할당된 재현 실험 → 4/21에 결과 공유.' },
    ],
  },
  {
    id: 'e-2026-04-10',
    projectSlug: JOURNAL_PROJECT_SLUG,
    date: '2026-04-10T00:00:00Z',
    type: 'report',
    authorLogin: 'yeji',
    title: '공용 평가 스크립트 eval_common.py 설계',
    summary: 'retention / forget / MMLU 3축 동시 측정. 출력 포맷 통일.',
    tags: ['infra', 'evaluation'],
    bodyMarkdown: `# eval_common.py 설계안

\`\`\`bash
python eval_common.py --model path/to/ckpt --forget_set A --retain_set mmlu --out results.json
\`\`\`

## 출력
\`\`\`json
{"retention": 0.82, "forget_rate": 0.15, "mmlu_5shot": 0.61}
\`\`\`

## 남은 이슈
diffusion LM의 log-likelihood 계산이 느림 → 배치 처리 최적화 필요.`,
    artifacts: [
      { type: 'notebook', title: '설계 노트북', href: '#' },
      { type: 'doc', title: 'PR draft #42', href: '#' },
    ],
    slides: [
      { kind: 'discovery', title: '평가가 제각각이다', body: '논문마다 forget/retain 정의가 달라서 비교가 안 되는 게 본질적 문제였다.' },
      { kind: 'implement', title: '3축 동시 측정 스크립트', body: 'retention, forget_rate, MMLU 5-shot을 한번에 계산해서 JSON으로 출력. 모든 베이스라인이 같은 인터페이스.', chip: 'infra' },
      { kind: 'failure', title: 'log-likelihood가 느리다', body: 'diffusion LM은 autoregressive와 달라서 per-token likelihood 계산이 10배 느림. 배치 최적화 필요.', chip: 'bottleneck' },
      { kind: 'question', title: 'MMLU만으로 충분?', body: 'utility 축을 MMLU 하나로 두면 over-fitting 위험. TruthfulQA도 넣자는 의견.' },
      { kind: 'next', title: '머지 후 할 일', body: '배치 최적화 → 팀원 전원이 같은 스크립트로 결과 재생성 → 4/21 미팅에서 합치기.' },
    ],
  },
  {
    id: 'e-2026-04-07',
    projectSlug: JOURNAL_PROJECT_SLUG,
    date: '2026-04-07T00:00:00Z',
    type: 'review',
    authorLogin: 'jihoon',
    title: 'PAPL planner 동작 원리 정리',
    summary: 'state-action-reward 구조. 수렴 불안정 원인 분석.',
    tags: ['review', 'papl', 'planner'],
    bodyMarkdown: `# PAPL planner 리뷰

## 구조
1. state = (모델 가중치 snapshot, forget set 통계)
2. action = 다음 업데이트 스텝 선택
3. reward = retention − α · forget_rate

## 문제
- action space가 커서 초기 에피소드에서 수렴 느림
- 해결안: action 템플릿 제한 (우리 방법에서 시도)`,
    artifacts: [
      { type: 'figure', title: 'PAPL 구조도', href: '#' },
      { type: 'doc', title: '원문 PDF 주석본', href: '#' },
    ],
    slides: [
      { kind: 'discovery', title: 'planner는 MDP로 모델링돼있다', body: 'state, action, reward가 명시적. 이전에 헷갈렸던 "planner가 뭘 한다는거지?"의 답.', chip: 'insight' },
      { kind: 'failure', title: '수렴이 불안정한 이유', body: 'action space가 너무 커서 초기 random policy가 의미있는 신호를 못 얻음. 논문 저자도 appendix에서 인정.' },
      { kind: 'implement', title: '우리의 아이디어', body: 'action을 KLASS가 허용하는 방향으로만 제한 → search space 축소 → 수렴 가능성 ↑', chip: 'our angle' },
      { kind: 'question', title: 'action 제한이 expressiveness를 죽이진 않나', body: '최적 action이 제한 영역 밖에 있으면 답이 안 나옴. 어떻게 실험으로 확인할지?' },
    ],
  },
  {
    id: 'e-2026-04-02',
    projectSlug: JOURNAL_PROJECT_SLUG,
    date: '2026-04-02T00:00:00Z',
    type: 'experiment',
    authorLogin: 'jihoon',
    title: 'KLASS KL filter temperature 스윕',
    summary: 'T=1.0 부근 최적. 작으면 과제거, 크면 불충분.',
    tags: ['experiment', 'klass'],
    bodyMarkdown: `# KLASS KL filter temp 스윕

| T | retention | forget |
|---|-----------|--------|
| 0.5 | 0.65 | 0.08 |
| 1.0 | **0.80** | **0.16** |
| 2.0 | 0.83 | 0.31 |

**T=1.0 ± 0.3 범위** 운용 권장.`,
    artifacts: [
      { type: 'figure', title: 'trade-off curve', href: '#' },
      { type: 'notebook', title: 'klass_temp_sweep.ipynb', href: '#' },
    ],
    slides: [
      { kind: 'metric', title: 'temperature 3개 비교', body: 'T ∈ {0.5, 1.0, 2.0}. T=1.0에서 retention/forget 균형 최고.', metrics: [{ b: 'T=1.0', s: 'sweet spot' }, { b: '0.80 / 0.16', s: 'ret / forget' }] },
      { kind: 'failure', title: 'T=0.5는 과제거', body: 'forget rate는 0.08로 낮지만 retention도 0.65로 무너짐. 너무 공격적으로 지움.' },
      { kind: 'failure', title: 'T=2.0은 불충분', body: 'retention은 유지되지만 forget이 0.31 — 지우려던 게 남아있음.' },
      { kind: 'discovery', title: '실용 운용 범위', body: 'T=1.0 ± 0.3이 안전 영역. 방법론 섹션에 recommendation으로 기재 예정.', chip: 'recipe' },
      { kind: 'next', title: '다음 실험', body: 'T를 학습 과정에서 동적으로 조절하는 schedule 테스트.' },
    ],
  },
  {
    id: 'e-2026-03-28',
    projectSlug: JOURNAL_PROJECT_SLUG,
    date: '2026-03-28T00:00:00Z',
    type: 'meeting',
    authorLogin: 'sooyoung',
    title: '월간 미팅 — 범위 재조정',
    summary: '개인정보 케이스 스터디 2건을 평가 시나리오로 추가.',
    tags: ['meeting', 'scope'],
    bodyMarkdown: `# 2026-03-28 월간 미팅

## 결정
- 평가 시나리오에 개인정보 케이스 스터디 2건 추가
  - (1) 이름 + 주소 패턴
  - (2) 의료 기록 일부
- 법적/윤리 이슈는 연구윤리위 자문 후 공개 데이터셋만 사용

## 리스크
개인정보 데이터셋 확보 — 2주 내 후보 리스트업`,
    artifacts: [
      { type: 'doc', title: '연구윤리 체크리스트', href: '#' },
    ],
    slides: [
      { kind: 'discovery', title: '평가가 "학술적"이기만 하면 약하다', body: '실제 unlearning 수요는 개인정보 제거. 이걸 다루지 않으면 리뷰어 Q1이 올 것.', chip: 'scope' },
      { kind: 'implement', title: '케이스 스터디 2건 추가', body: '(1) 이름+주소 패턴, (2) 의료 기록 일부. 공개 데이터셋만 사용하기로.' },
      { kind: 'question', title: '윤리 이슈 어떻게 넘나', body: '실제 개인정보를 쓸 수 없으니 합성 or 공개된 PII-like 데이터로 제한. 연구윤리위 자문 필요.' },
      { kind: 'next', title: '2주 내 액션', body: '데이터셋 후보 리스트업 + 윤리위 체크리스트 제출.' },
    ],
  },
  {
    id: 'e-2026-03-24',
    projectSlug: JOURNAL_PROJECT_SLUG,
    date: '2026-03-24T00:00:00Z',
    type: 'report',
    authorLogin: 'sungmin',
    title: '세미나 발표: evaluation protocols',
    summary: 'unlearning 평가 통일 프로토콜 제안.',
    tags: ['seminar', 'evaluation'],
    bodyMarkdown: `# 세미나: Unlearning Evaluation Protocols

- 논문마다 forget/retain/utility 정의가 제각각
- 제안: **3축 동시 공개** (retention, forget rate, downstream utility)
- 데이터셋: MMLU, TruthfulQA, 자체 forget set

## 반응
지도교수: 좋은 출발. 논문의 contribution 한 꼭지로 쓸 수 있음.`,
    artifacts: [
      { type: 'slide', title: '세미나 슬라이드 (Marp)', href: '#' },
    ],
    slides: [
      { kind: 'discovery', title: '발표 준비하며 알게 된 것', body: '평가 통일 자체가 본 논문의 부차적 기여(contribution)로 충분히 쓸 수 있다는 피드백.', chip: 'contribution' },
      { kind: 'implement', title: '3축 프로토콜 제안', body: 'retention · forget rate · downstream utility를 모든 논문이 공개하자는 플랫폼 제안.' },
      { kind: 'next', title: '논문 초고 섹션', body: 'Section 4에 evaluation protocol을 독립 섹션으로 넣기로. 세미나 피드백 반영.' },
    ],
  },
];

export const journalMilestones: Milestone[] = [
  { id: 0, date: '2025-11-01T00:00:00Z', label: '문제 정의', note: 'diffusion LM unlearning', status: 'past', position: 0 },
  { id: 0, date: '2025-12-01T00:00:00Z', label: '서베이 & 리뷰', note: 'klass / hierarchy / papl', status: 'past', position: 1 },
  { id: 0, date: '2026-01-01T00:00:00Z', label: '베이스라인 재현', note: 'KLASS Table 2', status: 'past', position: 2 },
  { id: 0, date: '2026-04-01T00:00:00Z', label: '제안 방법 설계', note: 'planner + KL filter 결합', status: 'now', position: 3 },
  { id: 0, date: '2026-06-01T00:00:00Z', label: '본실험', note: 'MMLU retention eval', status: 'future', position: 4 },
  { id: 0, date: '2026-09-01T00:00:00Z', label: '논문 작성', note: 'ICML 2026', status: 'future', position: 5 },
];

export const journalTodos: TodoItem[] = [
  // short (단기)
  { id: 0, bucket: 'short', text: 'KLASS Table 2 재현 차이 원인 분석', done: true, position: 0 },
  { id: 0, bucket: 'short', text: '공용 평가 스크립트 eval_common.py', done: true, position: 1 },
  { id: 0, bucket: 'short', text: 'Hierarchy Fig2 하이퍼파라미터 스윕', done: true, position: 2 },
  { id: 0, bucket: 'short', text: 'planner-guided unlearning 초안 PR', done: false, position: 3 },
  { id: 0, bucket: 'short', text: '다음 주 세미나 슬라이드 (박)', done: false, position: 4 },
  // mid (중기)
  { id: 0, bucket: 'mid', text: '베이스라인 3종 통합 벤치', done: true, position: 0 },
  { id: 0, bucket: 'mid', text: '제안 방법 ablation 설계 (forget set × KL temp)', done: false, position: 1 },
  { id: 0, bucket: 'mid', text: 'MMLU / TruthfulQA retention 파이프라인', done: false, position: 2 },
  { id: 0, bucket: 'mid', text: '개인정보 시나리오 케이스 스터디 2건', done: false, position: 3 },
  // long (장기)
  { id: 0, bucket: 'long', text: 'ICML 2026 submission (2026-02-04)', done: false, position: 0 },
  { id: 0, bucket: 'long', text: '코드 & 모델 공개 (MIT)', done: false, position: 1 },
  { id: 0, bucket: 'long', text: '후속 주제: multi-task unlearning', done: false, position: 2 },
];
