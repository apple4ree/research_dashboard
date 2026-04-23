import { test, expect } from '@playwright/test';

test('edit run summary', async ({ page }) => {
  // Use exp-1404 from seed data (belongs to reasoning-bench-v2)
  await page.goto('/projects/reasoning-bench-v2/experiments/exp-1404');
  // Click Edit button
  await page.getByRole('link', { name: /Edit/ }).first().click();
  await expect(page).toHaveURL(/\/projects\/reasoning-bench-v2\/experiments\/exp-1404\/edit$/);
  const ts = Date.now();
  const newSummary = `edited summary ${ts}`;
  await page.getByLabel('Summary').fill(newSummary);
  await page.getByRole('button', { name: /Save changes/ }).click();
  await expect(page.getByText(newSummary)).toBeVisible();
});
