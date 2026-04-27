import { type NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import { prisma } from '@/lib/db';
import { absoluteStoredPath } from '@/lib/uploads';

/**
 * Stream a stored entry artifact file. Auth is enforced by middleware
 * (cookie session), so reaching this handler means the caller is allowed.
 *
 * Query: `?inline=1` flips Content-Disposition from `attachment` (default,
 * triggers a download) to `inline`, letting the browser render
 * markdown/html/images/pdf in a new tab instead of saving them.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (!Number.isFinite(id)) {
    return new NextResponse('not found', { status: 404 });
  }

  const artifact = await prisma.entryArtifact.findUnique({
    where: { id },
    select: { storedPath: true, originalFilename: true, mimeType: true },
  });
  if (!artifact || !artifact.storedPath) {
    return new NextResponse('not found', { status: 404 });
  }

  const abs = absoluteStoredPath(artifact.storedPath);
  let buf: Buffer;
  try {
    buf = await fs.readFile(abs);
  } catch {
    return new NextResponse('file missing on disk', { status: 410 });
  }

  const inline = req.nextUrl.searchParams.get('inline') === '1';

  // Markdown lacks a registered IANA mime in some browsers and gets
  // downloaded even with inline disposition; nudge it to text/plain so
  // it just shows as text in the new tab.
  const filename = artifact.originalFilename ?? 'file';
  let contentType = artifact.mimeType ?? 'application/octet-stream';
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
