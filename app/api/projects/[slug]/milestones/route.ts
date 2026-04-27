import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMemberFromBearer } from '@/lib/api/bearer';
import { apiError } from '@/lib/api/errors';
import { getMilestonesByProject } from '@/lib/queries';

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const { slug } = await ctx.params;
  const project = await prisma.project.findUnique({ where: { slug } });
  if (!project) return apiError(404, 'project_not_found', `Project '${slug}' not found.`);

  const milestones = await getMilestonesByProject(slug);
  return NextResponse.json({ milestones });
}
