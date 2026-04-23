'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { CURRENT_USER } from '@/lib/queries/constants';
import type { DiscussionCategory } from '@/lib/types';
import { logActivity } from './events';

const CATEGORY_VALUES: readonly DiscussionCategory[] = ['announcements', 'journal_club', 'qa', 'ideas'];

export type CreateDiscussionState = { error?: string } | null;

export async function createDiscussion(
  _prev: CreateDiscussionState,
  formData: FormData,
): Promise<CreateDiscussionState> {
  const category = String(formData.get('category') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  const projectSlugRaw = String(formData.get('projectSlug') ?? '').trim();
  const projectSlug = projectSlugRaw || null;

  if (!title) return { error: 'Title is required.' };
  if (!body) return { error: 'Body is required.' };
  if (!CATEGORY_VALUES.includes(category as DiscussionCategory)) {
    return { error: `Invalid category "${category}".` };
  }
  if (projectSlug) {
    const project = await prisma.project.findUnique({ where: { slug: projectSlug } });
    if (!project) return { error: `Project "${projectSlug}" not found.` };
  }

  const id = `d-${randomUUID().slice(0, 8)}`;
  const now = new Date();

  await prisma.discussion.create({
    data: {
      id,
      category,
      title,
      authorLogin: CURRENT_USER,
      projectSlug,
      createdAt: now,
      lastActivityAt: now,
      replyCount: 0,
      bodyMarkdown: body,
    },
  });

  await logActivity({
    type: 'discussion',
    actorLogin: CURRENT_USER,
    projectSlug: projectSlug ?? undefined,
    payload: { discussionId: id, action: 'opened' },
  });

  revalidatePath('/discussions');
  if (projectSlug) revalidatePath(`/projects/${projectSlug}/discussions`);
  revalidatePath('/');
  redirect(`/discussions/${id}`);
}

export type CreateReplyState = { error?: string } | null;

export async function createReply(
  discussionId: string,
  _prev: CreateReplyState,
  formData: FormData,
): Promise<CreateReplyState> {
  const body = String(formData.get('body') ?? '').trim();
  if (!body) return { error: 'Reply cannot be empty.' };

  const discussion = await prisma.discussion.findUnique({ where: { id: discussionId } });
  if (!discussion) return { error: `Discussion ${discussionId} not found.` };

  const now = new Date();
  const nextPosition = await prisma.reply.count({ where: { discussionId } });

  await prisma.$transaction([
    prisma.reply.create({
      data: {
        discussionId,
        authorLogin: CURRENT_USER,
        createdAt: now,
        bodyMarkdown: body,
        position: nextPosition,
      },
    }),
    prisma.discussion.update({
      where: { id: discussionId },
      data: { replyCount: { increment: 1 }, lastActivityAt: now },
    }),
  ]);

  await logActivity({
    type: 'discussion',
    actorLogin: CURRENT_USER,
    payload: { discussionId, action: 'replied' },
  });

  revalidatePath(`/discussions/${discussionId}`);
  revalidatePath('/discussions');
  revalidatePath('/');
  return null;
}

export type UpdateDiscussionState = { error?: string } | null;

export async function updateDiscussionAction(
  discussionId: string,
  _prev: UpdateDiscussionState,
  formData: FormData,
): Promise<UpdateDiscussionState> {
  const existing = await prisma.discussion.findUnique({ where: { id: discussionId } });
  if (!existing) return { error: `Discussion "${discussionId}" not found.` };

  const category = String(formData.get('category') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const bodyMarkdown = String(formData.get('body') ?? '').trim();
  const projectSlugRaw = String(formData.get('projectSlug') ?? '').trim();
  const projectSlug = projectSlugRaw || null;

  if (!title) return { error: 'Title is required.' };
  if (!bodyMarkdown) return { error: 'Body is required.' };
  if (!CATEGORY_VALUES.includes(category as DiscussionCategory)) {
    return { error: `Invalid category "${category}".` };
  }
  if (projectSlug) {
    const project = await prisma.project.findUnique({ where: { slug: projectSlug } });
    if (!project) return { error: `Project "${projectSlug}" not found.` };
  }

  await prisma.discussion.update({
    where: { id: discussionId },
    data: { category, title, bodyMarkdown, projectSlug },
  });

  revalidatePath(`/discussions/${discussionId}`);
  revalidatePath('/discussions');
  if (existing.projectSlug) revalidatePath(`/projects/${existing.projectSlug}/discussions`);
  if (projectSlug && projectSlug !== existing.projectSlug) {
    revalidatePath(`/projects/${projectSlug}/discussions`);
  }
  revalidatePath('/');
  redirect(`/discussions/${discussionId}`);
}

export async function updateReplyAction(
  discussionId: string,
  replyId: string,
  bodyMarkdown: string,
): Promise<void> {
  const trimmed = bodyMarkdown.trim();
  if (!trimmed) throw new Error('Reply cannot be empty');
  const reply = await prisma.reply.findUnique({ where: { id: replyId } });
  if (!reply || reply.discussionId !== discussionId) {
    throw new Error('Reply not found');
  }
  await prisma.reply.update({
    where: { id: replyId },
    data: { bodyMarkdown: trimmed },
  });
  revalidatePath(`/discussions/${discussionId}`);
}

export async function deleteDiscussionAction(discussionId: string): Promise<void> {
  const existing = await prisma.discussion.findUnique({ where: { id: discussionId } });
  if (!existing) {
    redirect('/discussions');
  }
  await prisma.discussion.delete({ where: { id: discussionId } });
  revalidatePath('/discussions');
  revalidatePath('/');
  redirect('/discussions');
}

export async function deleteReplyAction(discussionId: string, replyId: string): Promise<void> {
  const reply = await prisma.reply.findUnique({ where: { id: replyId } });
  if (!reply || reply.discussionId !== discussionId) return;
  await prisma.$transaction([
    prisma.reply.delete({ where: { id: replyId } }),
    prisma.discussion.update({
      where: { id: discussionId },
      data: { replyCount: { decrement: 1 } },
    }),
  ]);
  revalidatePath(`/discussions/${discussionId}`);
  revalidatePath('/discussions');
  revalidatePath('/');
}
