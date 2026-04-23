import Link from 'next/link';
import { PlusIcon } from '@primer/octicons-react';
import { RunRow } from '@/components/runs/RunRow';
import { RunRowActions } from '@/components/runs/RunRowActions';
import { EmptyState } from '@/components/misc/EmptyState';
import { getRunsByProject } from '@/lib/queries';
import { resolveRunContext } from '@/lib/queries/resolve';
import { loadProject } from '@/lib/mock/loaders';
import { requestNow } from '@/lib/time';

export default async function ProjectExperiments({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await loadProject(params);
  const now = requestNow();
  const runs = (await getRunsByProject(slug)).sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  const newRunLink = (
    <div className="mb-3 flex justify-end">
      <Link
        href={`/experiments/new?projectSlug=${slug}`}
        className="px-3 h-8 inline-flex items-center gap-1 rounded-md border border-border-default text-sm hover:bg-canvas-subtle"
      >
        <PlusIcon size={14} /> New run
      </Link>
    </div>
  );

  if (runs.length === 0) {
    return (
      <div>
        {newRunLink}
        <EmptyState title="No runs yet" body="Experiment runs for this project will appear here." />
      </div>
    );
  }

  const ctx = await resolveRunContext(runs);
  return (
    <div>
      {newRunLink}
      <ul className="bg-white border border-border-default rounded-md">
        {runs.map(r => (
          <RunRow
            key={r.id}
            run={r}
            hideProject
            now={now}
            ctx={ctx}
            actions={<RunRowActions runId={r.id} />}
          />
        ))}
      </ul>
    </div>
  );
}
