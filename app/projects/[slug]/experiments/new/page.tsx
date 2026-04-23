import { RunCreateForm } from '@/components/runs/RunCreateForm';
import { getAllMembers, getAllProjects } from '@/lib/queries';
import { loadProject } from '@/lib/mock/loaders';

export default async function NewProjectRunPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await loadProject(params);
  const [members, projects] = await Promise.all([getAllMembers(), getAllProjects()]);
  return (
    <RunCreateForm
      projects={projects}
      members={members}
      defaultProjectSlug={slug}
      scopedProjectSlug={slug}
    />
  );
}
