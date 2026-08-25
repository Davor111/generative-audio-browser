import { test, expect, type Page } from '@playwright/test';
import { startExperience, spawnViaClick } from './helpers';

/** Reads an element's canvas position straight off its inline style. */
async function position(page: Page, selector: string): Promise<{ x: number; y: number }> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement;
    return { x: parseFloat(el.style.left), y: parseFloat(el.style.top) };
  }, selector);
}

/** Drags `selector` so its centre lands on the given viewport point. */
async function dragTo(page: Page, selector: string, x: number, y: number): Promise<void> {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`${selector} not found`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 15 });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await startExperience(page);
});

test('right-clicking a line opens its editor with the default angle, length and speed', async ({
  page,
}) => {
  await spawnViaClick(page, 'Line');
  await page.locator('.line-element').click({ button: 'right' });

  const dialog = page.locator('#line-edit-dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#line-edit-angle-value')).toHaveText('0°');
  await expect(page.locator('#line-edit-length-value')).toHaveText('480px');
  await expect(page.locator('#line-edit-speed-value')).toHaveText('1.6');
});

test('a line pulls a nearby orb onto its rail and slides it along', async ({ page }) => {
  await spawnViaClick(page, 'Orb');
  await spawnViaClick(page, 'Line');

  const canvas = await page.locator('#canvas').boundingBox();
  if (!canvas) throw new Error('canvas not found');

  // Park the line mid-canvas, then put the orb clearly off its (horizontal) axis
  // but inside the influence radius.
  const lineX = canvas.x + canvas.width / 2;
  const lineY = canvas.y + canvas.height / 2;
  await dragTo(page, '.line-element', lineX, lineY);
  await dragTo(page, '.orb-element', lineX + 60, lineY + 90);

  const linePos = await position(page, '.line-element');
  const before = await position(page, '.orb-element');
  expect(Math.abs(before.y - linePos.y), 'orb starts off the rail').toBeGreaterThan(40);

  await page.waitForTimeout(1500);

  const after = await position(page, '.orb-element');
  // Pulled onto the rail: the perpendicular offset decays toward zero.
  expect(Math.abs(after.y - linePos.y), 'orb converges onto the rail').toBeLessThan(
    Math.abs(before.y - linePos.y) / 2,
  );
  // And slid along it.
  expect(Math.abs(after.x - before.x), 'orb travels along the rail').toBeGreaterThan(10);
});

test('an orb on the rail bounces instead of running off the end', async ({ page }) => {
  await spawnViaClick(page, 'Orb');
  await spawnViaClick(page, 'Line');

  const canvas = await page.locator('#canvas').boundingBox();
  if (!canvas) throw new Error('canvas not found');

  const lineX = canvas.x + canvas.width / 2;
  const lineY = canvas.y + canvas.height / 2;
  await dragTo(page, '.line-element', lineX, lineY);
  await dragTo(page, '.orb-element', lineX + 40, lineY);

  const linePos = await position(page, '.line-element');

  // Sample well past the time it takes to reach an end and turn around.
  let maxOffset = 0;
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(500);
    const p = await position(page, '.orb-element');
    maxOffset = Math.max(maxOffset, Math.abs(p.x - linePos.x));
  }

  // Half of the 480px default length, plus a frame of travel.
  expect(maxOffset, 'stays within the rail').toBeLessThan(250);
  expect(maxOffset, 'actually travelled toward an end').toBeGreaterThan(60);
});

test('changing the angle re-aims the rail', async ({ page }) => {
  await spawnViaClick(page, 'Orb');
  await spawnViaClick(page, 'Line');

  const canvas = await page.locator('#canvas').boundingBox();
  if (!canvas) throw new Error('canvas not found');

  const lineX = canvas.x + canvas.width / 2;
  const lineY = canvas.y + canvas.height / 2;
  await dragTo(page, '.line-element', lineX, lineY);

  await page.locator('.line-element').click({ button: 'right' });
  await page.locator('#line-edit-angle').fill('90');
  await page.locator('#line-edit-angle').dispatchEvent('input');
  await expect(page.locator('#line-edit-angle-value')).toHaveText('90°');
  await page.locator('#line-edit-close').click();

  // Vertical rail now: an orb offset horizontally should be pulled onto x.
  await dragTo(page, '.orb-element', lineX + 90, lineY + 60);
  const linePos = await position(page, '.line-element');
  const before = await position(page, '.orb-element');

  await page.waitForTimeout(1500);
  const after = await position(page, '.orb-element');

  expect(Math.abs(after.x - linePos.x), 'orb converges onto the vertical rail').toBeLessThan(
    Math.abs(before.x - linePos.x) / 2,
  );
});
