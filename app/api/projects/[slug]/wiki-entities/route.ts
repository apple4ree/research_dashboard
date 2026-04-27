import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMemberFromBearer } from '@/lib/api/bearer';
import { apiError } from '@/lib/api/errors';
import { requireProject } from '@/lib/api/project';

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const { slug } = await ctx.params;
  const project = await requireProject(slug);
  if (!project.ok) return apiError(project.status, project.code, project.hint);

  const rows = await prisma.wikiEntity.findMany({
    where: { projectSlug: slug },
    orderBy: [{ type: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      type: true,
      name: true,
      status: true,
      summaryMarkdown: true,
      sourceFiles: true,
      lastSyncedAt: true,
    },
  });

  const entities = rows.map(r => ({
    ...r,
    sourceFiles: safeParseStringArray(r.sourceFiles),
  }));

  return NextResponse.json({ entities });
}

function safeParseStringArray(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
