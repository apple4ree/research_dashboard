'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';

const KEY_RE = /^[a-z0-9_-]+$/;

function s(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v : '';
}

export async function addWikiTypeAction(fd: FormData) {
  const projectSlug = s(fd, 'projectSlug').trim();
  const key = s(fd, 'key').trim();
  const label = s(fd, 'label').trim();
  const description = s(fd, 'description').trim();

  if (!projectSlug || !key || !label) return;
  if (!KEY_RE.test(key)) return;

  const project = await prisma.project.findUnique({
    where: { slug: projectSlug },
    select: { slug: true },
  });
  if (!project) return;

  const last = await prisma.wikiType.findFirst({
    where: { projectSlug },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const position = (last?.position ?? -1) + 1;

  try {
    await prisma.wikiType.create({
      data: {
        projectSlug,
        key,
        label,
        description: description || null,
        position,
      },
    });
  } catch {
    // unique violation on (projectSlug, key) — silent dedupe
  }

  revalidatePath(`/projects/${projectSlug}/wiki`);
}

export async function deleteWikiTypeAction(fd: FormData) {
  const projectSlug = s(fd, 'projectSlug').trim();
  const key = s(fd, 'key').trim();
  if (!projectSlug || !key) return;

  // If any entities reference this type, refuse to delete (data integrity).
  const inUse = await prisma.wikiEntity.findFirst({
    where: { projectSlug, type: key },
    select: { id: true },
  });
  if (inUse) return;

  await prisma.wikiType.deleteMany({ where: { projectSlug, key } });
  revalidatePath(`/projects/${projectSlug}/wiki`);
}
