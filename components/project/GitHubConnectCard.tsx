'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { MarkGithubIcon, LinkExternalIcon, SyncIcon, AlertIcon, CheckIcon, XIcon } from '@primer/octicons-react';
import {
  connectGitHubRepoAction,
  disconnectGitHubRepoAction,
  syncProjectFromGitHubAction,
  type ConnectGitHubState,
  type SyncResult,
} from '@/lib/actions/github';

interface Props {
  slug: string;
  githubRepo?: string;
  lastSyncedAt?: string;
}

export function GitHubConnectCard({ slug, githubRepo, lastSyncedAt }: Props) {
  const bound = connectGitHubRepoAction.bind(null, slug);
  const [connectState, connectAction, connectPending] = useActionState<
    ConnectGitHubState,
    FormData
  >(bound, null);

  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncPending, startSyncTransition] = useTransition();
  const [disconnectPending, startDisconnectTransition] = useTransition();

  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  const onSync = () => {
    setSyncResult(null);
    startSyncTransition(async () => {
      const result = await syncProjectFromGitHubAction(slug);
      setSyncResult(result);
    });
  };

  const onDisconnect = () => {
    if (!confirmingDisconnect) {
      setConfirmingDisconnect(true);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmingDisconnect(false), 3000);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    startDisconnectTransition(async () => {
      await disconnectGitHubRepoAction(slug);
      setConfirmingDisconnect(false);
      setSyncResult(null);
    });
  };

  return (
    <section className="mt-8 border-t border-border-default pt-6">
      <h2 className="text-sm font-semibold mb-1 flex items-center gap-2">
        <MarkGithubIcon size={16} /> GitHub integration
      </h2>
      <p className="text-xs text-fg-muted mb-4">
        Connect this project to a GitHub repository to sync its README and releases.
      </p>

      {!githubRepo ? (
        <form
          action={connectAction}
          className="space-y-3 bg-white border border-border-default rounded-md p-4"
        >
          {connectState?.error && (
            <div
              role="alert"
              className="flex items-start gap-2 bg-danger-subtle border border-danger-subtle rounded-md p-2 text-xs text-danger-fg"
            >
              <AlertIcon size={14} className="mt-0.5 flex-shrink-0" />
              <span>{connectState.error}</span>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="githubRepo">
              GitHub repository
            </label>
            <input
              id="githubRepo"
              name="githubRepo"
              type="text"
              placeholder="owner/repo (e.g. vercel/next.js)"
              className="w-full border border-border-default rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent-emphasis"
            />
            <p className="text-xs text-fg-muted mt-1">
              Accepts <code>owner/repo</code> or a full github.com URL.
            </p>
          </div>
          <button
            type="submit"
            disabled={connectPending}
            className="px-3 h-8 inline-flex items-center gap-1 rounded-md bg-accent-emphasis text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MarkGithubIcon size={14} />
            {connectPending ? 'Connecting…' : 'Connect'}
          </button>
        </form>
      ) : (
        <div className="space-y-3 bg-white border border-border-default rounded-md p-4">
          <div className="flex items-center gap-2 text-sm">
            <MarkGithubIcon size={14} className="text-fg-muted" />
            <a
              href={`https://github.com/${githubRepo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-accent-fg hover:underline inline-flex items-center gap-1"
            >
              {githubRepo}
              <LinkExternalIcon size={12} />
            </a>
          </div>
          <div className="text-xs text-fg-muted">
            {lastSyncedAt
              ? `Last synced ${new Date(lastSyncedAt).toLocaleString()}`
              : 'Not synced yet.'}
          </div>

          {syncResult?.ok && (
            <div
              role="status"
              className="flex items-start gap-2 bg-success-subtle border border-success-subtle rounded-md p-2 text-xs text-success-fg"
            >
              <CheckIcon size={14} className="mt-0.5 flex-shrink-0" />
              <span>
                Synced. {syncResult.releasesUpserted ?? 0} release
                {(syncResult.releasesUpserted ?? 0) === 1 ? '' : 's'} upserted
                {syncResult.releasesSkipped
                  ? `, ${syncResult.releasesSkipped} skipped`
                  : ''}
                .
              </span>
            </div>
          )}
          {syncResult && !syncResult.ok && (
            <div
              role="alert"
              className="flex items-start gap-2 bg-danger-subtle border border-danger-subtle rounded-md p-2 text-xs text-danger-fg"
            >
              <AlertIcon size={14} className="mt-0.5 flex-shrink-0" />
              <span>{syncResult.error ?? 'Sync failed.'}</span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onSync}
              disabled={syncPending || disconnectPending}
              className="px-3 h-8 inline-flex items-center gap-1 rounded-md border border-border-default text-sm hover:bg-canvas-subtle disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <SyncIcon size={14} className={syncPending ? 'animate-spin' : ''} />
              {syncPending ? 'Syncing…' : 'Sync now'}
            </button>
            <button
              type="button"
              onClick={onDisconnect}
              disabled={disconnectPending || syncPending}
              className={`px-3 h-8 inline-flex items-center gap-1 rounded-md border text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                confirmingDisconnect
                  ? 'border-danger-emphasis bg-danger-emphasis text-white hover:bg-danger-fg'
                  : 'border-border-default hover:bg-canvas-subtle'
              }`}
            >
              <XIcon size={14} />
              {confirmingDisconnect ? 'Click again to confirm' : 'Disconnect'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
