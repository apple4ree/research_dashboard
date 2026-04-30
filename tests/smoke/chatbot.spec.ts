import { test, expect } from '@playwright/test';

// The chatbot now hits a real LLM via the litellm proxy, so we can't
// assert on response text deterministically. The smoke check below only
// verifies the UI surface is present and reachable; the streaming path
// is exercised by manual / staging testing.

test('project chatbot renders in sidebar with input + presets', async ({ page }) => {
  await page.goto('/projects/lldm-unlearning');

  const input = page.getByPlaceholder(/프로젝트 관련 질문/);
  await expect(input).toBeVisible();

  await expect(page.getByRole('button', { name: '이번 주 TODO?' })).toBeVisible();
});
