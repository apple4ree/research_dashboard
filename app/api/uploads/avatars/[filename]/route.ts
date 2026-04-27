import { type NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { avatarFsPath, avatarMimeForExt } from '@/lib/avatars';

/**
 * Serve a stored member avatar. Auth gating happens in middleware (cookie
 * session). The middleware lets /api/uploads/avatars/* through to here only
 * for signed-in browsers.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ filename: string }> },
) {
  const { filename } = await ctx.params;
  let absPath: string;
  try {
    absPath = avatarFsPath(filename);
  } catch {
    return new NextResponse('not found', { status: 404 });
  }

  let buf: Buffer;
  try {
    buf = await fs.readFile(absPath);
  } catch {
    return new NextResponse('not found', { status: 404 });
  }

  const ext = path.extname(filename).slice(1);
  const headers = new Headers();
  headers.set('Content-Type', avatarMimeForExt(ext));
  headers.set('Content-Length', String(buf.byteLength));
  // Avatars are small + version-pinned via ?v=… query, so allow short cache.
  headers.set('Cache-Control', 'private, max-age=300');

  return new NextResponse(new Uint8Array(buf), { status: 200, headers });
}
