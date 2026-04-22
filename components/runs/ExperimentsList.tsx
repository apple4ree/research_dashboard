'use client';

import { useMemo, useState } from 'react';
import { RunRow } from '@/components/runs/RunRow';
import type { ExperimentRun, Project, Member, RunStatus } from '@/lib/types';
import type { RunContext } from '@/lib/queries/resolve';

const STATUS_OPTIONS: RunStatus[] = ['success', 'failure', 'in_progress', 'queued', 'cancelled'];

export function ExperimentsList({
  runs,
  ctx,
  projects,
  members,
  now,
}: {
  runs: ExperimentRun[];
  ctx: RunContext;
  projects: Project[];
  members: Member[];
  now: number;
}) {
  const [status, setStatus] = useState<RunStatus | ''>('');
  const [projectSlug, setProjectSlug] = useState<string>('');
  const [actorLogin, setActorLogin] = useState<string>('');

  const filtered = useMemo(() => {
    return runs.filter(r => {
      if (status && r.status !== status) return false;
      if (projectSlug && r.projectSlug !== projectSlug) return false;
      if (actorLogin && r.triggeredByLogin !== actorLogin) return false;
      return true;
    });
  }, [runs, status, projectSlug, actorLogin]);

  const anyFilter = status || projectSlug || actorLogin;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Experiments</h1>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select
          aria-label="Filter by status"
          value={status}
          onChange={e => setStatus(e.target.value as RunStatus | '')}
          className="px-2 py-1 bg-white border border-border-default rounded-md"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map(s => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        <select
          aria-label="Filter by project"
          value={projectSlug}
          onChange={e => setProjectSlug(e.target.value)}
          className="px-2 py-1 bg-white border border-border-default rounded-md"
        >
          <option value="">All projects</option>
          {projects.map(p => (
            <option key={p.slug} value={p.slug}>{p.name}</option>
          ))}
        </select>
        <select
          aria-label="Filter by actor"
          value={actorLogin}
          onChange={e => setActorLogin(e.target.value)}
          className="px-2 py-1 bg-white border border-border-default rounded-md"
        >
          <option value="">All members</option>
          {members.map(m => (
            <option key={m.login} value={m.login}>{m.displayName}</option>
          ))}
        </select>
        {anyFilter && (
          <button
            type="button"
            onClick={() => { setStatus(''); setProjectSlug(''); setActorLogin(''); }}
            className="px-2 py-1 text-accent-fg hover:underline"
          >
            Clear filters
          </button>
        )}
        <span className="text-fg-muted ml-auto">{filtered.length} of {runs.length}</span>
      </div>
      {filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-border-default rounded-md p-8 text-center text-sm text-fg-muted">
          No runs match these filters.
        </div>
      ) : (
        <ul className="bg-white border border-border-default rounded-md">
          {filtered.map(r => <RunRow key={r.id} run={r} ctx={ctx} now={now} />)}
        </ul>
      )}
    </div>
  );
}
