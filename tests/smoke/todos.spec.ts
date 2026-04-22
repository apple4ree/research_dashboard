import { test, expect } from '@playwright/test';

test('add a new todo to the short bucket persists', async ({ page }) => {
  const ts = Date.now();
  const text = `automated todo ${ts}`;
  await page.goto('/projects/lldm-unlearning');

  const shortBucket = page.getByTestId('todo-bucket-short');
  await expect(shortBucket).toBeVisible();

  await shortBucket.getByLabel('add todo to short').fill(text);
  await shortBucket.getByRole('button', { name: /Add/ }).click();

  await expect(page.getByText(text)).toBeVisible();
  await page.reload();
  await expect(page.getByText(text)).toBeVisible();
});

test('toggle a todo persists across reload', async ({ page }) => {
  const ts = Date.now();
  const text = `toggleable todo ${ts}`;
  await page.goto('/projects/lldm-unlearning');

  // First add a known todo so we can reliably target it.
  const shortBucket = page.getByTestId('todo-bucket-short');
  await shortBucket.getByLabel('add todo to short').fill(text);
  await shortBucket.getByRole('button', { name: /Add/ }).click();
  await expect(page.getByText(text)).toBeVisible();

  // Toggle it by clicking its checkbox (aria-label matches the todo text).
  const checkbox = page.getByRole('checkbox', { name: text });
  await expect(checkbox).not.toBeChecked();
  await checkbox.check();
  await expect(checkbox).toBeChecked();

  // Reload and verify the checked state persisted.
  await page.reload();
  const after = page.getByRole('checkbox', { name: text });
  await expect(after).toBeChecked();
});

test('delete a todo removes it', async ({ page }) => {
  const ts = Date.now();
  const text = `deletable todo ${ts}`;
  await page.goto('/projects/lldm-unlearning');

  const shortBucket = page.getByTestId('todo-bucket-short');
  await shortBucket.getByLabel('add todo to short').fill(text);
  await shortBucket.getByRole('button', { name: /Add/ }).click();
  await expect(page.getByText(text)).toBeVisible();

  // Click delete button (has aria-label "delete <text>").
  const delBtn = page.getByRole('button', { name: `delete ${text}` });
  // Hover the row to force the button into a clickable visual state.
  await delBtn.dispatchEvent('click');

  await expect(page.getByText(text)).toBeHidden();
  await page.reload();
  await expect(page.getByText(text)).toBeHidden();
});
