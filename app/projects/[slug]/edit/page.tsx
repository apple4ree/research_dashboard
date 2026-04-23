import { notFound } from 'next/navigation';
import { getProjectBySlug } from '@/lib/queries';
import { prisma } from '@/lib/db';
import { ProjectEditForm } from '@/components/project/ProjectEditForm';

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const repoRows = await prisma.projectRepo.findMany({
    where: { projectSlug: slug },
    orderBy: { id: 'asc' },
  });
  const repos = repoRows.map(r => ({ id: r.id, label: r.label, url: r.url }));

  return <ProjectEditForm project={project} repos={repos} />;
}
