import { test, expect } from '@playwright/test';
import { startExperience, spawnViaClick } from './helpers';

test.beforeEach(async ({ page }) => {
  await startExperience(page);
});

test('a placed power synth finishes loading its engine', async ({ page }) => {
  await spawnViaClick(page, 'Power Synth');

  const powerSynth = page.locator('.powersynth-element');
  await expect(powerSynth).not.toHaveClass(/powersynth-loading/, { timeout: 10_000 });
  await expect(powerSynth).not.toHaveClass(/powersynth-error/);
});

test('a placed power synth pulses on its scheduled notes', async ({ page }) => {
  await spawnViaClick(page, 'Power Synth');

  const powerSynth = page.locator('.powersynth-element');
  await expect(powerSynth).not.toHaveClass(/powersynth-loading/, { timeout: 10_000 });

  // The note-pulse class is added and removed each note, so poll for it
  // rather than asserting on a single instant. The default interval is 500ms.
  await expect
    .poll(
      async () => powerSynth.evaluate((el) => el.classList.contains('note-pulse')),
      { timeout: 5000, intervals: [50] },
    )
    .toBe(true);
});

test('erasing a power synth while its engine is still loading leaves nothing behind', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  // Deliberately does NOT wait for loading to finish — this exercises the
  // disposed-during-load path, which is the one race this element has.
  await page.getByRole('button', { name: 'Power Synth', exact: true }).click();

  const powerSynth = page.locator('.powersynth-element');
  await expect(powerSynth).toHaveCount(1);

  await powerSynth.evaluate((el) => el.remove());

  await page.waitForTimeout(3000);
  expect(errors).toEqual([]);
});
