import { test, expect } from '@playwright/test';

test('edit existing milestone label', async ({ page }) => {
  await page.goto('/projects/lldm-unlearning');

  const first = page.locator('[data-milestone]').first();
  await first.hover();
  await first.getByRole('button', { name: 'Edit milestone' }).click();

  const editForm = page.locator('[data-testid^="edit-milestone-form-"]').first();
  await expect(editForm).toBeVisible();

  const ts = Date.now();
  const newLabel = `updated label ${ts}`;
  await editForm.getByLabel('Label').fill(newLabel);
  await editForm.getByRole('button', { name: /Save/ }).click();

  await expect(page.getByText(newLabel)).toBeVisible();
  await page.reload();
  await expect(page.getByText(newLabel)).toBeVisible();
});
