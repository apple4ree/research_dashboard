import { test, expect } from '@playwright/test';

test('/pipeline renders kanban columns', async ({ page }) => {
  await page.goto('/pipeline');
  await expect(page.getByRole('heading', { name: 'Pipeline' })).toBeVisible();
  for (const col of ['Idea', 'Running experiments', 'Writing', 'Under review', 'Published']) {
    await expect(page.getByText(col, { exact: false })).toBeVisible();
  }
});
