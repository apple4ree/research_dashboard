# labhub-flow-ingest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship the `labhub-flow-ingest` skill that the Flow page's empty state already advertises. The skill walks `<localPath>/progress/<researcher>/progress_*.md`, has the LLM extract one structured `FlowEvent` per file, and persists rows + task links via a bundled CLI.

**Architecture:** Local CLI script (`scripts/flow-ingest-cli.ts`) does all DB I/O via Prisma. SKILL.md orchestrates: spawn CLI for project metadata, `git pull`, walk new files, per-file LLM extraction, spawn CLI to persist. Second plugin entry in this repo's marketplace alongside `labhub`. No new HTTP API.

**Tech Stack:** Node + tsx (CLI), Prisma 7 against existing `prisma/dev.db`, Claude Code skill format. Playwright for CLI sub-command tests via `child_process.execSync`.

---

## File Structure

```
scripts/
  flow-ingest-cli.ts                          # NEW — get-project / list-new-progress / apply
skills/
  labhub-flow-ingest/
    SKILL.md                                  # NEW — agent instruction (~150 lines)
.claude-plugin/marketplace.json               # MODIFY — add second plugin entry
docs/progress-format.md                       # NEW — researcher-facing format guide
tests/cli/
  flow-ingest-cli.spec.ts                     # NEW — CLI sub-command tests
docs/superpowers/specs/2026-04-27-labhub-flow-ingest.md   # already committed
docs/superpowers/plans/2026-04-27-labhub-flow-ingest.md   # THIS FILE
```

---

## Task 1: CLI scaffold + `get-project` sub-command (TDD)

**Files:**
- Create: `scripts/flow-ingest-cli.ts`
- Create: `tests/cli/flow-ingest-cli.spec.ts`

- [ ] **Step 1: Write failing test for `get-project`**

Create `/home/dgu/research_dashboard/tests/cli/flow-ingest-cli.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import Database from 'better-sqlite3';

const DB_PATH = path.resolve(process.cwd(), 'prisma/dev.db');
const CLI = `pnpm tsx ${path.resolve(process.cwd(), 'scripts/flow-ingest-cli.ts')}`;

function runCli(argv: string, opts: { stdin?: string; expectFail?: boolean } = {}): { stdout: string; stderr: string; code: number } {
  try {
    const stdout = execSync(`${CLI} ${argv}`, {
      cwd: process.cwd(),
      input: opts.stdin,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', code: 0 };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; status?: number };
    if (!opts.expectFail) throw e;
    return { stdout: err.stdout ?? '', stderr: err.stderr ?? '', code: err.status ?? 1 };
  }
}

const FIXTURE_SLUG = 'flow-ingest-test';

function ensureFixtureProject(localPath: string): void {
  const db = new Database(DB_PATH);
  const now = new Date().toISOString();
  db.prepare(`INSERT OR IGNORE INTO Project (slug, name, description, tags, pinned, createdAt, updatedAt, source, githubRepo, localPath)
              VALUES (?, ?, ?, '[]', 0, ?, ?, 'internal', ?, ?)`)
    .run(FIXTURE_SLUG, 'Flow Ingest Test', 'fixture project for CLI tests', now, now, 'apple4ree/test', localPath);
  db.prepare(`UPDATE Project SET githubRepo=?, localPath=? WHERE slug=?`)
    .run('apple4ree/test', localPath, FIXTURE_SLUG);
  db.close();
}

test('get-project: returns project + tasks + wiki types + ingested sources', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-ingest-test-'));
  ensureFixtureProject(tmpDir);

  const { stdout } = runCli(`get-project --slug ${FIXTURE_SLUG}`);
  const result = JSON.parse(stdout);

  expect(result.project.slug).toBe(FIXTURE_SLUG);
  expect(result.project.localPath).toBe(tmpDir);
  expect(result.project.githubRepo).toBe('apple4ree/test');
  expect(Array.isArray(result.tasks)).toBe(true);
  expect(Array.isArray(result.wikiTypes)).toBe(true);
  expect(Array.isArray(result.ingestedSources)).toBe(true);

  await fs.rm(tmpDir, { recursive: true, force: true });
});

test('get-project: errors when project missing', async () => {
  const { code, stderr } = runCli('get-project --slug no-such-project', { expectFail: true });
  expect(code).not.toBe(0);
  expect(stderr).toMatch(/not found/i);
});

test('get-project: errors when localPath unset', async () => {
  const slug = 'flow-ingest-no-localpath';
  const db = new Database(DB_PATH);
  const now = new Date().toISOString();
  db.prepare(`INSERT OR IGNORE INTO Project (slug, name, description, tags, pinned, createdAt, updatedAt, source, githubRepo)
              VALUES (?, ?, ?, '[]', 0, ?, ?, 'internal', ?)`)
    .run(slug, 'No Local Path', '', now, now, 'apple4ree/test');
  db.prepare(`UPDATE Project SET localPath=NULL WHERE slug=?`).run(slug);
  db.close();

  const { code, stderr } = runCli(`get-project --slug ${slug}`, { expectFail: true });
  expect(code).not.toBe(0);
  expect(stderr).toMatch(/localPath/);
});
```

- [ ] **Step 2: Run to confirm fail**

Run: `pnpm exec playwright test tests/cli/flow-ingest-cli.spec.ts --reporter=line --workers=1`

Expected: 3 fail (CLI script doesn't exist).

- [ ] **Step 3: Create `scripts/flow-ingest-cli.ts` with `get-project` only**

```ts
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
      if (next && !next.startsWith('--')) { flags[key] = next; i += 1; }
      else { flags[key] = true; }
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
      throw new Error(`project "${slug}" has no githubRepo set. Set Project.githubRepo (e.g. "owner/repo") before ingest.`);
    }
    if (!project.localPath) {
      throw new Error(`project "${slug}" has no localPath set. Set Project.localPath to the local git checkout path before ingest.`);
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

    console.log(JSON.stringify({
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
    }, null, 2));
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
    default:
      console.error('usage: flow-ingest-cli {get-project|list-new-progress|apply} [flags]');
      process.exit(1);
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
```

- [ ] **Step 4: Run tests to confirm pass**

Run: `pnpm exec playwright test tests/cli/flow-ingest-cli.spec.ts --reporter=line --workers=1`

Expected: 3/3 pass.

- [ ] **Step 5: Commit**

```bash
git -C /home/dgu/research_dashboard add scripts/flow-ingest-cli.ts tests/cli/flow-ingest-cli.spec.ts
git -C /home/dgu/research_dashboard commit -m "flow-ingest CLI: scaffold + get-project sub-command (TDD)"
```

---

## Task 2: `list-new-progress` sub-command (TDD)

**Files:**
- Modify: `scripts/flow-ingest-cli.ts` — add `cmdListNewProgress`
- Modify: `tests/cli/flow-ingest-cli.spec.ts` — append 3 cases

- [ ] **Step 1: Append tests**

Append to `tests/cli/flow-ingest-cli.spec.ts`:

```ts
test('list-new-progress: walks <localPath>/progress/<researcher>/progress_*.md', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-ingest-test-'));
  ensureFixtureProject(tmpDir);

  const subDir = path.join(tmpDir, 'progress', 'dgu');
  await fs.mkdir(subDir, { recursive: true });
  await fs.writeFile(path.join(subDir, 'progress_20260427_1400.md'), '# test', 'utf8');
  await fs.writeFile(path.join(subDir, 'progress_20260427_1500.md'), '# test', 'utf8');
  await fs.writeFile(path.join(subDir, 'not-progress.md'), '# ignore me', 'utf8');

  const { stdout } = runCli(`list-new-progress --slug ${FIXTURE_SLUG}`);
  const result = JSON.parse(stdout);

  expect(result.progressRoot).toBe(path.join(tmpDir, 'progress'));
  expect(result.files.length).toBe(2);
  expect(result.files.every((f: { ingested: boolean }) => f.ingested === false)).toBe(true);
  expect(result.files.map((f: { source: string }) => f.source).sort()).toEqual([
    'progress_20260427_1400.md', 'progress_20260427_1500.md',
  ]);

  await fs.rm(tmpDir, { recursive: true, force: true });
});

test('list-new-progress: marks files matching FlowEvent.source as ingested', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-ingest-test-'));
  ensureFixtureProject(tmpDir);

  const subDir = path.join(tmpDir, 'progress', 'dgu');
  await fs.mkdir(subDir, { recursive: true });
  await fs.writeFile(path.join(subDir, 'progress_20260427_2000.md'), '# test', 'utf8');

  // Pre-populate a FlowEvent with that source.
  const db = new Database(DB_PATH);
  db.prepare(`INSERT INTO FlowEvent (projectSlug, date, source, title, summary, tone, position)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(FIXTURE_SLUG, '2026-04-27 20:00', 'progress_20260427_2000.md', 'pre-existing', 'fixture', 'milestone', 0);
  db.close();

  const { stdout } = runCli(`list-new-progress --slug ${FIXTURE_SLUG}`);
  const result = JSON.parse(stdout);

  const f = result.files.find((x: { source: string }) => x.source === 'progress_20260427_2000.md');
  expect(f).toBeTruthy();
  expect(f.ingested).toBe(true);

  // cleanup the row so other tests don't see it
  const cleanup = new Database(DB_PATH);
  cleanup.prepare(`DELETE FROM FlowEvent WHERE projectSlug=? AND source=?`)
    .run(FIXTURE_SLUG, 'progress_20260427_2000.md');
  cleanup.close();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

test('list-new-progress: --force marks all files as not-ingested', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-ingest-test-'));
  ensureFixtureProject(tmpDir);

  const subDir = path.join(tmpDir, 'progress', 'dgu');
  await fs.mkdir(subDir, { recursive: true });
  await fs.writeFile(path.join(subDir, 'progress_20260427_2100.md'), '# test', 'utf8');

  const db = new Database(DB_PATH);
  db.prepare(`INSERT INTO FlowEvent (projectSlug, date, source, title, summary, tone, position)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(FIXTURE_SLUG, '2026-04-27 21:00', 'progress_20260427_2100.md', 'force-test', 'fixture', 'milestone', 0);
  db.close();

  const { stdout } = runCli(`list-new-progress --slug ${FIXTURE_SLUG} --force`);
  const result = JSON.parse(stdout);
  const f = result.files.find((x: { source: string }) => x.source === 'progress_20260427_2100.md');
  expect(f.ingested).toBe(false);

  const cleanup = new Database(DB_PATH);
  cleanup.prepare(`DELETE FROM FlowEvent WHERE projectSlug=? AND source=?`)
    .run(FIXTURE_SLUG, 'progress_20260427_2100.md');
  cleanup.close();
  await fs.rm(tmpDir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run to confirm fail**

Run: `pnpm exec playwright test tests/cli/flow-ingest-cli.spec.ts -g "list-new-progress" --reporter=line --workers=1`

Expected: 3 fail (sub-command doesn't exist).

- [ ] **Step 3: Add `cmdListNewProgress` to CLI**

Insert into `scripts/flow-ingest-cli.ts` after `cmdGetProject`:

```ts
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
      force ? [] : (await prisma.flowEvent.findMany({
        where: { projectSlug: slug },
        select: { source: true },
        distinct: ['source'],
      })).map(e => e.source),
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
```

And register in the dispatch switch:

```ts
case 'list-new-progress': {
  const slug = String(flags.slug ?? '');
  if (!slug) throw new Error('list-new-progress: --slug required');
  await cmdListNewProgress(slug, Boolean(flags.force));
  return;
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `pnpm exec playwright test tests/cli/flow-ingest-cli.spec.ts --reporter=line --workers=1`

Expected: 6/6 pass (3 prior + 3 new).

- [ ] **Step 5: Commit**

```bash
git -C /home/dgu/research_dashboard add scripts/flow-ingest-cli.ts tests/cli/flow-ingest-cli.spec.ts
git -C /home/dgu/research_dashboard commit -m "flow-ingest CLI: list-new-progress sub-command (TDD)"
```

---

## Task 3: `apply` sub-command (TDD)

**Files:**
- Modify: `scripts/flow-ingest-cli.ts` — add `cmdApply`
- Modify: `tests/cli/flow-ingest-cli.spec.ts` — append 5 cases

- [ ] **Step 1: Append tests**

Append to `tests/cli/flow-ingest-cli.spec.ts`:

```ts
function makeApplyPayload(opts: {
  source?: string;
  tone?: string;
  taskIds?: number[];
  overwrite?: boolean;
} = {}): string {
  return JSON.stringify({
    projectSlug: FIXTURE_SLUG,
    event: {
      date: '2026-04-27 14:00',
      source: opts.source ?? 'progress_20260427_1400.md',
      title: 'apply test',
      summary: 'fixture summary',
      tone: opts.tone ?? 'milestone',
      bullets: ['fact 1', 'fact 2'],
      numbers: [{ label: 'metric', value: '0.5' }],
      tags: ['tag-a'],
    },
    taskIds: opts.taskIds ?? [],
    overwrite: opts.overwrite ?? false,
  });
}

function cleanupEventsForSource(source: string) {
  const db = new Database(DB_PATH);
  // FlowEventTaskLink cascades from FlowEvent
  db.prepare(`DELETE FROM FlowEvent WHERE projectSlug=? AND source=?`).run(FIXTURE_SLUG, source);
  db.close();
}

test('apply: creates FlowEvent on happy path', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-ingest-test-'));
  ensureFixtureProject(tmpDir);
  const source = `progress_apply_${Date.now()}.md`;

  const { stdout } = runCli('apply', { stdin: makeApplyPayload({ source }) });
  const result = JSON.parse(stdout);
  expect(result.ok).toBe(true);
  expect(typeof result.eventId).toBe('number');
  expect(result.mode).toBe('created');
  expect(result.taskLinks).toBe(0);

  cleanupEventsForSource(source);
  await fs.rm(tmpDir, { recursive: true, force: true });
});

test('apply: rejects invalid tone', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-ingest-test-'));
  ensureFixtureProject(tmpDir);
  const { code, stderr } = runCli('apply', {
    stdin: makeApplyPayload({ tone: 'bogus', source: `progress_tone_${Date.now()}.md` }),
    expectFail: true,
  });
  expect(code).not.toBe(0);
  expect(stderr).toMatch(/tone/);
  await fs.rm(tmpDir, { recursive: true, force: true });
});

test('apply: duplicate source without overwrite → error', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-ingest-test-'));
  ensureFixtureProject(tmpDir);
  const source = `progress_dup_${Date.now()}.md`;

  runCli('apply', { stdin: makeApplyPayload({ source }) });
  const { code, stderr } = runCli('apply', { stdin: makeApplyPayload({ source }), expectFail: true });
  expect(code).not.toBe(0);
  expect(stderr).toMatch(/already exists/);

  cleanupEventsForSource(source);
  await fs.rm(tmpDir, { recursive: true, force: true });
});

test('apply: overwrite=true replaces same-source events and llm-source links', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-ingest-test-'));
  ensureFixtureProject(tmpDir);
  const source = `progress_over_${Date.now()}.md`;

  runCli('apply', { stdin: makeApplyPayload({ source }) });
  const { stdout } = runCli('apply', { stdin: makeApplyPayload({ source, overwrite: true }) });
  const result = JSON.parse(stdout);
  expect(result.ok).toBe(true);
  expect(result.mode).toBe('updated');

  // After overwrite, only one event with that source remains.
  const db = new Database(DB_PATH);
  const rows = db.prepare(`SELECT id FROM FlowEvent WHERE projectSlug=? AND source=?`)
    .all(FIXTURE_SLUG, source);
  db.close();
  expect(rows.length).toBe(1);

  cleanupEventsForSource(source);
  await fs.rm(tmpDir, { recursive: true, force: true });
});

test('apply: links to existing tasks; rejects unknown taskIds', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-ingest-test-'));
  ensureFixtureProject(tmpDir);
  const source = `progress_link_${Date.now()}.md`;

  // Create one fixture task to link to.
  const db = new Database(DB_PATH);
  const taskRow = db.prepare(`INSERT INTO TodoItem (projectSlug, bucket, text, status, position) VALUES (?, ?, ?, ?, ?)`)
    .run(FIXTURE_SLUG, 'short', 'fixture task for link', 'in_progress', 99);
  const realId = Number(taskRow.lastInsertRowid);
  db.close();

  // Happy path: link to real id.
  const { stdout } = runCli('apply', { stdin: makeApplyPayload({ source, taskIds: [realId] }) });
  const result = JSON.parse(stdout);
  expect(result.ok).toBe(true);
  expect(result.taskLinks).toBe(1);

  // Unknown id → error.
  const { code, stderr } = runCli('apply', {
    stdin: makeApplyPayload({ source: `${source}-2`, taskIds: [999999] }),
    expectFail: true,
  });
  expect(code).not.toBe(0);
  expect(stderr).toMatch(/not found/);

  // cleanup
  const cleanup = new Database(DB_PATH);
  cleanup.prepare(`DELETE FROM TodoItem WHERE id=?`).run(realId);
  cleanup.close();
  cleanupEventsForSource(source);
  await fs.rm(tmpDir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run to confirm fail**

Run: `pnpm exec playwright test tests/cli/flow-ingest-cli.spec.ts -g "apply" --reporter=line --workers=1`

Expected: 5 fail.

- [ ] **Step 3: Add `cmdApply` and stdin reader to CLI**

Add to `scripts/flow-ingest-cli.ts`:

```ts
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
  try { payload = JSON.parse(stdinJson); }
  catch { throw new Error('apply: stdin is not valid JSON'); }

  const { projectSlug, event, taskIds = [], overwrite = false } = payload;
  if (!projectSlug) throw new Error('apply: projectSlug required');
  if (!event?.source) throw new Error('apply: event.source required');
  if (!event.title) throw new Error('apply: event.title required');
  if (!ALLOWED_TONES.has(event.tone)) {
    throw new Error(`apply: invalid tone "${event.tone}". Must be one of: ${[...ALLOWED_TONES].join(', ')}`);
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

    // Existing events with the same source (V2 schema allows multiple).
    const existingEvents = await prisma.flowEvent.findMany({
      where: { projectSlug, source: event.source },
      select: { id: true },
    });

    if (existingEvents.length > 0 && !overwrite) {
      throw new Error(`apply: event already exists for source "${event.source}". Pass overwrite:true to replace.`);
    }

    let saved;
    if (existingEvents.length > 0) {
      // Overwrite path: delete existing same-source events (cascades to all their links).
      // Then create one fresh event + llm-source links. Manual links on other events for
      // this source (rare in V1) are also wiped, but V1 mints all links itself.
      await prisma.flowEvent.deleteMany({
        where: { projectSlug, source: event.source },
      });
      const max = await prisma.flowEvent.findFirst({
        where: { projectSlug }, orderBy: { position: 'desc' }, select: { position: true },
      });
      saved = await prisma.flowEvent.create({
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
    } else {
      const max = await prisma.flowEvent.findFirst({
        where: { projectSlug }, orderBy: { position: 'desc' }, select: { position: true },
      });
      saved = await prisma.flowEvent.create({
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
    }

    let linkCount = 0;
    for (const tid of taskIds) {
      try {
        await prisma.flowEventTaskLink.create({
          data: { projectSlug, flowEventId: saved.id, todoId: tid, source: 'llm' },
        });
        linkCount += 1;
      } catch {
        // unique constraint hit — fine, treat as already-linked
      }
    }

    console.log(JSON.stringify({
      ok: true,
      eventId: saved.id,
      mode: existingEvents.length > 0 ? 'updated' : 'created',
      taskLinks: linkCount,
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}
```

Add the dispatch case:

```ts
case 'apply': {
  const stdin = await readStdin();
  await cmdApply(stdin);
  return;
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `pnpm exec playwright test tests/cli/flow-ingest-cli.spec.ts --reporter=line --workers=1`

Expected: 11 passed (6 prior + 5 new).

- [ ] **Step 5: Commit**

```bash
git -C /home/dgu/research_dashboard add scripts/flow-ingest-cli.ts tests/cli/flow-ingest-cli.spec.ts
git -C /home/dgu/research_dashboard commit -m "flow-ingest CLI: apply sub-command with overwrite + task linking (TDD)"
```

---

## Task 4: SKILL.md body

**Files:**
- Create: `skills/labhub-flow-ingest/SKILL.md`

- [ ] **Step 1: Create the skill folder + body**

```bash
mkdir -p skills/labhub-flow-ingest
```

Write `/home/dgu/research_dashboard/skills/labhub-flow-ingest/SKILL.md`:

````markdown
---
name: labhub-flow-ingest
description: |
  Pull progress markdown files from a research project's git checkout, run LLM
  extraction, and populate LabHub Flow J view (FlowEvents + task links).
  Trigger: "labhub-flow-ingest <slug>", "flow ingest", "<slug>의 progress 정리해줘",
  "wiki ingest" (currently flow only — wiki is a separate phase).
---

# labhub-flow-ingest

Auto-populate the LabHub Flow J view (`/projects/<slug>/flow`) from a project's
git progress files. One project per invocation.

## When to invoke

User says something like:
- "labhub-flow-ingest tick-agent"
- "tick-agent의 progress 정리해줘"
- "flow ingest tick-agent"

If they don't supply a slug, ask: `"어느 프로젝트의 progress를 ingest 할까요?"`.

## Constants

```
LABHUB_REPO  = /home/dgu/research_dashboard       (or $LABHUB_REPO env override)
CLI          = $LABHUB_REPO/scripts/flow-ingest-cli.ts
RUNNER       = pnpm tsx $CLI
```

The CLI must run from `LABHUB_REPO` (it uses cwd-relative `prisma/dev.db`).
Always `cd $LABHUB_REPO` before invoking.

## Hard requirements

- The project must have BOTH `Project.githubRepo` and `Project.localPath` set
  in the LabHub DB. The CLI errors out otherwise — surface that to the user
  with the SQL fix:
  `UPDATE Project SET githubRepo='owner/repo', localPath='/abs/path' WHERE slug='<slug>'`.

## Procedure

### Step 1: get-project metadata

```bash
cd $LABHUB_REPO
pnpm tsx scripts/flow-ingest-cli.ts get-project --slug <SLUG>
```

JSON output:
- `project.localPath` — git checkout root.
- `project.githubRepo` — `owner/repo`.
- `tasks[]` — TodoItem rows (`id, bucket, title, goal, subtasks, status`). Used in
  Step 4 for task mapping.
- `wikiTypes[]` — informational in V1; ignore for flow ingest.
- `ingestedSources[]` — already-processed progress filenames.

If the CLI errors with "githubRepo / localPath not set", stop and tell the user
to fix it. Don't auto-set; that's an admin call.

### Step 2: git pull

```bash
cd <project.localPath>
git pull --ff-only
```

If this errors (non-ff, conflicts, network), stop and report. Don't try to
recover automatically. After pulling, `cd $LABHUB_REPO` to be ready for CLI calls.

### Step 3: list-new-progress

```bash
cd $LABHUB_REPO
pnpm tsx scripts/flow-ingest-cli.ts list-new-progress --slug <SLUG>
```

Returns `{progressRoot, files: [{path, source, ingested}]}`. Without `--force`,
only `ingested: false` files need processing.

If `files.length === 0`, tell user "no new progress files since last ingest" and stop.

### Step 4: per-file extract → apply

For each file with `ingested: false`:

#### 4a. Read the markdown body

Use the **Read tool** on `file.path` (absolute path from list-new-progress).

#### 4b. Construct the apply payload

Following the schema in `docs/progress-format.md` and the body markdown
(`Context` / `Done` / `Numbers` / `Next` sections — all optional):

```json
{
  "projectSlug": "<SLUG>",
  "event": {
    "date": "<YYYY-MM-DD HH:mm — extract from filename or frontmatter>",
    "source": "<file.source — bare filename>",
    "title": "<≤30 chars; punchy summary; in result tone include the headline metric>",
    "summary": "<2-3 sentence what+why+result>",
    "tone": "milestone | result | pivot | design | incident",
    "bullets": ["<short fact 1>", "<short fact 2>", ...],
    "numbers": [{"label": "<short metric name>", "value": "<value string>"}, ...],
    "tags": ["<theme-tag>", "<activity-tag>", ...]
  },
  "taskIds": [<id of mapped task>, ...],
  "overwrite": false
}
```

**Tone — pick exactly one** (overlap is fine; pick the central change):

| Tone | When |
|---|---|
| `milestone` | Setup, new tooling, start of major change |
| `result` | Completed experiment with measurable outcome |
| `pivot` | Direction change, hypothesis abandoned |
| `design` | New experiment / structure design phase |
| `incident` | Debugging, outage, post-hoc fix |

**Title** — 30 chars max. For a `result`, include the headline number
("trigger_fake × MELON 0.305"). For a `pivot`, "X 폐기 → Y 설계" form.
Korean / English mix is fine.

**Bullets** — 0-5 short facts, usually from the file's `Done` / 결과 section.
Omit (or empty array) if nothing fits.

**Numbers** — 0-4 most important metrics, `{label, value}` shape. Skip if
the progress has no numerical data.

**Tags** — informational only in V1; skip if unsure.

**taskIds** — compare progress against `tasks[]` from Step 1. Pick tasks the
progress actually advances (`task.text` / `task.goal` / `task.subtasks` is
mentioned or clearly implied in the body). 1-3 typical, occasionally 0 or
more. **False positives are worse than false negatives** — drop ambiguous
mappings.

#### 4c. Apply via CLI stdin

```bash
echo '<JSON>' | pnpm tsx scripts/flow-ingest-cli.ts apply
```

Or with heredoc:

```bash
pnpm tsx scripts/flow-ingest-cli.ts apply <<'EOF'
{
  "projectSlug": "...",
  "event": {...},
  "taskIds": [...],
  "overwrite": false
}
EOF
```

Success → `{"ok": true, "eventId": <int>, "mode": "created", "taskLinks": <count>}`.

Failure → stderr message, non-zero exit. **Skip that file, continue with the
next one**, summarize all failures at the end.

### Step 5: Summary report

After processing all files, tell the user:

```
✓ Ingested <N>/<M> progress files into <SLUG>:
  - 2026-04-26 10:30  result    "trigger_fake × MELON 0.305"  → 2 tasks
  - 2026-04-27 14:00  design    "5종 ablation 라운드 설계"     → 1 task
  - 2026-04-27 16:00  incident  "YAML 파싱 버그"               → 0 tasks
  ⨯ progress_20260427_2300.md  — apply failed: <reason>

  https://labhub.damilab.cc/projects/<SLUG>/flow
```

## Failure modes

| Symptom | Action |
|---|---|
| `get-project` says githubRepo / localPath missing | Tell user to set via UI or SQL; stop. |
| `git pull` non-ff or conflicts | Show git output; ask user to resolve manually; stop. |
| Empty `files[]` | "No new progress files." Stop. |
| `apply` rejects tone | Re-pick tone, retry once. |
| `apply` rejects taskIds | Drop the unknown ids, retry. |
| `apply` says "already exists" without `--force` | The user re-running on the same file — skip and note. |
| Network / DB / unknown error | Surface the message, stop, leave whatever's done done. |

## Re-running

This skill is idempotent without `--force`: same progress files don't double-insert.
If the user wants to re-process (e.g., they edited an old file), they can:

1. Pass `--force` to the second `list-new-progress` call (skill currently doesn't
   accept this flag — V2 will), OR
2. Manually delete the FlowEvent row in DB and re-invoke.

V1 keeps re-runs simple: opt out of force, fix files, re-invoke.

## Cost notes

- One progress file ≈ 5K tokens in the LLM step (body + tasks context).
- 6 files ≈ 30K tokens, ~1-2 minutes wallclock.
- Run within Claude Max plan; no extra API charge.
````

- [ ] **Step 2: Verify line count**

Run: `wc -l skills/labhub-flow-ingest/SKILL.md`
Expected: under 250 (target ~200).

- [ ] **Step 3: Commit**

```bash
git -C /home/dgu/research_dashboard add skills/labhub-flow-ingest/SKILL.md
git -C /home/dgu/research_dashboard commit -m "labhub-flow-ingest skill: SKILL.md body"
```

---

## Task 5: Marketplace.json — add second plugin

**Files:**
- Modify: `.claude-plugin/marketplace.json`

- [ ] **Step 1: Read current state**

```bash
cat /home/dgu/research_dashboard/.claude-plugin/marketplace.json
```

- [ ] **Step 2: Add the second plugin entry**

The current `plugins` array has one entry (`labhub`). Append a sibling:

```json
{
  "name": "labhub-flow-ingest",
  "source": "./",
  "description": "Mirror a research project's progress files into LabHub Flow J view (FlowEvents + task links). Walks <localPath>/progress/<researcher>/progress_*.md, runs LLM extraction, persists rows.",
  "version": "0.1.0",
  "category": "research",
  "skills": ["./skills/labhub-flow-ingest"]
}
```

(Use the Edit tool to insert before the closing `]` of the `plugins` array, keeping the existing `labhub` entry intact.)

- [ ] **Step 3: Validate JSON**

```bash
python3 -m json.tool /home/dgu/research_dashboard/.claude-plugin/marketplace.json > /dev/null && echo OK
```

- [ ] **Step 4: Commit**

```bash
git -C /home/dgu/research_dashboard add .claude-plugin/marketplace.json
git -C /home/dgu/research_dashboard commit -m "marketplace: register labhub-flow-ingest plugin"
```

---

## Task 6: docs/progress-format.md (researcher-facing guide)

**Files:**
- Create: `docs/progress-format.md`

- [ ] **Step 1: Write the guide**

```markdown
# Progress file format for `labhub-flow-ingest`

Researchers writing daily progress notes for a project tracked in LabHub:
follow this layout so the `labhub-flow-ingest` skill can extract clean
events and link them to your tasks automatically.

## File location and name

```
<Project.localPath>/progress/<your-id>/progress_<YYYYMMDD>_<HHMM>.md
```

- `<your-id>` is your researcher folder (`dgu`, `ys`, `jane`, …).
- `<YYYYMMDD>_<HHMM>` is the local time you started writing the entry.
- One file = one event. If a single session covers multiple distinct things,
  consider splitting into two files.

Example: `/home/dgu/research/tick-agent/progress/dgu/progress_20260427_1400.md`.

## Recommended body structure

```markdown
---
date: 2026-04-27 14:00
researcher: dgu
---

# <한 줄 제목>

## Context
<왜 이걸 했나, 1-2 문단. 다른 진척과의 관계.>

## Done
- <짧은 사실 1>
- <짧은 사실 2>
- <짧은 사실 3>

## Numbers / Metrics
| metric | value |
|---|---|
| MELON ASR | 0.305 |
| sweep iterations | 105 |

## Next
- <후속 계획 / 다음 단계>
```

The skill's LLM accepts free-form markdown too — the structure is a strong
**recommendation** for extraction quality, not a parser requirement.

## What ends up where

| File section | Goes into FlowEvent field |
|---|---|
| `# 한 줄 제목` | `title` (≤30 chars, possibly trimmed) |
| `## Context` | `summary` (2-3 sentences synthesized) |
| `## Done` | `bullets[]` (one bullet per "fact") |
| `## Numbers` | `numbers[]` (`{label, value}` rows) |
| Implicit from content | `tone`, `tags`, `taskIds` |

## Tone (one per file)

The skill picks one tone capturing the "central change" reported:

- **milestone** — setup, new tooling, start of a major change
- **result** — a completed experiment with results
- **pivot** — direction change, hypothesis abandoned
- **design** — designing a new experiment / structure
- **incident** — debugging, outages, post-hoc fixes

If your progress mixes tones (e.g., "we got a result and then pivoted"),
pick the dominant one — usually the one that affects what happens next.

## Tasks (auto-mapped)

The skill compares your progress against the project's existing
`/projects/<slug>/flow` tasks. A task is linked if its title / goal /
subtasks are mentioned. Typically 1-3 tasks per progress.

If your progress doesn't move any existing task forward, that's fine — the
event still gets created with no links.

## Re-running and edits

- The skill identifies new files by filename. If you edit an already-ingested
  file and re-run the skill, by default the event won't be re-extracted (idempotent).
- To force re-extraction on a file: delete the matching `FlowEvent` row in
  the LabHub DB, then re-invoke the skill.

## Examples

### result
```
---
date: 2026-04-27 14:00
researcher: dgu
---

# trigger_fake × MELON 첫 sweep

## Context
attack 전체 set에 대해 benchmark의 첫 측정. baseline은 trigger_static.

## Done
- MELON 105개 instance에 대해 ASR 측정
- baseline (trigger_static) 대비 +18%p 개선
- 일부 instance는 leak 의심 — 다음 step에 분리

## Numbers
| metric | value |
|---|---|
| trigger_fake ASR | 0.305 |
| trigger_static ASR (baseline) | 0.124 |
| n | 105 |

## Next
- leak suspects 5개 manual inspection
- ablation: trigger length 짧게 → ASR 변화 측정
```

→ Extracted: `tone=result`, `title="trigger_fake × MELON 0.305"`,
`numbers=[{label:'trigger_fake ASR',value:'0.305'},…]`,
mapped to whichever task currently tracks "trigger_fake benchmark".

### pivot
```
# sysframe 폐기 → trigger_fake 설계

## Context
sysframe 접근으로 한 주 진행했지만 instruction sandwich가 너무 fragile.
authority framing 대신 trigger token 으로 전환 결정.

## Done
- sysframe 마지막 측정: ASR 0.087 (너무 낮음)
- trigger_fake 변형 3개 후보 설계
- 다음 주 우선순위: trigger_fake → MELON benchmark
```

→ Extracted: `tone=pivot`, `title="sysframe 폐기 → trigger_fake"`,
mapped to the task that tracked "attack 설계 결정".
```

- [ ] **Step 2: Commit**

```bash
git -C /home/dgu/research_dashboard add docs/progress-format.md
git -C /home/dgu/research_dashboard commit -m "docs: progress.md format guide for labhub-flow-ingest"
```

---

## Task 7: Final verification

**Files:** none.

- [ ] **Step 1: Static checks**

```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

All three clean.

- [ ] **Step 2: Full test suite**

```bash
pnpm exec playwright test tests/ --reporter=line --workers=1
```

Expected: 67 prior API tests + 11 new CLI tests = ~78 passing.

- [ ] **Step 3: Confirm marketplace structure**

```bash
ls /home/dgu/research_dashboard/skills/
```

Expected: `labhub`, `labhub-flow-ingest`.

```bash
python3 -c "import json; m=json.load(open('/home/dgu/research_dashboard/.claude-plugin/marketplace.json')); print('plugins:', [p['name'] for p in m['plugins']])"
```

Expected: `plugins: ['labhub', 'labhub-flow-ingest']`.

- [ ] **Step 4: Confirm git tree clean and ready to push**

```bash
git -C /home/dgu/research_dashboard status
git -C /home/dgu/research_dashboard log --oneline origin/main..HEAD
```

Expected: clean tree; ~7 new commits.

- [ ] **Step 5: Push (with explicit user approval)**

```bash
git -C /home/dgu/research_dashboard push
```

- [ ] **Step 6: Redeploy prod (with explicit user approval)**

```bash
PATH=/usr/bin:$PATH pnpm rebuild better-sqlite3   # rebuild for pm2's Node v20 if needed
pnpm build
pm2 restart labhub-app
```

(Both push and pm2 restart need explicit confirmation per Phase 2's deployment etiquette.)

---

## Self-Review

**1. Spec coverage:**
- Filename + location convention → adopted in Task 2 (`list-new-progress` glob) and Task 4 (skill recipes) ✓
- Body markdown recommendation → Task 6 (progress-format.md) ✓
- Extraction JSON schema → Task 3 (`apply` payload type) and Task 4 (skill body) ✓
- Tone taxonomy → Task 3 (`ALLOWED_TONES`) and Task 4 (skill body) ✓
- Task-mapping policy → Task 4 (skill body) ✓
- CLI sub-commands → Tasks 1, 2, 3 ✓
- SKILL.md procedure → Task 4 ✓
- Marketplace.json second plugin → Task 5 ✓
- Multi-event-per-source semantics (V1: 1:1, overwrite to replace) → Task 3 ✓
- Acceptance criteria → Task 7 ✓

No gaps.

**2. Placeholder scan:** searched for "TBD" / "TODO" / "fill in" / "as needed". No matches outside the spec's "Out-of-scope" callouts.

**3. Type / name consistency:**
- CLI sub-command names (`get-project`, `list-new-progress`, `apply`) — used identically in spec, plan, skill body, tests.
- `ApplyPayload` shape — defined in Task 3, referenced by skill body in Task 4 — fields match exactly.
- `ALLOWED_TONES` — `milestone | pivot | result | incident | design` — same five everywhere.
- `FlowEventTaskLink.source: 'manual' | 'llm'` — `'llm'` set in Task 3's CLI; spec mentions both values.
- Test fixture project `flow-ingest-test` — used consistently in Tasks 1, 2, 3.
