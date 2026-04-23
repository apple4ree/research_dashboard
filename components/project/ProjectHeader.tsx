import Link from 'next/link';
import { RepoIcon, PencilIcon } from '@primer/octicons-react';
import type { Project } from '@/lib/types';
import { LabelChip } from '@/components/badges/LabelChip';
import { PinProjectButton } from './PinProjectButton';

export function ProjectHeader({
  project,
  source = 'internal',
  isPinned = false,
}: {
  project: Project;
  source?: string;
  isPinned?: boolean;
}) {
  return (
    <div className="pb-4 border-b border-border-muted">
      <div className="flex items-center gap-2">
        <RepoIcon size={18} />
        <h1 className="text-lg font-semibold">{project.name}</h1>
        <div className="ml-auto flex items-center gap-2">
          <PinProjectButton projectSlug={project.slug} initialPinned={isPinned} />
          {source === 'internal' && (
            <Link
              href={`/projects/${project.slug}/edit`}
              className="inline-flex items-center gap-1 px-2 h-7 border border-border-default rounded-md bg-canvas-subtle hover:bg-canvas-inset text-xs"
            >
              <PencilIcon size={14} /> Edit
            </Link>
          )}
        </div>
      </div>
      {project.description && <p className="mt-2 text-sm text-fg-muted">{project.description}</p>}
      <div className="mt-2 flex flex-wrap gap-1">
        {project.tags.map(t => <LabelChip key={t} tone="accent">{t}</LabelChip>)}
      </div>
    </div>
  );
}
