import { test, expect } from '@playwright/test';
import { startExperience, spawnViaClick } from './helpers';

test.beforeEach(async ({ page }) => {
  await startExperience(page);
  await spawnViaClick(page, 'Power Synth');
  await expect(page.locator('.powersynth-element')).not.toHaveClass(
    /powersynth-loading/,
    { timeout: 10_000 },
  );
});

test('shows a hover hint on the power synth', async ({ page }) => {
  const powerSynth = page.locator('.powersynth-element');
  await powerSynth.hover();
  await expect(powerSynth.locator('.powersynth-edit-hint')).toBeVisible();
});

test('right-clicking opens the edit dialog pre-filled with its current values', async ({ page }) => {
  await page.locator('.powersynth-element').click({ button: 'right' });

  const dialog = page.locator('#ps-edit-dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#ps-edit-engine')).toHaveValue('8');
  await expect(page.locator('#ps-edit-note-duration')).toHaveValue('8n');
  await expect(page.locator('#ps-edit-note-interval-value')).toHaveText('500ms');
  await expect(page.locator('#ps-edit-volume-value')).toHaveText('100%');
  await expect(page.locator('#ps-edit-timbre-value')).toHaveText('0.50');
});

test('the engine select offers all 24 Plaits engines', async ({ page }) => {
  await page.locator('.powersynth-element').click({ button: 'right' });
  await expect(page.locator('#ps-edit-engine option')).toHaveCount(24);
});

test('changing the engine updates the select and raises no console error', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.locator('.powersynth-element').click({ button: 'right' });
  await page.locator('#ps-edit-engine').selectOption('13');
  await expect(page.locator('#ps-edit-engine')).toHaveValue('13');

  await page.waitForTimeout(1000);
  expect(errors).toEqual([]);
});

test('moving the harmonics and volume sliders updates their live readouts', async ({ page }) => {
  await page.locator('.powersynth-element').click({ button: 'right' });

  await page.locator('#ps-edit-harmonics').fill('0.8');
  await page.locator('#ps-edit-harmonics').dispatchEvent('input');
  await expect(page.locator('#ps-edit-harmonics-value')).toHaveText('0.80');

  await page.locator('#ps-edit-volume').fill('0.3');
  await page.locator('#ps-edit-volume').dispatchEvent('input');
  await expect(page.locator('#ps-edit-volume-value')).toHaveText('30%');
});

test('the close button closes the dialog', async ({ page }) => {
  await page.locator('.powersynth-element').click({ button: 'right' });

  const dialog = page.locator('#ps-edit-dialog');
  await expect(dialog).toBeVisible();

  await page.locator('#ps-edit-close').click();
  await expect(dialog).toBeHidden();
});

test('clicking the backdrop closes the dialog', async ({ page }) => {
  await page.locator('.powersynth-element').click({ button: 'right' });

  const dialog = page.locator('#ps-edit-dialog');
  await expect(dialog).toBeVisible();

  await dialog.click({ position: { x: 2, y: 2 } });
  await expect(dialog).toBeHidden();
});

test('the effects section starts fully dry', async ({ page }) => {
  await page.locator('.powersynth-element').click({ button: 'right' });

  await expect(page.locator('#ps-edit-delay-mix-value')).toHaveText('0%');
  await expect(page.locator('#ps-edit-reverb-send-value')).toHaveText('0%');
  await expect(page.locator('#ps-edit-delay-time-value')).toHaveText('0.30s');
  await expect(page.locator('#ps-edit-delay-feedback-value')).toHaveText('35%');
});

test('moving the effect sliders updates their readouts and raises no console error', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.locator('.powersynth-element').click({ button: 'right' });

  for (const [id, value, expected] of [
    ['ps-edit-delay-mix', '0.6', '60%'],
    ['ps-edit-reverb-send', '0.45', '45%'],
    ['ps-edit-delay-time', '0.75', '0.75s'],
    ['ps-edit-delay-feedback', '0.8', '80%'],
  ] as const) {
    await page.locator(`#${id}`).fill(value);
    await page.locator(`#${id}`).dispatchEvent('input');
    await expect(page.locator(`#${id}-value`)).toHaveText(expected);
  }

  // Long enough for a few note loops to run through the wet delay path.
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});

test('effect settings are per-element, not shared by the dialog', async ({ page }) => {
  await page.locator('.powersynth-element').first().click({ button: 'right' });
  await page.locator('#ps-edit-delay-mix').fill('0.7');
  await page.locator('#ps-edit-delay-mix').dispatchEvent('input');
  await page.locator('#ps-edit-close').click();

  await spawnViaClick(page, 'Power Synth');
  await page.locator('.powersynth-element').nth(1).click({ button: 'right' });

  // The second synth must show its own default, not the first one's setting.
  await expect(page.locator('#ps-edit-delay-mix-value')).toHaveText('0%');
});
