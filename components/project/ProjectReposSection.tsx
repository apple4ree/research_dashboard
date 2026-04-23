'use client';

import { useState, useTransition } from 'react';
import { XIcon, PlusIcon, LinkExternalIcon, AlertIcon } from '@primer/octicons-react';
import {
  addProjectRepoAction,
  removeProjectRepoAction,
} from '@/lib/actions/project-repos';

export interface ProjectRepoItem {
  id: number;
  label: string;
  url: string;
}

export function ProjectReposSection({
  projectSlug,
  repos,
}: {
  projectSlug: string;
  repos: ProjectRepoItem[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleAdd(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await addProjectRepoAction(projectSlug, formData);
        setShowAdd(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add repo');
      }
    });
  }

  function handleRemove(id: number) {
    setError(null);
    startTransition(async () => {
      try {
        await removeProjectRepoAction(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove repo');
      }
    });
  }

  return (
    <section className="mt-8 space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Linked repositories</h2>
        <button
          type="button"
          onClick={() => setShowAdd(s => !s)}
          className="inline-flex items-center gap-1 text-xs px-2 h-7 rounded-md border border-border-default hover:bg-canvas-subtle"
        >
          <PlusIcon size={12} /> Add link
        </button>
      </div>
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 bg-danger-subtle border border-danger-subtle rounded-md p-2 text-xs text-danger-fg"
        >
          <AlertIcon size={14} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {showAdd && (
        <form
          action={handleAdd}
          className="bg-canvas-subtle border border-border-default rounded-md p-3"
        >
          <div className="flex flex-wrap gap-2">
            <input
              name="label"
              required
              placeholder="e.g., GitHub"
              aria-label="Repo label"
              className="w-28 text-sm border border-border-default rounded-md px-2 py-1"
            />
            <input
              name="url"
              required
              type="url"
              placeholder="https://…"
              aria-label="Repo URL"
              className="flex-1 min-w-[200px] text-sm border border-border-default rounded-md px-2 py-1 font-mono"
            />
            <button
              type="submit"
              disabled={pending}
              className="text-sm px-3 h-8 rounded-md bg-success-emphasis text-white hover:bg-success-fg disabled:opacity-50"
            >
              {pending ? 'Adding…' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="text-sm px-3 h-8 rounded-md border border-border-default hover:bg-canvas-subtle"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      <ul className="bg-white border border-border-default rounded-md divide-y divide-border-muted">
        {repos.length === 0 ? (
          <li className="px-4 py-3 text-sm text-fg-muted">No linked repositories.</li>
        ) : (
          repos.map(r => (
            <li key={r.id} className="px-4 py-2 flex items-center gap-3 group">
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-fg hover:underline inline-flex items-center gap-1 text-sm font-medium"
              >
                <LinkExternalIcon size={12} /> {r.label}
              </a>
              <code className="text-xs text-fg-muted truncate flex-1">{r.url}</code>
              <button
                type="button"
                onClick={() => handleRemove(r.id)}
                disabled={pending}
                className="opacity-0 group-hover:opacity-100 text-fg-muted hover:text-danger-fg disabled:opacity-50"
                aria-label={`Remove ${r.label}`}
              >
                <XIcon size={14} />
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
