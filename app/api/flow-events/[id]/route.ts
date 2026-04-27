import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireMemberFromBearer } from '@/lib/api/bearer';
import { apiError } from '@/lib/api/errors';
import { logActivity } from '@/lib/actions/events';

const ALLOWED_TONES = new Set(['milestone', 'pivot', 'result', 'incident', 'design']);

function parseId(s: string): number | null {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

type PatchPayload = {
  date?: string;
  source?: string;
  title?: string;
  summary?: string;
  tone?: string;
  bullets?: unknown;
  numbers?: unknown;
  tags?: unknown;
};

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const { id: idStr } = await ctx.params;
  const id = parseId(idStr);
  if (id === null) return apiError(404, 'flow_event_not_found', `Flow event id '${idStr}' is invalid.`);

  const existing = await prisma.flowEvent.findUnique({ where: { id } });
  if (!existing) return apiError(404, 'flow_event_not_found', `Flow event '${idStr}' not found.`);

  const body = (await req.json().catch(() => null)) as PatchPayload | null;
  if (!body) return apiError(400, 'invalid_request', 'JSON body required');

  const data: Record<string, unknown> = {};

  if (body.date !== undefined) {
    if (typeof body.date !== 'string' || !body.date.trim()) {
      return apiError(400, 'invalid_request', 'date must be a non-empty string');
    }
    data.date = body.date;
  }
  if (body.source !== undefined) {
    if (typeof body.source !== 'string' || !body.source.trim()) {
      return apiError(400, 'invalid_request', 'source must be a non-empty string');
    }
    data.source = body.source.trim();
  }
  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || !body.title.trim()) {
      return apiError(400, 'invalid_request', 'title must be a non-empty string');
    }
    data.title = body.title.trim();
  }
  if (body.summary !== undefined) {
    if (typeof body.summary !== 'string') {
      return apiError(400, 'invalid_request', 'summary must be a string');
    }
    data.summary = body.summary;
  }
  if (body.tone !== undefined) {
    if (typeof body.tone !== 'string' || !ALLOWED_TONES.has(body.tone)) {
      return apiError(400, 'invalid_request', `tone must be one of: ${[...ALLOWED_TONES].join(', ')}`);
    }
    data.tone = body.tone;
  }
  if (body.bullets !== undefined) {
    data.bullets = body.bullets === null ? null : JSON.stringify(body.bullets);
  }
  if (body.numbers !== undefined) {
    data.numbers = body.numbers === null ? null : JSON.stringify(body.numbers);
  }
  if (body.tags !== undefined) {
    data.tags = body.tags === null ? null : JSON.stringify(body.tags);
  }

  if (Object.keys(data).length === 0) {
    return apiError(400, 'invalid_request', 'no fields to update');
  }

  await prisma.flowEvent.update({ where: { id }, data });

  await logActivity({
    type: 'flow_event',
    actorLogin: auth.memberLogin,
    projectSlug: existing.projectSlug,
    payload: { flowEventId: id, action: 'updated' },
  });

  revalidatePath('/');
  revalidatePath(`/projects/${existing.projectSlug}/flow`);

  return NextResponse.json({ ok: true, id });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const { id: idStr } = await ctx.params;
  const id = parseId(idStr);
  if (id === null) return apiError(404, 'flow_event_not_found', `Flow event id '${idStr}' is invalid.`);

  const existing = await prisma.flowEvent.findUnique({ where: { id } });
  if (!existing) return apiError(404, 'flow_event_not_found', `Flow event '${idStr}' not found.`);

  await prisma.flowEvent.delete({ where: { id } });

  await logActivity({
    type: 'flow_event',
    actorLogin: auth.memberLogin,
    projectSlug: existing.projectSlug,
    payload: { flowEventId: id, action: 'deleted' },
  });

  revalidatePath('/');
  revalidatePath(`/projects/${existing.projectSlug}/flow`);

  return new NextResponse(null, { status: 204 });
}
