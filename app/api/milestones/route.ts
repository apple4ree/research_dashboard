import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireMemberFromBearer } from '@/lib/api/bearer';
import { apiError } from '@/lib/api/errors';
import { logActivity } from '@/lib/actions/events';
import { isMilestoneStatus } from '@/lib/api/validators';

export async function POST(req: NextRequest) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const body = (await req.json().catch(() => null)) as
    | { projectSlug?: string; date?: string; label?: string; status?: string; note?: string | null; position?: number }
    | null;
  if (!body) return apiError(400, 'invalid_request', 'JSON body required');

  const projectSlug = body.projectSlug?.trim();
  const dateStr = body.date?.trim();
  const label = body.label?.trim();
  const status = body.status?.trim();

  if (!projectSlug) return apiError(400, 'invalid_request', 'projectSlug is required');
  if (!dateStr) return apiError(400, 'invalid_request', 'date is required');
  if (!label) return apiError(400, 'invalid_request', 'label is required');
  if (!status || !isMilestoneStatus(status)) return apiError(400, 'invalid_request', 'status must be one of past/now/future');

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return apiError(400, 'invalid_request', `invalid date: ${dateStr}`);

  const project = await prisma.project.findUnique({ where: { slug: projectSlug } });
  if (!project) return apiError(404, 'project_not_found', `Project '${projectSlug}' not found.`);

  let position = body.position;
  if (position === undefined || position === null) {
    const last = await prisma.milestone.findFirst({
      where: { projectSlug },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    position = (last?.position ?? -1) + 1;
  }

  const created = await prisma.milestone.create({
    data: {
      projectSlug,
      date,
      label,
      status,
      note: body.note ?? null,
      position,
    },
  });

  await logActivity({
    type: 'milestone',
    actorLogin: auth.memberLogin,
    projectSlug,
    payload: { milestoneId: created.id, action: 'created' },
  });

  revalidatePath('/');
  revalidatePath(`/projects/${projectSlug}`);

  return NextResponse.json({ id: created.id }, { status: 201 });
}
