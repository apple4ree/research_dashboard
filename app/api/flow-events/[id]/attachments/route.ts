import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireMemberFromBearer } from '@/lib/api/bearer';
import { apiError } from '@/lib/api/errors';
import { writeAttachmentFile, MAX_UPLOAD_BYTES } from '@/lib/uploads';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (!Number.isFinite(id)) {
    return apiError(404, 'flow_event_not_found', `Flow event id '${idStr}' is invalid.`);
  }

  const event = await prisma.flowEvent.findUnique({
    where: { id },
    select: { id: true, projectSlug: true },
  });
  if (!event) return apiError(404, 'flow_event_not_found', `Flow event '${idStr}' not found.`);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return apiError(400, 'invalid_request', 'multipart/form-data body required');
  }

  const fileRaw = form.get('file');
  if (!(fileRaw instanceof File) || fileRaw.size === 0) {
    return apiError(400, 'invalid_request', 'file field is required');
  }
  if (fileRaw.size > MAX_UPLOAD_BYTES) {
    return apiError(400, 'invalid_request', `file too large (${fileRaw.size} bytes; max ${MAX_UPLOAD_BYTES})`);
  }

  const titleRaw = form.get('title');
  const title =
    typeof titleRaw === 'string' && titleRaw.trim()
      ? titleRaw.trim()
      : fileRaw.name || 'attachment';

  const lastPos = await prisma.flowEventAttachment.findFirst({
    where: { flowEventId: id },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const position = (lastPos?.position ?? -1) + 1;

  const created = await prisma.flowEventAttachment.create({
    data: { flowEventId: id, title, storedPath: '', position },
  });

  let storedPath: string;
  let sizeBytes: number;
  try {
    const written = await writeAttachmentFile({
      subdir: 'flow-events',
      scopeSegments: [String(id)],
      attachmentId: created.id,
      file: fileRaw,
    });
    storedPath = written.storedPath;
    sizeBytes = written.sizeBytes;
  } catch (err) {
    await prisma.flowEventAttachment.delete({ where: { id: created.id } }).catch(() => {});
    return apiError(
      500,
      'invalid_request',
      err instanceof Error ? err.message : 'failed to write file',
    );
  }

  const updated = await prisma.flowEventAttachment.update({
    where: { id: created.id },
    data: {
      storedPath,
      sizeBytes,
      originalFilename: fileRaw.name,
      mimeType: fileRaw.type || 'application/octet-stream',
    },
  });

  revalidatePath(`/projects/${event.projectSlug}/flow`);

  return NextResponse.json(
    {
      id: updated.id,
      title: updated.title,
      href: `/api/flow-event-attachments/${updated.id}`,
      originalFilename: updated.originalFilename,
      mimeType: updated.mimeType,
      sizeBytes: updated.sizeBytes,
    },
    { status: 201 },
  );
}
