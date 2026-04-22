import { ProjectHeader } from '@/components/project/ProjectHeader';
import { TabBar } from '@/components/project/TabBar';
import { loadProject } from '@/lib/mock/loaders';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug, project } = await loadProject(params);

  return (
    <div className="space-y-4">
      <ProjectHeader project={project} />
      <TabBar slug={slug} />
      {children}
    </div>
  );
}
