'use client';

import { useOptimistic, useTransition } from 'react';
import { StarIcon, StarFillIcon } from '@primer/octicons-react';
import { toggleWikiEntityStarAction } from '@/lib/actions/wiki';

export function WikiStarButton({
  slug,
  entityId,
  starred,
  size = 14,
  withLabel = false,
}: {
  slug: string;
  entityId: string;
  starred: boolean;
  size?: number;
  withLabel?: boolean;
}) {
  const [optimisticStarred, setOptimisticStarred] = useOptimistic(starred);
  const [pending, startTransition] = useTransition();

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      setOptimisticStarred(!optimisticStarred);
      await toggleWikiEntityStarAction(slug, entityId);
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label={optimisticStarred ? 'Unstar' : 'Star'}
      title={optimisticStarred ? '즐겨찾기 해제' : '즐겨찾기'}
      className={`inline-flex items-center gap-1 transition-colors disabled:opacity-50 ${
        optimisticStarred
          ? 'text-attention-fg hover:text-attention-emphasis'
          : 'text-fg-muted hover:text-attention-fg'
      }`}
    >
      {optimisticStarred ? <StarFillIcon size={size} /> : <StarIcon size={size} />}
      {withLabel && (
        <span className="text-xs">{optimisticStarred ? '즐겨찾기 해제' : '즐겨찾기'}</span>
      )}
    </button>
  );
}
