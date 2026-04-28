'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { TrashIcon } from '@primer/octicons-react';
import { deleteNoticeCommentAction } from '@/lib/actions/notices';

export function NoticeCommentDeleteButton({
  noticeId,
  commentId,
}: {
  noticeId: string;
  commentId: string;
}) {
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onClick = () => {
    if (!armed) {
      setArmed(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setArmed(false), 4000);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    startTransition(() => deleteNoticeCommentAction(noticeId, commentId));
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      title="댓글 삭제"
      aria-label="댓글 삭제"
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors disabled:opacity-50 ${
        armed
          ? 'bg-danger-emphasis text-white'
          : 'text-fg-muted hover:text-danger-fg'
      }`}
    >
      <TrashIcon size={12} />
      {armed && <span>한 번 더</span>}
    </button>
  );
}
