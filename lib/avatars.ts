import path from 'node:path';
import { promises as fs } from 'node:fs';
import { UPLOADS_ROOT } from '@/lib/uploads';

export const AVATARS_ROOT = path.join(UPLOADS_ROOT, 'avatars');

/** ≤10MB profile pictures. Cloudflare cap is 100MB but no need to allow huge images here. */
export const MAX_AVATAR_BYTES = 10 * 1024 * 1024;

const ALLOWED_EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

export const ALLOWED_AVATAR_MIMES = Object.keys(ALLOWED_EXT_BY_MIME);

export function avatarExtForMime(mime: string): string | null {
  return ALLOWED_EXT_BY_MIME[mime.toLowerCase()] ?? null;
}

const EXT_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

export function avatarMimeForExt(ext: string): string {
  return EXT_TO_MIME[ext.toLowerCase()] ?? 'application/octet-stream';
}

async function ensureAvatarsRoot(): Promise<void> {
  await fs.mkdir(AVATARS_ROOT, { recursive: true });
}

/** Remove every existing avatar file for this login (any allowed extension). */
export async function deleteAvatarFiles(login: string): Promise<void> {
  await ensureAvatarsRoot();
  const entries = await fs.readdir(AVATARS_ROOT).catch(() => [] as string[]);
  await Promise.all(
    entries
      .filter(f => f.startsWith(`${login}.`))
      .map(f => fs.unlink(path.join(AVATARS_ROOT, f)).catch(() => {})),
  );
}

/** Persist a new avatar file. Returns the relative URL the route handler serves. */
export async function writeAvatar(
  login: string,
  file: File,
): Promise<{ avatarUrl: string }> {
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error(`Avatar too large (${file.size} bytes; max ${MAX_AVATAR_BYTES}).`);
  }
  const ext = avatarExtForMime(file.type);
  if (!ext) {
    throw new Error(`Unsupported avatar mime "${file.type}". Allowed: ${ALLOWED_AVATAR_MIMES.join(', ')}.`);
  }
  await deleteAvatarFiles(login);
  const filename = `${login}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(AVATARS_ROOT, filename), buf);
  // Cache-bust via mtime — clients see fresh images when uploaded again.
  return { avatarUrl: `/api/uploads/avatars/${filename}?v=${Date.now()}` };
}

export function avatarFsPath(filename: string): string {
  // Reject path traversal.
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    throw new Error('invalid avatar filename');
  }
  return path.join(AVATARS_ROOT, filename);
}
