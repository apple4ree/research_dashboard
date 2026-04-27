import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireMemberFromBearer } from '@/lib/api/bearer';
import { apiError } from '@/lib/api/errors';
import { requireProject } from '@/lib/api/project';

const KEY_RE = /^[a-z0-9_-]+$/;

type Payload = {
  projectSlug?: string;
  key?: string;
  label?: string;
  description?: string | null;
};

export async function POST(req: NextRequest) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const body = (await req.json().catch(() => null)) as Payload | null;
  if (!body) return apiError(400, 'invalid_request', 'JSON body required');

  const projectSlug = body.projectSlug?.trim();
  const key = body.key?.trim();
  const label = body.label?.trim();

  if (!projectSlug) return apiError(400, 'invalid_request', 'projectSlug is required');
  if (!key) return apiError(400, 'invalid_request', 'key is required');
  if (!KEY_RE.test(key)) {
    return apiError(400, 'invalid_request', `key must match ${KEY_RE} (got "${key}")`);
  }
  if (!label) return apiError(400, 'invalid_request', 'label is required');

  const project = await requireProject(projectSlug);
  if (!project.ok) return apiError(project.status, project.code, project.hint);

  const description = typeof body.description === 'string' ? body.description.trim() || null : null;

  const existing = await prisma.wikiType.findUnique({
    where: { projectSlug_key: { projectSlug, key } },
    select: { id: true },
  });

  if (existing) {
    await prisma.wikiType.update({
      where: { projectSlug_key: { projectSlug, key } },
      data: { label, description },
    });
    revalidatePath(`/projects/${projectSlug}/wiki`);
    return NextResponse.json({ ok: true, key, mode: 'updated' });
  }

  const last = await prisma.wikiType.findFirst({
    where: { projectSlug },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const position = (last?.position ?? -1) + 1;

  await prisma.wikiType.create({
    data: { projectSlug, key, label, description, position },
  });

  revalidatePath(`/projects/${projectSlug}/wiki`);
  return NextResponse.json({ ok: true, key, mode: 'created' }, { status: 201 });
}
