'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import type { MilestoneStatus } from '@/lib/types';

const STATUSES: readonly MilestoneStatus[] = ['past', 'now', 'future'];

export type CreateMilestoneState = { error?: string } | null;

export async function createMilestoneAction(
  projectSlug: string,
  _prev: CreateMilestoneState,
  formData: FormData,
): Promise<CreateMilestoneState> {
  const dateStr = String(formData.get('date') ?? '').trim();
  const label = String(formData.get('label') ?? '').trim();
  const noteRaw = String(formData.get('note') ?? '').trim();
  const note = noteRaw === '' ? null : noteRaw;
  const status = String(formData.get('status') ?? '') as MilestoneStatus;
  const positionRaw = String(formData.get('position') ?? '').trim();

  if (!dateStr) return { error: 'Date is required.' };
  if (!label) return { error: 'Label is required.' };
  if (!STATUSES.includes(status)) return { error: `Invalid status "${status}".` };

  const parsedDate = new Date(dateStr);
  if (Number.isNaN(parsedDate.getTime())) return { error: `Invalid date "${dateStr}".` };

  let position: number;
  if (positionRaw === '') {
    const maxPos = await prisma.milestone.findFirst({
      where: { projectSlug },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    position = (maxPos?.position ?? -1) + 1;
  } else {
    const parsed = Number.parseInt(positionRaw, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      return { error: `Invalid position "${positionRaw}".` };
    }
    position = parsed;
  }

  await prisma.milestone.create({
    data: { projectSlug, date: parsedDate, label, note, status, position },
  });
  revalidatePath(`/projects/${projectSlug}`);
  return null;
}

export async function updateMilestoneAction(
  projectSlug: string,
  id: number,
  formData: FormData,
): Promise<void> {
  const dateStr = String(formData.get('date') ?? '').trim();
  const label = String(formData.get('label') ?? '').trim();
  const noteRaw = String(formData.get('note') ?? '').trim();
  const note = noteRaw === '' ? null : noteRaw;
  const status = String(formData.get('status') ?? '') as MilestoneStatus;

  if (!dateStr) throw new Error('Date is required');
  if (!label) throw new Error('Label is required');
  if (!STATUSES.includes(status)) throw new Error(`Invalid status "${status}"`);

  const parsedDate = new Date(dateStr);
  if (Number.isNaN(parsedDate.getTime())) throw new Error(`Invalid date "${dateStr}"`);

  await prisma.milestone.update({
    where: { id },
    data: { date: parsedDate, label, note, status },
  });
  revalidatePath(`/projects/${projectSlug}`);
}

export async function deleteMilestoneAction(
  projectSlug: string,
  id: number,
): Promise<void> {
  await prisma.milestone.delete({ where: { id } });
  revalidatePath(`/projects/${projectSlug}`);
}
