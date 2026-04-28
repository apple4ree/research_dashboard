'use client';

import { useRef, useState, useTransition } from 'react';
import { PlusIcon, XIcon } from '@primer/octicons-react';
import {
  uploadResultAttachmentAction,
  deleteResultAttachmentAction,
} from '@/lib/actions/experiments';

type Attachment = {
  id: number;
  title: string;
  originalFilename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
};

export function ResultAttachmentList({
  slug,
  resultId,
  attachments,
}: {
  slug: string;
  resultId: string;
  attachments: Attachment[];
}) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (!(fd.get('file') instanceof File)) return;
    startTransition(async () => {
      await uploadResultAttachmentAction(slug, resultId, fd);
      form.reset();
      setAdding(false);
    });
  };

  const onDelete = (id: number) => {
    startTransition(() => deleteResultAttachmentAction(slug, id));
  };

  return (
    <div className="pt-1">
      {attachments.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 mb-2 list-none pl-0">
          {attachments.map(a => {
            const mime = (a.mimeType ?? '').toLowerCase();
            const isImage = mime.startsWith('image/');
            const inlineable =
              isImage ||
              mime.startsWith('text/') ||
              mime === 'application/pdf' ||
              /\.(md|html?|txt|json|csv|tsv|log|pdf|png|jpe?g|gif|webp|svg)$/i.test(
                a.originalFilename ?? '',
              );
            const href = `/api/uploads/result-attachments/${a.id}${inlineable ? '?inline=1' : ''}`;
            return (
              <li key={a.id} className="inline-flex items-center gap-1">
                <a
                  href={href}
                  target={inlineable ? '_blank' : undefined}
                  rel={inlineable ? 'noopener noreferrer' : undefined}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-canvas-subtle hover:bg-canvas-default border border-border-muted rounded"
                  title={a.originalFilename ?? a.title}
                >
                  <span className="text-sm">{isImage ? '🖼' : '📎'}</span>
                  <span className="truncate max-w-[20ch]">{a.title}</span>
                </a>
                <button
                  type="button"
                  onClick={() => onDelete(a.id)}
                  disabled={pending}
                  aria-label={`Remove ${a.title}`}
                  className="text-fg-muted hover:text-danger-fg p-0.5 disabled:opacity-50"
                >
                  <XIcon size={10} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {adding ? (
        <form
          ref={formRef}
          onSubmit={onSubmit}
          className="flex flex-wrap items-center gap-2 bg-canvas-subtle p-2 rounded"
        >
          <input
            type="text"
            name="title"
            placeholder="제목 (선택, 비우면 파일명 사용)"
            className="text-xs border border-border-default rounded px-2 py-1 flex-1 min-w-[150px]"
          />
          <input
            type="file"
            name="file"
            required
            className="text-xs"
          />
          <button
            type="submit"
            disabled={pending}
            className="px-2 h-7 text-xs bg-accent-fg text-white rounded hover:opacity-90 disabled:opacity-50"
          >
            {pending ? '업로드 중…' : '업로드'}
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="px-2 h-7 text-xs border border-border-default rounded hover:bg-canvas-default"
          >
            취소
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-accent-fg"
        >
          <PlusIcon size={12} /> 첨부 추가
        </button>
      )}
    </div>
  );
}
