import { cache } from 'react';
import { prisma } from '@/lib/db';

/**
 * Per-request cached lookup of a member's uploaded profile image.
 *
 * Wrapped in React `cache()` so multiple Avatar renders for the same
 * login during one request collapse to a single DB query. Different
 * logins still cost one query each, but that's fine for a small
 * member roster.
 */
export const getAvatarUrl = cache(async (login: string): Promise<string | null> => {
  const m = await prisma.member.findUnique({
    where: { login },
    select: { avatarUrl: true },
  });
  return m?.avatarUrl ?? null;
});
