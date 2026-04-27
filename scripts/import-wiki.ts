// Mirror a project's git wiki/ folder into the LabHub WikiEntity table.
//
// Usage:
//   pnpm tsx scripts/import-wiki.ts --slug <project-slug>
//
// Assumes the project has Project.localPath set to a git checkout containing
// a wiki/ subfolder organized by type:
//   wiki/<type>/<entity-id>.md   (frontmatter: name, type, status, last_updated)
//
// Type registry comes from WikiType rows for the project — directories on
// disk that don't match a known type are skipped. Run once per project; safe
// to re-run (upserts entities, only touches lastSyncedAt when content
// actually changed; deletes entities present in DB but no longer in git).

import 'dotenv/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../lib/generated/prisma/client';

type Frontmatter = {
  name?: string;
  type?: string;
  status?: string;
  last_updated?: string;
};

function parseFrontmatter(src: string): { fm: Frontmatter; body: string } {
  const m = src.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: src };
  const fm: Frontmatter = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) (fm as Record<string, string>)[kv[1]] = kv[2].trim();
  }
  return { fm, body: m[2] };
}

function extractSummary(body: string): string {
  const m = body.match(/##\s+Summary\s*\n([\s\S]*?)(?:\n##\s|$)/);
  if (m) return m[1].trim();
  for (const para of body.split(/\n\n+/)) {
    const t = para.trim();
    if (t && !t.startsWith('#')) return t;
  }
  return '';
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out[key] = next;
        i += 1;
      } else {
        out[key] = 'true';
      }
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const slug = args.slug;
  if (!slug) {
    console.error('usage: import-wiki.ts --slug <project-slug>');
    process.exit(1);
  }

  const adapter = new PrismaBetterSqlite3({ url: 'file:./prod.db' });
  const prisma = new PrismaClient({ adapter });

  const project = await prisma.project.findUnique({ where: { slug } });
  if (!project) {
    console.error(`project not found: ${slug}`);
    process.exit(1);
  }
  if (!project.localPath) {
    console.error(`project "${slug}" has no localPath set; cannot import wiki`);
    process.exit(1);
  }

  const types = await prisma.wikiType.findMany({
    where: { projectSlug: slug },
    select: { key: true },
  });
  if (types.length === 0) {
    console.error(`project "${slug}" has no WikiType rows. Define wiki types first.`);
    process.exit(1);
  }

  const wikiRoot = path.join(project.localPath, 'wiki');

  const now = new Date();
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  const seenIds = new Set<string>();

  // For each WikiType, look in wiki/<typeKey>s/ (pluralized) AND wiki/<typeKey>/.
  for (const t of types) {
    const candidates = [
      path.join(wikiRoot, t.key + 's'),
      path.join(wikiRoot, t.key),
    ];
    let dir: string | null = null;
    for (const c of candidates) {
      try {
        const stat = await fs.stat(c);
        if (stat.isDirectory()) { dir = c; break; }
      } catch { /* missing */ }
    }
    if (!dir) continue;

    const files = (await fs.readdir(dir)).filter(f => f.endsWith('.md'));
    for (const f of files) {
      const full = path.join(dir, f);
      const src = await fs.readFile(full, 'utf8');
      const { fm, body } = parseFrontmatter(src);
      const id = (fm.name ?? f.replace(/\.md$/, '')).trim();
      const name = fm.name ?? id;
      const status = fm.status ?? 'active';
      const summary = extractSummary(body);
      const trimmedBody = body.trim();
      const sourceRel = path.relative(project.localPath, full);
      seenIds.add(id);

      const existing = await prisma.wikiEntity.findUnique({
        where: { projectSlug_id: { projectSlug: slug, id } },
      });

      if (!existing) {
        await prisma.wikiEntity.create({
          data: {
            projectSlug: slug,
            id,
            type: t.key,
            name,
            status,
            summaryMarkdown: summary,
            bodyMarkdown: trimmedBody,
            sourceFiles: JSON.stringify([sourceRel]),
            lastSyncedAt: now,
          },
        });
        created += 1;
      } else if (
        existing.bodyMarkdown === trimmedBody &&
        existing.summaryMarkdown === summary &&
        existing.status === status &&
        existing.name === name &&
        existing.type === t.key
      ) {
        unchanged += 1;
      } else {
        await prisma.wikiEntity.update({
          where: { projectSlug_id: { projectSlug: slug, id } },
          data: {
            type: t.key,
            name,
            status,
            summaryMarkdown: summary,
            bodyMarkdown: trimmedBody,
            sourceFiles: JSON.stringify([sourceRel]),
            lastSyncedAt: now,
          },
        });
        updated += 1;
      }
    }
  }

  // Delete entities in DB but no longer on disk.
  const orphans = await prisma.wikiEntity.findMany({
    where: { projectSlug: slug, id: { notIn: [...seenIds] } },
    select: { id: true },
  });
  if (orphans.length > 0) {
    await prisma.wikiEntity.deleteMany({
      where: { projectSlug: slug, id: { in: orphans.map(o => o.id) } },
    });
  }

  console.log(
    `Wiki sync (project=${slug}): created=${created} updated=${updated} unchanged=${unchanged} deleted=${orphans.length}`,
  );
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
