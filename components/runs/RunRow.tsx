import Link from 'next/link';
import type { ReactNode } from 'react';
import type { ExperimentRun } from '@/lib/types';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { Avatar } from '@/components/people/Avatar';
import type { RunContext } from '@/lib/queries/resolve';
import { relTime } from '@/lib/time';

function fmtDuration(sec?: number) {
  if (sec == null) return '—';
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec/60)}m`;
  const h = Math.floor(sec/3600); const m = Math.round((sec%3600)/60);
  return `${h}h ${m}m`;
}

export function RunRow({ run, hideProject = false, now, ctx, actions }: { run: ExperimentRun; hideProject?: boolean; now: number; ctx: RunContext; actions?: ReactNode }) {
  const proj = ctx.projects.get(run.projectSlug);
  const actor = ctx.members.get(run.triggeredByLogin);
  return (
    <li className="px-4 py-3 flex items-center gap-3 border-b border-border-muted last:border-0">
      <StatusBadge status={run.status} />
      <div className="flex-1 min-w-0">
        <Link href={`/projects/${run.projectSlug}/experiments/${run.id}`} className="font-medium text-sm text-fg-default hover:text-accent-fg truncate block">
          {run.name}
        </Link>
        <div className="text-xs text-fg-muted flex items-center gap-2 mt-0.5">
          {!hideProject && proj && (
            <Link href={`/projects/${proj.slug}`} className="hover:underline">{proj.name}</Link>
          )}
          <span className="flex items-center gap-1"><Avatar login={run.triggeredByLogin} size={12}/> {actor?.displayName ?? run.triggeredByLogin}</span>
        </div>
      </div>
      <div className="text-xs text-fg-muted text-right whitespace-nowrap">
        <div>{fmtDuration(run.durationSec)}</div>
        <div>{relTime(run.startedAt, now)}</div>
      </div>
      {actions}
    </li>
  );
}
