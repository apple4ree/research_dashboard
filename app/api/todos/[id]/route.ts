import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireMemberFromBearer } from '@/lib/api/bearer';
import { apiError } from '@/lib/api/errors';
import { logActivity } from '@/lib/actions/events';
import { isTodoBucket, isTaskStatus } from '@/lib/api/validators';
import type { TodoEventAction } from '@/lib/types';
import type { TaskStatus } from '@/lib/types/flow';

function parseId(s: string): number | null {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

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

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const { id: idStr } = await ctx.params;
  const id = parseId(idStr);
  if (id === null) return apiError(404, 'todo_not_found', `Todo id '${idStr}' is invalid.`);

  const existing = await prisma.todoItem.findUnique({ where: { id } });
  if (!existing) return apiError(404, 'todo_not_found', `Todo '${idStr}' not found.`);

  const body = (await req.json().catch(() => null)) as
    | {
        bucket?: string;
        text?: string;
        done?: boolean;
        position?: number;
        goal?: string | null;
        subtasks?: string[] | null;
        status?: string;
        group?: string | null;
      }
    | null;
  if (!body) return apiError(400, 'invalid_request', 'JSON body required');

  if (body.subtasks !== undefined && body.subtasks !== null) {
    if (!Array.isArray(body.subtasks) || !body.subtasks.every(s => typeof s === 'string')) {
      return apiError(400, 'invalid_request', 'subtasks must be an array of strings');
    }
  }

  const sync = resolveDoneStatus(body.done, body.status);
  if (!sync.ok) return apiError(400, 'invalid_request', sync.hint);

  const data: {
    bucket?: string;
    text?: string;
    position?: number;
    goal?: string | null;
    subtasks?: string | null;
    group?: string | null;
    done?: boolean;
    status?: TaskStatus;
  } = {};
  if (body.bucket !== undefined) {
    if (!isTodoBucket(body.bucket)) return apiError(400, 'invalid_request', 'bucket must be one of short/mid/long');
    data.bucket = body.bucket;
  }
  if (body.text !== undefined) data.text = body.text;
  if (body.position !== undefined) data.position = body.position;
  if (body.goal !== undefined) data.goal = body.goal;
  if (body.subtasks !== undefined) {
    data.subtasks = body.subtasks && body.subtasks.length > 0 ? JSON.stringify(body.subtasks) : null;
  }
  if (body.group !== undefined) data.group = body.group;
  if (sync.done !== undefined) data.done = sync.done;
  if (sync.status !== undefined) data.status = sync.status;

  const updated = await prisma.todoItem.update({ where: { id }, data });

  let action: TodoEventAction = 'updated';
  if (sync.done === true && existing.done === false) action = 'completed';
  else if (sync.done === false && existing.done === true) action = 'reopened';

  await logActivity({
    type: 'todo',
    actorLogin: auth.memberLogin,
    projectSlug: existing.projectSlug,
    payload: { todoId: id, action },
  });

  revalidatePath('/');
  revalidatePath(`/projects/${existing.projectSlug}`);
  revalidatePath(`/projects/${existing.projectSlug}/flow`);

  return NextResponse.json({
    id: updated.id,
    projectSlug: updated.projectSlug,
    bucket: updated.bucket,
    text: updated.text,
    done: updated.done,
    status: updated.status,
    position: updated.position,
    goal: updated.goal,
    subtasks: updated.subtasks ? JSON.parse(updated.subtasks) : null,
    group: updated.group,
  });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const { id: idStr } = await ctx.params;
  const id = parseId(idStr);
  if (id === null) return apiError(404, 'todo_not_found', `Todo id '${idStr}' is invalid.`);

  const existing = await prisma.todoItem.findUnique({ where: { id } });
  if (!existing) return apiError(404, 'todo_not_found', `Todo '${idStr}' not found.`);

  await prisma.todoItem.delete({ where: { id } });

  await logActivity({
    type: 'todo',
    actorLogin: auth.memberLogin,
    projectSlug: existing.projectSlug,
    payload: { todoId: id, action: 'deleted' },
  });

  revalidatePath('/');
  revalidatePath(`/projects/${existing.projectSlug}`);
  revalidatePath(`/projects/${existing.projectSlug}/flow`);

  return new NextResponse(null, { status: 204 });
}
