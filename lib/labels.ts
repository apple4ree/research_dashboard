import type { PaperStage } from './types';

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
