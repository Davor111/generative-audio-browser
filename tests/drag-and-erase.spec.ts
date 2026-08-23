import { test, expect } from '@playwright/test';
import { startExperience, spawnViaClick } from './helpers';

test.beforeEach(async ({ page }) => {
  await startExperience(page);
});

test('dragging a placed element updates its position', async ({ page }) => {
  await spawnViaClick(page, 'Orb');
  const orb = page.locator('.orb-element');
  const canvas = page.locator('#canvas');

  const before = await orb.boundingBox();
  const canvasBox = await canvas.boundingBox();
  if (!before || !canvasBox) throw new Error('orb or canvas not found');

  // Drag toward the canvas center — guaranteed to be far from wherever the
  // (randomly placed) orb started, and never clamped by the drag margin.
  const targetX = canvasBox.x + canvasBox.width / 2;
  const targetY = canvasBox.y + canvasBox.height / 2;

  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetX, targetY, { steps: 10 });
  await page.mouse.up();

  const after = await orb.boundingBox();
  if (!after) throw new Error('orb not found after drag');

  const afterCenterX = after.x + after.width / 2;
  const afterCenterY = after.y + after.height / 2;
  expect(Math.abs(afterCenterX - targetX)).toBeLessThan(5);
  expect(Math.abs(afterCenterY - targetY)).toBeLessThan(5);
});

test('erase zone stays hidden until a drag starts', async ({ page }) => {
  await spawnViaClick(page, 'Orb');
  await expect(page.locator('#erase-zone')).not.toHaveClass(/visible/);
});

test('dragging an element onto the erase zone removes it', async ({ page }) => {
  await spawnViaClick(page, 'Orb');
  const orb = page.locator('.orb-element');
  const eraseZone = page.locator('#erase-zone');

  const orbBox = await orb.boundingBox();
  if (!orbBox) throw new Error('orb not found');

  await page.mouse.move(orbBox.x + orbBox.width / 2, orbBox.y + orbBox.height / 2);
  await page.mouse.down();

  // Confirm the drag actually registered before targeting the (now-visible) erase zone.
  await expect(eraseZone).toHaveClass(/visible/);

  const eraseBox = await eraseZone.boundingBox();
  if (!eraseBox) throw new Error('erase zone not found');
  await page.mouse.move(eraseBox.x + eraseBox.width / 2, eraseBox.y + eraseBox.height / 2, { steps: 15 });
  await expect(eraseZone).toHaveClass(/armed/);
  await page.mouse.up();

  await expect(orb).toHaveCount(0);
  await expect(eraseZone).not.toHaveClass(/visible|armed/);
});

test('dragging an element away from the erase zone does not remove it', async ({ page }) => {
  await spawnViaClick(page, 'Orb');
  const orb = page.locator('.orb-element');

  const orbBox = await orb.boundingBox();
  if (!orbBox) throw new Error('orb not found');

  await page.mouse.move(orbBox.x + orbBox.width / 2, orbBox.y + orbBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(orbBox.x + 80, orbBox.y - 60, { steps: 10 });
  await page.mouse.up();

  await expect(orb).toHaveCount(1);
});
