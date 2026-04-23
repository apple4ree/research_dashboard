'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';

export async function addProjectRepoAction(
  projectSlug: string,
  formData: FormData,
): Promise<void> {
  const label = String(formData.get('label') ?? '').trim();
  const url = String(formData.get('url') ?? '').trim();
  if (!label) throw new Error('Label is required');
  if (!url) throw new Error('URL is required');
  if (!/^https?:\/\//.test(url)) {
    throw new Error('URL must start with http:// or https://');
  }

  const project = await prisma.project.findUnique({ where: { slug: projectSlug } });
  if (!project) throw new Error(`Project "${projectSlug}" not found`);

  await prisma.projectRepo.create({
    data: { projectSlug, label, url },
  });

  revalidatePath(`/projects/${projectSlug}`);
  revalidatePath(`/projects/${projectSlug}/edit`);
}

export async function removeProjectRepoAction(id: number): Promise<void> {
  const repo = await prisma.projectRepo.findUnique({ where: { id } });
  if (!repo) return;
  await prisma.projectRepo.delete({ where: { id } });
  revalidatePath(`/projects/${repo.projectSlug}`);
  revalidatePath(`/projects/${repo.projectSlug}/edit`);
}
