import path from 'node:path';
import Database from 'better-sqlite3';

/**
 * Ensure the minimum row set exists for the Playwright suite.
 * Idempotent — safe to run on every test invocation.
 *
 * Why this is minimal: the prior dummy-data wipe deliberately cleared
 * the seed mockup. We only re-create what API tests strictly need
 * (Member.dgu + at least one Project), not the full seed fixture.
 *
 * Why raw better-sqlite3 instead of Prisma: Playwright loads globalSetup
 * via Node's CJS loader, but Prisma 7's generated client is ESM-only
 * (uses import.meta.url). Bypassing the ORM keeps this pre-test step
 * self-contained.
 */
async function globalSetup() {
  const dbPath = path.resolve(process.cwd(), 'prisma', 'dev.db');
  const db = new Database(dbPath);
  try {
    db.pragma('foreign_keys = ON');

    const dgu = db.prepare('SELECT 1 FROM Member WHERE login = ?').get('dgu');
    if (!dgu) {
      db.prepare(
        `INSERT INTO Member (login, displayName, role, githubLogin, pinnedProjectSlugs, source)
         VALUES (?, ?, ?, ?, ?, 'internal')`,
      ).run('dgu', 'dgu', 'PhD', 'dgu', '[]');
    }

    // Deterministic test member. The auth-flow spec relies on this row
    // existing with githubLogin='testbot' so the "existing-member matched
    // by githubLogin" path is reachable regardless of what prod data the
    // dev DB already holds. Member.dgu.githubLogin can vary (real OAuth
    // login on the dev/prod machine), so we don't reuse it for assertions.
    const testbot = db.prepare('SELECT 1 FROM Member WHERE login = ?').get('testbot');
    if (!testbot) {
      db.prepare(
        `INSERT INTO Member (login, displayName, role, githubLogin, pinnedProjectSlugs, source)
         VALUES (?, ?, ?, ?, ?, 'internal')`,
      ).run('testbot', 'Test Bot', 'PhD', 'testbot', '[]');
    }

    // Deterministic fixture project. Ensure regardless of whatever real
    // projects already live in the dev DB — tests assert against this slug
    // explicitly.
    const fixtureProject = db.prepare('SELECT 1 FROM Project WHERE slug = ?').get('phase1-test');
    if (!fixtureProject) {
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO Project (slug, name, description, tags, pinned, createdAt, updatedAt, source)
         VALUES (?, ?, ?, ?, 0, ?, ?, 'internal')`,
      ).run('phase1-test', 'Phase 1 Test Project', 'Minimal fixture for Playwright API tests.', '[]', now, now);
      db.prepare(
        `INSERT OR IGNORE INTO ProjectMember (projectSlug, memberLogin) VALUES (?, ?)`,
      ).run('phase1-test', 'dgu');
    }

    // Wiki type fixtures for wiki-entities API tests. Two types let us check
    // both type validation (against valid keys) and ordering by position.
    const insertType = db.prepare(
      `INSERT OR IGNORE INTO WikiType (projectSlug, key, label, position, description)
       VALUES (?, ?, ?, ?, ?)`,
    );
    insertType.run('phase1-test', 'attack', 'Attacks', 0, 'Adversarial attack variants');
    insertType.run('phase1-test', 'concept', 'Concepts', 1, 'Definitions and ideas');
  } finally {
    db.close();
  }
}

export default globalSetup;
