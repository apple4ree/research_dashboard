import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { signMemberToken } from '@/lib/api/jwt';
import { verifyGitHubAccessToken } from '@/lib/api/github';
import { pickMemberLogin } from '@/lib/api/member-pick';
import { apiError } from '@/lib/api/errors';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { github_access_token?: string } | null;
  const ghToken = body?.github_access_token?.trim();
  if (!ghToken) {
    return apiError(400, 'invalid_request', 'github_access_token is required');
  }

  const ghUser = await verifyGitHubAccessToken(ghToken);
  if (!ghUser) {
    return apiError(401, 'github_verify_failed', 'GitHub /user rejected this token');
  }

  let member = await prisma.member.findUnique({ where: { githubLogin: ghUser.login } });
  if (!member) {
    const picked = await pickMemberLogin(ghUser.login);
    if (!picked.ok) {
      return apiError(401, 'github_verify_failed', `member-slug pick failed: ${picked.reason}`);
    }
    member = await prisma.member.create({
      data: {
        login: picked.login,
        displayName: ghUser.name ?? ghUser.login,
        role: 'PhD',
        githubLogin: ghUser.login,
        email: ghUser.email ?? undefined,
        avatarUrl: ghUser.avatarUrl ?? undefined,
        pinnedProjectSlugs: '[]',
      },
    });
  }

  const { token, expiresAt } = await signMemberToken(member.login);
  return NextResponse.json({
    token,
    expiresAt: expiresAt.toISOString(),
    member: { login: member.login, displayName: member.displayName },
  });
}
