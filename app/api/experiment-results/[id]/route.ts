import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireMemberFromBearer } from '@/lib/api/bearer';
import { apiError } from '@/lib/api/errors';
import { deleteArtifactFile } from '@/lib/uploads';

const KINDS = new Set(['benchmark', 'checkpoint', 'figure-bundle', 'report', 'tool']);

type PatchPayload = {
  title?: string;
  summary?: string;
  kind?: string;
  metrics?: { label: string; value: string }[];
};

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const { id } = await ctx.params;
  const existing = await prisma.experimentResult.findUnique({
    where: { id },
    include: { experiment: { select: { id: true, projectSlug: true } } },
  });
  if (!existing) return apiError(404, 'result_not_found', `Result '${id}' not found.`);

  const body = (await req.json().catch(() => null)) as PatchPayload | null;
  if (!body) return apiError(400, 'invalid_request', 'JSON body required');

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) {
    if (!body.title.trim()) return apiError(400, 'invalid_request', 'title must be non-empty');
    data.title = body.title.trim();
  }
  if (body.kind !== undefined) {
    if (!KINDS.has(body.kind)) {
      return apiError(400, 'invalid_request', `kind must be one of: ${[...KINDS].join(', ')}`);
    }
    data.kind = body.kind;
  }
  if (body.summary !== undefined) data.summary = body.summary;
  if (Array.isArray(body.metrics)) {
    data.metricsJson = JSON.stringify(
      body.metrics
        .map(m => ({ label: String(m.label ?? '').trim(), value: String(m.value ?? '').trim() }))
        .filter(m => m.label),
    );
  }

  if (Object.keys(data).length === 0) {
    return apiError(400, 'invalid_request', 'no fields to update');
  }

  await prisma.experimentResult.update({ where: { id }, data });
  revalidatePath(`/projects/${existing.experiment.projectSlug}/experiments/${existing.experiment.id}`);
  revalidatePath(`/projects/${existing.experiment.projectSlug}/results`);
  return NextResponse.json({ ok: true, id });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const { id } = await ctx.params;
  const existing = await prisma.experimentResult.findUnique({
    where: { id },
    include: {
      experiment: { select: { id: true, projectSlug: true } },
      attachments: { select: { storedPath: true } },
    },
  });
  if (!existing) return apiError(404, 'result_not_found', `Result '${id}' not found.`);

  for (const a of existing.attachments) {
    if (a.storedPath) await deleteArtifactFile(a.storedPath);
  }
  await prisma.experimentResult.delete({ where: { id } });
  revalidatePath(`/projects/${existing.experiment.projectSlug}/experiments/${existing.experiment.id}`);
  revalidatePath(`/projects/${existing.experiment.projectSlug}/results`);
  return new NextResponse(null, { status: 204 });
}
