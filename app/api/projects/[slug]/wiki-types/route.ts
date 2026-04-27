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

  const types = await prisma.wikiType.findMany({
    where: { projectSlug: slug },
    orderBy: { position: 'asc' },
    select: { key: true, label: true, description: true },
  });

  return NextResponse.json({ types });
}
