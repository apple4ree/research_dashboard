import { test, expect } from '@playwright/test';

test('create run via form', async ({ page }) => {
  const ts = Date.now();
  const name = `smoke run ${ts}`;
  await page.goto('/experiments/new');
  await expect(page.getByRole('heading', { name: 'New run' })).toBeVisible();
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Project').selectOption('reasoning-bench-v2');
  await page.getByLabel('Status').selectOption('success');
  await page.getByLabel(/Triggered by/).selectOption('dgu');
  await page.getByLabel('Started at').fill('2026-04-23T10:00');
  await page.getByLabel(/Duration/).fill('3600');
  await page.getByLabel(/Summary/).fill('smoke test run');
  await page.getByRole('button', { name: 'Create run' }).click();
  await expect(page.getByText(name)).toBeVisible();
});

test('experiments list has New run button', async ({ page }) => {
  await page.goto('/experiments');
  await expect(page.getByRole('link', { name: /New run/ })).toBeVisible();
});
