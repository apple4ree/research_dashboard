import { type NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import { prisma } from '@/lib/db';
import { absoluteStoredPath } from '@/lib/uploads';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (!Number.isFinite(id)) return new NextResponse('not found', { status: 404 });

  const att = await prisma.flowEventAttachment.findUnique({
    where: { id },
    select: { storedPath: true, originalFilename: true, mimeType: true },
  });
  if (!att || !att.storedPath) return new NextResponse('not found', { status: 404 });

  let buf: Buffer;
  try {
    buf = await fs.readFile(absoluteStoredPath(att.storedPath));
  } catch {
    return new NextResponse('file missing on disk', { status: 410 });
  }

  const inline = req.nextUrl.searchParams.get('inline') === '1';
  const filename = att.originalFilename ?? 'file';
  let contentType = att.mimeType ?? 'application/octet-stream';
  if (inline && (contentType === 'text/markdown' || /\.md$/i.test(filename))) {
    contentType = 'text/plain; charset=utf-8';
  }

  const headers = new Headers();
  headers.set('Content-Type', contentType);
  headers.set(
    'Content-Disposition',
    `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(filename)}`,
  );
  headers.set('Content-Length', String(buf.byteLength));
  headers.set('Cache-Control', 'private, no-store');

  return new NextResponse(new Uint8Array(buf), { status: 200, headers });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { requireMemberFromBearer } = await import('@/lib/api/bearer');
  const { apiError } = await import('@/lib/api/errors');
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (!Number.isFinite(id)) return apiError(404, 'invalid_request', 'invalid id');

  const att = await prisma.flowEventAttachment.findUnique({
    where: { id },
    select: { storedPath: true, flowEvent: { select: { projectSlug: true } } },
  });
  if (!att) return apiError(404, 'invalid_request', 'attachment not found');

  if (att.storedPath) {
    try {
      await fs.unlink(absoluteStoredPath(att.storedPath));
    } catch { /* already gone */ }
  }
  await prisma.flowEventAttachment.delete({ where: { id } });

  if (att.flowEvent) {
    const { revalidatePath } = await import('next/cache');
    revalidatePath(`/projects/${att.flowEvent.projectSlug}/flow`);
  }

  return new NextResponse(null, { status: 204 });
}
