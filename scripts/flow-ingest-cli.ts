// CLI for labhub-flow-ingest skill — performs all DB I/O so the skill itself
// only does LLM extraction. Run from the LabHub repo root (uses prisma/dev.db).
//
// Subcommands:
//   get-project       --slug <slug>           → JSON project metadata + tasks + wikiTypes + ingestedSources
//   list-new-progress --slug <slug> [--force] → JSON of unprocessed progress_*.md files
//   apply             (reads JSON from stdin) → upserts FlowEvent + links
//
// Errors: stderr message + exit non-zero.

import 'dotenv/config';
import path from 'node:path';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../lib/generated/prisma/client';

function newPrisma() {
  const dbPath = path.resolve(process.cwd(), 'prisma/dev.db');
  const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
  return new PrismaClient({ adapter });
}

function parseArgs(argv: string[]): { sub: string; flags: Record<string, string | boolean> } {
  const [, , sub, ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = rest[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i += 1;
      } else {
        flags[key] = true;
      }
    }
  }
  return { sub: sub ?? '', flags };
}

async function cmdGetProject(slug: string) {
  const prisma = newPrisma();
  try {
    const project = await prisma.project.findUnique({ where: { slug } });
    if (!project) throw new Error(`project not found: ${slug}`);
    if (!project.githubRepo) {
      throw new Error(
        `project "${slug}" has no githubRepo set. Set Project.githubRepo (e.g. "owner/repo") before ingest.`,
      );
    }
    if (!project.localPath) {
      throw new Error(
        `project "${slug}" has no localPath set. Set Project.localPath to the local git checkout path before ingest.`,
      );
    }

    const [tasks, wikiTypes, ingested] = await Promise.all([
      prisma.todoItem.findMany({
        where: { projectSlug: slug },
        orderBy: [{ bucket: 'asc' }, { position: 'asc' }],
        select: { id: true, bucket: true, text: true, goal: true, subtasks: true, status: true },
      }),
      prisma.wikiType.findMany({
        where: { projectSlug: slug },
        orderBy: { position: 'asc' },
        select: { key: true, label: true, description: true },
      }),
      prisma.flowEvent.findMany({
        where: { projectSlug: slug },
        select: { source: true },
        distinct: ['source'],
      }),
    ]);

    console.log(
      JSON.stringify(
        {
          project: {
            slug: project.slug,
            name: project.name,
            localPath: project.localPath,
            githubRepo: project.githubRepo,
          },
          tasks: tasks.map(t => ({
            id: t.id,
            bucket: t.bucket,
            title: t.text,
            goal: t.goal,
            subtasks: t.subtasks ? JSON.parse(t.subtasks) : [],
            status: t.status,
          })),
          wikiTypes,
          ingestedSources: ingested.map(e => e.source),
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function cmdListNewProgress(slug: string, force: boolean) {
  const prisma = newPrisma();
  try {
    const project = await prisma.project.findUnique({ where: { slug } });
    if (!project) throw new Error(`project not found: ${slug}`);
    if (!project.githubRepo || !project.localPath) {
      throw new Error(`project "${slug}" needs githubRepo + localPath; set both before ingest`);
    }

    const progressRoot = path.join(project.localPath, 'progress');
    const ingested = new Set<string>(
      force
        ? []
        : (
            await prisma.flowEvent.findMany({
              where: { projectSlug: slug },
              select: { source: true },
              distinct: ['source'],
            })
          ).map(e => e.source),
    );

    const fs = await import('node:fs/promises');
    const files: { path: string; source: string; ingested: boolean }[] = [];
    let researcherDirs: string[] = [];
    try {
      researcherDirs = await fs.readdir(progressRoot);
    } catch {
      console.log(JSON.stringify({ progressRoot, files: [] }, null, 2));
      return;
    }
    for (const d of researcherDirs) {
      const sub = path.join(progressRoot, d);
      const stat = await fs.stat(sub).catch(() => null);
      if (!stat?.isDirectory()) continue;
      const entries = await fs.readdir(sub);
      for (const f of entries) {
        if (!/^progress_.*\.md$/.test(f)) continue;
        files.push({ path: path.join(sub, f), source: f, ingested: ingested.has(f) });
      }
    }
    files.sort((a, b) => a.source.localeCompare(b.source));
    console.log(JSON.stringify({ progressRoot, files }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const { sub, flags } = parseArgs(process.argv);
  switch (sub) {
    case 'get-project': {
      const slug = String(flags.slug ?? '');
      if (!slug) throw new Error('get-project: --slug required');
      await cmdGetProject(slug);
      return;
    }
    case 'list-new-progress': {
      const slug = String(flags.slug ?? '');
      if (!slug) throw new Error('list-new-progress: --slug required');
      await cmdListNewProgress(slug, Boolean(flags.force));
      return;
    }
    default:
      console.error('usage: flow-ingest-cli {get-project|list-new-progress|apply} [flags]');
      process.exit(1);
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
