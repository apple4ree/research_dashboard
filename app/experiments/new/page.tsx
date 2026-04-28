import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeftIcon, RepoIcon } from '@primer/octicons-react';
import { getAllProjects } from '@/lib/queries';

export default async function NewRunProjectPickerPage({
  searchParams,
}: {
  searchParams: Promise<{ projectSlug?: string }>;
}) {
  const { projectSlug } = await searchParams;
  if (projectSlug) {
    redirect(`/projects/${projectSlug}/runs/new`);
  }
  const projects = await getAllProjects();

  return (
    <div className="max-w-2xl">
      <Link
        href="/experiments"
        className="inline-flex items-center gap-1 text-sm text-accent-fg hover:underline mb-4"
      >
        <ArrowLeftIcon size={14} /> Back to experiments
      </Link>
      <h1 className="text-lg font-semibold mb-2">New run</h1>
      <p className="text-sm text-fg-muted mb-4">
        Pick a project to attach this run to. Runs are always scoped to a project.
      </p>
      <ul className="bg-white border border-border-default rounded-md divide-y divide-border-muted">
        {projects.map(p => (
          <li key={p.slug}>
            <Link
              href={`/projects/${p.slug}/runs/new`}
              className="px-4 py-3 flex items-start gap-3 hover:bg-canvas-subtle"
            >
              <RepoIcon size={16} className="mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-accent-fg">{p.name}</div>
                {p.description && (
                  <p className="text-xs text-fg-muted mt-1 line-clamp-1">{p.description}</p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
