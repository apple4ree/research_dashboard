import { notFound } from 'next/navigation';
import { ProjectHeader } from '@/components/project/ProjectHeader';
import { TabBar } from '@/components/project/TabBar';
import { getProjectBySlug } from '@/lib/mock';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) notFound();

  return (
    <div className="space-y-4">
      <ProjectHeader project={project} />
      <TabBar slug={slug} />
      {children}
    </div>
  );
}
