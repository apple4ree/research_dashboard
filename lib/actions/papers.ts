'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { PAPER_STAGE_ORDER } from '@/lib/labels';
import type { PaperStage } from '@/lib/types';

export async function updatePaperStage(paperId: string, stage: PaperStage): Promise<void> {
  if (!PAPER_STAGE_ORDER.includes(stage)) throw new Error(`Invalid stage ${stage}`);
  await prisma.paper.update({
    where: { id: paperId },
    data: { stage },
  });
  revalidatePath('/pipeline');
  revalidatePath('/projects');
}

export type CreatePaperState = { error?: string } | null;

export async function createPaper(
  projectSlug: string,
  _prev: CreatePaperState,
  formData: FormData,
): Promise<CreatePaperState> {
  const title = String(formData.get('title') ?? '').trim();
  const stage = String(formData.get('stage') ?? '') as PaperStage;
  const venue = String(formData.get('venue') ?? '').trim() || null;
  const deadlineStr = String(formData.get('deadline') ?? '').trim();
  const authorsRaw = formData.getAll('authors');
  const draftUrl = String(formData.get('draftUrl') ?? '').trim() || null;

  if (!title) return { error: 'Title is required.' };
  if (!PAPER_STAGE_ORDER.includes(stage)) return { error: `Invalid stage "${stage}".` };

  const project = await prisma.project.findUnique({ where: { slug: projectSlug } });
  if (!project) return { error: `Project "${projectSlug}" not found.` };

  const authors = authorsRaw.map(String).filter(Boolean);
  if (authors.length === 0) return { error: 'At least one author is required.' };

  const deadline = deadlineStr ? new Date(deadlineStr) : null;

  const id = `p-${randomUUID().slice(0, 8)}`;

  await prisma.paper.create({
    data: {
      id,
      title,
      projectSlug,
      stage,
      venue,
      deadline,
      draftUrl,
      authors: {
        create: authors.map((login, position) => ({
          authorLogin: login,
          position,
        })),
      },
    },
  });

  revalidatePath(`/projects/${projectSlug}/papers`);
  revalidatePath('/pipeline');
  revalidatePath('/');
  redirect(`/projects/${projectSlug}/papers`);
}

export type UpdatePaperState = { error?: string } | null;

export async function updatePaperAction(
  paperId: string,
  _prev: UpdatePaperState,
  formData: FormData,
): Promise<UpdatePaperState> {
  const existing = await prisma.paper.findUnique({ where: { id: paperId } });
  if (!existing) return { error: `Paper "${paperId}" not found.` };

  const title = String(formData.get('title') ?? '').trim();
  const stage = String(formData.get('stage') ?? '') as PaperStage;
  const venue = String(formData.get('venue') ?? '').trim() || null;
  const deadlineStr = String(formData.get('deadline') ?? '').trim();
  const draftUrl = String(formData.get('draftUrl') ?? '').trim() || null;
  const pdfUrl = String(formData.get('pdfUrl') ?? '').trim() || null;
  const authorsRaw = formData.getAll('authors').map(String).filter(Boolean);

  if (!title) return { error: 'Title is required.' };
  if (!PAPER_STAGE_ORDER.includes(stage)) return { error: `Invalid stage "${stage}"` };
  if (authorsRaw.length === 0) return { error: 'At least one author is required.' };

  const deadline = deadlineStr ? new Date(deadlineStr) : null;

  await prisma.$transaction([
    prisma.paper.update({
      where: { id: paperId },
      data: { title, stage, venue, deadline, draftUrl, pdfUrl },
    }),
    prisma.paperAuthor.deleteMany({ where: { paperId } }),
    prisma.paperAuthor.createMany({
      data: authorsRaw.map((login, position) => ({
        paperId,
        authorLogin: login,
        position,
      })),
    }),
  ]);

  revalidatePath(`/projects/${existing.projectSlug}/papers`);
  revalidatePath('/pipeline');
  revalidatePath('/');
  redirect(`/projects/${existing.projectSlug}/papers`);
}

export async function deletePaperAction(paperId: string): Promise<void> {
  const existing = await prisma.paper.findUnique({ where: { id: paperId } });
  if (!existing) return;
  await prisma.paper.delete({ where: { id: paperId } });
  revalidatePath(`/projects/${existing.projectSlug}/papers`);
  revalidatePath('/pipeline');
  revalidatePath('/');
}
