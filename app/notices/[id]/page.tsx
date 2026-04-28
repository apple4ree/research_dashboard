import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeftIcon, CommentIcon, PencilIcon, PinIcon } from '@primer/octicons-react';
import { prisma } from '@/lib/db';
import { LabelChip } from '@/components/badges/LabelChip';
import { Avatar } from '@/components/people/Avatar';
import { MarkdownBody } from '@/components/md/MarkdownBody';
import { NoticeDeleteButton } from '@/components/notices/NoticeDeleteButton';
import { NoticeCommentForm } from '@/components/notices/NoticeCommentForm';
import { NoticeCommentDeleteButton } from '@/components/notices/NoticeCommentDeleteButton';
import { relTime, requestNow } from '@/lib/time';
import {
  NOTICE_CATEGORY_LABELS,
  NOTICE_CATEGORY_TONE,
  type NoticeCategory,
} from '@/lib/labels';

export default async function NoticeDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = await prisma.notice.findUnique({
    where: { id },
    include: {
      author: { select: { displayName: true, login: true } },
      comments: {
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { displayName: true, login: true } } },
      },
    },
  });
  if (!n) notFound();

  const cat = n.category as NoticeCategory;
  const now = requestNow();
  const wasEdited = n.updatedAt.getTime() - n.createdAt.getTime() > 1000;

  return (
    <article className="max-w-3xl mx-auto py-2">
      <Link
        href="/notices"
        className="inline-flex items-center gap-1 text-sm text-accent-fg hover:underline mb-4"
      >
        <ArrowLeftIcon size={14} /> Back to notices
      </Link>

      <header className="flex items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {n.pinned && (
            <span title="Pinned" className="text-attention-fg">
              <PinIcon size={14} />
            </span>
          )}
          <LabelChip tone={NOTICE_CATEGORY_TONE[cat]}>{NOTICE_CATEGORY_LABELS[cat]}</LabelChip>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/notices/${n.id}/edit`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border-default text-xs text-fg-muted hover:border-accent-fg hover:text-accent-fg"
          >
            <PencilIcon size={12} /> 편집
          </Link>
          <NoticeDeleteButton id={n.id} />
        </div>
      </header>

      <h1 className="text-2xl font-semibold tracking-tight mb-2">{n.title}</h1>
      <div className="text-xs text-fg-muted flex items-center gap-2 mb-6">
        <Avatar login={n.authorLogin} size={16} />
        <span>{n.author?.displayName ?? n.authorLogin}</span>
        <span>· posted {relTime(n.createdAt.toISOString(), now)}</span>
        {wasEdited && <span>· last edited {relTime(n.updatedAt.toISOString(), now)}</span>}
      </div>

      <section className="bg-white border border-border-default rounded-md p-6">
        <MarkdownBody source={n.bodyMarkdown} size="base" />
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wider mb-3 flex items-center gap-2">
          <CommentIcon size={14} /> 댓글 ({n.comments.length})
        </h2>
        {n.comments.length === 0 ? (
          <p className="text-sm text-fg-muted italic mb-6">
            아직 댓글이 없습니다. 가장 먼저 의견을 남겨보세요.
          </p>
        ) : (
          <ul className="list-none pl-0 space-y-3 mb-6">
            {n.comments.map(c => (
              <li
                key={c.id}
                className="bg-white border border-border-default rounded-md p-4"
              >
                <div className="flex items-center gap-2 text-xs text-fg-muted mb-2">
                  <Avatar login={c.authorLogin} size={16} />
                  <span className="font-medium text-fg-default">
                    {c.author?.displayName ?? c.authorLogin}
                  </span>
                  <span>· {relTime(c.createdAt.toISOString(), now)}</span>
                  <div className="ml-auto">
                    <NoticeCommentDeleteButton noticeId={n.id} commentId={c.id} />
                  </div>
                </div>
                <MarkdownBody source={c.bodyMarkdown} size="sm" />
              </li>
            ))}
          </ul>
        )}

        <div className="bg-white border border-border-default rounded-md p-4">
          <NoticeCommentForm noticeId={n.id} />
        </div>
      </section>
    </article>
  );
}
