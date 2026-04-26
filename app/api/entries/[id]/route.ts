import { type NextRequest, NextResponse } from 'next/server';
import { requireMemberFromBearer } from '@/lib/api/bearer';
import { apiError } from '@/lib/api/errors';
import { getEntryById } from '@/lib/queries';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const { id } = await ctx.params;
  const entry = await getEntryById(id);
  if (!entry) return apiError(404, 'entry_not_found', `Entry '${id}' not found.`);

  return NextResponse.json(entry);
}
