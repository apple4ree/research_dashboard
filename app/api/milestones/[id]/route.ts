import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireMemberFromBearer } from '@/lib/api/bearer';
import { apiError } from '@/lib/api/errors';
import { logActivity } from '@/lib/actions/events';
import { isMilestoneStatus } from '@/lib/api/validators';

function parseId(s: string): number | null {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const { id: idStr } = await ctx.params;
  const id = parseId(idStr);
  if (id === null) return apiError(404, 'milestone_not_found', `Milestone id '${idStr}' is invalid.`);

  const existing = await prisma.milestone.findUnique({ where: { id } });
  if (!existing) return apiError(404, 'milestone_not_found', `Milestone '${idStr}' not found.`);

  const body = (await req.json().catch(() => null)) as
    | { date?: string; label?: string; status?: string; note?: string | null; position?: number }
    | null;
  if (!body) return apiError(400, 'invalid_request', 'JSON body required');

  const data: { date?: Date; label?: string; status?: string; note?: string | null; position?: number } = {};

  if (body.date !== undefined) {
    const d = new Date(body.date);
    if (Number.isNaN(d.getTime())) return apiError(400, 'invalid_request', `invalid date: ${body.date}`);
    data.date = d;
  }
  if (body.label !== undefined) data.label = body.label;
  if (body.status !== undefined) {
    if (!isMilestoneStatus(body.status)) return apiError(400, 'invalid_request', 'status must be one of past/now/future');
    data.status = body.status;
  }
  if (body.note !== undefined) data.note = body.note;
  if (body.position !== undefined) data.position = body.position;

  const updated = await prisma.milestone.update({ where: { id }, data });

  await logActivity({
    type: 'milestone',
    actorLogin: auth.memberLogin,
    projectSlug: existing.projectSlug,
    payload: { milestoneId: id, action: 'updated' },
  });

  revalidatePath('/');
  revalidatePath(`/projects/${existing.projectSlug}`);

  return NextResponse.json({
    id: updated.id,
    projectSlug: updated.projectSlug,
    date: updated.date.toISOString(),
    label: updated.label,
    status: updated.status,
    note: updated.note,
    position: updated.position,
  });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const { id: idStr } = await ctx.params;
  const id = parseId(idStr);
  if (id === null) return apiError(404, 'milestone_not_found', `Milestone id '${idStr}' is invalid.`);

  const existing = await prisma.milestone.findUnique({ where: { id } });
  if (!existing) return apiError(404, 'milestone_not_found', `Milestone '${idStr}' not found.`);

  await prisma.milestone.delete({ where: { id } });

  await logActivity({
    type: 'milestone',
    actorLogin: auth.memberLogin,
    projectSlug: existing.projectSlug,
    payload: { milestoneId: id, action: 'deleted' },
  });

  revalidatePath('/');
  revalidatePath(`/projects/${existing.projectSlug}`);

  return new NextResponse(null, { status: 204 });
}
