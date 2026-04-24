'use client';

import { useState } from 'react';
import { PlusIcon } from '@primer/octicons-react';
import { useRouter } from 'next/navigation';
import { SlideOver } from '@/components/ui/slide-over';
import { RunRow } from './RunRow';
import { RunRowActions } from './RunRowActions';
import { RunCreateForm } from './RunCreateForm';
import { RunEditForm } from './RunEditForm';
import { EmptyState } from '@/components/misc/EmptyState';
import type { ExperimentRun, Project, Member } from '@/lib/types';
import type { RunContext } from '@/lib/queries/resolve';

type PanelState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; run: ExperimentRun };

export function ProjectExperimentsView({
  projectSlug,
  runs,
  ctx,
  members,
  projects,
  now,
}: {
  projectSlug: string;
  runs: ExperimentRun[];
  ctx: RunContext;
  members: Member[];
  projects: Project[];
  now: number;
}) {
  const [panel, setPanel] = useState<PanelState>({ mode: 'closed' });
  const router = useRouter();

  function close() {
    setPanel({ mode: 'closed' });
  }
  function onFormSuccess() {
    close();
    router.refresh();
  }

  const newButton = (
    <div className="mb-3 flex justify-end">
      <button
        type="button"
        onClick={() => setPanel({ mode: 'create' })}
        className="px-3 h-8 inline-flex items-center gap-1 rounded-md border border-border-default text-sm hover:bg-canvas-subtle"
      >
        <PlusIcon size={14} /> New run
      </button>
    </div>
  );

  return (
    <div>
      {newButton}
      {runs.length === 0 ? (
        <EmptyState
          title="No runs yet"
          body="Experiment runs for this project will appear here."
        />
      ) : (
        <ul className="bg-white border border-border-default rounded-md">
          {runs.map(r => (
            <RunRow
              key={r.id}
              run={r}
              hideProject
              now={now}
              ctx={ctx}
              actions={
                <RunRowActions
                  runId={r.id}
                  projectSlug={projectSlug}
                  onEdit={() => setPanel({ mode: 'edit', run: r })}
                />
              }
            />
          ))}
        </ul>
      )}

      <SlideOver
        open={panel.mode === 'create'}
        onOpenChange={o => !o && close()}
        title="New run"
        widthClass="max-w-2xl"
      >
        {panel.mode === 'create' && (
          <RunCreateForm
            projects={projects}
            members={members}
            defaultProjectSlug={projectSlug}
            scopedProjectSlug={projectSlug}
            onSuccess={onFormSuccess}
            onCancel={close}
          />
        )}
      </SlideOver>

      <SlideOver
        open={panel.mode === 'edit'}
        onOpenChange={o => !o && close()}
        title="Edit run"
        widthClass="max-w-2xl"
      >
        {panel.mode === 'edit' && (
          <RunEditForm
            run={panel.run}
            projectSlug={projectSlug}
            onSuccess={onFormSuccess}
            onCancel={close}
          />
        )}
      </SlideOver>
    </div>
  );
}
