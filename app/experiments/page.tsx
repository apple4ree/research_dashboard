import { ExperimentsList } from '@/components/runs/ExperimentsList';
import { getAllRuns, getAllProjects, getAllMembers } from '@/lib/queries';
import { resolveRunContext } from '@/lib/queries/resolve';
import { requestNow } from '@/lib/time';

export default async function ExperimentsIndex() {
  const now = requestNow();
  const [all, projects, members] = await Promise.all([
    getAllRuns(),
    getAllProjects(),
    getAllMembers(),
  ]);
  const runs = [...all].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const ctx = await resolveRunContext(runs);
  return <ExperimentsList runs={runs} ctx={ctx} projects={projects} members={members} now={now} />;
}
