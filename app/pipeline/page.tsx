import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import { DeadlineList } from '@/components/misc/DeadlineList';
import { papers, getUpcomingVenues } from '@/lib/mock';

export default function PipelinePage() {
  const now = Date.now();
  const venues = getUpcomingVenues(new Date(now));
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
      <div>
        <h1 className="text-lg font-semibold mb-4">Pipeline</h1>
        <KanbanBoard initial={papers} />
      </div>
      <div>
        <DeadlineList venues={venues} now={now} title="Venue deadlines" />
      </div>
    </div>
  );
}
