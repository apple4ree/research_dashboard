import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireMemberFromBearer } from '@/lib/api/bearer';
import { apiError } from '@/lib/api/errors';
import { logActivity } from '@/lib/actions/events';
import { runStatusToEventAction } from '@/lib/events';
import type { RunStatus } from '@/lib/types';

const STATUSES: readonly RunStatus[] = ['success', 'failure', 'in_progress', 'queued', 'cancelled'];

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const { id } = await ctx.params;
  const existing = await prisma.experimentRun.findUnique({ where: { id } });
  if (!existing) return apiError(404, 'run_not_found');

  const body = (await req.json().catch(() => null)) as
    | {
        status?: string;
        summary?: string | null;
        durationSec?: number | null;
        name?: string;
      }
    | null;
  if (!body) return apiError(400, 'invalid_request', 'JSON body required');

  const updates: {
    status?: RunStatus;
    summary?: string | null;
    durationSec?: number | null;
    name?: string;
  } = {};
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as RunStatus)) {
      return apiError(400, 'invalid_request', `status must be one of ${STATUSES.join(', ')}`);
    }
    updates.status = body.status as RunStatus;
  }
  if (body.summary !== undefined) updates.summary = body.summary;
  if (body.durationSec !== undefined) updates.durationSec = body.durationSec;
  if (body.name !== undefined) updates.name = body.name;

  const updated = await prisma.experimentRun.update({ where: { id }, data: updates });

  if (updates.status && updates.status !== existing.status) {
    await logActivity({
      type: 'experiment',
      actorLogin: auth.memberLogin,
      projectSlug: existing.projectSlug,
      payload: { runId: id, action: runStatusToEventAction(updates.status) },
    });
  }

  revalidatePath('/experiments');
  revalidatePath(`/projects/${existing.projectSlug}/experiments`);
  revalidatePath(`/projects/${existing.projectSlug}/experiments/${id}`);

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    projectSlug: updated.projectSlug,
    status: updated.status,
    startedAt: updated.startedAt.toISOString(),
    durationSec: updated.durationSec,
    summary: updated.summary,
    triggeredByLogin: updated.triggeredByLogin,
  });
}
