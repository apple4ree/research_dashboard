import { DiscussionForm } from '@/components/discussions/DiscussionForm';
import { getAllProjects } from '@/lib/queries';

export default async function NewDiscussionPage({
  searchParams,
}: {
  searchParams: Promise<{ projectSlug?: string }>;
}) {
  const [projects, params] = await Promise.all([getAllProjects(), searchParams]);
  return (
    <DiscussionForm
      mode="create"
      projects={projects}
      defaultProjectSlug={params.projectSlug}
    />
  );
}
