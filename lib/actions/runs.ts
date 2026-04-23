'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import type { RunStatus } from '@/lib/types';

export type UpdateRunState = { error?: string } | null;
export type CreateRunState = { error?: string } | null;

const STATUSES: readonly RunStatus[] = ['success', 'failure', 'in_progress', 'queued', 'cancelled'];

export async function createRunAction(
  _prev: CreateRunState,
  formData: FormData,
): Promise<CreateRunState> {
  const name = String(formData.get('name') ?? '').trim();
  const projectSlug = String(formData.get('projectSlug') ?? '').trim();
  const status = String(formData.get('status') ?? '') as RunStatus;
  const triggeredByLogin = String(formData.get('triggeredByLogin') ?? '').trim();
  const startedAtStr = String(formData.get('startedAt') ?? '').trim();
  const durationSecStr = String(formData.get('durationSec') ?? '').trim();
  const summary = String(formData.get('summary') ?? '').trim() || null;

  if (!name) return { error: 'Name is required.' };
  if (!projectSlug) return { error: 'Project is required.' };
  if (!STATUSES.includes(status)) return { error: `Invalid status "${status}".` };
  if (!triggeredByLogin) return { error: 'Triggered-by member is required.' };
  if (!startedAtStr) return { error: 'Started-at is required.' };

  const project = await prisma.project.findUnique({ where: { slug: projectSlug } });
  if (!project) return { error: `Project "${projectSlug}" not found.` };
  const member = await prisma.member.findUnique({ where: { login: triggeredByLogin } });
  if (!member) return { error: `Member "${triggeredByLogin}" not found.` };

  let durationSec: number | null = null;
  if (durationSecStr) {
    const parsed = parseInt(durationSecStr, 10);
    if (isNaN(parsed) || parsed < 0) {
      return { error: 'Duration must be a non-negative integer.' };
    }
    durationSec = parsed;
  }

  const startedAt = new Date(startedAtStr);
  if (isNaN(startedAt.getTime())) {
    return { error: `Invalid started-at value "${startedAtStr}".` };
  }

  const baseId = `exp-${Math.floor(Date.now() / 1000).toString(36)}`;
  const existing = await prisma.experimentRun.findUnique({ where: { id: baseId } });
  const finalId = existing ? `${baseId}-${randomUUID().slice(0, 4)}` : baseId;

  await prisma.experimentRun.create({
    data: {
      id: finalId,
      name,
      projectSlug,
      status,
      startedAt,
      durationSec,
      triggeredByLogin,
      summary,
    },
  });

  revalidatePath('/experiments');
  revalidatePath(`/projects/${projectSlug}/experiments`);
  revalidatePath('/');
  redirect(`/projects/${projectSlug}/experiments/${finalId}`);
}

export async function updateRunAction(
  id: string,
  _prev: UpdateRunState,
  formData: FormData,
): Promise<UpdateRunState> {
  const existing = await prisma.experimentRun.findUnique({ where: { id } });
  if (!existing) return { error: `Run "${id}" not found.` };

  const name = String(formData.get('name') ?? '').trim();
  const summary = String(formData.get('summary') ?? '').trim() || null;

  if (!name) return { error: 'Name is required.' };

  await prisma.experimentRun.update({
    where: { id },
    data: { name, summary },
  });

  revalidatePath('/experiments');
  revalidatePath(`/projects/${existing.projectSlug}/experiments`);
  revalidatePath(`/projects/${existing.projectSlug}/experiments/${id}`);
  redirect(`/projects/${existing.projectSlug}/experiments/${id}`);
}

export async function deleteRunAction(id: string): Promise<void> {
  const existing = await prisma.experimentRun.findUnique({ where: { id } });
  if (!existing) return;
  await prisma.experimentRun.delete({ where: { id } });
  revalidatePath('/experiments');
  revalidatePath(`/projects/${existing.projectSlug}/experiments`);
  redirect(`/projects/${existing.projectSlug}/experiments`);
}
