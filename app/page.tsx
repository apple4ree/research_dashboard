import { PlusIcon } from '@primer/octicons-react';
import Link from 'next/link';
import { auth } from '@/auth';
import { ProjectCard } from '@/components/project/ProjectCard';
import { ActivityFeedItem } from '@/components/feed/ActivityFeedItem';
import { DeadlineList } from '@/components/misc/DeadlineList';
import {
  getAllProjects,
  getPinnedProjects,
  getProjectsForMember,
  getUpcomingVenues,
  getRecentEvents,
  getRecentEventsForProjects,
} from '@/lib/queries';
import { resolveEventContext } from '@/lib/queries/resolve';
import { requestNow } from '@/lib/time';

type ProjectsView = 'my' | 'all';
type ActivityView = 'mine' | 'all';

function buildDashUrl(view: ProjectsView, activity: ActivityView): string {
  const sp = new URLSearchParams();
  if (view === 'all') sp.set('view', 'all');
  if (activity === 'all') sp.set('activity', 'all');
  const qs = sp.toString();
  return qs ? `/?${qs}` : '/';
}

function ToggleSegment({
  leftLabel,
  rightLabel,
  leftHref,
  rightHref,
  active,
}: {
  leftLabel: string;
  rightLabel: string;
  leftHref: string;
  rightHref: string;
  active: 'left' | 'right';
}) {
  return (
    <div className="inline-flex border border-border-default rounded-md overflow-hidden text-xs">
      <Link
        href={leftHref}
        className={`px-3 py-1 ${active === 'left' ? 'bg-canvas-inset font-semibold' : 'hover:bg-canvas-subtle text-fg-muted'}`}
      >
        {leftLabel}
      </Link>
      <Link
        href={rightHref}
        className={`px-3 py-1 border-l border-border-default ${active === 'right' ? 'bg-canvas-inset font-semibold' : 'hover:bg-canvas-subtle text-fg-muted'}`}
      >
        {rightLabel}
      </Link>
    </div>
  );
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; activity?: string }>;
}) {
  const now = requestNow();
  const session = await auth();
  const memberLogin = (session as { memberLogin?: string } | null)?.memberLogin;

  const params = await searchParams;
  const view: ProjectsView = params.view === 'all' ? 'all' : 'my';
  const activity: ActivityView = params.activity === 'all' ? 'all' : 'mine';

  // For logged-in users we always need myProjectSlugs (drives both the
  // "Mine" project list and the "Mine" activity filter). One query, reused.
  const myProjects = memberLogin ? await getProjectsForMember(memberLogin) : [];
  const myProjectSlugs = myProjects.map(p => p.slug);

  let projects;
  let projectsHeading: string;
  if (memberLogin) {
    projects = view === 'all' ? await getAllProjects() : myProjects;
    projectsHeading = view === 'all' ? 'All projects' : 'Joined projects';
  } else {
    projects = await getPinnedProjects();
    projectsHeading = 'Pinned projects';
  }

  const events =
    memberLogin && activity === 'mine'
      ? await getRecentEventsForProjects(myProjectSlugs, 12)
      : await getRecentEvents(12);

  const [venuesAll] = await Promise.all([getUpcomingVenues(new Date(now))]);
  const venues = venuesAll.slice(0, 5);
  const eventCtx = await resolveEventContext(events);

  const isProjectsEmpty = memberLogin && view === 'my' && projects.length === 0;
  const isActivityEmpty = events.length === 0;
  const activityHeading = 'Recent activity';

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs uppercase tracking-wide text-fg-muted font-semibold">{projectsHeading}</h2>
            {memberLogin && (
              <ToggleSegment
                leftLabel="Joined"
                rightLabel="All"
                leftHref={buildDashUrl('my', activity)}
                rightHref={buildDashUrl('all', activity)}
                active={view === 'my' ? 'left' : 'right'}
              />
            )}
          </div>
          {isProjectsEmpty ? (
            <div className="border border-dashed border-border-default rounded-md p-6 bg-white">
              <p className="text-sm text-fg-muted mb-3">
                You aren&apos;t a member of any project yet, and you haven&apos;t pinned anything.
                Browse all lab projects or create your own.
              </p>
              <div className="flex gap-2">
                <Link
                  href={buildDashUrl('all', activity)}
                  className="px-3 h-8 inline-flex items-center border border-border-default rounded-md bg-canvas-subtle hover:bg-canvas-inset text-sm"
                >
                  See all projects
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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-wide text-fg-muted font-semibold">{activityHeading}</h2>
          {memberLogin && (
            <ToggleSegment
              leftLabel="Joined"
              rightLabel="All"
              leftHref={buildDashUrl(view, 'mine')}
              rightHref={buildDashUrl(view, 'all')}
              active={activity === 'mine' ? 'left' : 'right'}
            />
          )}
        </div>
        {isActivityEmpty ? (
          <div className="bg-white border border-border-default rounded-md p-6 text-sm text-fg-muted">
            No recent activity in your joined projects yet.
          </div>
        ) : (
          <ul className="bg-white border border-border-default rounded-md px-4 list-none">
            {events.map(e => <ActivityFeedItem key={e.id} event={e} now={now} ctx={eventCtx} />)}
          </ul>
        )}
      </section>
    </div>
  );
}
