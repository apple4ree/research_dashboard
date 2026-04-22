import { test, expect } from '@playwright/test';

test('project detail renders header and tabs', async ({ page }) => {
  await page.goto('/projects/reasoning-bench-v2');
  await expect(page.getByRole('heading', { name: 'reasoning-bench-v2' }).first()).toBeVisible();
  const main = page.getByRole('main');
  await expect(main.getByRole('link', { name: 'Overview' })).toBeVisible();
  await expect(main.getByRole('link', { name: 'Experiments' })).toBeVisible();
  await expect(main.getByRole('link', { name: 'Papers' })).toBeVisible();
  await expect(main.getByRole('link', { name: 'Data' })).toBeVisible();
  await expect(main.getByRole('link', { name: 'Members' })).toBeVisible();
});

test('unknown project returns 404', async ({ page }) => {
  const res = await page.goto('/projects/does-not-exist');
  expect(res?.status()).toBe(404);
});
