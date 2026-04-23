'use client';

import { useState, useTransition } from 'react';
import { StarIcon, StarFillIcon } from '@primer/octicons-react';
import { togglePinProjectAction } from '@/lib/actions/pins';

export function PinProjectButton({
  projectSlug,
  initialPinned,
}: {
  projectSlug: string;
  initialPinned: boolean;
}) {
  const [pinned, setPinned] = useState(initialPinned);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const previous = pinned;
    setPinned(!previous); // optimistic
    startTransition(async () => {
      try {
        await togglePinProjectAction(projectSlug);
      } catch {
        setPinned(previous); // rollback
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={pinned ? 'Unpin from profile' : 'Pin to profile'}
      title={pinned ? 'Pinned on your profile — click to unpin' : 'Pin to your profile'}
      className={`inline-flex items-center gap-1 px-2 h-7 border rounded-md text-xs transition-colors disabled:opacity-50 ${
        pinned
          ? 'bg-attention-subtle text-attention-fg border-attention-emphasis hover:bg-canvas-subtle'
          : 'bg-canvas-subtle border-border-default hover:bg-canvas-inset'
      }`}
    >
      {pinned ? <StarFillIcon size={14} /> : <StarIcon size={14} />}
      {pinned ? 'Pinned' : 'Pin'}
    </button>
  );
}
