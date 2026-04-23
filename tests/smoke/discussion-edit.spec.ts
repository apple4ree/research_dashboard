import { test, expect } from '@playwright/test';

test('edit discussion title', async ({ page }) => {
  const ts = Date.now();
  const originalTitle = `Discussion to edit ${ts}`;
  await page.goto('/discussions/new');
  await page.getByLabel('Title').fill(originalTitle);
  await page.getByLabel(/Body/).fill('original body');
  await page.getByRole('button', { name: 'Create discussion' }).click();
  await expect(page.getByRole('heading', { name: originalTitle })).toBeVisible();

  // Go to edit
  await page.getByRole('link', { name: /Edit/ }).first().click();
  await expect(page.getByRole('heading', { name: /Edit discussion/ })).toBeVisible();
  const newTitle = `Edited title ${ts}`;
  await page.getByLabel('Title').fill(newTitle);
  await page.getByLabel(/Body/).fill('updated body');
  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect(page.getByRole('heading', { name: newTitle })).toBeVisible();
  await expect(page.getByText('updated body')).toBeVisible();
});
