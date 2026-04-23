import { test, expect } from '@playwright/test';

test('create member then edit display name then delete', async ({ page }) => {
  const ts = Date.now();
  const login = `smoke-${ts.toString(36)}`;
  const originalName = `Smoke User ${ts}`;

  // Create
  await page.goto('/members/new');
  await expect(page.getByRole('heading', { name: 'New member' })).toBeVisible();
  await page.getByLabel(/Login/).fill(login);
  await page.getByLabel('Display name').fill(originalName);
  await page.getByLabel('Role').selectOption('PhD');
  await page.getByLabel(/Bio/).fill('smoke bio');
  await page.getByRole('button', { name: 'Create member' }).click();
  await expect(page).toHaveURL(new RegExp(`/members/${login}$`));
  await expect(page.getByRole('heading', { name: originalName })).toBeVisible();

  // Edit
  const editedName = `Edited Smoke ${ts}`;
  await page.getByRole('link', { name: /Edit profile/ }).click();
  await expect(page).toHaveURL(new RegExp(`/members/${login}/edit$`));
  await page.getByLabel('Display name').fill(editedName);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page).toHaveURL(new RegExp(`/members/${login}$`));
  await expect(page.getByRole('heading', { name: editedName })).toBeVisible();

  // Delete (new member has no runs/discussions/etc., so deletion should succeed)
  await page.getByRole('link', { name: /Edit profile/ }).click();
  const delBtn = page.getByRole('button', { name: /Delete member/ });
  await delBtn.click();
  await page.getByRole('button', { name: /Click again to confirm/ }).click();
  // After delete we're redirected away from the edit page
  await expect(page).not.toHaveURL(new RegExp(`/members/${login}`));
});

test('delete member is blocked when member has runs', async ({ page }) => {
  // dgu has runs in seed data — attempting delete should surface an error.
  await page.goto('/members/dgu/edit');
  const delBtn = page.getByRole('button', { name: /Delete member/ });
  await delBtn.click();
  await page.getByRole('button', { name: /Click again to confirm/ }).click();
  await expect(page.getByText(/Cannot delete member/)).toBeVisible();
});
