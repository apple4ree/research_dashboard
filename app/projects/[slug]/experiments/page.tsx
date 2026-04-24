import { getRunsByProject, getAllMembers, getAllProjects } from '@/lib/queries';
import { resolveRunContext } from '@/lib/queries/resolve';
import { loadProject } from '@/lib/mock/loaders';
import { requestNow } from '@/lib/time';
import { ProjectExperimentsView } from '@/components/runs/ProjectExperimentsView';

export default async function ProjectExperiments({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await loadProject(params);
  const [runs, members, projects] = await Promise.all([
    getRunsByProject(slug),
    getAllMembers(),
    getAllProjects(),
  ]);
  const sorted = runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const ctx = await resolveRunContext(sorted);
  return (
    <ProjectExperimentsView
      projectSlug={slug}
      runs={sorted}
      ctx={ctx}
      members={members}
      projects={projects}
      now={requestNow()}
    />
  );
}
