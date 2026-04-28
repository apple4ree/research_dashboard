import type { PaperStage, DiscussionCategory, EntryType, SlideKind, TodoBucket } from './types';

export const PAPER_STAGE_LABELS: Record<PaperStage, string> = {
  idea: 'Idea',
  experiments: 'Running experiments',
  writing: 'Writing',
  review: 'Under review',
  published: 'Published',
};

export const PAPER_STAGE_ORDER: PaperStage[] = ['idea', 'experiments', 'writing', 'review', 'published'];

export const PAPER_STAGE_TONE: Record<PaperStage, 'neutral' | 'attention' | 'accent' | 'done' | 'success'> = {
  idea: 'neutral',
  experiments: 'attention',
  writing: 'accent',
  review: 'done',
  published: 'success',
};

export const DISCUSSION_CATEGORY_LABELS: Record<DiscussionCategory, string> = {
  announcements: 'Announcements',
  journal_club: 'Journal Club',
  qa: 'Q&A',
  ideas: 'Ideas',
};

export const DISCUSSION_CATEGORY_ICONS: Record<DiscussionCategory, string> = {
  announcements: '📣',
  journal_club: '📚',
  qa: '❓',
  ideas: '💡',
};

export const DISCUSSION_CATEGORY_TONE: Record<DiscussionCategory, 'neutral' | 'accent' | 'done' | 'attention'> = {
  announcements: 'attention',
  journal_club: 'accent',
  qa: 'neutral',
  ideas: 'done',
};

export const DISCUSSION_CATEGORY_ORDER: DiscussionCategory[] = ['announcements', 'journal_club', 'qa', 'ideas'];

// ========== Notices (site-wide changelog / announcements) ==========

export type NoticeCategory = 'update' | 'feature' | 'fix' | 'announcement';

export const NOTICE_CATEGORY_LABELS: Record<NoticeCategory, string> = {
  update: '업데이트',
  feature: '새 기능',
  fix: '수정',
  announcement: '공지',
};

export const NOTICE_CATEGORY_ICONS: Record<NoticeCategory, string> = {
  update: '🔄',
  feature: '✨',
  fix: '🛠',
  announcement: '📣',
};

export const NOTICE_CATEGORY_TONE: Record<NoticeCategory, 'neutral' | 'accent' | 'done' | 'attention' | 'success'> = {
  update: 'neutral',
  feature: 'success',
  fix: 'attention',
  announcement: 'accent',
};

export const NOTICE_CATEGORY_ORDER: NoticeCategory[] = ['announcement', 'feature', 'update', 'fix'];

// ========== Research Journal ==========

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  meeting: '회의록',
  report: '개별 보고',
  experiment: '실험 결과',
  review: '논문 리뷰',
};

export const ENTRY_TYPE_TONE: Record<EntryType, 'attention' | 'accent' | 'success' | 'done'> = {
  meeting: 'attention',
  report: 'accent',
  experiment: 'success',
  review: 'done',
};

export const ENTRY_TYPE_ORDER: EntryType[] = ['meeting', 'report', 'experiment', 'review'];

export const ENTRY_TYPE_STRIP_BG: Record<EntryType, string> = {
  meeting: 'bg-attention-emphasis',
  report: 'bg-accent-emphasis',
  experiment: 'bg-success-emphasis',
  review: 'bg-done-emphasis',
};

export const SLIDE_KIND_STRIP_BG: Record<SlideKind, string> = {
  discovery: 'bg-accent-emphasis',
  failure: 'bg-danger-emphasis',
  implement: 'bg-success-emphasis',
  question: 'bg-attention-emphasis',
  next: 'bg-neutral-emphasis',
  metric: 'bg-done-emphasis',
};

export const SLIDE_KIND_LABEL: Record<SlideKind, string> = {
  discovery: 'DISCOVERY',
  failure: 'FAILURE',
  implement: 'IMPLEMENT',
  question: 'QUESTION',
  next: 'NEXT',
  metric: 'METRIC',
};

export const SLIDE_KIND_ICON: Record<SlideKind, string> = {
  discovery: '💡',
  failure: '⚠',
  implement: '🛠',
  question: '?',
  next: '→',
  metric: '📊',
};

export const TODO_BUCKET_LABELS: Record<TodoBucket, string> = {
  short: '단기 (1주)',
  mid: '중기 (1개월)',
  long: '장기 (학기~학회)',
};

export const TODO_BUCKET_ORDER: TodoBucket[] = ['short', 'mid', 'long'];
