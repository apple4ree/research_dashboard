import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireMemberFromBearer } from '@/lib/api/bearer';
import { apiError } from '@/lib/api/errors';
import { logActivity } from '@/lib/actions/events';
import { getEntryById } from '@/lib/queries';
import { isEntryType, isSlideKind, isArtifactType } from '@/lib/api/validators';

type SlideInput = { kind: string; title: string; body: string; chip?: string | null; metricsJson?: string | null; code?: string | null };
type ArtifactInput = { type: string; title: string; href: string };

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const { id } = await ctx.params;
  const entry = await getEntryById(id);
  if (!entry) return apiError(404, 'entry_not_found', `Entry '${id}' not found.`);

  return NextResponse.json(entry);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const { id } = await ctx.params;
  const existing = await prisma.researchEntry.findUnique({ where: { id } });
  if (!existing) return apiError(404, 'entry_not_found', `Entry '${id}' not found.`);

  const body = (await req.json().catch(() => null)) as
    | {
        date?: string;
        type?: string;
        title?: string;
        summary?: string;
        bodyMarkdown?: string;
        tags?: string[];
        slides?: SlideInput[];
        artifacts?: ArtifactInput[];
      }
    | null;
  if (!body) return apiError(400, 'invalid_request', 'JSON body required');

  const data: {
    date?: Date;
    type?: string;
    title?: string;
    summary?: string;
    bodyMarkdown?: string;
    tags?: string;
  } = {};

  if (body.date !== undefined) {
    const d = new Date(body.date);
    if (Number.isNaN(d.getTime())) return apiError(400, 'invalid_request', `invalid date: ${body.date}`);
    data.date = d;
  }
  if (body.type !== undefined) {
    if (!isEntryType(body.type)) return apiError(400, 'invalid_request', 'type must be one of meeting/report/experiment/review');
    data.type = body.type;
  }
  if (body.title !== undefined) data.title = body.title;
  if (body.summary !== undefined) data.summary = body.summary;
  if (body.bodyMarkdown !== undefined) data.bodyMarkdown = body.bodyMarkdown;
  if (body.tags !== undefined) data.tags = JSON.stringify(body.tags);

  if (body.slides !== undefined) {
    for (const s of body.slides) {
      if (!s || typeof s !== 'object') return apiError(400, 'invalid_request', 'each slide must be an object');
      if (!isSlideKind(s.kind)) return apiError(400, 'invalid_request', `invalid slide kind: ${s.kind}`);
      if (typeof s.title !== 'string' || typeof s.body !== 'string') return apiError(400, 'invalid_request', 'slide.title and slide.body required');
    }
  }
  if (body.artifacts !== undefined) {
    for (const a of body.artifacts) {
      if (!a || typeof a !== 'object') return apiError(400, 'invalid_request', 'each artifact must be an object');
      if (!isArtifactType(a.type)) return apiError(400, 'invalid_request', `invalid artifact type: ${a.type}`);
      if (typeof a.title !== 'string' || typeof a.href !== 'string') return apiError(400, 'invalid_request', 'artifact.title and artifact.href required');
    }
  }

  await prisma.$transaction(async tx => {
    await tx.researchEntry.update({ where: { id }, data });
    if (body.slides !== undefined) {
      await tx.entrySlide.deleteMany({ where: { entryId: id } });
      if (body.slides.length > 0) {
        await tx.entrySlide.createMany({
          data: body.slides.map((s, i) => ({
            entryId: id,
            position: i + 1,
            kind: s.kind,
            title: s.title,
            body: s.body,
            chip: s.chip ?? null,
            metricsJson: s.metricsJson ?? null,
            code: s.code ?? null,
          })),
        });
      }
    }
    if (body.artifacts !== undefined) {
      await tx.entryArtifact.deleteMany({ where: { entryId: id } });
      if (body.artifacts.length > 0) {
        await tx.entryArtifact.createMany({
          data: body.artifacts.map((a, i) => ({
            entryId: id,
            position: i,
            type: a.type,
            title: a.title,
            href: a.href,
          })),
        });
      }
    }
  });

  await logActivity({
    type: 'entry',
    actorLogin: auth.memberLogin,
    projectSlug: existing.projectSlug,
    payload: { entryId: id, action: 'updated' },
  });

  revalidatePath('/');
  revalidatePath(`/projects/${existing.projectSlug}`);

  const updated = await getEntryById(id);
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const { id } = await ctx.params;
  const existing = await prisma.researchEntry.findUnique({ where: { id } });
  if (!existing) return apiError(404, 'entry_not_found', `Entry '${id}' not found.`);

  await prisma.researchEntry.delete({ where: { id } });

  await logActivity({
    type: 'entry',
    actorLogin: auth.memberLogin,
    projectSlug: existing.projectSlug,
    payload: { entryId: id, action: 'deleted' },
  });

  revalidatePath('/');
  revalidatePath(`/projects/${existing.projectSlug}`);

  return new NextResponse(null, { status: 204 });
}
