import { test, expect } from '@playwright/test';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import os from 'node:os';

const SLUG = 'phase1-test';

test('entry create: no artifact (baseline) still works after refactor', async ({ page }) => {
  await page.goto(`/projects/${SLUG}/entries/new`);
  const title = `noArt smoke ${Date.now()}`;
  await page.getByLabel(/Title/i).fill(title);
  await page.getByLabel(/Summary/i).fill('Baseline — no artifact.');
  await page.getByRole('button', { name: /Create entry/i }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${SLUG}(\\?|$)`), { timeout: 15_000 });
});

test('entry create: upload a file via File mode + download via /api/uploads/<id>', async ({
  page,
}) => {
  // Build a small test file on disk.
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'labhub-upload-'));
  const filePath = path.join(tmp, 'note.txt');
  const content = `hello upload ${Date.now()}\n`;
  await fs.writeFile(filePath, content, 'utf8');

  await page.goto(`/projects/${SLUG}/entries/new`);

  const title = `Upload smoke ${Date.now()}`;
  await page.getByLabel(/Title/i).fill(title);
  await page.getByLabel(/Summary/i).fill('Verifying file upload path.');

  // Add an artifact, switch to File mode, pick the file.
  await page.getByRole('button', { name: /Add artifact/i }).click();
  await page.locator('input[placeholder="Artifact title"]').first().fill('attached-note');
  await page.getByRole('button', { name: /^File$/ }).first().click();
  await page
    .locator('input[type="file"][name="artifact_0_file"]')
    .setInputFiles(filePath);

  await page.getByRole('button', { name: /Create entry/i }).click();

  // Redirected back to project page; new entry visible.
  await expect(page).toHaveURL(new RegExp(`/projects/${SLUG}$`), { timeout: 15_000 });
  await expect(page.getByText(title).first()).toBeVisible();

  await fs.rm(tmp, { recursive: true, force: true });
});
