import Link from 'next/link';
import { PlusIcon } from '@primer/octicons-react';
import { DiscussionRow } from '@/components/discussions/DiscussionRow';
import { EmptyState } from '@/components/misc/EmptyState';
import { getDiscussionsByProject } from '@/lib/queries';
import { loadProject } from '@/lib/mock/loaders';
import { requestNow } from '@/lib/time';

export default async function ProjectDiscussions({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await loadProject(params);
  const now = requestNow();
  const discussions = (await getDiscussionsByProject(slug)).sort((a, b) =>
    b.lastActivityAt.localeCompare(a.lastActivityAt),
  );

  const newLink = (
    <div className="mb-3 flex justify-end">
      <Link
        href={`/projects/${slug}/discussions/new`}
        className="px-3 h-8 inline-flex items-center gap-1 rounded-md border border-border-default text-sm hover:bg-canvas-subtle"
      >
        <PlusIcon size={14} /> New discussion
      </Link>
    </div>
  );

  if (discussions.length === 0) {
    return (
      <div>
        {newLink}
        <EmptyState
          title="No discussions yet"
          body="Announcements, journal club notes, Q&A, and ideas scoped to this project will appear here."
        />
      </div>
    );
  }

  return (
    <div>
      {newLink}
      <ul className="bg-white border border-border-default rounded-md">
        {discussions.map(d => (
          <DiscussionRow key={d.id} discussion={d} now={now} hideProject />
        ))}
      </ul>
    </div>
  );
}
