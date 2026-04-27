'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { writeAvatar, deleteAvatarFiles } from '@/lib/avatars';
import type { MemberRole } from '@/lib/types';

export type CreateMemberState = { error?: string } | null;
export type UpdateMemberState = { error?: string } | null;

const ROLES: readonly MemberRole[] = ['PI', 'Postdoc', 'PhD', 'MS', 'Intern', 'Alumni'];
const LOGIN_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GITHUB_LOGIN_PATTERN = /^[A-Za-z0-9]([A-Za-z0-9-]{0,38})$/;

export async function createMemberAction(
  _prev: CreateMemberState,
  formData: FormData,
): Promise<CreateMemberState> {
  const login = String(formData.get('login') ?? '').trim().toLowerCase();
  const displayName = String(formData.get('displayName') ?? '').trim();
  const role = String(formData.get('role') ?? '') as MemberRole;
  const bio = String(formData.get('bio') ?? '').trim() || null;
  const emailRaw = String(formData.get('email') ?? '').trim();
  const email = emailRaw === '' ? null : emailRaw.toLowerCase();
  const githubLoginRaw = String(formData.get('githubLogin') ?? '').trim();
  const githubLogin = githubLoginRaw === '' ? null : githubLoginRaw;
  const pinnedSlugsRaw = formData.getAll('pinnedProjectSlugs').map(String).filter(Boolean);

  if (!login) return { error: 'Login is required.' };
  if (!LOGIN_PATTERN.test(login)) {
    return { error: 'Login must be lowercase letters, digits, and hyphens (cannot start or end with hyphen).' };
  }
  if (!displayName) return { error: 'Display name is required.' };
  if (!ROLES.includes(role)) return { error: `Invalid role "${role}".` };
  if (email && !EMAIL_PATTERN.test(email)) {
    return { error: `Invalid email "${email}".` };
  }
  if (githubLogin && !GITHUB_LOGIN_PATTERN.test(githubLogin)) {
    return { error: `Invalid GitHub login "${githubLogin}".` };
  }

  const existing = await prisma.member.findUnique({ where: { login } });
  if (existing) return { error: `Member "${login}" already exists.` };

  if (email) {
    const emailClash = await prisma.member.findUnique({ where: { email } });
    if (emailClash) return { error: `Email "${email}" is already used by member "${emailClash.login}".` };
  }
  if (githubLogin) {
    const ghClash = await prisma.member.findUnique({ where: { githubLogin } });
    if (ghClash) return { error: `GitHub login "${githubLogin}" is already used by member "${ghClash.login}".` };
  }

  await prisma.member.create({
    data: {
      login,
      displayName,
      role,
      bio,
      email,
      githubLogin,
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
  const emailRaw = String(formData.get('email') ?? '').trim();
  const email = emailRaw === '' ? null : emailRaw.toLowerCase();
  const githubLoginRaw = String(formData.get('githubLogin') ?? '').trim();
  const githubLogin = githubLoginRaw === '' ? null : githubLoginRaw;
  const pinnedSlugsRaw = formData.getAll('pinnedProjectSlugs').map(String).filter(Boolean);

  if (!displayName) return { error: 'Display name is required.' };
  if (!ROLES.includes(role)) return { error: `Invalid role "${role}".` };
  if (email && !EMAIL_PATTERN.test(email)) {
    return { error: `Invalid email "${email}".` };
  }
  if (githubLogin && !GITHUB_LOGIN_PATTERN.test(githubLogin)) {
    return { error: `Invalid GitHub login "${githubLogin}".` };
  }

  if (email && email !== existing.email) {
    const emailClash = await prisma.member.findUnique({ where: { email } });
    if (emailClash && emailClash.login !== login) {
      return { error: `Email "${email}" is already used by member "${emailClash.login}".` };
    }
  }
  if (githubLogin && githubLogin !== existing.githubLogin) {
    const ghClash = await prisma.member.findUnique({ where: { githubLogin } });
    if (ghClash && ghClash.login !== login) {
      return { error: `GitHub login "${githubLogin}" is already used by member "${ghClash.login}".` };
    }
  }

  // Avatar handling: removeAvatar=1 clears, otherwise an attached file overwrites.
  const removeAvatar = String(formData.get('removeAvatar') ?? '') === '1';
  const avatarFileRaw = formData.get('avatarFile');
  const avatarFile = avatarFileRaw instanceof File && avatarFileRaw.size > 0 ? avatarFileRaw : null;

  let nextAvatarUrl: string | null | undefined = undefined; // undefined = no change
  if (removeAvatar) {
    await deleteAvatarFiles(login);
    nextAvatarUrl = null;
  } else if (avatarFile) {
    try {
      const result = await writeAvatar(login, avatarFile);
      nextAvatarUrl = result.avatarUrl;
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Avatar upload failed.' };
    }
  }

  await prisma.member.update({
    where: { login },
    data: {
      displayName,
      role,
      bio,
      email,
      githubLogin,
      pinnedProjectSlugs: JSON.stringify(pinnedSlugsRaw),
      ...(nextAvatarUrl !== undefined ? { avatarUrl: nextAvatarUrl } : {}),
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
