import { type NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import { prisma } from '@/lib/db';
import { absoluteStoredPath } from '@/lib/uploads';

/**
 * Stream a stored entry artifact file. Auth is enforced by middleware
 * (cookie session), so reaching this handler means the caller is allowed.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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

  // Reading into memory caps at 100MB per file (the upload limit), so
  // streaming via Node ReadableStream isn't strictly required here.
  const headers = new Headers();
  headers.set('Content-Type', artifact.mimeType ?? 'application/octet-stream');
  headers.set(
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(artifact.originalFilename ?? 'file')}`,
  );
  headers.set('Content-Length', String(buf.byteLength));
  // Don't let Cloudflare cache authenticated downloads.
  headers.set('Cache-Control', 'private, no-store');

  return new NextResponse(new Uint8Array(buf), { status: 200, headers });
}
