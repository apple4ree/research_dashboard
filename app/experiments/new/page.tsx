import { RunCreateForm } from '@/components/runs/RunCreateForm';
import { getAllProjects, getAllMembers } from '@/lib/queries';

export default async function NewRunPage({
  searchParams,
}: {
  searchParams: Promise<{ projectSlug?: string }>;
}) {
  const [projects, members, params] = await Promise.all([
    getAllProjects(),
    getAllMembers(),
    searchParams,
  ]);
  return (
    <RunCreateForm
      projects={projects}
      members={members}
      defaultProjectSlug={params.projectSlug}
    />
  );
}
