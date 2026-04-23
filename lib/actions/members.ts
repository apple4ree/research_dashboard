'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import type { MemberRole } from '@/lib/types';

export type CreateMemberState = { error?: string } | null;
export type UpdateMemberState = { error?: string } | null;

const ROLES: readonly MemberRole[] = ['PI', 'Postdoc', 'PhD', 'MS', 'Intern', 'Alumni'];
const LOGIN_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;

export async function createMemberAction(
  _prev: CreateMemberState,
  formData: FormData,
): Promise<CreateMemberState> {
  const login = String(formData.get('login') ?? '').trim().toLowerCase();
  const displayName = String(formData.get('displayName') ?? '').trim();
  const role = String(formData.get('role') ?? '') as MemberRole;
  const bio = String(formData.get('bio') ?? '').trim() || null;
  const pinnedSlugsRaw = formData.getAll('pinnedProjectSlugs').map(String).filter(Boolean);

  if (!login) return { error: 'Login is required.' };
  if (!LOGIN_PATTERN.test(login)) {
    return { error: 'Login must be lowercase letters, digits, and hyphens (cannot start or end with hyphen).' };
  }
  if (!displayName) return { error: 'Display name is required.' };
  if (!ROLES.includes(role)) return { error: `Invalid role "${role}".` };

  const existing = await prisma.member.findUnique({ where: { login } });
  if (existing) return { error: `Member "${login}" already exists.` };

  await prisma.member.create({
    data: {
      login,
      displayName,
      role,
      bio,
      pinnedProjectSlugs: JSON.stringify(pinnedSlugsRaw),
    },
  });

  revalidatePath('/');
  revalidatePath('/members');
  redirect(`/members/${login}`);
}

export async function updateMemberAction(
  login: string,
  _prev: UpdateMemberState,
  formData: FormData,
): Promise<UpdateMemberState> {
  const existing = await prisma.member.findUnique({ where: { login } });
  if (!existing) return { error: `Member "${login}" not found.` };

  const displayName = String(formData.get('displayName') ?? '').trim();
  const role = String(formData.get('role') ?? '') as MemberRole;
  const bio = String(formData.get('bio') ?? '').trim() || null;
  const pinnedSlugsRaw = formData.getAll('pinnedProjectSlugs').map(String).filter(Boolean);

  if (!displayName) return { error: 'Display name is required.' };
  if (!ROLES.includes(role)) return { error: `Invalid role "${role}".` };

  await prisma.member.update({
    where: { login },
    data: {
      displayName,
      role,
      bio,
      pinnedProjectSlugs: JSON.stringify(pinnedSlugsRaw),
    },
  });

  revalidatePath(`/members/${login}`);
  revalidatePath('/');
  redirect(`/members/${login}`);
}

export async function deleteMemberAction(login: string): Promise<void> {
  // Restrict-cascaded relations: ExperimentRun.triggeredBy, Discussion.author,
  // Reply.author, ActivityEvent.actor, ResearchEntry.author.
  // These block a delete; surface a friendly error via thrown Error so the
  // client can catch it and display the message.
  const [runCount, discussionCount, replyCount, eventCount, entryCount] = await Promise.all([
    prisma.experimentRun.count({ where: { triggeredByLogin: login } }),
    prisma.discussion.count({ where: { authorLogin: login } }),
    prisma.reply.count({ where: { authorLogin: login } }),
    prisma.activityEvent.count({ where: { actorLogin: login } }),
    prisma.researchEntry.count({ where: { authorLogin: login } }),
  ]);

  const blockers: string[] = [];
  if (runCount > 0) blockers.push(`${runCount} experiment run(s)`);
  if (discussionCount > 0) blockers.push(`${discussionCount} discussion(s)`);
  if (replyCount > 0) blockers.push(`${replyCount} repl${replyCount === 1 ? 'y' : 'ies'}`);
  if (eventCount > 0) blockers.push(`${eventCount} activity event(s)`);
  if (entryCount > 0) blockers.push(`${entryCount} journal entr${entryCount === 1 ? 'y' : 'ies'}`);

  if (blockers.length > 0) {
    throw new Error(
      `Cannot delete member "${login}": they have ${blockers.join(', ')}. Transfer or delete those first.`,
    );
  }

  await prisma.member.delete({ where: { login } });
  revalidatePath('/');
  revalidatePath('/members');
  redirect('/');
}
