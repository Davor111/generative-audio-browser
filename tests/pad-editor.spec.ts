import { test, expect } from '@playwright/test';
import { startExperience, spawnViaClick } from './helpers';

test.beforeEach(async ({ page }) => {
  await startExperience(page);
  await spawnViaClick(page, 'Deep Pad');
});

test('shows a hover hint on the pad', async ({ page }) => {
  const pad = page.locator('.deeppad-element');
  await pad.hover();
  await expect(pad.locator('.dp-edit-hint')).toBeVisible();
});

test('right-clicking a pad opens the edit dialog pre-filled with its current values', async ({ page }) => {
  const pad = page.locator('.deeppad-element');
  await pad.click({ button: 'right' });

  const dialog = page.locator('#pad-edit-dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#pad-edit-waveform')).toHaveValue('fatsawtooth');
  await expect(page.locator('#pad-edit-note-interval-value')).toHaveText('5000ms');
  await expect(page.locator('#pad-edit-volume-value')).toHaveText('100%');
});

test('changing the waveform, note interval, and volume updates the live display', async ({ page }) => {
  const pad = page.locator('.deeppad-element');
  await pad.click({ button: 'right' });

  await page.locator('#pad-edit-waveform').selectOption('square');
  await expect(page.locator('#pad-edit-waveform')).toHaveValue('square');

  await page.locator('#pad-edit-note-interval').fill('2000');
  await page.locator('#pad-edit-note-interval').dispatchEvent('input');
  await expect(page.locator('#pad-edit-note-interval-value')).toHaveText('2000ms');

  await page.locator('#pad-edit-volume').fill('0.5');
  await page.locator('#pad-edit-volume').dispatchEvent('input');
  await expect(page.locator('#pad-edit-volume-value')).toHaveText('50%');
});

test('the close button closes the dialog', async ({ page }) => {
  const pad = page.locator('.deeppad-element');
  await pad.click({ button: 'right' });

  const dialog = page.locator('#pad-edit-dialog');
  await expect(dialog).toBeVisible();

  await page.locator('#pad-edit-close').click();
  await expect(dialog).toBeHidden();
});

test('clicking the backdrop closes the dialog', async ({ page }) => {
  const pad = page.locator('.deeppad-element');
  await pad.click({ button: 'right' });

  const dialog = page.locator('#pad-edit-dialog');
  await expect(dialog).toBeVisible();

  await dialog.click({ position: { x: 2, y: 2 } });
  await expect(dialog).toBeHidden();
});
