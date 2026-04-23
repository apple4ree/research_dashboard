import { DiscussionForm } from '@/components/discussions/DiscussionForm';
import { getAllProjects } from '@/lib/queries';
import { loadProject } from '@/lib/mock/loaders';

export default async function NewProjectDiscussionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await loadProject(params);
  const projects = await getAllProjects();
  return (
    <DiscussionForm
      mode="create"
      projects={projects}
      scopedProjectSlug={slug}
    />
  );
}
