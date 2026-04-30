import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireMemberFromBearer } from '@/lib/api/bearer';
import { apiError } from '@/lib/api/errors';
import { writeAttachmentFile, MAX_UPLOAD_BYTES } from '@/lib/uploads';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const { id: resultId } = await ctx.params;
  const result = await prisma.experimentResult.findUnique({
    where: { id: resultId },
    include: { experiment: { select: { id: true, projectSlug: true } } },
  });
  if (!result) return apiError(404, 'result_not_found', `Result '${resultId}' not found.`);

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

  const lastPos = await prisma.experimentResultAttachment.findFirst({
    where: { resultId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const position = (lastPos?.position ?? -1) + 1;

  const created = await prisma.experimentResultAttachment.create({
    data: { resultId, title, storedPath: '', position },
  });

  try {
    const written = await writeAttachmentFile({
      subdir: 'experiment-results',
      scopeSegments: [resultId],
      attachmentId: created.id,
      file: fileRaw,
    });
    const updated = await prisma.experimentResultAttachment.update({
      where: { id: created.id },
      data: {
        storedPath: written.storedPath,
        sizeBytes: written.sizeBytes,
        originalFilename: fileRaw.name,
        mimeType: fileRaw.type || 'application/octet-stream',
      },
    });

    revalidatePath(`/projects/${result.experiment.projectSlug}/experiments/${result.experiment.id}`);
    revalidatePath(`/projects/${result.experiment.projectSlug}/results`);

    return NextResponse.json(
      {
        id: updated.id,
        title: updated.title,
        href: `/api/uploads/result-attachments/${updated.id}`,
        originalFilename: updated.originalFilename,
        mimeType: updated.mimeType,
        sizeBytes: updated.sizeBytes,
      },
      { status: 201 },
    );
  } catch (err) {
    await prisma.experimentResultAttachment.delete({ where: { id: created.id } }).catch(() => {});
    return apiError(500, 'invalid_request', err instanceof Error ? err.message : 'failed to write file');
  }
}
