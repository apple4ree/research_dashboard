import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import Database from 'better-sqlite3';

const DB_PATH = path.resolve(process.cwd(), 'prisma/dev.db');
const CLI = `pnpm tsx ${path.resolve(process.cwd(), 'scripts/flow-ingest-cli.ts')}`;

function runCli(
  argv: string,
  opts: { stdin?: string; expectFail?: boolean } = {},
): { stdout: string; stderr: string; code: number } {
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
  db.prepare(
    `INSERT OR IGNORE INTO Project (slug, name, description, tags, pinned, createdAt, updatedAt, source, githubRepo, localPath)
     VALUES (?, ?, ?, '[]', 0, ?, ?, 'internal', ?, ?)`,
  ).run(FIXTURE_SLUG, 'Flow Ingest Test', 'fixture project for CLI tests', now, now, 'apple4ree/test', localPath);
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
  db.prepare(
    `INSERT OR IGNORE INTO Project (slug, name, description, tags, pinned, createdAt, updatedAt, source, githubRepo)
     VALUES (?, ?, ?, '[]', 0, ?, ?, 'internal', ?)`,
  ).run(slug, 'No Local Path', '', now, now, 'apple4ree/test');
  db.prepare(`UPDATE Project SET localPath=NULL WHERE slug=?`).run(slug);
  db.close();

  const { code, stderr } = runCli(`get-project --slug ${slug}`, { expectFail: true });
  expect(code).not.toBe(0);
  expect(stderr).toMatch(/localPath/);
});

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
  const sourceName = `progress_${Date.now()}_2000.md`;
  await fs.writeFile(path.join(subDir, sourceName), '# test', 'utf8');

  const db = new Database(DB_PATH);
  db.prepare(`INSERT INTO FlowEvent (projectSlug, date, source, title, summary, tone, position)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(FIXTURE_SLUG, '2026-04-27 20:00', sourceName, 'pre-existing', 'fixture', 'milestone', 0);
  db.close();

  const { stdout } = runCli(`list-new-progress --slug ${FIXTURE_SLUG}`);
  const result = JSON.parse(stdout);

  const f = result.files.find((x: { source: string }) => x.source === sourceName);
  expect(f).toBeTruthy();
  expect(f.ingested).toBe(true);

  const cleanup = new Database(DB_PATH);
  cleanup.prepare(`DELETE FROM FlowEvent WHERE projectSlug=? AND source=?`)
    .run(FIXTURE_SLUG, sourceName);
  cleanup.close();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

test('list-new-progress: --force marks all files as not-ingested', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-ingest-test-'));
  ensureFixtureProject(tmpDir);

  const subDir = path.join(tmpDir, 'progress', 'dgu');
  await fs.mkdir(subDir, { recursive: true });
  const sourceName = `progress_${Date.now()}_2100.md`;
  await fs.writeFile(path.join(subDir, sourceName), '# test', 'utf8');

  const db = new Database(DB_PATH);
  db.prepare(`INSERT INTO FlowEvent (projectSlug, date, source, title, summary, tone, position)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(FIXTURE_SLUG, '2026-04-27 21:00', sourceName, 'force-test', 'fixture', 'milestone', 0);
  db.close();

  const { stdout } = runCli(`list-new-progress --slug ${FIXTURE_SLUG} --force`);
  const result = JSON.parse(stdout);
  const f = result.files.find((x: { source: string }) => x.source === sourceName);
  expect(f).toBeTruthy();
  expect(f.ingested).toBe(false);

  const cleanup = new Database(DB_PATH);
  cleanup.prepare(`DELETE FROM FlowEvent WHERE projectSlug=? AND source=?`)
    .run(FIXTURE_SLUG, sourceName);
  cleanup.close();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

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

test('apply: overwrite=true replaces same-source events', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'flow-ingest-test-'));
  ensureFixtureProject(tmpDir);
  const source = `progress_over_${Date.now()}.md`;

  runCli('apply', { stdin: makeApplyPayload({ source }) });
  const { stdout } = runCli('apply', { stdin: makeApplyPayload({ source, overwrite: true }) });
  const result = JSON.parse(stdout);
  expect(result.ok).toBe(true);
  expect(result.mode).toBe('updated');

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

  const db = new Database(DB_PATH);
  const taskRow = db
    .prepare(`INSERT INTO TodoItem (projectSlug, bucket, text, status, position) VALUES (?, ?, ?, ?, ?)`)
    .run(FIXTURE_SLUG, 'short', 'fixture task for link', 'in_progress', 99);
  const realId = Number(taskRow.lastInsertRowid);
  db.close();

  const { stdout } = runCli('apply', { stdin: makeApplyPayload({ source, taskIds: [realId] }) });
  const result = JSON.parse(stdout);
  expect(result.ok).toBe(true);
  expect(result.taskLinks).toBe(1);

  const { code, stderr } = runCli('apply', {
    stdin: makeApplyPayload({ source: `${source}-2`, taskIds: [999999] }),
    expectFail: true,
  });
  expect(code).not.toBe(0);
  expect(stderr).toMatch(/not found/);

  const cleanup = new Database(DB_PATH);
  cleanup.prepare(`DELETE FROM TodoItem WHERE id=?`).run(realId);
  cleanup.close();
  cleanupEventsForSource(source);
  await fs.rm(tmpDir, { recursive: true, force: true });
});
