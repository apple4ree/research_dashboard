import { test, expect } from '@playwright/test';

test('chatbot appends user + ai bubble on Enter', async ({ page }) => {
  await page.goto('/projects/lldm-unlearning');
  await page.getByRole('button', { name: /더보기/ }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const question = '이번 주 TODO?';
  const input = dialog.getByPlaceholder(/프로젝트 관련 질문/);
  await input.fill(question);
  await input.press('Enter');

  // User bubble renders the question inside the dialog. Both the preset chip
  // and the new chat bubble render the same text; assert that the count grew.
  const bubbles = dialog.getByText(question, { exact: true });
  await expect(bubbles).toHaveCount(2);
  // mockAnswer for /todo|할 일|남/ returns the canned response below.
  await expect(
    dialog.getByText('이번 주 남은 것: planner 초안 PR, 세미나 슬라이드.'),
  ).toBeVisible();
});

test('chatbot responds to preset chip click', async ({ page }) => {
  await page.goto('/projects/lldm-unlearning');
  await page.getByRole('button', { name: /더보기/ }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: 'baseline 비교' }).click();

  // mockAnswer for /baseline|비교/ returns this exact string.
  await expect(
    dialog.getByText('KLASS = KL filter, Hierarchy = masking, PAPL = planner.'),
  ).toBeVisible();
});
