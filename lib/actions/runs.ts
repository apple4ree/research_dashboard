'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';

export type UpdateRunState = { error?: string } | null;

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
  revalidatePath(`/experiments/${id}`);
  revalidatePath(`/projects/${existing.projectSlug}/experiments`);
  redirect(`/experiments/${id}`);
}

export async function deleteRunAction(id: string): Promise<void> {
  const existing = await prisma.experimentRun.findUnique({ where: { id } });
  if (!existing) return;
  await prisma.experimentRun.delete({ where: { id } });
  revalidatePath('/experiments');
  revalidatePath(`/projects/${existing.projectSlug}/experiments`);
  redirect('/experiments');
}
