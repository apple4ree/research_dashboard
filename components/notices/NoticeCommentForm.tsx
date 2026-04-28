'use client';

import { useRef, useState, useTransition } from 'react';
import { addNoticeCommentAction } from '@/lib/actions/notices';

export function NoticeCommentForm({ noticeId }: { noticeId: string }) {
  const [body, setBody] = useState('');
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    const fd = new FormData();
    fd.set('bodyMarkdown', trimmed);
    startTransition(async () => {
      await addNoticeCommentAction(noticeId, fd);
      setBody('');
      formRef.current?.reset();
    });
  };

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-2">
      <label htmlFor={`comment-${noticeId}`} className="block text-xs uppercase tracking-wider text-fg-muted font-semibold">
        댓글 작성
      </label>
      <textarea
        id={`comment-${noticeId}`}
        name="bodyMarkdown"
        rows={3}
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="의견을 남겨주세요. 마크다운 사용 가능."
        className="w-full border border-border-default rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-emphasis resize-y"
      />
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending || !body.trim()}
          className="px-3 h-8 rounded-md bg-accent-fg text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {pending ? '게시 중…' : '댓글 게시'}
        </button>
      </div>
    </form>
  );
}
