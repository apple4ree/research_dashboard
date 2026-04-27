import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireMemberFromBearer } from '@/lib/api/bearer';
import { apiError } from '@/lib/api/errors';
import { logActivity } from '@/lib/actions/events';
import { isTodoBucket } from '@/lib/api/validators';

export async function POST(req: NextRequest) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const body = (await req.json().catch(() => null)) as
    | { projectSlug?: string; bucket?: string; text?: string; position?: number }
    | null;
  if (!body) return apiError(400, 'invalid_request', 'JSON body required');

  const projectSlug = body.projectSlug?.trim();
  const bucket = body.bucket?.trim();
  const text = body.text?.trim();

  if (!projectSlug) return apiError(400, 'invalid_request', 'projectSlug is required');
  if (!bucket || !isTodoBucket(bucket)) return apiError(400, 'invalid_request', 'bucket must be one of short/mid/long');
  if (!text) return apiError(400, 'invalid_request', 'text is required');

  const project = await prisma.project.findUnique({ where: { slug: projectSlug } });
  if (!project) return apiError(404, 'project_not_found', `Project '${projectSlug}' not found.`);

  let position = body.position;
  if (position === undefined || position === null) {
    const last = await prisma.todoItem.findFirst({
      where: { projectSlug, bucket },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    position = (last?.position ?? -1) + 1;
  }

  const created = await prisma.todoItem.create({
    data: { projectSlug, bucket, text, done: false, position },
  });

  await logActivity({
    type: 'todo',
    actorLogin: auth.memberLogin,
    projectSlug,
    payload: { todoId: created.id, action: 'created' },
  });

  revalidatePath('/');
  revalidatePath(`/projects/${projectSlug}`);

  return NextResponse.json({ id: created.id }, { status: 201 });
}
