import { test, expect } from '@playwright/test';

test('add then remove project member', async ({ page }) => {
  // Create a fresh member to add
  const ts = Date.now();
  const login = `pm-${ts.toString(36)}`;
  const name = `ProjMem ${ts}`;
  await page.goto('/members/new');
  await page.getByLabel(/Login/).fill(login);
  await page.getByLabel('Display name').fill(name);
  await page.getByLabel('Role').selectOption('PhD');
  await page.getByRole('button', { name: 'Create member' }).click();
  await expect(page).toHaveURL(new RegExp(`/members/${login}$`));

  // Add to reasoning-bench-v2
  await page.goto('/projects/reasoning-bench-v2/members');
  const select = page.getByLabel('Add member');
  await select.selectOption(login);
  await page.getByRole('button', { name: /^Add$/ }).click();

  await expect(page.getByText(`@${login}`)).toBeVisible();

  // Remove
  const memberCard = page
    .locator('div')
    .filter({ has: page.getByText(`@${login}`, { exact: true }) })
    .first();
  await memberCard.hover();
  await memberCard.getByRole('button', { name: new RegExp(`Remove ${name}`) }).click();
  await expect(page.getByText(`@${login}`)).not.toBeVisible();
});
