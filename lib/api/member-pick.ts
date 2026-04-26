import { prisma } from '@/lib/db';

export type MemberPickResult =
  | { ok: true; login: string }
  | { ok: false; reason: 'invalid_github_login' | 'too_many_collisions' };

/**
 * Pick a free Member.login slug for an auto-created Member.
 *
 * Tries the lowercased GitHub handle first; on collision, appends -1, -2, ...
 * up to -50 before giving up. Shared between NextAuth's signIn callback
 * (web login) and POST /api/auth/device/exchange (skill API) so both
 * surfaces apply the same collision policy.
 */
export async function pickMemberLogin(githubLogin: string): Promise<MemberPickResult> {
  const normalized = githubLogin.toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!normalized) return { ok: false, reason: 'invalid_github_login' };

  let candidate = normalized;
  let suffix = 0;
  while (await prisma.member.findUnique({ where: { login: candidate } })) {
    suffix += 1;
    candidate = `${normalized}-${suffix}`;
    if (suffix > 50) return { ok: false, reason: 'too_many_collisions' };
  }
  return { ok: true, login: candidate };
}
