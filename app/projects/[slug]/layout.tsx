import { ProjectHeader } from '@/components/project/ProjectHeader';
import { TabBar } from '@/components/project/TabBar';
import { loadProject } from '@/lib/mock/loaders';
import { prisma } from '@/lib/db';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug, project } = await loadProject(params);
  const row = await prisma.project.findUnique({
    where: { slug },
    select: { source: true },
  });

  return (
    <div className="space-y-4">
      <ProjectHeader project={project} source={row?.source ?? 'internal'} />
      <TabBar slug={slug} />
      {children}
    </div>
  );
}
