import { notFound } from 'next/navigation';
import { getRunById } from '@/lib/queries';
import { loadProject } from '@/lib/mock/loaders';
import { RunEditForm } from '@/components/runs/RunEditForm';

export default async function EditProjectRunPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  await loadProject(Promise.resolve({ slug }));
  const run = await getRunById(id);
  if (!run || run.projectSlug !== slug) notFound();

  return <RunEditForm run={run} projectSlug={slug} />;
}
