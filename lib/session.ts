import { auth } from '@/auth';
import { prisma } from '@/lib/db';

/**
 * Returns the Member login for the currently authenticated user.
 *
 * Server actions and protected server components should call this instead of
 * relying on a hardcoded CURRENT_USER. The middleware redirects anonymous
 * traffic to /auth/signin, so reaching a server action without a session
 * indicates a bug — hence we throw rather than return null.
 *
 * The PLAYWRIGHT_TEST escape hatch lets the existing smoke suite run without
 * configuring a session cookie; the middleware skips auth in the same mode.
 */
export async function getCurrentUserLogin(): Promise<string> {
  if (process.env.PLAYWRIGHT_TEST === 'true') return 'dgu';
  const session = await auth();
  const login = (session as { memberLogin?: string } | null)?.memberLogin;
  if (!login) {
    throw new Error('Not authenticated: no memberLogin in session.');
  }
  return login;
}

/** Returns the Member row for the currently authenticated user, or null. */
export async function getCurrentMember() {
  const login = await getCurrentUserLogin();
  return prisma.member.findUnique({ where: { login } });
}
