import { test, expect } from '@playwright/test';

test('add then remove project repo link', async ({ page }) => {
  const ts = Date.now();
  const label = `Smoke${ts.toString(36)}`;
  const url = `https://example.com/repo-${ts}`;
  await page.goto('/projects/reasoning-bench-v2/edit');

  // Open add form
  await page.getByRole('button', { name: /Add link/ }).click();
  await page.getByLabel('Repo label').fill(label);
  await page.getByLabel('Repo URL').fill(url);
  await page.getByRole('button', { name: /^Add$/ }).click();

  await expect(page.getByRole('link', { name: new RegExp(label) })).toBeVisible();
  await expect(page.getByText(url)).toBeVisible();

  // Remove
  const row = page.getByRole('listitem').filter({ hasText: label });
  await row.hover();
  await row.getByRole('button', { name: new RegExp(`Remove ${label}`) }).click();
  await expect(page.getByText(url)).not.toBeVisible();
});
