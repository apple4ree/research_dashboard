'use server';

import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import type {
  EventType,
  PaperEventAction,
  ExperimentEventAction,
  ReleaseEventAction,
  DiscussionEventAction,
  ProjectEventAction,
  EntryEventAction,
  MilestoneEventAction,
  TodoEventAction,
  UserLogin,
  Slug,
} from '@/lib/types';

type PayloadFor<T extends EventType> =
  T extends 'paper' ? { paperId: string; action: PaperEventAction; version?: number } :
  T extends 'experiment' ? { runId: string; action: ExperimentEventAction } :
  T extends 'release' ? { releaseId: string; action: ReleaseEventAction } :
  T extends 'discussion' ? { discussionId: string; action: DiscussionEventAction } :
  T extends 'project' ? { action: ProjectEventAction } :
  T extends 'entry' ? { entryId: string; action: EntryEventAction } :
  T extends 'milestone' ? { milestoneId: number; action: MilestoneEventAction } :
  T extends 'todo' ? { todoId: number; action: TodoEventAction } :
  never;

/**
 * Insert an ActivityEvent row so the Dashboard "Recent activity" feed picks it up.
 * Fire-and-forget safe: caller can await or not. Never throws — logs failure and returns.
 */
export async function logActivity<T extends EventType>(args: {
  type: T;
  actorLogin: UserLogin;
  projectSlug?: Slug;
  payload: PayloadFor<T>;
  createdAt?: Date;
}): Promise<void> {
  try {
    await prisma.activityEvent.create({
      data: {
        id: `e-${Math.floor(Date.now() / 1000).toString(36)}-${randomUUID().slice(0, 4)}`,
        type: args.type,
        actorLogin: args.actorLogin,
        projectSlug: args.projectSlug,
        payload: JSON.stringify(args.payload),
        createdAt: args.createdAt ?? new Date(),
      },
    });
  } catch (err) {
    // Activity logging must not block the primary action. Log and continue.
    console.error('[logActivity] failed', err);
  }
}

