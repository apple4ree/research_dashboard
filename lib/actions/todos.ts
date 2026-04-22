'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { TODO_BUCKET_ORDER } from '@/lib/labels';
import type { TodoBucket } from '@/lib/types';

const BUCKETS: readonly TodoBucket[] = TODO_BUCKET_ORDER;

export async function toggleTodoAction(
  projectSlug: string,
  id: number,
  done: boolean,
): Promise<void> {
  await prisma.todoItem.update({ where: { id }, data: { done } });
  revalidatePath(`/projects/${projectSlug}`);
}

export async function createTodoAction(
  projectSlug: string,
  formData: FormData,
): Promise<void> {
  const text = String(formData.get('text') ?? '').trim();
  const bucket = String(formData.get('bucket') ?? '') as TodoBucket;
  if (!text) throw new Error('Text is required');
  if (!BUCKETS.includes(bucket)) throw new Error(`Invalid bucket "${bucket}"`);

  const maxPos = await prisma.todoItem.findFirst({
    where: { projectSlug, bucket },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const position = (maxPos?.position ?? -1) + 1;

  await prisma.todoItem.create({
    data: { projectSlug, bucket, text, done: false, position },
  });
  revalidatePath(`/projects/${projectSlug}`);
}

export async function deleteTodoAction(
  projectSlug: string,
  id: number,
): Promise<void> {
  await prisma.todoItem.delete({ where: { id } });
  revalidatePath(`/projects/${projectSlug}`);
}

export async function updateTodoTextAction(
  projectSlug: string,
  id: number,
  text: string,
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Text cannot be empty');
  await prisma.todoItem.update({ where: { id }, data: { text: trimmed } });
  revalidatePath(`/projects/${projectSlug}`);
}
