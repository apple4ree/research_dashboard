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
