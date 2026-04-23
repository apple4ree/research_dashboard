'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';

export async function addProjectMemberAction(
  projectSlug: string,
  memberLogin: string,
): Promise<void> {
  if (!projectSlug) throw new Error('Project is required');
  if (!memberLogin) throw new Error('Member is required');

  const project = await prisma.project.findUnique({ where: { slug: projectSlug } });
  if (!project) throw new Error(`Project "${projectSlug}" not found`);
  const member = await prisma.member.findUnique({ where: { login: memberLogin } });
  if (!member) throw new Error(`Member "${memberLogin}" not found`);

  // Idempotent: skip if already a member (compound @@id makes this a primary key).
  const existing = await prisma.projectMember.findFirst({
    where: { projectSlug, memberLogin },
  });
  if (!existing) {
    await prisma.projectMember.create({ data: { projectSlug, memberLogin } });
  }

  revalidatePath(`/projects/${projectSlug}`);
  revalidatePath(`/projects/${projectSlug}/members`);
}

export async function removeProjectMemberAction(
  projectSlug: string,
  memberLogin: string,
): Promise<void> {
  await prisma.projectMember.deleteMany({
    where: { projectSlug, memberLogin },
  });
  revalidatePath(`/projects/${projectSlug}`);
  revalidatePath(`/projects/${projectSlug}/members`);
}
