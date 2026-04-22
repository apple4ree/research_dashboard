import { loadProject } from '@/lib/mock/loaders';
import {
  getEntriesByProject,
  getMilestonesByProject,
  getTodosByProject,
  getPapersByProject,
  getRunsByProject,
} from '@/lib/queries';
import { KpiBar } from '@/components/journal/KpiBar';
import { TimelinePanel } from '@/components/journal/TimelinePanel';
import { TodosPanel } from '@/components/journal/TodosPanel';
import { JournalView } from '@/components/journal/JournalView';
import { EmptyState } from '@/components/misc/EmptyState';

export default async function ProjectOverview({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await loadProject(params);

  const [entries, milestones, todos, papers, runs] = await Promise.all([
    getEntriesByProject(slug),
    getMilestonesByProject(slug),
    getTodosByProject(slug),
    getPapersByProject(slug),
    getRunsByProject(slug),
  ]);

  const papersCount = papers.length;
  const runsCount = runs.length;
  const meetingsCount = entries.filter(e => e.type === 'meeting').length;
  const targetVenue = papers.find(p => p.venue)?.venue ?? '—';

  const hasJournal =
    entries.length > 0 || milestones.length > 0 || todos.length > 0;

  return (
    <div className="space-y-6">
      <KpiBar
        stats={[
          { label: 'papers', value: papersCount, tone: 'accent' },
          { label: 'experiments', value: runsCount, tone: 'success' },
          { label: 'meetings', value: meetingsCount, tone: 'attention' },
          { label: 'target', value: targetVenue, tone: 'done' },
        ]}
      />

      {hasJournal ? (
        <>
          <TimelinePanel milestones={milestones} projectSlug={slug} />
          <TodosPanel todos={todos} projectSlug={slug} />
          <JournalView entries={entries} />
        </>
      ) : (
        <EmptyState
          title="No journal entries yet"
          body="Timeline, todos, and research log cards will appear here once you add content."
        />
      )}
    </div>
  );
}
