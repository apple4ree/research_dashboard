import { test, expect } from '@playwright/test';

const routes = [
  '/',
  '/projects',
  '/projects/reasoning-bench-v2',
  '/projects/reasoning-bench-v2/experiments',
  '/projects/reasoning-bench-v2/papers',
  '/projects/reasoning-bench-v2/data',
  '/projects/reasoning-bench-v2/members',
  '/pipeline',
  '/experiments',
  '/projects/long-context-eval/experiments/exp-1428',
  '/discussions',
  '/discussions/d-001',
  '/members/dgu',
];

for (const route of routes) {
  test(`${route} returns 200`, async ({ page }) => {
    const res = await page.goto(route);
    expect(res?.status(), `status for ${route}`).toBe(200);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.waitForLoadState('networkidle');
    expect(errors, `runtime errors on ${route}`).toEqual([]);
  });
}
