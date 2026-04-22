import Link from 'next/link';
import { Avatar } from '@/components/people/Avatar';
import { LabelChip } from '@/components/badges/LabelChip';
import { getMembersByProject } from '@/lib/mock';
import { loadProject } from '@/lib/mock/loaders';

export default async function MembersTab({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await loadProject(params);
  const members = getMembersByProject(slug);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {members.map(m => (
        <Link key={m.login} href={`/members/${m.login}`} className="bg-white border border-border-default rounded-md p-4 hover:border-accent-fg">
          <div className="flex items-center gap-3">
            <Avatar login={m.login} size={40} />
            <div>
              <div className="font-semibold text-sm">{m.displayName}</div>
              <div className="text-xs text-fg-muted">@{m.login}</div>
            </div>
            <LabelChip className="ml-auto">{m.role}</LabelChip>
          </div>
          {m.bio && <p className="text-xs text-fg-muted mt-2 line-clamp-2">{m.bio}</p>}
        </Link>
      ))}
    </div>
  );
}
