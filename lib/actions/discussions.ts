'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { CURRENT_USER } from '@/lib/queries/constants';
import type { DiscussionCategory } from '@/lib/types';

const CATEGORY_VALUES: readonly DiscussionCategory[] = ['announcements', 'journal_club', 'qa', 'ideas'];

export async function createDiscussion(formData: FormData): Promise<void> {
  const category = String(formData.get('category') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();

  if (!title) throw new Error('Title is required');
  if (!body) throw new Error('Body is required');
  if (!CATEGORY_VALUES.includes(category as DiscussionCategory)) {
    throw new Error(`Invalid category "${category}"`);
  }

  const id = `d-${randomUUID().slice(0, 8)}`;
  const now = new Date();

  await prisma.discussion.create({
    data: {
      id,
      category,
      title,
      authorLogin: CURRENT_USER,
      createdAt: now,
      lastActivityAt: now,
      replyCount: 0,
      bodyMarkdown: body,
    },
  });

  revalidatePath('/discussions');
  revalidatePath('/');
  redirect(`/discussions/${id}`);
}

export async function createReply(discussionId: string, formData: FormData): Promise<void> {
  const body = String(formData.get('body') ?? '').trim();
  if (!body) throw new Error('Reply cannot be empty');

  const discussion = await prisma.discussion.findUnique({ where: { id: discussionId } });
  if (!discussion) throw new Error(`Discussion ${discussionId} not found`);

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

  revalidatePath(`/discussions/${discussionId}`);
  revalidatePath('/discussions');
  revalidatePath('/');
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
