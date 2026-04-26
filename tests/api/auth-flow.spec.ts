import { test, expect } from '@playwright/test';

test('device exchange: invalid GitHub token → 401 github_verify_failed', async ({ request }) => {
  const res = await request.post('/api/auth/device/exchange', {
    data: { github_access_token: 'test:invalid' },
  });
  expect(res.status()).toBe(401);
  const body = await res.json();
  expect(body.error).toBe('github_verify_failed');
});

test('device exchange: existing member matched by githubLogin', async ({ request }) => {
  // globalSetup ensures Member.testbot exists with githubLogin='testbot'.
  const res = await request.post('/api/auth/device/exchange', {
    data: { github_access_token: 'test:testbot' },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.token).toMatch(/^eyJ/);
  expect(body.member.login).toBe('testbot');
  expect(body.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
});

test('device exchange: new GitHub user auto-creates a Member', async ({ request }) => {
  // First call may auto-create; subsequent calls match by githubLogin.
  // Either way the resolved member.login should be 'newuser'.
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
