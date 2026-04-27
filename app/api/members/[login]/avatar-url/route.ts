import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Tiny lookup used by the client-side Avatar component to resolve a
 * member's uploaded profile image without prop plumbing. Auth is
 * enforced by middleware (cookie session).
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ login: string }> },
) {
  const { login } = await ctx.params;
  const m = await prisma.member.findUnique({
    where: { login },
    select: { avatarUrl: true },
  });
  return NextResponse.json(
    { avatarUrl: m?.avatarUrl ?? null },
    { headers: { 'Cache-Control': 'private, max-age=60' } },
  );
}
