import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireMemberFromBearer } from '@/lib/api/bearer';
import { apiError } from '@/lib/api/errors';
import { writeArtifactFile, MAX_UPLOAD_BYTES } from '@/lib/uploads';
import type { ArtifactType } from '@/lib/types';

const ARTIFACT_TYPES: readonly ArtifactType[] = ['notebook', 'figure', 'sheet', 'csv', 'doc', 'slide'];

/**
 * Bearer-auth multipart endpoint for attaching a single file to an existing
 * entry. Lets skills (which can't run the multipart form action used by the
 * UI) upload PDFs / notebooks / images by streaming the bytes here.
 *
 * Required form fields:
 *   - file:   File (binary)
 * Optional form fields:
 *   - title:  string  (defaults to the original filename)
 *   - type:   one of ARTIFACT_TYPES (defaults to 'doc')
 *
 * Response: { id, type, title, href, originalFilename, mimeType, sizeBytes }
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const { id: entryId } = await ctx.params;
  const entry = await prisma.researchEntry.findUnique({
    where: { id: entryId },
    select: { id: true, projectSlug: true },
  });
  if (!entry) return apiError(404, 'entry_not_found', `Entry '${entryId}' not found.`);

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
    return apiError(
      400,
      'invalid_request',
      `file too large (${fileRaw.size} bytes; max ${MAX_UPLOAD_BYTES})`,
    );
  }

  const titleRaw = form.get('title');
  const title =
    typeof titleRaw === 'string' && titleRaw.trim()
      ? titleRaw.trim()
      : fileRaw.name || 'attachment';

  const typeRaw = form.get('type');
  const type =
    typeof typeRaw === 'string' && (ARTIFACT_TYPES as readonly string[]).includes(typeRaw)
      ? (typeRaw as ArtifactType)
      : 'doc';

  // Pre-allocate a row to claim an autoincrement id, write the file, then
  // fill in storedPath/href/etc. Mirrors the UI form path.
  const lastPos = await prisma.entryArtifact.findFirst({
    where: { entryId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const position = (lastPos?.position ?? -1) + 1;

  const created = await prisma.entryArtifact.create({
    data: { entryId, type, title, href: '', position },
  });

  let storedPath: string;
  let sizeBytes: number;
  try {
    const written = await writeArtifactFile(entryId, created.id, fileRaw);
    storedPath = written.storedPath;
    sizeBytes = written.sizeBytes;
  } catch (err) {
    await prisma.entryArtifact.delete({ where: { id: created.id } }).catch(() => {});
    return apiError(
      500,
      'invalid_request',
      err instanceof Error ? err.message : 'failed to write file',
    );
  }

  const updated = await prisma.entryArtifact.update({
    where: { id: created.id },
    data: {
      storedPath,
      sizeBytes,
      originalFilename: fileRaw.name,
      mimeType: fileRaw.type || 'application/octet-stream',
      href: `/api/uploads/${created.id}`,
    },
  });

  revalidatePath(`/projects/${entry.projectSlug}`);

  return NextResponse.json(
    {
      id: updated.id,
      type: updated.type,
      title: updated.title,
      href: updated.href,
      originalFilename: updated.originalFilename,
      mimeType: updated.mimeType,
      sizeBytes: updated.sizeBytes,
    },
    { status: 201 },
  );
}
