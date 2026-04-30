import { NextResponse } from 'next/server';
import {
  getAllProjects,
  getAllMembers,
  getAllPapers,
  getAllRuns,
  getAllDiscussions,
  getAllReleases,
} from '@/lib/queries';
import { prisma } from '@/lib/db';

export type SearchItem = {
  type: 'project' | 'paper' | 'member' | 'discussion' | 'run' | 'release' | 'entry';
  title: string;
  subtitle?: string;
  href: string;
  keywords: string; // flattened searchable text
};

export async function GET() {
  const [projects, members, papers, runs, discussions, releases, entries] = await Promise.all([
    getAllProjects(),
    getAllMembers(),
    getAllPapers(),
    getAllRuns(),
    getAllDiscussions(),
    getAllReleases(),
    prisma.researchEntry.findMany({
      select: { id: true, projectSlug: true, title: true, summary: true, type: true, tags: true },
    }),
  ]);

  const items: SearchItem[] = [
    ...projects.map((p) => ({
      type: 'project' as const,
      title: p.name,
      subtitle: p.description,
      href: `/projects/${p.slug}`,
      keywords: [p.name, p.slug, p.description, ...p.tags].join(' '),
    })),
    ...members.map((m) => ({
      type: 'member' as const,
      title: m.displayName,
      subtitle: `@${m.login} · ${m.role}`,
      href: `/members/${m.login}`,
      keywords: [m.displayName, m.login, m.role, m.bio ?? ''].join(' '),
    })),
    ...papers.map((p) => ({
      type: 'paper' as const,
      title: p.title,
      subtitle: `${p.venue ?? ''} · ${p.projectSlug}`.trim(),
      href: `/projects/${p.projectSlug}/papers`,
      keywords: [p.title, p.venue ?? '', ...p.authorLogins, p.stage].join(' '),
    })),
    ...runs.map((r) => ({
      type: 'run' as const,
      title: r.name,
      subtitle: `${r.projectSlug} · ${r.status}`,
      href: `/projects/${r.projectSlug}/experiments/${r.id}`,
      keywords: [r.name, r.projectSlug, r.triggeredByLogin, r.summary ?? ''].join(' '),
    })),
    ...discussions.map((d) => ({
      type: 'discussion' as const,
      title: d.title,
      subtitle: `${d.category.replace('_', ' ')} · ${d.authorLogin}`,
      href: `/discussions/${d.id}`,
      keywords: [d.title, d.bodyMarkdown, d.authorLogin].join(' '),
    })),
    ...releases.map((r) => ({
      type: 'release' as const,
      title: r.name,
      subtitle: `${r.kind} · ${r.version} · ${r.projectSlug}`,
      href: `/projects/${r.projectSlug}/results`,
      keywords: [r.name, r.kind, r.version, r.description ?? ''].join(' '),
    })),
    ...entries.map((e) => ({
      type: 'entry' as const,
      title: e.title,
      subtitle: `${e.projectSlug} · ${e.type} · ${e.summary}`,
      href: `/projects/${e.projectSlug}`,
      keywords: [e.title, e.summary, e.tags].join(' '),
    })),
  ];

  return NextResponse.json(
    { items },
    {
      headers: { 'Cache-Control': 'no-store' }, // always fresh in dev; tune for prod later
    }
  );
}
