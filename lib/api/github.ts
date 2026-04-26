export type GitHubUser = {
  login: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
};

const TEST_FIXTURES: Record<string, GitHubUser> = {
  // Matches Member.testbot guaranteed by tests/global-setup.ts.
  'test:testbot': { login: 'testbot', name: 'Test Bot', email: 'bot@test.local', avatarUrl: null },
  // Used to verify the auto-create path. Caller (test) is responsible
  // for cleaning up the resulting Member row if it matters.
  'test:newuser': { login: 'newuser', name: 'New User', email: 'new@test.local', avatarUrl: null },
};

/**
 * Verify a GitHub access token by calling the /user endpoint.
 * Returns the resolved user identity, or null if GitHub rejects the token.
 *
 * Test escape hatch: when PLAYWRIGHT_TEST=true, the token is interpreted
 * as a fixture key (e.g., 'test:dgu') and the canned identity is returned
 * without hitting api.github.com. Mirrors the pattern in lib/session.ts.
 */
export async function verifyGitHubAccessToken(token: string): Promise<GitHubUser | null> {
  if (process.env.PLAYWRIGHT_TEST === 'true') {
    return TEST_FIXTURES[token] ?? null;
  }

  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'labhub-cli',
    },
    cache: 'no-store',
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    login: string;
    name?: string | null;
    email?: string | null;
    avatar_url?: string | null;
  };
  return {
    login: data.login,
    name: data.name ?? null,
    email: data.email ?? null,
    avatarUrl: data.avatar_url ?? null,
  };
}
