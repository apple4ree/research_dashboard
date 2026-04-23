'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import type { ReleaseKind } from '@/lib/types';
import { CURRENT_USER } from '@/lib/queries/constants';
import { logActivity } from './events';

export type CreateReleaseState = { error?: string } | null;
export type UpdateReleaseState = { error?: string } | null;

const KINDS: readonly ReleaseKind[] = ['dataset', 'tool', 'skill', 'model'];

export async function createReleaseAction(
  projectSlug: string,
  _prev: CreateReleaseState,
  formData: FormData,
): Promise<CreateReleaseState> {
  const project = await prisma.project.findUnique({ where: { slug: projectSlug } });
  if (!project) return { error: `Project "${projectSlug}" not found.` };

  const name = String(formData.get('name') ?? '').trim();
  const kind = String(formData.get('kind') ?? '') as ReleaseKind;
  const version = String(formData.get('version') ?? '').trim();
  const publishedAtStr = String(formData.get('publishedAt') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const downloadUrl = String(formData.get('downloadUrl') ?? '').trim() || null;

  if (!name) return { error: 'Name is required.' };
  if (!KINDS.includes(kind)) return { error: `Invalid kind "${kind}".` };
  if (!version) return { error: 'Version is required.' };
  if (!publishedAtStr) return { error: 'Published date is required.' };

  const id = `r-${randomUUID().slice(0, 8)}`;

  await prisma.release.create({
    data: {
      id,
      name,
      kind,
      projectSlug,
      version,
      publishedAt: new Date(publishedAtStr),
      description,
      downloadUrl,
      source: 'internal',
    },
  });

  await logActivity({
    type: 'release',
    actorLogin: CURRENT_USER,
    projectSlug,
    payload: { releaseId: id, action: 'published' },
  });

  revalidatePath(`/projects/${projectSlug}/data`);
  revalidatePath(`/projects/${projectSlug}`);
  revalidatePath('/');
  redirect(`/projects/${projectSlug}/data`);
}

export async function updateReleaseAction(
  releaseId: string,
  _prev: UpdateReleaseState,
  formData: FormData,
): Promise<UpdateReleaseState> {
  const existing = await prisma.release.findUnique({ where: { id: releaseId } });
  if (!existing) return { error: `Release "${releaseId}" not found.` };
  if (existing.source === 'github') {
    return { error: 'GitHub-sourced releases are read-only. Edit on GitHub and re-sync.' };
  }

  const name = String(formData.get('name') ?? '').trim();
  const kind = String(formData.get('kind') ?? '') as ReleaseKind;
  const version = String(formData.get('version') ?? '').trim();
  const publishedAtStr = String(formData.get('publishedAt') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  const downloadUrl = String(formData.get('downloadUrl') ?? '').trim() || null;

  if (!name) return { error: 'Name is required.' };
  if (!KINDS.includes(kind)) return { error: `Invalid kind "${kind}".` };
  if (!version) return { error: 'Version is required.' };
  if (!publishedAtStr) return { error: 'Published date is required.' };

  await prisma.release.update({
    where: { id: releaseId },
    data: {
      name,
      kind,
      version,
      publishedAt: new Date(publishedAtStr),
      description,
      downloadUrl,
    },
  });

  revalidatePath(`/projects/${existing.projectSlug}/data`);
  revalidatePath(`/projects/${existing.projectSlug}`);
  revalidatePath('/');
  redirect(`/projects/${existing.projectSlug}/data`);
}

export async function deleteReleaseAction(releaseId: string): Promise<void> {
  const existing = await prisma.release.findUnique({ where: { id: releaseId } });
  if (!existing) return;
  // GitHub-sourced releases are read-only and should only be removed by
  // disconnecting the project from the GitHub repo.
  if (existing.source === 'github') return;
  await prisma.release.delete({ where: { id: releaseId } });
  revalidatePath(`/projects/${existing.projectSlug}/data`);
  revalidatePath(`/projects/${existing.projectSlug}`);
  revalidatePath('/');
}
