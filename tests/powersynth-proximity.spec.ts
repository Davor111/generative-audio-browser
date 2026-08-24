import { test, expect } from '@playwright/test';
import { startExperience, spawnViaClick } from './helpers';

test.beforeEach(async ({ page }) => {
  await startExperience(page);
});

/** Drags `from` onto `to`, landing just inside the modulator's influence radius. */
async function dragOnto(page: import('@playwright/test').Page, from: string, to: string) {
  const fromBox = await page.locator(from).boundingBox();
  const toBox = await page.locator(to).boundingBox();
  if (!fromBox || !toBox) throw new Error(`${from} or ${to} not found`);

  await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(toBox.x + toBox.width / 2 + 20, toBox.y + toBox.height / 2, { steps: 15 });
  await page.mouse.up();
}

test('dragging a modulator next to a power synth marks it mod-affected, and moving away clears it', async ({ page }) => {
  await spawnViaClick(page, 'Power Synth');
  await spawnViaClick(page, 'Modulator');

  const powerSynth = page.locator('.powersynth-element');
  await expect(powerSynth).not.toHaveClass(/powersynth-loading/, { timeout: 10_000 });

  await dragOnto(page, '.modulator-element', '.powersynth-element');
  await expect(powerSynth).toHaveClass(/mod-affected/);

  const canvas = await page.locator('#canvas').boundingBox();
  const farModBox = await page.locator('.modulator-element').boundingBox();
  if (!canvas || !farModBox) throw new Error('canvas or modulator not found');

  await page.mouse.move(farModBox.x + farModBox.width / 2, farModBox.y + farModBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 40, canvas.y + 40, { steps: 15 });
  await page.mouse.up();

  await expect(powerSynth).not.toHaveClass(/mod-affected/);
});

test('dragging a time warp next to a power synth marks it warped', async ({ page }) => {
  await spawnViaClick(page, 'Power Synth');
  await spawnViaClick(page, 'Time Warp');

  const powerSynth = page.locator('.powersynth-element');
  await expect(powerSynth).not.toHaveClass(/powersynth-loading/, { timeout: 10_000 });

  await dragOnto(page, '.timewarp-element', '.powersynth-element');
  await expect(powerSynth).toHaveClass(/warped/);
});

test('dragging a woah next to a power synth marks it woah-affected', async ({ page }) => {
  await spawnViaClick(page, 'Power Synth');
  await spawnViaClick(page, 'Woah');

  const powerSynth = page.locator('.powersynth-element');
  await expect(powerSynth).not.toHaveClass(/powersynth-loading/, { timeout: 10_000 });

  await dragOnto(page, '.woah-element', '.powersynth-element');
  await expect(powerSynth).toHaveClass(/woah-affected/);
});
