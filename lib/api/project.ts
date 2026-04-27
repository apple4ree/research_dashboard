import { prisma } from '@/lib/db';
import { type ApiErrorCode } from './errors';

export type RequireProjectResult =
  | { ok: true; slug: string }
  | { ok: false; status: 404; code: Extract<ApiErrorCode, 'project_not_found'>; hint: string };

/**
 * Confirm a project exists by slug. Returns either { ok: true, slug } or
 * a discriminated 404 result for callers to feed into apiError(...).
 *
 * Most route handlers under /api/projects/:slug/... need this; centralizing
 * keeps the apiError code + hint shape consistent across endpoints.
 */
export async function requireProject(slug: string): Promise<RequireProjectResult> {
  const project = await prisma.project.findUnique({ where: { slug }, select: { slug: true } });
  if (!project) {
    return {
      ok: false,
      status: 404,
      code: 'project_not_found',
      hint: `Project '${slug}' not found.`,
    };
  }
  return { ok: true, slug: project.slug };
}
