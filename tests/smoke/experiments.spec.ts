import { test, expect } from '@playwright/test';

test('/experiments lists runs with status icons', async ({ page }) => {
  await page.goto('/experiments');
  await expect(page.getByRole('heading', { name: /Experiments/i })).toBeVisible();
  await expect(page.getByText('sweep-context-len #1428')).toBeVisible();
});

test('project experiments tab hides project link per row', async ({ page }) => {
  await page.goto('/projects/long-context-eval/experiments');
  // The page shouldn't link each row back to long-context-eval (it IS long-context-eval).
  // It's fine for the project name to appear in nav or elsewhere; the assertion is row-scoped.
  const rowLinks = await page.getByRole('listitem').getByRole('link', { name: /long-context-eval/ }).count();
  expect(rowLinks).toBe(0);
});

test('run detail shows steps for an in-progress run', async ({ page }) => {
  await page.goto('/experiments/exp-1428');
  await expect(page.getByRole('heading', { name: /sweep-context-len #1428/ })).toBeVisible();
  await expect(page.getByText('prepare')).toBeVisible();
  await expect(page.getByText('run 128k')).toBeVisible();
});
