import { test, expect } from '@playwright/test';
import { startExperience, spawnViaClick } from './helpers';

test.beforeEach(async ({ page }) => {
  await startExperience(page);
  await spawnViaClick(page, 'Orb');
});

test('shows a hover hint on the orb', async ({ page }) => {
  const orb = page.locator('.orb-element');
  await orb.hover();
  await expect(orb.locator('.orb-edit-hint')).toBeVisible();
});

test('right-clicking an orb opens the edit dialog pre-filled with its current values', async ({ page }) => {
  const orb = page.locator('.orb-element');
  await orb.click({ button: 'right' });

  const dialog = page.locator('#orb-edit-dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#orb-edit-waveform')).toHaveValue('sine');
  await expect(page.locator('#orb-edit-note-duration')).toHaveValue('8n');
  await expect(page.locator('#orb-edit-note-interval-value')).toHaveText('500ms');
  await expect(page.locator('#orb-edit-volume-value')).toHaveText('100%');
});

test('changing the volume updates the live display', async ({ page }) => {
  const orb = page.locator('.orb-element');
  await orb.click({ button: 'right' });

  await page.locator('#orb-edit-volume').fill('0.3');
  await page.locator('#orb-edit-volume').dispatchEvent('input');
  await expect(page.locator('#orb-edit-volume-value')).toHaveText('30%');
});

test('changing the waveform and note interval updates the live display', async ({ page }) => {
  const orb = page.locator('.orb-element');
  await orb.click({ button: 'right' });

  await page.locator('#orb-edit-waveform').selectOption('square');
  await expect(page.locator('#orb-edit-waveform')).toHaveValue('square');

  await page.locator('#orb-edit-note-interval').fill('1200');
  await page.locator('#orb-edit-note-interval').dispatchEvent('input');
  await expect(page.locator('#orb-edit-note-interval-value')).toHaveText('1200ms');
});

test('the close button closes the dialog', async ({ page }) => {
  const orb = page.locator('.orb-element');
  await orb.click({ button: 'right' });

  const dialog = page.locator('#orb-edit-dialog');
  await expect(dialog).toBeVisible();

  await page.locator('#orb-edit-close').click();
  await expect(dialog).toBeHidden();
});

test('clicking the backdrop closes the dialog', async ({ page }) => {
  const orb = page.locator('.orb-element');
  await orb.click({ button: 'right' });

  const dialog = page.locator('#orb-edit-dialog');
  await expect(dialog).toBeVisible();

  // Click at the dialog element's own edge (outside its content box, still inside <dialog>) to hit the backdrop area.
  await dialog.click({ position: { x: 2, y: 2 } });
  await expect(dialog).toBeHidden();
});
