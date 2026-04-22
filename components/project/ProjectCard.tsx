import Link from 'next/link';
import { RepoIcon } from '@primer/octicons-react';
import type { Project } from '@/lib/types';
import { LabelChip } from '@/components/badges/LabelChip';

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/projects/${project.slug}`}
      className="block border border-border-default rounded-md bg-white p-4 hover:border-accent-fg transition-colors"
    >
      <div className="flex items-center gap-2 text-accent-fg font-semibold text-sm">
        <RepoIcon size={16} />
        {project.name}
      </div>
      <p className="mt-2 text-fg-muted text-xs leading-5 line-clamp-2 min-h-[40px]">{project.description}</p>
      <div className="mt-3 flex flex-wrap gap-1">
        {project.tags.map(t => <LabelChip key={t}>{t}</LabelChip>)}
      </div>
    </Link>
  );
}
