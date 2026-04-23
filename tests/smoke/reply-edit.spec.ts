import { test, expect } from '@playwright/test';

test('edit reply inline', async ({ page }) => {
  const ts = Date.now();
  const title = `Reply edit thread ${ts}`;
  await page.goto('/discussions/new');
  await page.getByLabel('Title').fill(title);
  await page.getByLabel(/Body/).fill('Starting thread.');
  await page.getByRole('button', { name: 'Create discussion' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();

  const originalReply = `Original reply ${ts}`;
  await page.getByLabel('Reply').fill(originalReply);
  await page.getByRole('button', { name: 'Post reply' }).click();
  await expect(page.getByText(originalReply)).toBeVisible();

  // Hover the reply card to reveal edit button, then click it
  const replyCard = page
    .locator('div')
    .filter({ hasText: originalReply })
    .first();
  await replyCard.hover();
  await replyCard.getByRole('button', { name: 'Edit reply' }).click();

  const editedReply = `Edited reply text ${ts}`;
  const textarea = page.getByLabel('Edit reply body');
  await textarea.fill(editedReply);
  await page.getByRole('button', { name: /^Save$/ }).click();

  await expect(page.getByText(editedReply)).toBeVisible();
  await expect(page.getByText(originalReply)).not.toBeVisible();
});
