import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireMemberFromBearer } from '@/lib/api/bearer';
import { apiError } from '@/lib/api/errors';
import { requireProject } from '@/lib/api/project';

const ID_RE = /^[a-z0-9_-]+$/;
const ALLOWED_STATUSES = new Set(['active', 'deprecated', 'superseded']);

type UpsertPayload = {
  projectSlug?: string;
  id?: string;
  type?: string;
  name?: string;
  status?: string;
  summaryMarkdown?: string;
  bodyMarkdown?: string;
  sourceFiles?: unknown;
};

export async function POST(req: NextRequest) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const body = (await req.json().catch(() => null)) as UpsertPayload | null;
  if (!body) return apiError(400, 'invalid_request', 'JSON body required');

  const projectSlug = body.projectSlug?.trim();
  if (!projectSlug) return apiError(400, 'invalid_request', 'projectSlug is required');

  const id = body.id?.trim();
  if (!id) return apiError(400, 'invalid_request', 'id is required');
  if (!ID_RE.test(id)) {
    return apiError(400, 'invalid_request', `id must match ${ID_RE} (got "${id}")`);
  }

  const name = body.name?.trim();
  if (!name) return apiError(400, 'invalid_request', 'name is required');

  const type = body.type?.trim();
  if (!type) return apiError(400, 'invalid_request', 'type is required');

  const status = body.status?.trim();
  if (status !== undefined && !ALLOWED_STATUSES.has(status)) {
    return apiError(
      400,
      'invalid_request',
      `status must be one of: ${[...ALLOWED_STATUSES].join(', ')}`,
    );
  }

  if (typeof body.bodyMarkdown !== 'string') {
    return apiError(400, 'invalid_request', 'bodyMarkdown is required (string)');
  }

  if (body.sourceFiles !== undefined) {
    if (
      !Array.isArray(body.sourceFiles) ||
      !body.sourceFiles.every(s => typeof s === 'string')
    ) {
      return apiError(400, 'invalid_request', 'sourceFiles must be an array of strings');
    }
  }
  const sourceFiles: string[] = Array.isArray(body.sourceFiles) ? (body.sourceFiles as string[]) : [];

  const project = await requireProject(projectSlug);
  if (!project.ok) return apiError(project.status, project.code, project.hint);

  const validTypes = await prisma.wikiType.findMany({
    where: { projectSlug },
    select: { key: true },
  });
  const typeKeys = validTypes.map(t => t.key);
  if (!typeKeys.includes(type)) {
    return apiError(
      400,
      'invalid_request',
      `type "${type}" is not a configured WikiType for this project. Valid: ${typeKeys.join(', ') || '(none)'}`,
    );
  }

  const existing = await prisma.wikiEntity.findUnique({
    where: { projectSlug_id: { projectSlug, id } },
    select: { id: true },
  });

  await prisma.wikiEntity.upsert({
    where: { projectSlug_id: { projectSlug, id } },
    create: {
      projectSlug,
      id,
      type,
      name,
      status: status ?? 'active',
      summaryMarkdown: body.summaryMarkdown ?? '',
      bodyMarkdown: body.bodyMarkdown,
      sourceFiles: JSON.stringify(sourceFiles),
      lastSyncedAt: new Date(),
      source: 'wiki-llm',
    },
    update: {
      type,
      name,
      status: status ?? 'active',
      summaryMarkdown: body.summaryMarkdown ?? '',
      bodyMarkdown: body.bodyMarkdown,
      sourceFiles: JSON.stringify(sourceFiles),
      lastSyncedAt: new Date(),
      source: 'wiki-llm',
    },
  });

  revalidatePath(`/projects/${projectSlug}/wiki`);

  const mode = existing ? 'updated' : 'created';
  return NextResponse.json(
    { ok: true, id, mode },
    { status: existing ? 200 : 201 },
  );
}
