'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookIcon, PlayIcon, FileIcon, DatabaseIcon, PeopleIcon, CommentDiscussionIcon, BookmarkIcon, GitMergeIcon } from '@primer/octicons-react';
import { cn } from '@/lib/cn';

const TABS = [
  { key: 'overview',    label: 'Overview',    Icon: BookIcon,               href: '' },
  { key: 'wiki',        label: 'Wiki',        Icon: BookmarkIcon,           href: '/wiki' },
  { key: 'flow',        label: 'Flow',        Icon: GitMergeIcon,           href: '/flow' },
  { key: 'experiments', label: 'Experiments', Icon: PlayIcon,               href: '/experiments' },
  { key: 'papers',      label: 'Papers',      Icon: FileIcon,               href: '/papers' },
  { key: 'results',     label: 'Results',     Icon: DatabaseIcon,           href: '/results' },
  { key: 'discussions', label: 'Discussions', Icon: CommentDiscussionIcon,  href: '/discussions' },
  { key: 'members',     label: 'Members',     Icon: PeopleIcon,             href: '/members' },
] as const;

export function TabBar({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/projects/${slug}`;
  return (
    <nav className="border-b border-border-muted">
      <ul className="flex gap-1">
        {TABS.map(t => {
          const href = base + t.href;
          const active = t.key === 'overview'
            ? pathname === base
            : pathname === href || pathname.startsWith(href + '/');
          return (
            <li key={t.key}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center gap-2 px-3 h-10 text-sm border-b-2',
                  active ? 'border-attention-emphasis font-semibold' : 'border-transparent text-fg-muted hover:text-fg-default'
                )}
              >
                <t.Icon size={14} />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
