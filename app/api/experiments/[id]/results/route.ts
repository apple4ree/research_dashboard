import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireMemberFromBearer } from '@/lib/api/bearer';
import { apiError } from '@/lib/api/errors';

const KINDS = new Set(['benchmark', 'checkpoint', 'figure-bundle', 'report', 'tool']);

type Payload = {
  title?: string;
  summary?: string;
  kind?: string;
  metrics?: { label: string; value: string }[];
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const { id: experimentId } = await ctx.params;
  const exp = await prisma.experiment.findUnique({
    where: { id: experimentId },
    select: { id: true, projectSlug: true },
  });
  if (!exp) return apiError(404, 'experiment_not_found', `Experiment '${experimentId}' not found.`);

  const body = (await req.json().catch(() => null)) as Payload | null;
  if (!body) return apiError(400, 'invalid_request', 'JSON body required');

  const title = body.title?.trim();
  const kind = body.kind?.trim() || 'benchmark';

  if (!title) return apiError(400, 'invalid_request', 'title is required');
  if (!KINDS.has(kind)) {
    return apiError(400, 'invalid_request', `kind must be one of: ${[...KINDS].join(', ')}`);
  }

  let metricsJson = '[]';
  if (Array.isArray(body.metrics)) {
    metricsJson = JSON.stringify(
      body.metrics
        .map(m => ({ label: String(m.label ?? '').trim(), value: String(m.value ?? '').trim() }))
        .filter(m => m.label),
    );
  }

  const created = await prisma.experimentResult.create({
    data: {
      experimentId,
      title,
      summary: body.summary ?? '',
      kind,
      metricsJson,
    },
    select: { id: true, title: true, kind: true },
  });

  revalidatePath(`/projects/${exp.projectSlug}/experiments/${experimentId}`);
  revalidatePath(`/projects/${exp.projectSlug}/results`);
  return NextResponse.json({ ok: true, ...created }, { status: 201 });
}
