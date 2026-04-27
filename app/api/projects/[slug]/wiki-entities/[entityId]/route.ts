import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMemberFromBearer } from '@/lib/api/bearer';
import { apiError } from '@/lib/api/errors';
import { requireProject } from '@/lib/api/project';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string; entityId: string }> },
) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const { slug, entityId } = await ctx.params;
  const project = await requireProject(slug);
  if (!project.ok) return apiError(project.status, project.code, project.hint);

  const row = await prisma.wikiEntity.findUnique({
    where: { projectSlug_id: { projectSlug: slug, id: entityId } },
    select: {
      id: true,
      type: true,
      name: true,
      status: true,
      summaryMarkdown: true,
      bodyMarkdown: true,
      sourceFiles: true,
      lastSyncedAt: true,
    },
  });

  if (!row) {
    return apiError(404, 'entity_not_found', `Entity '${entityId}' not found in project '${slug}'.`);
  }

  let sourceFiles: string[] = [];
  try {
    const v = JSON.parse(row.sourceFiles);
    if (Array.isArray(v)) sourceFiles = v.filter(x => typeof x === 'string');
  } catch {
    // leave empty
  }

  return NextResponse.json({ ...row, sourceFiles });
}
