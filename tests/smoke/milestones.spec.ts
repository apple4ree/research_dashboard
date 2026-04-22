import { test, expect } from '@playwright/test';

test('add a new milestone to lldm-unlearning', async ({ page }) => {
  const ts = Date.now();
  const label = `milestone ${ts}`;
  await page.goto('/projects/lldm-unlearning');

  await page.getByRole('button', { name: /마일스톤 추가/ }).click();

  const form = page.getByTestId('add-milestone-form');
  await form.getByLabel('Date').fill('2027-01-15');
  await form.getByLabel('Label').fill(label);
  await form.getByLabel('Status').selectOption('future');
  await form.getByRole('button', { name: /추가/ }).click();

  await expect(page.getByText(label)).toBeVisible();
  await page.reload();
  await expect(page.getByText(label)).toBeVisible();
});
