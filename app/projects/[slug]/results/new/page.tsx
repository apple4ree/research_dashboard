import { loadProject } from '@/lib/mock/loaders';
import { ReleaseForm } from '@/components/project/ReleaseForm';

export default async function NewReleasePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await loadProject(params);
  return <ReleaseForm mode="create" projectSlug={slug} />;
}
