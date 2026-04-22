import { notFound } from 'next/navigation';
import { getProjectBySlug } from '@/lib/queries';
import { ProjectEditForm } from '@/components/project/ProjectEditForm';

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  return <ProjectEditForm project={project} />;
}
