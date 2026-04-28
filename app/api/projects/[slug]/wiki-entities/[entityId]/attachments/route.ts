import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireMemberFromBearer } from '@/lib/api/bearer';
import { apiError } from '@/lib/api/errors';
import { requireProject } from '@/lib/api/project';
import { writeAttachmentFile, MAX_UPLOAD_BYTES } from '@/lib/uploads';

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string; entityId: string }> },
) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const { slug, entityId } = await ctx.params;
  const project = await requireProject(slug);
  if (!project.ok) return apiError(project.status, project.code, project.hint);

  const entity = await prisma.wikiEntity.findUnique({
    where: { projectSlug_id: { projectSlug: slug, id: entityId } },
    select: { id: true },
  });
  if (!entity) {
    return apiError(404, 'entity_not_found', `Entity '${entityId}' not found in project '${slug}'.`);
  }

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

  const lastPos = await prisma.wikiEntityAttachment.findFirst({
    where: { projectSlug: slug, entityId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const position = (lastPos?.position ?? -1) + 1;

  const created = await prisma.wikiEntityAttachment.create({
    data: { projectSlug: slug, entityId, title, storedPath: '', position },
  });

  let storedPath: string;
  let sizeBytes: number;
  try {
    const written = await writeAttachmentFile({
      subdir: 'wiki-entities',
      scopeSegments: [slug, entityId],
      attachmentId: created.id,
      file: fileRaw,
    });
    storedPath = written.storedPath;
    sizeBytes = written.sizeBytes;
  } catch (err) {
    await prisma.wikiEntityAttachment.delete({ where: { id: created.id } }).catch(() => {});
    return apiError(
      500,
      'invalid_request',
      err instanceof Error ? err.message : 'failed to write file',
    );
  }

  const updated = await prisma.wikiEntityAttachment.update({
    where: { id: created.id },
    data: {
      storedPath,
      sizeBytes,
      originalFilename: fileRaw.name,
      mimeType: fileRaw.type || 'application/octet-stream',
    },
  });

  revalidatePath(`/projects/${slug}/wiki/${entityId}`);
  revalidatePath(`/projects/${slug}/wiki`);

  return NextResponse.json(
    {
      id: updated.id,
      title: updated.title,
      href: `/api/wiki-entity-attachments/${updated.id}`,
      originalFilename: updated.originalFilename,
      mimeType: updated.mimeType,
      sizeBytes: updated.sizeBytes,
    },
    { status: 201 },
  );
}
