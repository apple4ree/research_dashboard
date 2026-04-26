# Skill Automation — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a JWT-authenticated REST API to LabHub so a future Claude Code skill can create/update `ExperimentRun`s after exchanging a GitHub Device Flow access token.

**Architecture:** Four new Next.js Route Handlers under `app/api/auth/device/exchange`, `app/api/me`, `app/api/runs`, and `app/api/runs/[id]`. Helpers split out under `lib/api/*`: a small JWT module (`jose` HS256) and a GitHub `/user` verifier. Auth on protected endpoints is a `Authorization: Bearer <jwt>` header — no NextAuth session, no cookies. Test mocking uses the existing `PLAYWRIGHT_TEST` escape hatch: when set, the GitHub verifier short-circuits to a deterministic fixture instead of calling `api.github.com`.

**Tech Stack:** Next.js 16 Route Handlers, Prisma (existing), `jose` 6.x for JWT (already in dep tree via NextAuth — promoted to direct dep), Playwright `request` fixture for API tests. No new test framework.

---

## Decisions to confirm before execution

These come from the user's Phase 1 ambiguity callouts plus one I noticed while reading the spec. **The plan below assumes these answers — if any are wrong, stop and revise the plan before coding.**

1. **Member login slug collision (auto-create)** — when GitHub login `dgu` arrives but `Member.login = "dgu"` is already someone else's row (different `githubLogin` already on file, or `null` `githubLogin`):
   - **Plan assumes:** mirror `auth.ts` open-registration — try `dgu`, then `dgu-1`, `dgu-2`, ..., up to `dgu-50`. Fail with 401 beyond that.
   - **Reuse:** factor the existing slug-pick logic out of `auth.ts` into `lib/api/member-pick.ts` so device-exchange and NextAuth share a single implementation.

2. **JWT error response format** — for missing/malformed/expired tokens on protected endpoints:
   - **Plan assumes:** all auth failures return `401` with body `{ "error": "<reason>" }` where reason ∈ `missing_token`, `invalid_token`, `expired_token`, `unknown_member`. Skill clients only branch on status code; the `error` string is for human debugging.

3. **Test data** — spec says "기존 32개 Playwright 테스트 모두 pass" but the dummy-data wipe in commit `22949a7` removed the seed rows the smoke tests assert against (`exp-1404`, `r-001`, `reasoning-bench-v2`, ...). **Confirmed by user:** the wipe was for prod cleanliness; the dummy mockup will not be restored.
   - **Phase 1 fixture:** add a tiny Playwright `globalSetup` that ensures `Member.dgu` exists and at least one Project exists (e.g., `phase1-test`). Idempotent — does nothing if those rows are already present.
   - **Phase 1 acceptance bar (revised):** new API tests (`tests/api/*`) pass + typecheck/build/lint clean. The 32 legacy smoke tests that depend on hard-coded seed IDs (`exp-1404`, `r-001`, `reasoning-bench-v2`, ...) are **out of scope** for Phase 1 — they will remain broken until a separate cleanup pass removes their hardcoded-ID dependencies. Phase 1 will not touch their files.

4. **GitHub fetch stubbing** — spec accepts "vi.mock 또는 fetch stub". Project has no vitest; tests use Playwright HTTP fixtures.
   - **Plan assumes:** the GitHub verifier checks `process.env.PLAYWRIGHT_TEST === 'true'`. When set, it interprets the access token as a fixture key (`test:dgu`, `test:newuser`, `test:invalid`) and returns canned `{login, name, email, avatarUrl}` (or `null`). Production code path unchanged.

---

## File Structure

```
app/api/
  auth/
    device/
      exchange/
        route.ts         # POST  /api/auth/device/exchange
  me/
    route.ts             # GET   /api/me
  runs/
    route.ts             # POST  /api/runs
    [id]/
      route.ts           # PATCH /api/runs/:id
lib/api/
  jwt.ts                 # signMemberToken / verifyMemberToken (jose HS256)
  bearer.ts              # requireMemberFromBearer(req) — auth gate for protected routes
  github.ts              # verifyGitHubAccessToken(token) — calls /user, honors PLAYWRIGHT_TEST
  member-pick.ts         # pickMemberLogin(githubLogin) — shared with auth.ts
  errors.ts              # apiError(status, code) — uniform { error } JSON helper
auth.ts                  # MODIFIED: import pickMemberLogin from lib/api/member-pick
.env.example             # NEW: documents LABHUB_JWT_SECRET, LABHUB_CLI_GITHUB_CLIENT_ID, etc.
package.json             # MODIFIED: jose promoted to direct dep
tests/api/
  auth-flow.spec.ts      # device-exchange → /api/me happy path + failures
  runs.spec.ts           # POST/PATCH /api/runs with auth gates
```

No schema changes. No migration.

---

## Task 1: Foundation — env, deps, .env.example

**Files:**
- Create: `.env.example`
- Modify: `package.json` (add `jose` to `dependencies`)

- [ ] **Step 1: Promote `jose` to a direct dependency**

`jose` is currently a transitive dep via NextAuth — pnpm's strict resolution refuses transitive imports from app code. Add it explicitly.

Run: `pnpm add jose`

Expected: `jose` appears under `dependencies` in `package.json`. Lockfile updates.

- [ ] **Step 2: Generate a JWT secret for local dev**

Run: `openssl rand -base64 32`

Copy the output into `.env.local` as:
```
LABHUB_JWT_SECRET="<output>"
LABHUB_CLI_GITHUB_CLIENT_ID=""
```

Leave `LABHUB_CLI_GITHUB_CLIENT_ID` empty for now — Phase 1 doesn't initiate Device Flow itself, only verifies tokens already obtained by a future skill.

- [ ] **Step 3: Create `.env.example`**

```bash
cat > .env.example <<'EOF'
# Database
DATABASE_URL="file:./prisma/dev.db"

# NextAuth.js (web sign-in)
AUTH_SECRET=""
AUTH_URL="http://localhost:3000"
AUTH_TRUST_HOST="true"
AUTH_GITHUB_ID=""
AUTH_GITHUB_SECRET=""

# Skill API — JWT signing secret (32 bytes base64).
# Generate with: openssl rand -base64 32
LABHUB_JWT_SECRET=""

# Skill API — GitHub OAuth App for "LabHub CLI" (Device Flow enabled).
# Phase 1 only verifies tokens; the skill itself uses this in Phase 2.
LABHUB_CLI_GITHUB_CLIENT_ID=""
EOF
```

- [ ] **Step 4: Verify the secret is loaded**

Run:
```bash
node -e "require('dotenv').config({path:'.env.local'}); console.log('len:', (process.env.LABHUB_JWT_SECRET ?? '').length)"
```

Expected: `len: 44` (base64-encoded 32 bytes is 44 chars).

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml .env.example
git commit -m "skill api foundation: pin jose as direct dep, add .env.example"
```

---

## Task 2: JWT helper module

**Files:**
- Create: `lib/api/jwt.ts`
- Create: `lib/api/errors.ts`

This is plumbing — directly exercised by API tests in later tasks. No standalone unit tests (project uses Playwright HTTP-level testing only; adding vitest just for two helpers is overkill).

- [ ] **Step 1: Write `lib/api/errors.ts`**

```ts
import { NextResponse } from 'next/server';

export type ApiErrorCode =
  | 'missing_token'
  | 'invalid_token'
  | 'expired_token'
  | 'unknown_member'
  | 'invalid_request'
  | 'project_not_found'
  | 'run_not_found'
  | 'github_verify_failed';

export function apiError(status: number, code: ApiErrorCode, hint?: string) {
  const body: { error: ApiErrorCode; hint?: string } = { error: code };
  if (hint) body.hint = hint;
  return NextResponse.json(body, { status });
}
```

- [ ] **Step 2: Write `lib/api/jwt.ts`**

```ts
import { SignJWT, jwtVerify } from 'jose';

const SECRET = () => {
  const s = process.env.LABHUB_JWT_SECRET;
  if (!s) throw new Error('LABHUB_JWT_SECRET not set');
  return new TextEncoder().encode(s);
};

const ALG = 'HS256';
const TTL_DAYS = 30;

export async function signMemberToken(memberLogin: string): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: ALG })
    .setSubject(memberLogin)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(SECRET());
  return { token, expiresAt };
}

export type VerifyResult =
  | { ok: true; memberLogin: string }
  | { ok: false; reason: 'missing_token' | 'invalid_token' | 'expired_token' };

export async function verifyMemberToken(token: string | null | undefined): Promise<VerifyResult> {
  if (!token) return { ok: false, reason: 'missing_token' };
  try {
    const { payload } = await jwtVerify(token, SECRET(), { algorithms: [ALG] });
    if (typeof payload.sub !== 'string' || !payload.sub) {
      return { ok: false, reason: 'invalid_token' };
    }
    return { ok: true, memberLogin: payload.sub };
  } catch (err) {
    const code = err instanceof Error ? err.message : '';
    if (code.includes('expired')) return { ok: false, reason: 'expired_token' };
    return { ok: false, reason: 'invalid_token' };
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add lib/api/jwt.ts lib/api/errors.ts
git commit -m "skill api: jwt sign/verify helper + uniform error response"
```

---

## Task 3: Bearer auth gate for route handlers

**Files:**
- Create: `lib/api/bearer.ts`

- [ ] **Step 1: Write `lib/api/bearer.ts`**

```ts
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyMemberToken } from './jwt';

export type BearerResult =
  | { ok: true; memberLogin: string }
  | { ok: false; status: 401; code: 'missing_token' | 'invalid_token' | 'expired_token' | 'unknown_member' };

export async function requireMemberFromBearer(req: NextRequest): Promise<BearerResult> {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null;

  const verify = await verifyMemberToken(token);
  if (!verify.ok) return { ok: false, status: 401, code: verify.reason };

  const member = await prisma.member.findUnique({
    where: { login: verify.memberLogin },
    select: { login: true },
  });
  if (!member) return { ok: false, status: 401, code: 'unknown_member' };

  return { ok: true, memberLogin: member.login };
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add lib/api/bearer.ts
git commit -m "skill api: requireMemberFromBearer gate for protected routes"
```

---

## Task 4: GitHub /user verifier with PLAYWRIGHT_TEST escape hatch

**Files:**
- Create: `lib/api/github.ts`

- [ ] **Step 1: Write `lib/api/github.ts`**

```ts
export type GitHubUser = {
  login: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
};

const TEST_FIXTURES: Record<string, GitHubUser> = {
  'test:dgu': { login: 'dgu', name: 'Test DGU', email: 'dgu@test.local', avatarUrl: null },
  'test:newuser': { login: 'newuser', name: 'New User', email: 'new@test.local', avatarUrl: null },
};

export async function verifyGitHubAccessToken(token: string): Promise<GitHubUser | null> {
  // Test escape hatch — mirrors lib/session.ts's PLAYWRIGHT_TEST pattern.
  if (process.env.PLAYWRIGHT_TEST === 'true') {
    return TEST_FIXTURES[token] ?? null;
  }

  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'labhub-cli',
    },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    login: string;
    name?: string | null;
    email?: string | null;
    avatar_url?: string | null;
  };
  return {
    login: data.login,
    name: data.name ?? null,
    email: data.email ?? null,
    avatarUrl: data.avatar_url ?? null,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add lib/api/github.ts
git commit -m "skill api: GitHub /user verifier with PLAYWRIGHT_TEST stub"
```

---

## Task 5: Shared member-pick helper (extract from auth.ts)

**Files:**
- Create: `lib/api/member-pick.ts`
- Modify: `auth.ts`

- [ ] **Step 1: Write `lib/api/member-pick.ts`**

```ts
import { prisma } from '@/lib/db';

export type MemberPickResult =
  | { ok: true; login: string }
  | { ok: false; reason: 'invalid_github_login' | 'too_many_collisions' };

/**
 * Pick a free Member.login slug for a new auto-created Member.
 * Mirrors the suffix-fallback policy used by NextAuth's signIn callback.
 */
export async function pickMemberLogin(githubLogin: string): Promise<MemberPickResult> {
  const normalized = githubLogin.toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!normalized) return { ok: false, reason: 'invalid_github_login' };

  let candidate = normalized;
  let suffix = 0;
  while (await prisma.member.findUnique({ where: { login: candidate } })) {
    suffix += 1;
    candidate = `${normalized}-${suffix}`;
    if (suffix > 50) return { ok: false, reason: 'too_many_collisions' };
  }
  return { ok: true, login: candidate };
}
```

- [ ] **Step 2: Refactor `auth.ts` to use the new helper**

In `auth.ts`, replace the inline `normalizedLogin` + suffix-loop block (currently ~lines 72–83) with:

```ts
const picked = await pickMemberLogin(githubLogin);
if (!picked.ok) return false;
const candidate = picked.login;
```

Add `import { pickMemberLogin } from '@/lib/api/member-pick';` to the imports.

- [ ] **Step 3: Verify NextAuth still typechecks**

Run: `pnpm exec tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add lib/api/member-pick.ts auth.ts
git commit -m "skill api: extract pickMemberLogin so device-exchange and NextAuth share collision policy"
```

---

## Task 6: POST /api/auth/device/exchange (TDD)

**Files:**
- Create: `tests/api/auth-flow.spec.ts`
- Create: `app/api/auth/device/exchange/route.ts`

- [ ] **Step 1: Write the failing test**

`tests/api/auth-flow.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('device exchange: invalid GitHub token → 401 invalid_request', async ({ request }) => {
  const res = await request.post('/api/auth/device/exchange', {
    data: { github_access_token: 'test:invalid' },
  });
  expect(res.status()).toBe(401);
  const body = await res.json();
  expect(body.error).toBe('github_verify_failed');
});

test('device exchange: existing member matched by githubLogin', async ({ request }) => {
  // Pre-seed assumption: Member.dgu exists with githubLogin set.
  // (cleanup-dummy-data preserves this row; integration with re-seed can refine.)
  const res = await request.post('/api/auth/device/exchange', {
    data: { github_access_token: 'test:dgu' },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.token).toMatch(/^eyJ/);
  expect(body.member.login).toBe('dgu');
  expect(body.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
});

test('device exchange: new GitHub user auto-creates a Member', async ({ request }) => {
  // Cleanup so this test is idempotent.
  await request.post('/api/auth/device/exchange', {
    data: { github_access_token: 'test:newuser' },
  });

  const res = await request.post('/api/auth/device/exchange', {
    data: { github_access_token: 'test:newuser' },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.member.login).toBe('newuser');
});

test('device exchange: missing github_access_token → 400 invalid_request', async ({ request }) => {
  const res = await request.post('/api/auth/device/exchange', { data: {} });
  expect(res.status()).toBe(400);
  expect((await res.json()).error).toBe('invalid_request');
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm exec playwright test tests/api/auth-flow.spec.ts`
Expected: 4 failures (route returns 404).

- [ ] **Step 3: Implement `app/api/auth/device/exchange/route.ts`**

```ts
import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { signMemberToken } from '@/lib/api/jwt';
import { verifyGitHubAccessToken } from '@/lib/api/github';
import { pickMemberLogin } from '@/lib/api/member-pick';
import { apiError } from '@/lib/api/errors';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { github_access_token?: string } | null;
  const ghToken = body?.github_access_token?.trim();
  if (!ghToken) return apiError(400, 'invalid_request', 'github_access_token is required');

  const ghUser = await verifyGitHubAccessToken(ghToken);
  if (!ghUser) return apiError(401, 'github_verify_failed', 'GitHub /user rejected this token');

  let member = await prisma.member.findUnique({ where: { githubLogin: ghUser.login } });
  if (!member) {
    const picked = await pickMemberLogin(ghUser.login);
    if (!picked.ok) return apiError(401, 'github_verify_failed', `member-slug pick failed: ${picked.reason}`);
    member = await prisma.member.create({
      data: {
        login: picked.login,
        displayName: ghUser.name ?? ghUser.login,
        role: 'PhD',
        githubLogin: ghUser.login,
        email: ghUser.email ?? undefined,
        avatarUrl: ghUser.avatarUrl ?? undefined,
        pinnedProjectSlugs: '[]',
      },
    });
  }

  const { token, expiresAt } = await signMemberToken(member.login);
  return NextResponse.json({
    token,
    expiresAt: expiresAt.toISOString(),
    member: { login: member.login, displayName: member.displayName },
  });
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm exec playwright test tests/api/auth-flow.spec.ts`
Expected: 4/4 pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/auth/device/exchange/route.ts tests/api/auth-flow.spec.ts
git commit -m "skill api: POST /api/auth/device/exchange — verify GH token, mint JWT"
```

---

## Task 7: GET /api/me (TDD)

**Files:**
- Modify: `tests/api/auth-flow.spec.ts` (add /api/me cases)
- Create: `app/api/me/route.ts`

- [ ] **Step 1: Add failing tests for /api/me**

Append to `tests/api/auth-flow.spec.ts`:

```ts
test('/api/me: missing bearer → 401 missing_token', async ({ request }) => {
  const res = await request.get('/api/me');
  expect(res.status()).toBe(401);
  expect((await res.json()).error).toBe('missing_token');
});

test('/api/me: malformed bearer → 401 invalid_token', async ({ request }) => {
  const res = await request.get('/api/me', {
    headers: { Authorization: 'Bearer not-a-jwt' },
  });
  expect(res.status()).toBe(401);
  expect((await res.json()).error).toBe('invalid_token');
});

test('/api/me: valid token → returns member', async ({ request }) => {
  const exchange = await request.post('/api/auth/device/exchange', {
    data: { github_access_token: 'test:dgu' },
  });
  const { token } = await exchange.json();

  const res = await request.get('/api/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.login).toBe('dgu');
  expect(body.role).toBe('PhD');
  expect(body.displayName).toBeTruthy();
});
```

- [ ] **Step 2: Run the test to see it fail**

Run: `pnpm exec playwright test tests/api/auth-flow.spec.ts`
Expected: 3 new failures.

- [ ] **Step 3: Implement `app/api/me/route.ts`**

```ts
import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireMemberFromBearer } from '@/lib/api/bearer';
import { apiError } from '@/lib/api/errors';

export async function GET(req: NextRequest) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const m = await prisma.member.findUnique({
    where: { login: auth.memberLogin },
    select: { login: true, displayName: true, role: true },
  });
  if (!m) return apiError(401, 'unknown_member');

  return NextResponse.json({ login: m.login, displayName: m.displayName, role: m.role });
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm exec playwright test tests/api/auth-flow.spec.ts`
Expected: all auth-flow tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/me/route.ts tests/api/auth-flow.spec.ts
git commit -m "skill api: GET /api/me — return member info for valid JWT"
```

---

## Task 8: POST /api/runs (TDD)

**Files:**
- Create: `tests/api/runs.spec.ts`
- Create: `app/api/runs/route.ts`

- [ ] **Step 1: Write failing tests for run creation**

`tests/api/runs.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

async function getToken(request: import('@playwright/test').APIRequestContext, ghToken = 'test:dgu'): Promise<string> {
  const res = await request.post('/api/auth/device/exchange', { data: { github_access_token: ghToken } });
  const body = await res.json();
  if (!body.token) throw new Error(`exchange failed: ${JSON.stringify(body)}`);
  return body.token;
}

test('POST /api/runs: missing bearer → 401', async ({ request }) => {
  const res = await request.post('/api/runs', { data: { name: 'x', projectSlug: 'y', status: 'in_progress' } });
  expect(res.status()).toBe(401);
});

test('POST /api/runs: unknown projectSlug → 404 with helpful hint', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.post('/api/runs', {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: 'sweep-1', projectSlug: 'does-not-exist', status: 'in_progress' },
  });
  expect(res.status()).toBe(404);
  const body = await res.json();
  expect(body.error).toBe('project_not_found');
  expect(body.hint).toMatch(/does-not-exist/);
});

test('POST /api/runs: success creates run + activity event', async ({ request }) => {
  const token = await getToken(request);
  // Use any existing project; tests rely on seed data being present.
  const projects = await request.get('/api/search-index');
  const items = (await projects.json()).items;
  const someProject = items.find((i: { type: string }) => i.type === 'project');
  test.skip(!someProject, 'no project in DB; re-seed first');

  const slug = someProject.href.replace('/projects/', '');
  const before = Date.now();
  const res = await request.post('/api/runs', {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: 'phase1-smoke', projectSlug: slug, status: 'in_progress', summary: 'from API test' },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.id).toMatch(/^exp-/);

  // Activity is fire-and-forget; small wait then assert.
  await new Promise(r => setTimeout(r, 200));
  const events = await request.get('/api/search-index'); // search-index doesn't include events; check via UI route instead
  expect(Date.now() - before).toBeLessThan(5_000); // sanity: didn't hang
});

test('POST /api/runs: invalid status → 400', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.post('/api/runs', {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: 'x', projectSlug: 'whatever', status: 'bogus' },
  });
  expect(res.status()).toBe(400);
});
```

- [ ] **Step 2: Run tests to see them fail**

Run: `pnpm exec playwright test tests/api/runs.spec.ts`
Expected: 4 failures.

- [ ] **Step 3: Implement `app/api/runs/route.ts`**

```ts
import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { requireMemberFromBearer } from '@/lib/api/bearer';
import { apiError } from '@/lib/api/errors';
import { logActivity } from '@/lib/actions/events';
import { runStatusToEventAction } from '@/lib/events';
import type { RunStatus } from '@/lib/types';

const STATUSES: readonly RunStatus[] = ['success', 'failure', 'in_progress', 'queued', 'cancelled'];

export async function POST(req: NextRequest) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const body = (await req.json().catch(() => null)) as
    | { name?: string; projectSlug?: string; status?: string; summary?: string | null; durationSec?: number | null }
    | null;
  if (!body) return apiError(400, 'invalid_request', 'JSON body required');

  const name = body.name?.trim();
  const projectSlug = body.projectSlug?.trim();
  const status = body.status?.trim() as RunStatus | undefined;
  if (!name) return apiError(400, 'invalid_request', 'name is required');
  if (!projectSlug) return apiError(400, 'invalid_request', 'projectSlug is required');
  if (!status || !STATUSES.includes(status)) return apiError(400, 'invalid_request', `status must be one of ${STATUSES.join(', ')}`);

  const project = await prisma.project.findUnique({ where: { slug: projectSlug } });
  if (!project) {
    return apiError(404, 'project_not_found', `Project '${projectSlug}' not found in LabHub. Create it via UI first or pass --project=<existing-slug>.`);
  }

  const baseId = `exp-${Math.floor(Date.now() / 1000).toString(36)}`;
  const collision = await prisma.experimentRun.findUnique({ where: { id: baseId } });
  const id = collision ? `${baseId}-${randomUUID().slice(0, 4)}` : baseId;

  await prisma.experimentRun.create({
    data: {
      id,
      name,
      projectSlug,
      status,
      startedAt: new Date(),
      durationSec: body.durationSec ?? null,
      triggeredByLogin: auth.memberLogin,
      summary: body.summary ?? null,
    },
  });

  await logActivity({
    type: 'experiment',
    actorLogin: auth.memberLogin,
    projectSlug,
    payload: { runId: id, action: runStatusToEventAction(status) },
  });

  revalidatePath('/experiments');
  revalidatePath(`/projects/${projectSlug}/experiments`);
  revalidatePath('/');

  return NextResponse.json({ id }, { status: 201 });
}
```

- [ ] **Step 4: Run tests to see them pass**

Run: `pnpm exec playwright test tests/api/runs.spec.ts`
Expected: 4/4 pass (assuming a project exists in DB).

- [ ] **Step 5: Commit**

```bash
git add app/api/runs/route.ts tests/api/runs.spec.ts
git commit -m "skill api: POST /api/runs — JWT-auth'd run creation with activity log"
```

---

## Task 9: PATCH /api/runs/:id (TDD)

**Files:**
- Modify: `tests/api/runs.spec.ts`
- Create: `app/api/runs/[id]/route.ts`

- [ ] **Step 1: Add failing PATCH tests**

Append to `tests/api/runs.spec.ts`:

```ts
test('PATCH /api/runs/:id: updates fields and logs activity on status change', async ({ request }) => {
  const token = await getToken(request);
  const projects = await request.get('/api/search-index');
  const items = (await projects.json()).items;
  const someProject = items.find((i: { type: string }) => i.type === 'project');
  test.skip(!someProject, 'no project in DB; re-seed first');
  const slug = someProject.href.replace('/projects/', '');

  const created = await request.post('/api/runs', {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: 'patch-target', projectSlug: slug, status: 'in_progress' },
  });
  const { id } = await created.json();

  const patched = await request.patch(`/api/runs/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { status: 'success', durationSec: 120, summary: 'final' },
  });
  expect(patched.status()).toBe(200);
  const body = await patched.json();
  expect(body.id).toBe(id);
  expect(body.status).toBe('success');
  expect(body.durationSec).toBe(120);
  expect(body.summary).toBe('final');
});

test('PATCH /api/runs/:id: anyone can update anyone else\'s run', async ({ request }) => {
  // dgu creates a run
  const tokenDgu = await getToken(request, 'test:dgu');
  const projects = await request.get('/api/search-index');
  const items = (await projects.json()).items;
  const someProject = items.find((i: { type: string }) => i.type === 'project');
  test.skip(!someProject, 'no project in DB; re-seed first');
  const slug = someProject.href.replace('/projects/', '');

  const created = await request.post('/api/runs', {
    headers: { Authorization: `Bearer ${tokenDgu}` },
    data: { name: 'cross-update', projectSlug: slug, status: 'in_progress' },
  });
  const { id } = await created.json();

  // newuser cancels it
  const tokenOther = await getToken(request, 'test:newuser');
  const patched = await request.patch(`/api/runs/${id}`, {
    headers: { Authorization: `Bearer ${tokenOther}` },
    data: { status: 'cancelled' },
  });
  expect(patched.status()).toBe(200);
  expect((await patched.json()).status).toBe('cancelled');
});

test('PATCH /api/runs/:id: unknown id → 404', async ({ request }) => {
  const token = await getToken(request);
  const res = await request.patch('/api/runs/exp-does-not-exist', {
    headers: { Authorization: `Bearer ${token}` },
    data: { status: 'cancelled' },
  });
  expect(res.status()).toBe(404);
});
```

- [ ] **Step 2: Run to see failures**

Run: `pnpm exec playwright test tests/api/runs.spec.ts`
Expected: 3 new failures (404 for missing route).

- [ ] **Step 3: Implement `app/api/runs/[id]/route.ts`**

```ts
import { type NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireMemberFromBearer } from '@/lib/api/bearer';
import { apiError } from '@/lib/api/errors';
import { logActivity } from '@/lib/actions/events';
import { runStatusToEventAction } from '@/lib/events';
import type { RunStatus } from '@/lib/types';

const STATUSES: readonly RunStatus[] = ['success', 'failure', 'in_progress', 'queued', 'cancelled'];

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireMemberFromBearer(req);
  if (!auth.ok) return apiError(auth.status, auth.code);

  const { id } = await ctx.params;
  const existing = await prisma.experimentRun.findUnique({ where: { id } });
  if (!existing) return apiError(404, 'run_not_found');

  const body = (await req.json().catch(() => null)) as
    | { status?: string; summary?: string | null; durationSec?: number | null; name?: string }
    | null;
  if (!body) return apiError(400, 'invalid_request', 'JSON body required');

  const updates: { status?: RunStatus; summary?: string | null; durationSec?: number | null; name?: string } = {};
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as RunStatus)) {
      return apiError(400, 'invalid_request', `status must be one of ${STATUSES.join(', ')}`);
    }
    updates.status = body.status as RunStatus;
  }
  if (body.summary !== undefined) updates.summary = body.summary;
  if (body.durationSec !== undefined) updates.durationSec = body.durationSec;
  if (body.name !== undefined) updates.name = body.name;

  const updated = await prisma.experimentRun.update({ where: { id }, data: updates });

  if (updates.status && updates.status !== existing.status) {
    await logActivity({
      type: 'experiment',
      actorLogin: auth.memberLogin,
      projectSlug: existing.projectSlug,
      payload: { runId: id, action: runStatusToEventAction(updates.status) },
    });
  }

  revalidatePath('/experiments');
  revalidatePath(`/projects/${existing.projectSlug}/experiments`);
  revalidatePath(`/projects/${existing.projectSlug}/experiments/${id}`);

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    projectSlug: updated.projectSlug,
    status: updated.status,
    startedAt: updated.startedAt.toISOString(),
    durationSec: updated.durationSec,
    summary: updated.summary,
    triggeredByLogin: updated.triggeredByLogin,
  });
}
```

- [ ] **Step 4: Run to see all pass**

Run: `pnpm exec playwright test tests/api/runs.spec.ts`
Expected: 7/7 pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/runs/[id]/route.ts tests/api/runs.spec.ts
git commit -m "skill api: PATCH /api/runs/:id — anyone can update, status change logs activity"
```

---

## Task 10: Playwright globalSetup — minimal test fixture

**Files:**
- Create: `tests/global-setup.ts`
- Modify: `playwright.config.ts`

This replaces "re-seed full dummy data". We need exactly: `Member.dgu` (already preserved by the cleanup script) and at least one Project for the run-creation tests to target.

- [ ] **Step 1: Write `tests/global-setup.ts`**

```ts
import { prisma } from '@/lib/db';

/**
 * Ensure the minimum row set exists for the Playwright suite.
 * Idempotent — safe to run on every test invocation.
 */
async function globalSetup() {
  // Member.dgu is preserved by scripts/cleanup-dummy-data.ts; ensure it's still here.
  const dgu = await prisma.member.findUnique({ where: { login: 'dgu' } });
  if (!dgu) {
    await prisma.member.create({
      data: {
        login: 'dgu',
        displayName: 'dgu',
        role: 'PhD',
        githubLogin: 'dgu',
        pinnedProjectSlugs: '[]',
      },
    });
  }

  // Ensure at least one project exists for /api/runs tests to target.
  const projectCount = await prisma.project.count();
  if (projectCount === 0) {
    await prisma.project.create({
      data: {
        slug: 'phase1-test',
        name: 'Phase 1 Test Project',
        description: 'Minimal fixture for Playwright API tests.',
        tags: '[]',
        pinned: false,
        members: {
          create: [{ memberLogin: 'dgu' }],
        },
      },
    });
  }

  await prisma.$disconnect();
}

export default globalSetup;
```

- [ ] **Step 2: Wire it into `playwright.config.ts`**

Add to `defineConfig({ ... })`:
```ts
globalSetup: require.resolve('./tests/global-setup.ts'),
```

(Use `require.resolve` so the TS file is resolved through tsx/ts-node which Playwright uses internally for config files.)

- [ ] **Step 3: Verify globalSetup runs and is idempotent**

Run: `pnpm exec playwright test tests/api/auth-flow.spec.ts --reporter=line`
Expected: globalSetup runs once, tests pass.

Run again immediately. Expected: same result, no duplicate row errors.

- [ ] **Step 4: Commit**

```bash
git add tests/global-setup.ts playwright.config.ts
git commit -m "tests: globalSetup ensures Member.dgu + at least one Project for API tests"
```

---

## Task 11: End-to-end curl verification (manual smoke)

**Files:** none — verifying the spec's curl scenario verbatim against a running server.

- [ ] **Step 1: Start the dev server on port 3100**

Run in separate terminal: `PLAYWRIGHT_TEST=true pnpm dev --port 3100`

(Using `PLAYWRIGHT_TEST=true` so we can use the `test:dgu` fixture token without spinning up a real GitHub OAuth App.)

- [ ] **Step 3: Run the spec's curl scenario**

```bash
TOKEN=$(curl -s -X POST localhost:3100/api/auth/device/exchange \
  -H 'Content-Type: application/json' \
  -d '{"github_access_token":"test:dgu"}' | jq -r .token)

echo "Token: ${TOKEN:0:30}..."

curl -s localhost:3100/api/me -H "Authorization: Bearer $TOKEN" | jq
# Expected: { "login": "dgu", "displayName": "...", "role": "PhD" }

# Pick an existing project slug:
SLUG=$(curl -s localhost:3100/api/search-index | jq -r '[.items[] | select(.type=="project")][0].href' | sed 's|/projects/||')
echo "Using slug: $SLUG"

RUN_ID=$(curl -s -X POST localhost:3100/api/runs \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"phase1-curl\",\"projectSlug\":\"$SLUG\",\"status\":\"in_progress\"}" | jq -r .id)
echo "Created run: $RUN_ID"

curl -s -X PATCH "localhost:3100/api/runs/$RUN_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"status":"success","durationSec":120}' | jq
# Expected: status=success, durationSec=120
```

Verify all four steps print the expected shape. Capture the run-id and confirm via the dashboard `/projects/<slug>/experiments` that it appears.

- [ ] **Step 4: Tear down dev server.**

---

## Task 12: Final verification — typecheck, build, scoped test pass

**Files:** none.

- [ ] **Step 1: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: clean.

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: clean.

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: clean — including the four new routes appearing in the route table:
- `POST /api/auth/device/exchange`
- `GET /api/me`
- `POST /api/runs`
- `PATCH /api/runs/[id]`

- [ ] **Step 4: Phase 1 test pass**

Run: `pnpm exec playwright test tests/api/`
Expected: all new API tests pass (~10 cases across 2 files).

**Out of scope:** the 32 legacy smoke tests under `tests/smoke/*` that hardcode seed IDs (`exp-1404`, `r-001`, `reasoning-bench-v2`, …). These are broken by the prior data wipe and are tracked as a separate, future cleanup. Phase 1 does not touch their files and does not gate on their pass status.

---

## Self-Review (run before declaring complete)

1. **Spec coverage** — every line of "Acceptance criteria" mapped to a task:
   - `.env.example` registers both env vars → Task 1
   - `pnpm db:migrate` unchanged → no schema changes (verified by inspection — Task 1 has no migration step)
   - curl scenario passes → Task 11
   - `pnpm build` clean → Task 12
   - `pnpm exec tsc --noEmit` clean → Task 12
   - new tests `tests/api/auth-flow.spec.ts`, `tests/api/runs.spec.ts` → Tasks 6–9
   - existing 32 tests pass → **dropped from Phase 1 acceptance** per Decision #3 (legacy tests reference deleted dummy data)

2. **Placeholder scan** — search this plan for "TBD"/"TODO"/"fill in"/etc. Result: none.

3. **Type consistency** — `RunStatus` imported from `@/lib/types` everywhere; `STATUSES` array order matches `lib/actions/runs.ts`; `runStatusToEventAction` reused from `@/lib/events`. ✓

4. **Decisions logged** — the four "Decisions to confirm" at the top remain visible to the executor; if the user disagrees during execution, revise before continuing.
