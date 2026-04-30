'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUserLogin } from '@/lib/session';
import {
  postNoticeCreated,
  postNoticeUpdated,
  postNoticeDeleted,
  postNoticeComment,
} from '@/lib/slack';

export type NoticeActionState = { error?: string } | null;

const ALLOWED_CATEGORIES = new Set(['update', 'feature', 'fix', 'announcement']);

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v : '';
}

function parseCategory(raw: string): string {
  return ALLOWED_CATEGORIES.has(raw) ? raw : 'update';
}

async function safeSlack(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(`[notices] Slack ${label} failed`, err);
  }
}

export async function createNoticeAction(
  _prev: NoticeActionState,
  formData: FormData,
): Promise<NoticeActionState> {
  const title = s(formData, 'title').trim();
  const bodyMarkdown = s(formData, 'bodyMarkdown');
  const category = parseCategory(s(formData, 'category').trim());
  const pinned = s(formData, 'pinned') === '1';

  if (!title) return { error: 'Title is required.' };
  if (!bodyMarkdown.trim()) return { error: 'Body is required.' };

  const authorLogin = await getCurrentUserLogin();
  if (!authorLogin) return { error: 'Not signed in.' };

  const notice = await prisma.notice.create({
    data: { title, bodyMarkdown, category, pinned, authorLogin },
    select: { id: true },
  });

  await safeSlack('create', () =>
    postNoticeCreated({
      title,
      category,
      authorLogin,
      noticeId: notice.id,
      bodyMarkdown,
    }),
  );

  revalidatePath('/notices');
  revalidatePath('/');
  redirect(`/notices/${notice.id}`);
}

export async function updateNoticeAction(
  id: string,
  _prev: NoticeActionState,
  formData: FormData,
): Promise<NoticeActionState> {
  const existing = await prisma.notice.findUnique({ where: { id } });
  if (!existing) return { error: `Notice "${id}" not found.` };

  const title = s(formData, 'title').trim();
  const bodyMarkdown = s(formData, 'bodyMarkdown');
  const category = parseCategory(s(formData, 'category').trim());
  const pinned = s(formData, 'pinned') === '1';

  if (!title) return { error: 'Title is required.' };
  if (!bodyMarkdown.trim()) return { error: 'Body is required.' };

  await prisma.notice.update({
    where: { id },
    data: { title, bodyMarkdown, category, pinned },
  });

  const editorLogin = (await getCurrentUserLogin()) ?? existing.authorLogin;
  await safeSlack('update', () =>
    postNoticeUpdated({
      title,
      category,
      editorLogin,
      noticeId: id,
      titleChanged: existing.title !== title,
      previousTitle: existing.title,
    }),
  );

  revalidatePath('/notices');
  revalidatePath(`/notices/${id}`);
  revalidatePath('/');
  redirect(`/notices/${id}`);
}

export async function deleteNoticeAction(id: string): Promise<void> {
  const existing = await prisma.notice.findUnique({
    where: { id },
    select: { id: true, title: true, category: true },
  });

  await prisma.notice.delete({ where: { id } });

  if (existing) {
    const deleterLogin = (await getCurrentUserLogin()) ?? 'unknown';
    await safeSlack('delete', () =>
      postNoticeDeleted({
        title: existing.title,
        category: existing.category,
        noticeId: existing.id,
        deleterLogin,
      }),
    );
  }

  revalidatePath('/notices');
  revalidatePath('/');
  redirect('/notices');
}

export async function addNoticeCommentAction(noticeId: string, formData: FormData): Promise<void> {
  const body = s(formData, 'bodyMarkdown').trim();
  if (!body) return;

  const authorLogin = await getCurrentUserLogin();
  if (!authorLogin) return;

  const notice = await prisma.notice.findUnique({
    where: { id: noticeId },
    select: { id: true, title: true },
  });
  if (!notice) return;

  await prisma.noticeComment.create({
    data: { noticeId, authorLogin, bodyMarkdown: body },
  });

  await safeSlack('comment', () =>
    postNoticeComment({
      noticeId: notice.id,
      noticeTitle: notice.title,
      commenterLogin: authorLogin,
      bodyMarkdown: body,
    }),
  );

  revalidatePath(`/notices/${noticeId}`);
  revalidatePath('/notices');
}

export async function deleteNoticeCommentAction(noticeId: string, commentId: string): Promise<void> {
  await prisma.noticeComment.deleteMany({ where: { id: commentId, noticeId } });
  revalidatePath(`/notices/${noticeId}`);
}
