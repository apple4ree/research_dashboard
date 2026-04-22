import { notFound } from 'next/navigation';
import Link from 'next/link';
import { LinkExternalIcon, TagIcon } from '@primer/octicons-react';
import { MarkdownBody } from '@/components/md/MarkdownBody';
import { Avatar } from '@/components/people/Avatar';
import {
  getProjectBySlug, getPapersByProject, getReleasesByProject, getMembersByProject,
} from '@/lib/mock';

export default async function ProjectOverview({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) notFound();

  const pinnedPaper = getPapersByProject(slug)[0];
  const latestRelease = getReleasesByProject(slug).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0];
  const members = getMembersByProject(slug);

  const readme = `# ${project.name}\n\n${project.description}\n\n## Goals\n\n- TBD goals section (placeholder for lab README content).\n\n## How to run\n\n\`\`\`bash\n# example\npython scripts/run_eval.py --model claude-opus-4-7\n\`\`\`\n`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
      <div className="bg-white border border-border-default rounded-md p-6">
        <MarkdownBody source={readme} />
      </div>
      <aside className="space-y-4">
        <section className="bg-white border border-border-default rounded-md p-4">
          <h3 className="text-xs uppercase tracking-wide text-fg-muted font-semibold mb-2">About</h3>
          <p className="text-sm text-fg-default">{project.description}</p>
          <div className="mt-3 flex items-center gap-2 text-sm text-fg-muted">
            <TagIcon size={14} />
            {project.tags.join(' · ')}
          </div>
        </section>
        <section className="bg-white border border-border-default rounded-md p-4">
          <h3 className="text-xs uppercase tracking-wide text-fg-muted font-semibold mb-2">Links</h3>
          <ul className="space-y-1 text-sm">
            {project.repos.map(r => (
              <li key={r.url}>
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-accent-fg hover:underline inline-flex items-center gap-1">
                  <LinkExternalIcon size={12}/> {r.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
        {pinnedPaper && (
          <section className="bg-white border border-border-default rounded-md p-4">
            <h3 className="text-xs uppercase tracking-wide text-fg-muted font-semibold mb-2">Pinned paper</h3>
            <Link href={`/projects/${slug}/papers`} className="text-sm text-accent-fg hover:underline">{pinnedPaper.title}</Link>
            {pinnedPaper.venue && <p className="text-xs text-fg-muted mt-1">{pinnedPaper.venue}</p>}
          </section>
        )}
        {latestRelease && (
          <section className="bg-white border border-border-default rounded-md p-4">
            <h3 className="text-xs uppercase tracking-wide text-fg-muted font-semibold mb-2">Latest release</h3>
            <p className="text-sm"><b>{latestRelease.name}</b> {latestRelease.version}</p>
            <p className="text-xs text-fg-muted">{new Date(latestRelease.publishedAt).toDateString()}</p>
          </section>
        )}
        <section className="bg-white border border-border-default rounded-md p-4">
          <h3 className="text-xs uppercase tracking-wide text-fg-muted font-semibold mb-2">Contributors ({members.length})</h3>
          <div className="flex flex-wrap gap-2">
            {members.map(m => (
              <Link key={m.login} href={`/members/${m.login}`} title={m.displayName}>
                <Avatar login={m.login} size={24} />
              </Link>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
