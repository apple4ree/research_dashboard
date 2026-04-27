import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireMemberFromBearer } from '@/lib/api/bearer';
import { apiError } from '@/lib/api/errors';
import { logActivity } from '@/lib/actions/events';
import { isTodoBucket } from '@/lib/api/validators';
import type { TodoEventAction } from '@/lib/types';

function parseId(s: string): number | null {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
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
    | { bucket?: string; text?: string; done?: boolean; position?: number }
    | null;
  if (!body) return apiError(400, 'invalid_request', 'JSON body required');

  const data: { bucket?: string; text?: string; done?: boolean; position?: number } = {};
  if (body.bucket !== undefined) {
    if (!isTodoBucket(body.bucket)) return apiError(400, 'invalid_request', 'bucket must be one of short/mid/long');
    data.bucket = body.bucket;
  }
  if (body.text !== undefined) data.text = body.text;
  if (body.done !== undefined) data.done = body.done;
  if (body.position !== undefined) data.position = body.position;

  const updated = await prisma.todoItem.update({ where: { id }, data });

  // Activity action: completed/reopened on done flip, otherwise updated.
  let action: TodoEventAction = 'updated';
  if (body.done === true && existing.done === false) action = 'completed';
  else if (body.done === false && existing.done === true) action = 'reopened';

  await logActivity({
    type: 'todo',
    actorLogin: auth.memberLogin,
    projectSlug: existing.projectSlug,
    payload: { todoId: id, action },
  });

  revalidatePath('/');
  revalidatePath(`/projects/${existing.projectSlug}`);

  return NextResponse.json({
    id: updated.id,
    projectSlug: updated.projectSlug,
    bucket: updated.bucket,
    text: updated.text,
    done: updated.done,
    position: updated.position,
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

  return new NextResponse(null, { status: 204 });
}
