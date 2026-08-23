import { test, expect } from '@playwright/test';
import { startExperience, spawnViaClick, ELEMENT_TYPES } from './helpers';

test.beforeEach(async ({ page }) => {
  await startExperience(page);
});

for (const { label, elementClass } of ELEMENT_TYPES) {
  test(`clicking the ${label} toolbar button places one ${elementClass}`, async ({ page }) => {
    await spawnViaClick(page, label);
    await expect(page.locator(`.${elementClass}`)).toHaveCount(1);
  });
}

test('spawning multiple different elements keeps them all on canvas', async ({ page }) => {
  await spawnViaClick(page, 'Orb');
  await spawnViaClick(page, 'Deep Pad');
  await spawnViaClick(page, 'Woah');

  await expect(page.locator('.orb-element')).toHaveCount(1);
  await expect(page.locator('.deeppad-element')).toHaveCount(1);
  await expect(page.locator('.woah-element')).toHaveCount(1);
});

test('drag-and-drop from the toolbar onto the canvas places an orb', async ({ page }) => {
  const toolbarOrb = page.getByRole('button', { name: 'Orb', exact: true });
  const canvas = page.locator('#canvas');

  await toolbarOrb.hover();
  await page.mouse.down();
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error('canvas not found');
  await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2, { steps: 10 });
  await page.mouse.up();

  await expect(page.locator('.orb-element')).toHaveCount(1);
});
