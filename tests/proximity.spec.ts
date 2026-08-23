import { test, expect } from '@playwright/test';
import { startExperience, spawnViaClick } from './helpers';

test.beforeEach(async ({ page }) => {
  await startExperience(page);
});

test('dragging a modulator next to an orb marks it mod-affected, and moving away clears it', async ({ page }) => {
  await spawnViaClick(page, 'Orb');
  await spawnViaClick(page, 'Modulator');

  const orb = page.locator('.orb-element');
  const modulator = page.locator('.modulator-element');

  const orbBox = await orb.boundingBox();
  const modBox = await modulator.boundingBox();
  if (!orbBox || !modBox) throw new Error('orb or modulator not found');

  // Drag the modulator right next to the orb — well within its influence radius.
  await page.mouse.move(modBox.x + modBox.width / 2, modBox.y + modBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(orbBox.x + orbBox.width / 2 + 20, orbBox.y + orbBox.height / 2, { steps: 15 });
  await page.mouse.up();

  await expect(orb).toHaveClass(/mod-affected/);

  // Drag it far away again — the effect should clear.
  const canvas = await page.locator('#canvas').boundingBox();
  if (!canvas) throw new Error('canvas not found');

  const farModBox = await modulator.boundingBox();
  if (!farModBox) throw new Error('modulator not found');

  await page.mouse.move(farModBox.x + farModBox.width / 2, farModBox.y + farModBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 40, canvas.y + 40, { steps: 15 });
  await page.mouse.up();

  await expect(orb).not.toHaveClass(/mod-affected/);
});
