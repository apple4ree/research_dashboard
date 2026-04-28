import Link from 'next/link';
import { ArrowLeftIcon } from '@primer/octicons-react';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { Avatar } from '@/components/people/Avatar';
import { getMemberByLogin, getRunById } from '@/lib/queries';
import { RunActions } from '@/components/runs/RunActions';

export async function RunDetailView({
  slug,
  id,
  projectName,
}: {
  slug: string;
  id: string;
  projectName: string;
}) {
  const run = await getRunById(id);
  if (!run || run.projectSlug !== slug) return null;
  const actor = await getMemberByLogin(run.triggeredByLogin);

  return (
    <div className="space-y-4">
      <Link
        href={`/projects/${slug}/experiments`}
        className="inline-flex items-center gap-1 text-sm text-accent-fg hover:underline"
      >
        <ArrowLeftIcon size={14} /> Back to {projectName} experiments
      </Link>
      <div className="flex items-center gap-3 pb-3 border-b border-border-muted">
        <StatusBadge status={run.status} showLabel />
        <h1 className="text-lg font-semibold">{run.name}</h1>
        <div className="ml-auto text-xs text-fg-muted flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Avatar login={run.triggeredByLogin} size={14} /> {actor?.displayName}
          </span>
          <span>
            {new Date(run.startedAt).toLocaleString('en-US', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </span>
          <RunActions run={run} projectSlug={slug} />
        </div>
      </div>
      {run.summary && (
        <div className="bg-white border border-border-default rounded-md p-4 text-sm">
          {run.summary}
        </div>
      )}
      <section>
        <h2 className="text-xs uppercase tracking-wide text-fg-muted font-semibold mb-2">
          Steps
        </h2>
        <ul className="bg-white border border-border-default rounded-md divide-y divide-border-muted">
          {(run.stepsMock ?? [{ name: 'run', status: run.status }]).map((s, i) => (
            <li key={i}>
              <details className="px-4 py-2">
                <summary className="flex items-center gap-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <StatusBadge status={s.status} />
                  <span className="font-medium">{s.name}</span>
                  {s.logSnippet && (
                    <span className="ml-auto text-xs text-fg-muted">view log</span>
                  )}
                </summary>
                {s.logSnippet && (
                  <pre className="mt-2 bg-canvas-inset text-xs p-3 rounded-md overflow-x-auto whitespace-pre-wrap">
                    {s.logSnippet}
                  </pre>
                )}
              </details>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-xs uppercase tracking-wide text-fg-muted font-semibold mb-2">
          Artifacts
        </h2>
        <div className="bg-white border border-border-default rounded-md p-4 text-sm text-fg-muted">
          No artifacts recorded for this run.
        </div>
      </section>
    </div>
  );
}
