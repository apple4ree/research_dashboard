import Link from 'next/link';
import { PlusIcon, PinIcon, CommentIcon } from '@primer/octicons-react';
import { prisma } from '@/lib/db';
import { LabelChip } from '@/components/badges/LabelChip';
import { Avatar } from '@/components/people/Avatar';
import { relTime, requestNow } from '@/lib/time';
import {
  NOTICE_CATEGORY_LABELS,
  NOTICE_CATEGORY_TONE,
  type NoticeCategory,
} from '@/lib/labels';

export default async function NoticesPage() {
  const notices = await prisma.notice.findMany({
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    include: {
      author: { select: { displayName: true, login: true } },
      _count: { select: { comments: true } },
    },
  });

  const now = requestNow();

  return (
    <div className="max-w-3xl mx-auto py-2 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notices</h1>
          <p className="text-sm text-fg-muted mt-1">
            LabHub의 보완·수정·기능 추가 등 업데이트 내역과 공지를 모아둡니다.
          </p>
        </div>
        <Link
          href="/notices/new"
          className="inline-flex items-center gap-1 px-3 h-8 rounded-md border border-border-default bg-canvas-subtle hover:bg-canvas-inset text-sm"
        >
          <PlusIcon size={14} /> New notice
        </Link>
      </header>

      {notices.length === 0 ? (
        <div className="bg-white border border-dashed border-border-default rounded-md p-10 text-center text-sm text-fg-muted">
          아직 공지가 없습니다. <Link href="/notices/new" className="text-accent-fg hover:underline">첫 공지 작성</Link>
        </div>
      ) : (
        <ul className="bg-white border border-border-default rounded-md list-none pl-0">
          {notices.map(n => {
            const cat = n.category as NoticeCategory;
            return (
              <li key={n.id} className="border-b border-border-muted last:border-0">
                <Link
                  href={`/notices/${n.id}`}
                  className="block px-4 py-3 hover:bg-canvas-subtle transition-colors"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    {n.pinned && (
                      <span title="Pinned" className="text-attention-fg">
                        <PinIcon size={12} />
                      </span>
                    )}
                    <LabelChip tone={NOTICE_CATEGORY_TONE[cat]}>
                      {NOTICE_CATEGORY_LABELS[cat]}
                    </LabelChip>
                    <span className="font-medium text-sm">{n.title}</span>
                  </div>
                  <div className="text-xs text-fg-muted mt-1 flex items-center gap-2 flex-wrap">
                    <Avatar login={n.authorLogin} size={14} />
                    <span>{n.author?.displayName ?? n.authorLogin}</span>
                    <span>· {relTime(n.createdAt.toISOString(), now)}</span>
                    {n.updatedAt.getTime() - n.createdAt.getTime() > 1000 && (
                      <span>· edited {relTime(n.updatedAt.toISOString(), now)}</span>
                    )}
                    {n._count.comments > 0 && (
                      <span className="inline-flex items-center gap-1 ml-1">
                        <CommentIcon size={12} /> {n._count.comments}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
