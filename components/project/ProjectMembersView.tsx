'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { XIcon, PlusIcon, AlertIcon } from '@primer/octicons-react';
import { Avatar } from '@/components/people/Avatar';
import { LabelChip } from '@/components/badges/LabelChip';
import {
  addProjectMemberAction,
  removeProjectMemberAction,
} from '@/lib/actions/project-members';
import type { Member } from '@/lib/types';

export function ProjectMembersView({
  projectSlug,
  members,
  candidates,
}: {
  projectSlug: string;
  members: Member[];
  candidates: Member[];
}) {
  const [selectedLogin, setSelectedLogin] = useState(candidates[0]?.login ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedLogin) return;
    setError(null);
    startTransition(async () => {
      try {
        await addProjectMemberAction(projectSlug, selectedLogin);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add member');
      }
    });
  }

  function onRemove(login: string) {
    setError(null);
    startTransition(async () => {
      try {
        await removeProjectMemberAction(projectSlug, login);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove member');
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 bg-danger-subtle border border-danger-subtle rounded-md p-3 text-sm text-danger-fg"
        >
          <AlertIcon size={16} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {candidates.length > 0 && (
        <form
          onSubmit={onAdd}
          className="flex flex-wrap items-center gap-2 bg-white border border-border-default rounded-md p-3"
        >
          <label htmlFor="addMemberLogin" className="text-sm font-medium">
            Add member
          </label>
          <select
            id="addMemberLogin"
            value={selectedLogin}
            onChange={e => setSelectedLogin(e.target.value)}
            className="text-sm border border-border-default rounded-md px-2 py-1.5"
          >
            {candidates.map(m => (
              <option key={m.login} value={m.login}>
                {m.displayName} (@{m.login}) — {m.role}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending || !selectedLogin}
            className="inline-flex items-center gap-1 text-sm px-3 h-8 rounded-md border border-border-default bg-canvas-subtle hover:bg-canvas-inset disabled:opacity-50"
          >
            <PlusIcon size={14} /> Add
          </button>
        </form>
      )}
      {members.length === 0 ? (
        <div className="bg-white border border-dashed border-border-default rounded-md p-8 text-center text-sm text-fg-muted">
          No members on this project yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {members.map(m => (
            <div
              key={m.login}
              className="group relative bg-white border border-border-default rounded-md p-4 hover:border-accent-fg"
            >
              <button
                type="button"
                onClick={() => onRemove(m.login)}
                disabled={pending}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-fg-muted hover:text-danger-fg disabled:opacity-50"
                aria-label={`Remove ${m.displayName}`}
              >
                <XIcon size={14} />
              </button>
              <Link href={`/members/${m.login}`} className="block">
                <div className="flex items-center gap-3">
                  <Avatar login={m.login} size={40} />
                  <div>
                    <div className="font-semibold text-sm">{m.displayName}</div>
                    <div className="text-xs text-fg-muted">@{m.login}</div>
                  </div>
                  <LabelChip className="ml-auto">{m.role}</LabelChip>
                </div>
                {m.bio && (
                  <p className="text-xs text-fg-muted mt-2 line-clamp-2">{m.bio}</p>
                )}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
