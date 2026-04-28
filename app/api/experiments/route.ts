import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireMemberFromBearer } from '@/lib/api/bearer';
import { apiError } from '@/lib/api/errors';
import { requireProject } from '@/lib/api/project';

const STATUSES = new Set(['planned', 'running', 'completed', 'archived']);

type Payload = {
  projectSlug?: string;
  title?: string;
  status?: string;
  hypothesis?: string;
  bodyMarkdown?: string;
  sourceWikiSlug?: string;
  sourceWikiEntityId?: string;
};

export async function POST(req: NextRequest) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const body = (await req.json().catch(() => null)) as Payload | null;
  if (!body) return apiError(400, 'invalid_request', 'JSON body required');

  const projectSlug = body.projectSlug?.trim();
  const title = body.title?.trim();
  const status = (body.status?.trim() || 'planned');

  if (!projectSlug) return apiError(400, 'invalid_request', 'projectSlug is required');
  if (!title) return apiError(400, 'invalid_request', 'title is required');
  if (!STATUSES.has(status)) {
    return apiError(400, 'invalid_request', `status must be one of: ${[...STATUSES].join(', ')}`);
  }

  const project = await requireProject(projectSlug);
  if (!project.ok) return apiError(project.status, project.code, project.hint);

  const created = await prisma.experiment.create({
    data: {
      projectSlug,
      title,
      status,
      hypothesis: body.hypothesis ?? '',
      bodyMarkdown: body.bodyMarkdown ?? '',
      sourceWikiSlug: body.sourceWikiSlug?.trim() || null,
      sourceWikiEntityId: body.sourceWikiEntityId?.trim() || null,
      createdByLogin: auth.memberLogin,
    },
    select: { id: true, title: true, status: true },
  });

  revalidatePath(`/projects/${projectSlug}/experiments`);
  return NextResponse.json({ ok: true, ...created }, { status: 201 });
}
