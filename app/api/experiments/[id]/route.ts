import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireMemberFromBearer } from '@/lib/api/bearer';
import { apiError } from '@/lib/api/errors';
import { deleteArtifactFile } from '@/lib/uploads';

const STATUSES = new Set(['planned', 'running', 'completed', 'archived']);

type PatchPayload = {
  title?: string;
  status?: string;
  hypothesis?: string;
  bodyMarkdown?: string;
};

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const { id } = await ctx.params;
  const existing = await prisma.experiment.findUnique({ where: { id } });
  if (!existing) return apiError(404, 'experiment_not_found', `Experiment '${id}' not found.`);

  const body = (await req.json().catch(() => null)) as PatchPayload | null;
  if (!body) return apiError(400, 'invalid_request', 'JSON body required');

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) {
    if (!body.title.trim()) return apiError(400, 'invalid_request', 'title must be non-empty');
    data.title = body.title.trim();
  }
  if (body.status !== undefined) {
    if (!STATUSES.has(body.status)) {
      return apiError(400, 'invalid_request', `status must be one of: ${[...STATUSES].join(', ')}`);
    }
    data.status = body.status;
  }
  if (body.hypothesis !== undefined) data.hypothesis = body.hypothesis;
  if (body.bodyMarkdown !== undefined) data.bodyMarkdown = body.bodyMarkdown;

  if (Object.keys(data).length === 0) {
    return apiError(400, 'invalid_request', 'no fields to update');
  }

  await prisma.experiment.update({ where: { id }, data });
  revalidatePath(`/projects/${existing.projectSlug}/experiments`);
  revalidatePath(`/projects/${existing.projectSlug}/experiments/${id}`);
  return NextResponse.json({ ok: true, id });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const { id } = await ctx.params;
  const existing = await prisma.experiment.findUnique({
    where: { id },
    select: { id: true, projectSlug: true, results: { select: { attachments: { select: { storedPath: true } } } } },
  });
  if (!existing) return apiError(404, 'experiment_not_found', `Experiment '${id}' not found.`);

  for (const r of existing.results) {
    for (const a of r.attachments) {
      if (a.storedPath) await deleteArtifactFile(a.storedPath);
    }
  }
  await prisma.experiment.delete({ where: { id } });
  revalidatePath(`/projects/${existing.projectSlug}/experiments`);
  revalidatePath(`/projects/${existing.projectSlug}/results`);
  return new NextResponse(null, { status: 204 });
}
