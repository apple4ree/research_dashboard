import { notFound } from 'next/navigation';
import { getProjectBySlug, getAllMembers } from '@/lib/queries';
import { PaperCreateForm } from '@/components/project/PaperCreateForm';

export default async function NewPaperPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();
  const members = await getAllMembers();

  return (
    <PaperCreateForm
      projectSlug={slug}
      projectName={project.name}
      projectDescription={project.description}
      members={members}
    />
  );
}
