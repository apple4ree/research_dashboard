import { notFound } from 'next/navigation';
import { DiscussionForm } from '@/components/discussions/DiscussionForm';
import { getDiscussionById, getAllProjects } from '@/lib/queries';

export default async function EditDiscussionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [discussion, projects] = await Promise.all([
    getDiscussionById(id),
    getAllProjects(),
  ]);
  if (!discussion) notFound();

  return <DiscussionForm mode="edit" initial={discussion} projects={projects} />;
}
