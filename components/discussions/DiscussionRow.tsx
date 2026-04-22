import Link from 'next/link';
import type { Discussion } from '@/lib/types';
import { Avatar } from '@/components/people/Avatar';
import { LabelChip } from '@/components/badges/LabelChip';
import { CommentIcon } from '@primer/octicons-react';
import { relTime } from '@/lib/time';
import { DISCUSSION_CATEGORY_LABELS, DISCUSSION_CATEGORY_TONE } from '@/lib/labels';

function firstLine(md: string): string {
  const line = md.split('\n').find(l => l.trim().length > 0) ?? '';
  return line.replace(/^#{1,6}\s+/, '').replace(/^[*>-]\s+/, '').slice(0, 140);
}

export function DiscussionRow({ discussion, now }: { discussion: Discussion; now: number }) {
  return (
    <li className="px-4 py-3 flex items-center gap-3 border-b border-border-muted last:border-0">
      <Avatar login={discussion.authorLogin} size={28} />
      <div className="flex-1 min-w-0">
        <Link href={`/discussions/${discussion.id}`} className="font-medium text-sm hover:text-accent-fg">{discussion.title}</Link>
        <p className="text-xs text-fg-muted mt-0.5 line-clamp-1">{firstLine(discussion.bodyMarkdown)}</p>
        <div className="text-xs text-fg-muted mt-0.5 flex items-center gap-2">
          <LabelChip tone={DISCUSSION_CATEGORY_TONE[discussion.category]}>{DISCUSSION_CATEGORY_LABELS[discussion.category]}</LabelChip>
          <span>@{discussion.authorLogin}</span>
          <span>· opened {relTime(discussion.createdAt, now)}</span>
        </div>
      </div>
      <div className="text-xs text-fg-muted whitespace-nowrap flex items-center gap-1">
        <CommentIcon size={12} /> {discussion.replyCount}
      </div>
    </li>
  );
}
