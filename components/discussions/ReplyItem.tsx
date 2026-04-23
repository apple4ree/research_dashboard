'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { TrashIcon, PencilIcon, AlertIcon } from '@primer/octicons-react';
import { deleteReplyAction, updateReplyAction } from '@/lib/actions/discussions';
import { Avatar } from '@/components/people/Avatar';
import { MarkdownBody } from '@/components/md/MarkdownBody';

export function ReplyItem({
  discussionId,
  replyId,
  authorLogin,
  authorName,
  createdAt,
  bodyMarkdown,
}: {
  discussionId: string;
  replyId: string;
  authorLogin: string;
  authorName: string;
  createdAt: string;
  bodyMarkdown: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(bodyMarkdown);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const startEdit = () => {
    setDraft(bodyMarkdown);
    setEditError(null);
    setEditing(true);
  };

  const handleDelete = () => {
    if (!confirming) {
      setConfirming(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setConfirming(false), 3000);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    startTransition(async () => {
      await deleteReplyAction(discussionId, replyId);
    });
  };

  const handleSave = () => {
    setEditError(null);
    const trimmed = draft.trim();
    if (!trimmed) {
      setEditError('Reply cannot be empty.');
      return;
    }
    startTransition(async () => {
      try {
        await updateReplyAction(discussionId, replyId, trimmed);
        setEditing(false);
      } catch (err) {
        setEditError(err instanceof Error ? err.message : 'Failed to update reply');
      }
    });
  };

  const handleCancel = () => {
    setDraft(bodyMarkdown);
    setEditError(null);
    setEditing(false);
  };

  return (
    <div className="bg-white border border-border-default rounded-md p-4 group">
      <div className="text-xs text-fg-muted mb-2 flex items-center gap-2">
        <Avatar login={authorLogin} size={16} /> <b>{authorName}</b> ·{' '}
        {new Date(createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
        {!editing && (
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={startEdit}
              disabled={pending}
              className="transition-opacity inline-flex items-center gap-1 text-xs opacity-0 group-hover:opacity-100 text-fg-muted hover:text-accent-fg disabled:opacity-50"
              aria-label="Edit reply"
            >
              <PencilIcon size={12} />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className={`transition-opacity inline-flex items-center gap-1 text-xs disabled:opacity-50 ${
                confirming
                  ? 'opacity-100 text-danger-fg font-semibold'
                  : 'opacity-0 group-hover:opacity-100 text-fg-muted hover:text-danger-fg'
              }`}
              aria-label={confirming ? 'Click again to confirm delete' : 'Delete reply'}
            >
              <TrashIcon size={12} /> {confirming ? 'Click again to confirm' : ''}
            </button>
          </div>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          {editError && (
            <div
              role="alert"
              className="flex items-start gap-2 bg-danger-subtle border border-danger-subtle rounded-md p-2 text-xs text-danger-fg"
            >
              <AlertIcon size={14} className="mt-0.5 flex-shrink-0" />
              <span>{editError}</span>
            </div>
          )}
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={5}
            aria-label="Edit reply body"
            className="w-full border border-border-default rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent-emphasis resize-y"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={pending}
              className="px-3 h-8 rounded-md bg-success-emphasis text-white text-sm font-medium hover:bg-success-fg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={pending}
              className="px-3 h-8 inline-flex items-center rounded-md border border-border-default text-sm hover:bg-canvas-subtle"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <MarkdownBody source={bodyMarkdown} />
      )}
    </div>
  );
}
