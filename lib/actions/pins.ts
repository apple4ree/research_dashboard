'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { getCurrentUserLogin } from '@/lib/session';

/**
 * Toggle whether the project is pinned on the current user's profile.
 * Appends to the end of pinnedProjectSlugs on pin, filters out on unpin.
 */
export async function togglePinProjectAction(projectSlug: string): Promise<void> {
  const login = await getCurrentUserLogin();
  const member = await prisma.member.findUnique({
    where: { login },
    select: { pinnedProjectSlugs: true },
  });
  if (!member) return;

  let current: string[] = [];
  try {
    const parsed = JSON.parse(member.pinnedProjectSlugs);
    if (Array.isArray(parsed)) current = parsed.map(String);
  } catch {
    current = [];
  }

  const isPinned = current.includes(projectSlug);
  const next = isPinned
    ? current.filter(s => s !== projectSlug)
    : [...current, projectSlug];

  await prisma.member.update({
    where: { login },
    data: { pinnedProjectSlugs: JSON.stringify(next) },
  });

  revalidatePath('/');
  revalidatePath(`/members/${login}`);
  revalidatePath(`/members/${login}/edit`);
  revalidatePath(`/projects/${projectSlug}`);
}
