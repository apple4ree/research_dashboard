// Admin power tool — runs from the LabHub repo with direct DB access via
// prisma/dev.db. The labhub-flow-ingest skill (V2) no longer calls this; it
// goes through the HTTP API (POST /api/flow-events) instead. Kept usable for
// one-shot admin ops on the server.
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
    // V2: githubRepo is optional metadata — UI source preview only. Skill
    // (HTTP-based) doesn't need it. CLI still walks <localPath>/progress, so
    // localPath remains required here.
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
    if (!project.localPath) {
      throw new Error(`project "${slug}" has no localPath; set it before ingest`);
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

const ALLOWED_TONES = new Set(['milestone', 'pivot', 'result', 'incident', 'design']);

type ApplyPayload = {
  projectSlug: string;
  event: {
    date: string;
    source: string;
    title: string;
    summary: string;
    tone: string;
    bullets?: string[];
    numbers?: { label: string; value: string }[];
    tags?: string[];
  };
  taskIds?: number[];
  overwrite?: boolean;
};

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

async function cmdApply(stdinJson: string) {
  let payload: ApplyPayload;
  try {
    payload = JSON.parse(stdinJson);
  } catch {
    throw new Error('apply: stdin is not valid JSON');
  }

  const { projectSlug, event, taskIds = [], overwrite = false } = payload;
  if (!projectSlug) throw new Error('apply: projectSlug required');
  if (!event?.source) throw new Error('apply: event.source required');
  if (!event.title) throw new Error('apply: event.title required');
  if (!ALLOWED_TONES.has(event.tone)) {
    throw new Error(
      `apply: invalid tone "${event.tone}". Must be one of: ${[...ALLOWED_TONES].join(', ')}`,
    );
  }

  const prisma = newPrisma();
  try {
    const project = await prisma.project.findUnique({ where: { slug: projectSlug } });
    if (!project) throw new Error(`apply: project not found: ${projectSlug}`);
    if (taskIds.length > 0) {
      const found = await prisma.todoItem.findMany({
        where: { projectSlug, id: { in: taskIds } },
        select: { id: true },
      });
      const foundIds = new Set(found.map(t => t.id));
      const missing = taskIds.filter(id => !foundIds.has(id));
      if (missing.length > 0) {
        throw new Error(`apply: taskIds not found in this project: ${missing.join(', ')}`);
      }
    }

    const existingEvents = await prisma.flowEvent.findMany({
      where: { projectSlug, source: event.source },
      select: { id: true },
    });

    if (existingEvents.length > 0 && !overwrite) {
      throw new Error(
        `apply: event already exists for source "${event.source}". Pass overwrite:true to replace.`,
      );
    }

    if (existingEvents.length > 0) {
      // Overwrite: delete existing same-source events (cascades to their links).
      await prisma.flowEvent.deleteMany({ where: { projectSlug, source: event.source } });
    }

    const max = await prisma.flowEvent.findFirst({
      where: { projectSlug },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const saved = await prisma.flowEvent.create({
      data: {
        projectSlug,
        date: event.date,
        source: event.source,
        title: event.title,
        summary: event.summary,
        tone: event.tone,
        bullets: event.bullets ? JSON.stringify(event.bullets) : null,
        numbers: event.numbers ? JSON.stringify(event.numbers) : null,
        tags: event.tags ? JSON.stringify(event.tags) : null,
        position: (max?.position ?? -1) + 1,
      },
    });

    let linkCount = 0;
    for (const tid of taskIds) {
      try {
        await prisma.flowEventTaskLink.create({
          data: { projectSlug, flowEventId: saved.id, todoId: tid, source: 'llm' },
        });
        linkCount += 1;
      } catch {
        // unique constraint hit — already linked, ignore
      }
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          eventId: saved.id,
          mode: existingEvents.length > 0 ? 'updated' : 'created',
          taskLinks: linkCount,
        },
        null,
        2,
      ),
    );
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
    case 'apply': {
      const stdin = await readStdin();
      await cmdApply(stdin);
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
