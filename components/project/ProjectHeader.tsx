import { RepoIcon, StarIcon, EyeIcon, RepoForkedIcon } from '@primer/octicons-react';
import type { Project } from '@/lib/types';
import { LabelChip } from '@/components/badges/LabelChip';

export function ProjectHeader({ project }: { project: Project }) {
  return (
    <div className="pb-4 border-b border-border-muted">
      <div className="flex items-center gap-2">
        <RepoIcon size={18} />
        <h1 className="text-lg font-semibold">{project.name}</h1>
        <span className="ml-auto flex gap-2 text-xs">
          <button className="inline-flex items-center gap-1 px-2 h-7 border border-border-default rounded-md bg-canvas-subtle hover:bg-canvas-inset"><EyeIcon size={14}/> Watch</button>
          <button className="inline-flex items-center gap-1 px-2 h-7 border border-border-default rounded-md bg-canvas-subtle hover:bg-canvas-inset"><RepoForkedIcon size={14}/> Fork</button>
          <button className="inline-flex items-center gap-1 px-2 h-7 border border-border-default rounded-md bg-canvas-subtle hover:bg-canvas-inset"><StarIcon size={14}/> Star</button>
        </span>
      </div>
      {project.description && <p className="mt-2 text-sm text-fg-muted">{project.description}</p>}
      <div className="mt-2 flex flex-wrap gap-1">
        {project.tags.map(t => <LabelChip key={t} tone="accent">{t}</LabelChip>)}
      </div>
    </div>
  );
}
