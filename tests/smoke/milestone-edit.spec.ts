import { test, expect } from '@playwright/test';

test('edit existing milestone label', async ({ page }) => {
  await page.goto('/projects/lldm-unlearning');

  // Click the milestone itself to open the edit popover (new UX).
  const first = page.locator('[data-milestone]').first();
  await first.getByRole('button', { name: /^Edit milestone:/ }).click();

  const editForm = page.locator('[data-testid^="edit-milestone-form-"]').first();
  await expect(editForm).toBeVisible();

  const ts = Date.now();
  const newLabel = `updated label ${ts}`;
  await editForm.getByLabel('Label').fill(newLabel);
  await editForm.getByRole('button', { name: /Save/ }).click();

  // Scope to the timeline panel — popover can briefly hold another copy during close animation.
  const panel = page.getByTestId('timeline-panel');
  await expect(panel.getByText(newLabel).first()).toBeVisible();
  await page.reload();
  await expect(panel.getByText(newLabel).first()).toBeVisible();
});
