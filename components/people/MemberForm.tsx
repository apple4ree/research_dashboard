'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { ArrowLeftIcon, AlertIcon } from '@primer/octicons-react';
import {
  createMemberAction,
  updateMemberAction,
  type CreateMemberState,
  type UpdateMemberState,
} from '@/lib/actions/members';
import { MemberDeleteButton } from '@/components/people/MemberDeleteButton';
import { PinnedProjectsPicker } from '@/components/people/PinnedProjectsPicker';
import type { Member, MemberRole, Project } from '@/lib/types';

const ROLE_OPTIONS: MemberRole[] = ['PI', 'Postdoc', 'PhD', 'MS', 'Intern', 'Alumni'];

type FormState = CreateMemberState | UpdateMemberState;

export function MemberForm(
  props:
    | { mode: 'create'; projects: Project[] }
    | { mode: 'edit'; projects: Project[]; initial: Member },
) {
  const { mode, projects } = props;
  const initial = mode === 'edit' ? props.initial : undefined;

  const bound =
    mode === 'create'
      ? createMemberAction
      : updateMemberAction.bind(null, initial!.login);

  const [state, formAction, pending] = useActionState<FormState, FormData>(
    bound,
    null,
  );


  const backHref = mode === 'edit' ? `/members/${initial!.login}` : '/';

  return (
    <div className="max-w-3xl">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-accent-fg hover:underline mb-4"
      >
        <ArrowLeftIcon size={14} /> {mode === 'edit' ? 'Back to profile' : 'Back'}
      </Link>
      <h1 className="text-lg font-semibold mb-4">
        {mode === 'create' ? 'New member' : `Edit ${initial!.displayName}`}
      </h1>
      <form
        action={formAction}
        className="space-y-4 bg-white border border-border-default rounded-md p-6"
      >
        {state?.error && (
          <div
            role="alert"
            className="flex items-start gap-2 bg-danger-subtle border border-danger-subtle rounded-md p-3 text-sm text-danger-fg"
          >
            <AlertIcon size={16} className="mt-0.5 flex-shrink-0" />
            <span>{state.error}</span>
          </div>
        )}
        {mode === 'create' ? (
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="login">
              Login <span className="text-fg-muted font-normal">(URL identifier)</span>
            </label>
            <input
              id="login"
              name="login"
              type="text"
              required
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              pattern="[a-z0-9]([a-z0-9-]*[a-z0-9])?"
              title="Lowercase English letters, digits, and hyphens only."
              placeholder="e.g., jane-doe"
              className="w-full border border-border-default rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
            />
            <p className="text-xs text-fg-muted mt-1">
              Lowercase letters, digits, hyphens. Profile URL becomes <code>/members/&lt;login&gt;</code>.
            </p>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="login">
              Login <span className="text-fg-muted font-normal">(read-only)</span>
            </label>
            <input
              id="login"
              type="text"
              value={initial!.login}
              disabled
              readOnly
              className="w-full border border-border-default rounded-md px-3 py-2 text-sm font-mono bg-canvas-subtle text-fg-muted cursor-not-allowed"
            />
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="displayName">
              Display name
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              required
              defaultValue={initial?.displayName ?? ''}
              className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="role">
              Role
            </label>
            <select
              id="role"
              name="role"
              required
              defaultValue={initial?.role ?? 'PhD'}
              className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
            >
              {ROLE_OPTIONS.map(r => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="email">
              Email <span className="text-fg-muted font-normal">(optional)</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={initial?.email ?? ''}
              placeholder="jane@example.com"
              className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
            />
            <p className="text-xs text-fg-muted mt-1">
              Used to match the GitHub sign-in to this member on first login.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="githubLogin">
              GitHub handle <span className="text-fg-muted font-normal">(optional)</span>
            </label>
            <input
              id="githubLogin"
              name="githubLogin"
              type="text"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              defaultValue={initial?.githubLogin ?? ''}
              placeholder="e.g., johndoe"
              className="w-full border border-border-default rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
            />
            <p className="text-xs text-fg-muted mt-1">
              Allowlists this GitHub account to sign in to LabHub.
            </p>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="bio">
            Bio (optional)
          </label>
          <textarea
            id="bio"
            name="bio"
            rows={3}
            defaultValue={initial?.bio ?? ''}
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis resize-y"
          />
        </div>
        <PinnedProjectsPicker
          allProjects={projects}
          defaultPinned={initial?.pinnedProjectSlugs ?? []}
        />
        <div className="flex items-center gap-2 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="px-3 h-8 rounded-md bg-success-emphasis text-white text-sm font-medium hover:bg-success-fg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mode === 'create'
              ? pending
                ? 'Creating…'
                : 'Create member'
              : pending
                ? 'Saving…'
                : 'Save changes'}
          </button>
          <Link
            href={backHref}
            className="px-3 h-8 inline-flex items-center rounded-md border border-border-default text-sm hover:bg-canvas-subtle"
          >
            Cancel
          </Link>
        </div>
      </form>

      {mode === 'edit' && (
        <section className="mt-8 border-t border-danger-subtle pt-6">
          <h2 className="text-sm font-semibold text-danger-fg mb-2">Danger zone</h2>
          <p className="text-xs text-fg-muted mb-3">
            Deleting this member removes their pinned-project list and project memberships. It is blocked when they
            still have runs, discussions, replies, journal entries, or activity events (transfer or delete those first).
          </p>
          <MemberDeleteButton login={initial!.login} />
        </section>
      )}
    </div>
  );
}
