import type { EntryType, SlideKind, ArtifactType, MilestoneStatus, TodoBucket } from '@/lib/types';
import type { TaskStatus } from '@/lib/types/flow';

export const ENTRY_TYPES: readonly EntryType[] = ['meeting', 'report', 'experiment', 'review'];
export const SLIDE_KINDS: readonly SlideKind[] = ['discovery', 'failure', 'implement', 'question', 'next', 'metric'];
export const ARTIFACT_TYPES: readonly ArtifactType[] = ['notebook', 'figure', 'sheet', 'csv', 'doc', 'slide'];
export const MILESTONE_STATUSES: readonly MilestoneStatus[] = ['past', 'now', 'future'];
export const TODO_BUCKETS: readonly TodoBucket[] = ['short', 'mid', 'long'];
export const TASK_STATUSES: readonly TaskStatus[] = ['pending', 'in_progress', 'done'];

export function isEntryType(s: unknown): s is EntryType {
  return typeof s === 'string' && (ENTRY_TYPES as readonly string[]).includes(s);
}
export function isSlideKind(s: unknown): s is SlideKind {
  return typeof s === 'string' && (SLIDE_KINDS as readonly string[]).includes(s);
}
export function isArtifactType(s: unknown): s is ArtifactType {
  return typeof s === 'string' && (ARTIFACT_TYPES as readonly string[]).includes(s);
}
export function isMilestoneStatus(s: unknown): s is MilestoneStatus {
  return typeof s === 'string' && (MILESTONE_STATUSES as readonly string[]).includes(s);
}
export function isTodoBucket(s: unknown): s is TodoBucket {
  return typeof s === 'string' && (TODO_BUCKETS as readonly string[]).includes(s);
}
export function isTaskStatus(s: unknown): s is TaskStatus {
  return typeof s === 'string' && (TASK_STATUSES as readonly string[]).includes(s);
}
