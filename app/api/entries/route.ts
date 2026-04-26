import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { requireMemberFromBearer } from '@/lib/api/bearer';
import { apiError } from '@/lib/api/errors';
import { logActivity } from '@/lib/actions/events';
import { isEntryType, isSlideKind, isArtifactType } from '@/lib/api/validators';

type SlideInput = { kind: string; title: string; body: string; chip?: string | null; metricsJson?: string | null; code?: string | null };
type ArtifactInput = { type: string; title: string; href: string };

export async function POST(req: NextRequest) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const body = (await req.json().catch(() => null)) as
    | {
        projectSlug?: string;
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

  const projectSlug = body.projectSlug?.trim();
  const dateStr = body.date?.trim();
  const type = body.type?.trim();
  const title = body.title?.trim();
  const summary = body.summary?.trim();
  const bodyMarkdown = body.bodyMarkdown ?? '';

  if (!projectSlug) return apiError(400, 'invalid_request', 'projectSlug is required');
  if (!dateStr) return apiError(400, 'invalid_request', 'date is required');
  if (!type || !isEntryType(type)) return apiError(400, 'invalid_request', 'type must be one of meeting/report/experiment/review');
  if (!title) return apiError(400, 'invalid_request', 'title is required');
  if (!summary) return apiError(400, 'invalid_request', 'summary is required');

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return apiError(400, 'invalid_request', `invalid date: ${dateStr}`);

  const slides = body.slides ?? [];
  for (const s of slides) {
    if (!s || typeof s !== 'object') return apiError(400, 'invalid_request', 'each slide must be an object');
    if (!isSlideKind(s.kind)) return apiError(400, 'invalid_request', `invalid slide kind: ${s.kind}`);
    if (typeof s.title !== 'string' || typeof s.body !== 'string') return apiError(400, 'invalid_request', 'slide.title and slide.body required');
  }

  const artifacts = body.artifacts ?? [];
  for (const a of artifacts) {
    if (!a || typeof a !== 'object') return apiError(400, 'invalid_request', 'each artifact must be an object');
    if (!isArtifactType(a.type)) return apiError(400, 'invalid_request', `invalid artifact type: ${a.type}`);
    if (typeof a.title !== 'string' || typeof a.href !== 'string') return apiError(400, 'invalid_request', 'artifact.title and artifact.href required');
  }

  const project = await prisma.project.findUnique({ where: { slug: projectSlug } });
  if (!project) return apiError(404, 'project_not_found', `Project '${projectSlug}' not found in LabHub.`);

  const baseId = `e-${Math.floor(Date.now() / 1000).toString(36)}`;
  const collision = await prisma.researchEntry.findUnique({ where: { id: baseId } });
  const id = collision ? `${baseId}-${randomUUID().slice(0, 4)}` : baseId;

  const tagsJson = JSON.stringify(body.tags ?? []);

  await prisma.researchEntry.create({
    data: {
      id,
      projectSlug,
      date,
      type,
      authorLogin: auth.memberLogin,
      title,
      summary,
      tags: tagsJson,
      bodyMarkdown,
      slides: {
        create: slides.map((s, i) => ({
          position: i + 1,
          kind: s.kind,
          title: s.title,
          body: s.body,
          chip: s.chip ?? null,
          metricsJson: s.metricsJson ?? null,
          code: s.code ?? null,
        })),
      },
      artifacts: {
        create: artifacts.map((a, i) => ({
          position: i,
          type: a.type,
          title: a.title,
          href: a.href,
        })),
      },
    },
  });

  await logActivity({
    type: 'entry',
    actorLogin: auth.memberLogin,
    projectSlug,
    payload: { entryId: id, action: 'created' },
  });

  revalidatePath('/');
  revalidatePath(`/projects/${projectSlug}`);

  return NextResponse.json({ id }, { status: 201 });
}
