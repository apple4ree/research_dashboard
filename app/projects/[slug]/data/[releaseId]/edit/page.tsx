import { notFound } from 'next/navigation';
import { getProjectBySlug, getReleaseById } from '@/lib/queries';
import { ReleaseForm } from '@/components/project/ReleaseForm';

export default async function EditReleasePage({
  params,
}: {
  params: Promise<{ slug: string; releaseId: string }>;
}) {
  const { slug, releaseId } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const release = await getReleaseById(releaseId);
  if (!release || release.projectSlug !== slug) notFound();

  return <ReleaseForm mode="edit" projectSlug={slug} initial={release} />;
}
