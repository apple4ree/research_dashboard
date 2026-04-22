import { test, expect } from '@playwright/test';

test('experiments status filter narrows list', async ({ page }) => {
  await page.goto('/experiments');
  const allCount = await page.getByRole('listitem').count();
  await page.getByLabel('Filter by status').selectOption('failure');
  const filteredCount = await page.getByRole('listitem').count();
  expect(filteredCount).toBeLessThan(allCount);
  expect(filteredCount).toBeGreaterThan(0);
});

test('discussions category filter shows subset', async ({ page }) => {
  await page.goto('/discussions');
  const allCount = await page
    .getByRole('listitem')
    .filter({ has: page.locator('a[href^="/discussions/d-"]') })
    .count();
  await page.getByRole('button', { name: /Announcements/ }).click();
  const filteredCount = await page
    .getByRole('listitem')
    .filter({ has: page.locator('a[href^="/discussions/d-"]') })
    .count();
  expect(filteredCount).toBeLessThanOrEqual(allCount);
});
