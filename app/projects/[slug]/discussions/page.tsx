import { getDiscussionsByProject, getAllProjects } from '@/lib/queries';
import { loadProject } from '@/lib/mock/loaders';
import { requestNow } from '@/lib/time';
import { ProjectDiscussionsView } from '@/components/project/ProjectDiscussionsView';

export default async function ProjectDiscussions({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await loadProject(params);
  const [discussions, projects] = await Promise.all([
    getDiscussionsByProject(slug),
    getAllProjects(),
  ]);
  const sorted = discussions.sort((a, b) =>
    b.lastActivityAt.localeCompare(a.lastActivityAt),
  );
  return (
    <ProjectDiscussionsView
      projectSlug={slug}
      discussions={sorted}
      projects={projects}
      now={requestNow()}
    />
  );
}
