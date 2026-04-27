import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireMemberFromBearer } from '@/lib/api/bearer';
import { apiError } from '@/lib/api/errors';
import { requireProject } from '@/lib/api/project';

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string; key: string }> },
) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const { slug, key } = await ctx.params;
  const project = await requireProject(slug);
  if (!project.ok) return apiError(project.status, project.code, project.hint);

  const existing = await prisma.wikiType.findUnique({
    where: { projectSlug_key: { projectSlug: slug, key } },
    select: { id: true },
  });
  if (!existing) {
    return apiError(404, 'wiki_type_not_found', `Wiki type '${key}' not found in project '${slug}'.`);
  }

  const inUse = await prisma.wikiEntity.findFirst({
    where: { projectSlug: slug, type: key },
    select: { id: true },
  });
  if (inUse) {
    return apiError(409, 'wiki_type_in_use', `Wiki type '${key}' is referenced by at least one WikiEntity.`);
  }

  await prisma.wikiType.delete({
    where: { projectSlug_key: { projectSlug: slug, key } },
  });

  revalidatePath(`/projects/${slug}/wiki`);
  return new NextResponse(null, { status: 204 });
}
