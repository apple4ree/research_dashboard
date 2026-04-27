import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireMemberFromBearer } from '@/lib/api/bearer';
import { apiError } from '@/lib/api/errors';
import { logActivity } from '@/lib/actions/events';
import { isTodoBucket, isTaskStatus } from '@/lib/api/validators';
import type { TaskStatus } from '@/lib/types/flow';

/**
 * Resolve {done, status} from body fields per the sync invariant.
 * status (if present) wins; otherwise derive from done; otherwise both undefined.
 */
function resolveDoneStatus(
  bodyDone: unknown,
  bodyStatus: unknown,
): { ok: true; done?: boolean; status?: TaskStatus } | { ok: false; hint: string } {
  if (bodyStatus !== undefined) {
    if (!isTaskStatus(bodyStatus)) {
      return { ok: false, hint: 'status must be one of pending/in_progress/done' };
    }
    return { ok: true, status: bodyStatus, done: bodyStatus === 'done' };
  }
  if (bodyDone !== undefined) {
    if (typeof bodyDone !== 'boolean') {
      return { ok: false, hint: 'done must be boolean' };
    }
    return { ok: true, done: bodyDone, status: bodyDone ? 'done' : 'in_progress' };
  }
  return { ok: true };
}

export async function POST(req: NextRequest) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const body = (await req.json().catch(() => null)) as
    | {
        projectSlug?: string;
        bucket?: string;
        text?: string;
        position?: number;
        goal?: string | null;
        subtasks?: string[] | null;
        status?: string;
        group?: string | null;
        done?: boolean;
      }
    | null;
  if (!body) return apiError(400, 'invalid_request', 'JSON body required');

  const projectSlug = body.projectSlug?.trim();
  const bucket = body.bucket?.trim();
  const text = body.text?.trim();

  if (!projectSlug) return apiError(400, 'invalid_request', 'projectSlug is required');
  if (!bucket || !isTodoBucket(bucket)) return apiError(400, 'invalid_request', 'bucket must be one of short/mid/long');
  if (!text) return apiError(400, 'invalid_request', 'text is required');

  if (body.subtasks !== undefined && body.subtasks !== null) {
    if (!Array.isArray(body.subtasks) || !body.subtasks.every(s => typeof s === 'string')) {
      return apiError(400, 'invalid_request', 'subtasks must be an array of strings');
    }
  }

  const sync = resolveDoneStatus(body.done, body.status);
  if (!sync.ok) return apiError(400, 'invalid_request', sync.hint);

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
    data: {
      projectSlug,
      bucket,
      text,
      done: sync.done ?? false,
      status: sync.status ?? 'in_progress',
      position,
      goal: body.goal ?? null,
      subtasks: body.subtasks && body.subtasks.length > 0 ? JSON.stringify(body.subtasks) : null,
      group: body.group ?? null,
    },
  });

  await logActivity({
    type: 'todo',
    actorLogin: auth.memberLogin,
    projectSlug,
    payload: { todoId: created.id, action: 'created' },
  });

  revalidatePath('/');
  revalidatePath(`/projects/${projectSlug}`);
  revalidatePath(`/projects/${projectSlug}/flow`);

  return NextResponse.json({ id: created.id }, { status: 201 });
}
