'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { TrashIcon, AlertIcon } from '@primer/octicons-react';
import { deleteMemberAction } from '@/lib/actions/members';

export function MemberDeleteButton({ login }: { login: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const handleDelete = () => {
    setError(null);
    if (!confirming) {
      setConfirming(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setConfirming(false), 3000);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    startTransition(async () => {
      try {
        await deleteMemberAction(login);
      } catch (err) {
        setConfirming(false);
        // NEXT_REDIRECT is thrown by the server action on success; ignore it.
        if (
          err instanceof Error &&
          (err.message === 'NEXT_REDIRECT' || err.message.includes('NEXT_REDIRECT'))
        ) {
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to delete member');
      }
    });
  };

  return (
    <div className="space-y-2">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 bg-danger-subtle border border-danger-subtle rounded-md p-3 text-sm text-danger-fg"
        >
          <AlertIcon size={16} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        className={`inline-flex items-center gap-1 px-3 h-8 rounded-md border text-sm transition-colors disabled:opacity-50 ${
          confirming
            ? 'border-danger-emphasis bg-danger-emphasis text-white hover:bg-danger-fg'
            : 'border-danger-subtle text-danger-fg hover:bg-danger-subtle'
        }`}
      >
        <TrashIcon size={14} />
        {confirming ? 'Click again to confirm' : 'Delete member'}
      </button>
    </div>
  );
}
