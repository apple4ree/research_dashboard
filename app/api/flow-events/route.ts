import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireMemberFromBearer } from '@/lib/api/bearer';
import { apiError } from '@/lib/api/errors';
import { requireProject } from '@/lib/api/project';

const ALLOWED_TONES = new Set(['milestone', 'pivot', 'result', 'incident', 'design']);

type ApplyPayload = {
  projectSlug?: string;
  event?: {
    date?: string;
    source?: string;
    title?: string;
    summary?: string;
    tone?: string;
    bullets?: unknown;
    numbers?: unknown;
    tags?: unknown;
  };
  taskIds?: number[];
  overwrite?: boolean;
};

export async function POST(req: NextRequest) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const body = (await req.json().catch(() => null)) as ApplyPayload | null;
  if (!body) return apiError(400, 'invalid_request', 'JSON body required');

  const projectSlug = body.projectSlug?.trim();
  if (!projectSlug) return apiError(400, 'invalid_request', 'projectSlug is required');

  const event = body.event;
  if (!event) return apiError(400, 'invalid_request', 'event is required');

  const source = event.source?.trim();
  const title = event.title?.trim();
  const tone = event.tone?.trim();
  if (!source) return apiError(400, 'invalid_request', 'event.source is required');
  if (!title) return apiError(400, 'invalid_request', 'event.title is required');
  if (!tone || !ALLOWED_TONES.has(tone)) {
    return apiError(
      400,
      'invalid_request',
      `event.tone must be one of: ${[...ALLOWED_TONES].join(', ')}`,
    );
  }

  const project = await requireProject(projectSlug);
  if (!project.ok) return apiError(project.status, project.code, project.hint);

  const taskIds = Array.isArray(body.taskIds) ? body.taskIds : [];
  if (taskIds.length > 0) {
    const found = await prisma.todoItem.findMany({
      where: { projectSlug, id: { in: taskIds } },
      select: { id: true },
    });
    const foundIds = new Set(found.map(t => t.id));
    const missing = taskIds.filter(id => !foundIds.has(id));
    if (missing.length > 0) {
      return apiError(
        400,
        'invalid_request',
        `taskIds not found in this project: ${missing.join(', ')}`,
      );
    }
  }

  const overwrite = body.overwrite === true;
  const existing = await prisma.flowEvent.findMany({
    where: { projectSlug, source },
    select: { id: true },
  });

  if (existing.length > 0 && !overwrite) {
    return apiError(
      409,
      'event_already_exists',
      `Event already exists for source "${source}". Pass overwrite:true to replace.`,
    );
  }

  if (existing.length > 0) {
    await prisma.flowEvent.deleteMany({ where: { projectSlug, source } });
  }

  const max = await prisma.flowEvent.findFirst({
    where: { projectSlug },
    orderBy: { position: 'desc' },
    select: { position: true },
  });

  const saved = await prisma.flowEvent.create({
    data: {
      projectSlug,
      date: event.date ?? '',
      source,
      title,
      summary: event.summary ?? '',
      tone,
      bullets: event.bullets ? JSON.stringify(event.bullets) : null,
      numbers: event.numbers ? JSON.stringify(event.numbers) : null,
      tags: event.tags ? JSON.stringify(event.tags) : null,
      position: (max?.position ?? -1) + 1,
    },
  });

  let linkCount = 0;
  for (const tid of taskIds) {
    try {
      await prisma.flowEventTaskLink.create({
        data: { projectSlug, flowEventId: saved.id, todoId: tid, source: 'llm' },
      });
      linkCount += 1;
    } catch {
      // unique constraint hit — already linked, ignore
    }
  }

  revalidatePath('/');
  revalidatePath(`/projects/${projectSlug}/flow`);

  const mode = existing.length > 0 ? 'updated' : 'created';
  return NextResponse.json(
    { ok: true, eventId: saved.id, mode, taskLinks: linkCount },
    { status: mode === 'updated' ? 200 : 201 },
  );
}
