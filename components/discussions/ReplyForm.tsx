'use client';

import { useActionState, useEffect, useRef } from 'react';
import { AlertIcon } from '@primer/octicons-react';
import { createReply, type CreateReplyState } from '@/lib/actions/discussions';

export function ReplyForm({ discussionId }: { discussionId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const boundAction = createReply.bind(null, discussionId);
  const [state, formAction, pending] = useActionState<CreateReplyState, FormData>(
    boundAction,
    null,
  );
  const prevPendingRef = useRef(false);

  // Reset the textarea after a successful submission (pending→idle with no error).
  useEffect(() => {
    if (prevPendingRef.current && !pending && !state?.error) {
      formRef.current?.reset();
    }
    prevPendingRef.current = pending;
  }, [pending, state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="bg-white border border-border-default rounded-md p-4 space-y-3"
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
      <label htmlFor="reply-body" className="block text-sm font-medium">Reply</label>
      <textarea
        id="reply-body"
        name="body"
        required
        rows={4}
        placeholder="Write your reply… (Markdown supported)"
        className="w-full border border-border-default rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent-emphasis resize-y"
      />
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="px-3 h-8 rounded-md bg-success-emphasis text-white text-sm font-medium hover:bg-success-fg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? 'Posting…' : 'Post reply'}
        </button>
      </div>
    </form>
  );
}
