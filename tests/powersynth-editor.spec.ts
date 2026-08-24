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
