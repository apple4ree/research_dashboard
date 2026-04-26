import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyMemberToken } from './jwt';

export type BearerResult =
  | { ok: true; memberLogin: string }
  | {
      ok: false;
      status: 401;
      code: 'missing_token' | 'invalid_token' | 'expired_token' | 'unknown_member';
    };

export async function requireMemberFromBearer(req: NextRequest): Promise<BearerResult> {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null;

  const verify = await verifyMemberToken(token);
  if (!verify.ok) return { ok: false, status: 401, code: verify.reason };

  const member = await prisma.member.findUnique({
    where: { login: verify.memberLogin },
    select: { login: true },
  });
  if (!member) return { ok: false, status: 401, code: 'unknown_member' };

  return { ok: true, memberLogin: member.login };
}
