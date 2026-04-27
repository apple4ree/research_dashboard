import { test, expect } from '@playwright/test';

const SLUG = 'phase1-test';

test('wiki entity edit: navigate from detail, save updates body', async ({ page, request }) => {
  // Seed an entity through the API so we control its initial state.
  const ts = Date.now();
  const id = `smoke_wiki_${ts}`;

  const tokenRes = await request.post('/api/auth/device/exchange', {
    data: { github_access_token: 'test:testbot' },
  });
  const token = (await tokenRes.json()).token as string;

  await request.post('/api/wiki-entities', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      projectSlug: SLUG,
      id,
      type: 'attack',
      name: 'Smoke Wiki',
      status: 'active',
      summaryMarkdown: 'sum',
      bodyMarkdown: '# Original body',
      sourceFiles: [],
    },
  });

  await page.goto(`/projects/${SLUG}/wiki/${id}`);
  await page.getByRole('link', { name: /편집/ }).click();
  await expect(page).toHaveURL(new RegExp(`/wiki/${id}/edit$`));

  // First-compile under turbopack can be slow; wait explicitly for the editor.
  const bodyTextarea = page.locator('textarea[name="bodyMarkdown"]');
  await bodyTextarea.waitFor({ state: 'visible', timeout: 30_000 });
  await bodyTextarea.fill('# Edited body');
  await page.getByRole('button', { name: /저장/ }).click();

  await expect(page).toHaveURL(new RegExp(`/wiki/${id}$`));
  await expect(page.getByText('Edited body')).toBeVisible();
});

test('wiki entity edit: two-click delete returns to wiki index', async ({ page, request }) => {
  const ts = Date.now();
  const id = `smoke_del_${ts}`;

  const tokenRes = await request.post('/api/auth/device/exchange', {
    data: { github_access_token: 'test:testbot' },
  });
  const token = (await tokenRes.json()).token as string;

  await request.post('/api/wiki-entities', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      projectSlug: SLUG,
      id,
      type: 'attack',
      name: 'Delete Me',
      status: 'active',
      bodyMarkdown: '# delete target',
      sourceFiles: [],
    },
  });

  await page.goto(`/projects/${SLUG}/wiki/${id}`);
  const delBtn = page.getByRole('button', { name: /삭제|한 번 더/ });
  await delBtn.click();
  await delBtn.click();

  await expect(page).toHaveURL(new RegExp(`/wiki$`));
});
