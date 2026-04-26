import { PlusIcon } from '@primer/octicons-react';
import Link from 'next/link';
import { auth } from '@/auth';
import { ProjectCard } from '@/components/project/ProjectCard';
import { ActivityFeedItem } from '@/components/feed/ActivityFeedItem';
import { DeadlineList } from '@/components/misc/DeadlineList';
import {
  getPinnedProjects,
  getProjectsForMember,
  getUpcomingVenues,
  getRecentEvents,
} from '@/lib/queries';
import { resolveEventContext } from '@/lib/queries/resolve';
import { requestNow } from '@/lib/time';

export default async function Dashboard() {
  const now = requestNow();
  const session = await auth();
  const memberLogin = (session as { memberLogin?: string } | null)?.memberLogin;

  const projects = memberLogin
    ? await getProjectsForMember(memberLogin)
    : await getPinnedProjects();

  const [venuesAll, events] = await Promise.all([
    getUpcomingVenues(new Date(now)),
    getRecentEvents(12),
  ]);
  const venues = venuesAll.slice(0, 5);
  const eventCtx = await resolveEventContext(events);

  const heading = memberLogin ? 'My projects' : 'Pinned projects';
  const isEmpty = memberLogin && projects.length === 0;

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div>
          <h2 className="text-xs uppercase tracking-wide text-fg-muted font-semibold mb-3">{heading}</h2>
          {isEmpty ? (
            <div className="border border-dashed border-border-default rounded-md p-6 bg-white">
              <p className="text-sm text-fg-muted mb-3">
                You aren&apos;t a member of any project yet, and you haven&apos;t pinned anything.
                Browse the lab projects or create your own.
              </p>
              <div className="flex gap-2">
                <Link
                  href="/projects"
                  className="px-3 h-8 inline-flex items-center border border-border-default rounded-md bg-canvas-subtle hover:bg-canvas-inset text-sm"
                >
                  Browse all projects
                </Link>
                <Link
                  href="/projects/new"
                  className="px-3 h-8 inline-flex items-center gap-1 border border-border-default rounded-md bg-accent-fg text-white hover:opacity-90 text-sm"
                >
                  <PlusIcon size={14} /> New project
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {projects.map(p => <ProjectCard key={p.slug} project={p} />)}
              <Link
                href="/projects/new"
                className="border border-dashed border-border-default rounded-md p-4 flex flex-col items-center justify-center text-fg-muted hover:border-accent-fg hover:text-accent-fg"
              >
                <PlusIcon size={20} />
                <span className="text-sm mt-1">New project</span>
              </Link>
            </div>
          )}
        </div>
        <DeadlineList venues={venues} now={now} />
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wide text-fg-muted font-semibold mb-3">Recent activity</h2>
        <ul className="bg-white border border-border-default rounded-md px-4 list-none">
          {events.map(e => <ActivityFeedItem key={e.id} event={e} now={now} ctx={eventCtx} />)}
        </ul>
      </section>
    </div>
  );
}
