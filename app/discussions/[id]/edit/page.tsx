import { notFound } from 'next/navigation';
import { DiscussionForm } from '@/components/discussions/DiscussionForm';
import { getDiscussionById } from '@/lib/queries';

export default async function EditDiscussionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const discussion = await getDiscussionById(id);
  if (!discussion) notFound();

  return <DiscussionForm mode="edit" initial={discussion} />;
}
