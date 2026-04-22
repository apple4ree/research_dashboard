import { test, expect } from '@playwright/test';

test('delete discussion requires two clicks', async ({ page }) => {
  const ts = Date.now();
  const title = `Delete test ${ts}`;
  await page.goto('/discussions/new');
  await page.getByLabel('Title').fill(title);
  await page.getByLabel(/Body/).fill('to be deleted');
  await page.getByRole('button', { name: 'Create discussion' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();

  const del = page.getByRole('button', { name: /Delete|Click again/ });
  await del.click();
  await del.click();

  await expect(page).toHaveURL(/\/discussions$/);
  await expect(page.getByRole('link', { name: title })).not.toBeVisible();
});
