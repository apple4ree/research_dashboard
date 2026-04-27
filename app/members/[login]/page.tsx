import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PencilIcon } from '@primer/octicons-react';
import { Avatar } from '@/components/people/Avatar';
import { LabelChip } from '@/components/badges/LabelChip';
import { ProjectCard } from '@/components/project/ProjectCard';
import { getMemberByLogin, getAllProjects } from '@/lib/queries';

export default async function MemberProfile({ params }: { params: Promise<{ login: string }> }) {
  const { login } = await params;
  const m = await getMemberByLogin(login);
  if (!m) notFound();

  const projects = await getAllProjects();
  const projectMap = new Map(projects.map(p => [p.slug, p]));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
      <aside className="bg-white border border-border-default rounded-md p-4 text-center">
        <div className="flex justify-center"><Avatar login={m.login} avatarUrl={m.avatarUrl} size={120} /></div>
        <h1 className="text-lg font-semibold mt-3">{m.displayName}</h1>
        <div className="text-sm text-fg-muted">@{m.login}</div>
        <div className="mt-2"><LabelChip>{m.role}</LabelChip></div>
        {m.bio && <p className="text-sm text-fg-muted mt-3 leading-5">{m.bio}</p>}
        <Link
          href={`/members/${m.login}/edit`}
          className="inline-flex items-center gap-1 mt-4 px-2 h-7 border border-border-default rounded-md bg-canvas-subtle hover:bg-canvas-inset text-xs"
        >
          <PencilIcon size={14} /> Edit profile
        </Link>
      </aside>
      <section>
        <h2 className="text-xs uppercase tracking-wide text-fg-muted font-semibold mb-2">Pinned projects</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {m.pinnedProjectSlugs.map(s => {
            const p = projectMap.get(s);
            if (!p) return null;
            return <ProjectCard key={s} project={p} />;
          })}
        </div>
      </section>
    </div>
  );
}
