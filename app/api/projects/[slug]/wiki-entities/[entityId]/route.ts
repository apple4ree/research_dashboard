import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireMemberFromBearer } from '@/lib/api/bearer';
import { apiError } from '@/lib/api/errors';
import { requireProject } from '@/lib/api/project';
import { logActivity } from '@/lib/actions/events';

const ALLOWED_STATUSES = new Set(['active', 'deprecated', 'superseded']);

type PatchPayload = {
  name?: string;
  type?: string;
  status?: string;
  summaryMarkdown?: string;
  bodyMarkdown?: string;
  // sourceFiles intentionally ignored — ingest territory.
};

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string; entityId: string }> },
) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const { slug, entityId } = await ctx.params;
  const project = await requireProject(slug);
  if (!project.ok) return apiError(project.status, project.code, project.hint);

  const row = await prisma.wikiEntity.findUnique({
    where: { projectSlug_id: { projectSlug: slug, id: entityId } },
    select: {
      id: true,
      type: true,
      name: true,
      status: true,
      summaryMarkdown: true,
      bodyMarkdown: true,
      sourceFiles: true,
      lastSyncedAt: true,
    },
  });

  if (!row) {
    return apiError(404, 'entity_not_found', `Entity '${entityId}' not found in project '${slug}'.`);
  }

  let sourceFiles: string[] = [];
  try {
    const v = JSON.parse(row.sourceFiles);
    if (Array.isArray(v)) sourceFiles = v.filter(x => typeof x === 'string');
  } catch {
    // leave empty
  }

  return NextResponse.json({ ...row, sourceFiles });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string; entityId: string }> },
) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const { slug, entityId } = await ctx.params;
  const project = await requireProject(slug);
  if (!project.ok) return apiError(project.status, project.code, project.hint);

  const existing = await prisma.wikiEntity.findUnique({
    where: { projectSlug_id: { projectSlug: slug, id: entityId } },
  });
  if (!existing) {
    return apiError(404, 'entity_not_found', `Entity '${entityId}' not found in project '${slug}'.`);
  }

  const body = (await req.json().catch(() => null)) as PatchPayload | null;
  if (!body) return apiError(400, 'invalid_request', 'JSON body required');

  const data: Record<string, unknown> = {};

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      return apiError(400, 'invalid_request', 'name must be a non-empty string');
    }
    data.name = body.name.trim();
  }
  if (body.type !== undefined) {
    if (typeof body.type !== 'string' || !body.type.trim()) {
      return apiError(400, 'invalid_request', 'type must be a non-empty string');
    }
    const validTypes = await prisma.wikiType.findMany({
      where: { projectSlug: slug },
      select: { key: true },
    });
    const keys = validTypes.map(t => t.key);
    if (!keys.includes(body.type)) {
      return apiError(
        400,
        'invalid_request',
        `type "${body.type}" is not configured for this project. Valid: ${keys.join(', ') || '(none)'}`,
      );
    }
    data.type = body.type;
  }
  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !ALLOWED_STATUSES.has(body.status)) {
      return apiError(400, 'invalid_request', `status must be one of: ${[...ALLOWED_STATUSES].join(', ')}`);
    }
    data.status = body.status;
  }
  if (body.summaryMarkdown !== undefined) {
    if (typeof body.summaryMarkdown !== 'string') {
      return apiError(400, 'invalid_request', 'summaryMarkdown must be a string');
    }
    data.summaryMarkdown = body.summaryMarkdown;
  }
  if (body.bodyMarkdown !== undefined) {
    if (typeof body.bodyMarkdown !== 'string') {
      return apiError(400, 'invalid_request', 'bodyMarkdown must be a string');
    }
    data.bodyMarkdown = body.bodyMarkdown;
  }

  if (Object.keys(data).length === 0) {
    return apiError(400, 'invalid_request', 'no fields to update');
  }

  data.lastSyncedAt = new Date();

  await prisma.wikiEntity.update({
    where: { projectSlug_id: { projectSlug: slug, id: entityId } },
    data,
  });

  await logActivity({
    type: 'wiki_entity',
    actorLogin: auth.memberLogin,
    projectSlug: slug,
    payload: { entityId, action: 'updated' },
  });

  revalidatePath(`/projects/${slug}/wiki`);
  revalidatePath(`/projects/${slug}/wiki/${entityId}`);

  return NextResponse.json({ ok: true, id: entityId });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string; entityId: string }> },
) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const { slug, entityId } = await ctx.params;
  const project = await requireProject(slug);
  if (!project.ok) return apiError(project.status, project.code, project.hint);

  const existing = await prisma.wikiEntity.findUnique({
    where: { projectSlug_id: { projectSlug: slug, id: entityId } },
    select: { id: true },
  });
  if (!existing) {
    return apiError(404, 'entity_not_found', `Entity '${entityId}' not found in project '${slug}'.`);
  }

  await prisma.wikiEntity.delete({
    where: { projectSlug_id: { projectSlug: slug, id: entityId } },
  });

  await logActivity({
    type: 'wiki_entity',
    actorLogin: auth.memberLogin,
    projectSlug: slug,
    payload: { entityId, action: 'deleted' },
  });

  revalidatePath(`/projects/${slug}/wiki`);

  return new NextResponse(null, { status: 204 });
}
