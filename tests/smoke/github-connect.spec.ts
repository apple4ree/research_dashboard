import { test, expect } from '@playwright/test';

test('/projects/[slug]/edit shows GitHub connect form when not connected', async ({ page }) => {
  await page.goto('/projects/reasoning-bench-v2/edit');
  await expect(page.getByText(/GitHub integration/i)).toBeVisible();
  await expect(page.getByLabel(/GitHub repository/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Connect/ })).toBeVisible();
});

test('GitHub connect card is present even with empty state', async ({ page }) => {
  await page.goto('/projects/reasoning-bench-v2/edit');
  // The input is always visible in the disconnected state
  const input = page.getByLabel(/GitHub repository/i);
  await expect(input).toBeVisible();
  await expect(input).toHaveValue('');
});

test('GitHub connect form shows validation error for malformed input', async ({ page }) => {
  await page.goto('/projects/reasoning-bench-v2/edit');
  await page.getByLabel(/GitHub repository/i).fill('not-a-valid-format');
  await page.getByRole('button', { name: /^Connect/ }).click();
  // parseRepo requires at least two slash-separated parts; single-word
  // input triggers the friendly validation error without any GitHub call.
  await expect(page.getByText(/Invalid repo format/i)).toBeVisible();
});
