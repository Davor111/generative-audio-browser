import { test, expect, type Page } from '@playwright/test';
import { startExperience, spawnViaClick } from './helpers';

/** Drags the nth element of `selector` so its centre lands on a viewport point. */
async function dragNthTo(
  page: Page,
  selector: string,
  nth: number,
  x: number,
  y: number,
): Promise<void> {
  const box = await page.locator(selector).nth(nth).boundingBox();
  if (!box) throw new Error(`${selector}[${nth}] not found`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 12 });
  await page.mouse.up();
}

async function setAutoplay(page: Page, prefix: string, on: boolean): Promise<void> {
  const box = page.locator(`#${prefix}-edit-autoplay`);
  await box.setChecked(on);
  await box.dispatchEvent('input');
}

/** Silences the nth orb so only Ping can make it sound. */
async function silenceOrb(page: Page, nth: number): Promise<void> {
  await page.locator('.orb-element').nth(nth).click({ button: 'right' });
  await setAutoplay(page, 'orb', false);
  await page.locator('#orb-edit-close').click();
}

/**
 * Records a timestamped note event per orb, so both how many notes fired and
 * the order they fired in can be asserted.
 */
async function watchOrbNotes(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as any).__hits = [];
    document.querySelectorAll('.orb-element').forEach((el, i) => {
      el.addEventListener('animationstart', (e) => {
        if ((e as AnimationEvent).animationName === 'orbNotePulse') {
          (window as any).__hits.push({ orb: i, at: performance.now() });
        }
      });
    });
  });
}

const hits = (page: Page) =>
  page.evaluate(() => (window as any).__hits as Array<{ orb: number; at: number }>);
const resetHits = (page: Page) => page.evaluate(() => ((window as any).__hits = []));

test.beforeEach(async ({ page }) => {
  await startExperience(page);
});

test('right-clicking a ping opens its editor with the default interval, speed and reach', async ({
  page,
}) => {
  await spawnViaClick(page, 'Ping');
  await page.locator('.ping-element').click({ button: 'right' });

  await expect(page.locator('#ping-edit-dialog')).toBeVisible();
  await expect(page.locator('#ping-edit-autoplay')).toBeChecked();
  await expect(page.locator('#ping-edit-interval-value')).toHaveText('2000ms');
  await expect(page.locator('#ping-edit-speed-value')).toHaveText('4.0 px/f');
  await expect(page.locator('#ping-edit-reach-value')).toHaveText('260px');
});

test('a ripple triggers a silent orb exactly once', async ({ page }) => {
  await spawnViaClick(page, 'Orb');
  await spawnViaClick(page, 'Ping');
  await silenceOrb(page, 0);

  const canvas = (await page.locator('#canvas').boundingBox())!;
  const cx = canvas.x + canvas.width / 2;
  const cy = canvas.y + canvas.height / 2;
  await dragNthTo(page, '.ping-element', 0, cx, cy);
  await dragNthTo(page, '.orb-element', 0, cx + 80, cy);

  // Stop the ping's own pulse so exactly one ripple is in flight.
  await page.locator('.ping-element').click({ button: 'right' });
  await setAutoplay(page, 'ping', false);
  await page.locator('#ping-edit-close').click();

  await page.waitForTimeout(600);
  await watchOrbNotes(page);
  await resetHits(page);

  await page.locator('.ping-element').click();
  // Long enough for the ring to cross the orb and expire past its reach.
  await page.waitForTimeout(2500);

  // Once per ripple — not once per frame the orb spends inside the ring.
  expect(await hits(page)).toHaveLength(1);
});

test('the ripple is a wavefront — near elements fire before far ones', async ({ page }) => {
  await spawnViaClick(page, 'Orb');
  await spawnViaClick(page, 'Orb');
  await spawnViaClick(page, 'Ping');
  await silenceOrb(page, 0);
  await silenceOrb(page, 1);

  const canvas = (await page.locator('#canvas').boundingBox())!;
  const cx = canvas.x + canvas.width / 2;
  const cy = canvas.y + canvas.height / 2;
  await dragNthTo(page, '.ping-element', 0, cx, cy);
  await dragNthTo(page, '.orb-element', 0, cx + 50, cy);
  await dragNthTo(page, '.orb-element', 1, cx + 220, cy);

  await page.locator('.ping-element').click({ button: 'right' });
  await setAutoplay(page, 'ping', false);
  await page.locator('#ping-edit-close').click();

  await page.waitForTimeout(600);
  await watchOrbNotes(page);
  await resetHits(page);

  await page.locator('.ping-element').click();
  await page.waitForTimeout(2500);

  const fired = await hits(page);
  expect(fired).toHaveLength(2);
  // The near orb is reached first, and the wave takes real time to cross.
  expect(fired[0].orb).toBe(0);
  expect(fired[1].orb).toBe(1);
  expect(fired[1].at - fired[0].at).toBeGreaterThan(150);
});

test('an element beyond the reach is never triggered', async ({ page }) => {
  await spawnViaClick(page, 'Orb');
  await spawnViaClick(page, 'Ping');
  await silenceOrb(page, 0);

  const canvas = (await page.locator('#canvas').boundingBox())!;
  const cx = canvas.x + 120;
  const cy = canvas.y + canvas.height / 2;
  await dragNthTo(page, '.ping-element', 0, cx, cy);

  await page.locator('.ping-element').click({ button: 'right' });
  await setAutoplay(page, 'ping', false);
  // Shrink the reach so the orb sits well outside it.
  await page.locator('#ping-edit-reach').fill('100');
  await page.locator('#ping-edit-reach').dispatchEvent('input');
  await page.locator('#ping-edit-close').click();

  await dragNthTo(page, '.orb-element', 0, cx + 320, cy);

  await page.waitForTimeout(600);
  await watchOrbNotes(page);
  await resetHits(page);

  await page.locator('.ping-element').click();
  await page.waitForTimeout(2500);

  expect(await hits(page)).toHaveLength(0);
});

test('autoplay off stops the pulse, and clicking still throws a ripple', async ({ page }) => {
  await spawnViaClick(page, 'Orb');
  await spawnViaClick(page, 'Ping');
  await silenceOrb(page, 0);

  const canvas = (await page.locator('#canvas').boundingBox())!;
  const cx = canvas.x + canvas.width / 2;
  const cy = canvas.y + canvas.height / 2;
  await dragNthTo(page, '.ping-element', 0, cx, cy);
  await dragNthTo(page, '.orb-element', 0, cx + 70, cy);

  // Fast pulse so a few ripples land inside the observation window.
  await page.locator('.ping-element').click({ button: 'right' });
  await page.locator('#ping-edit-interval').fill('400');
  await page.locator('#ping-edit-interval').dispatchEvent('input');
  await page.locator('#ping-edit-close').click();

  // The interval deliberately takes effect on the next tick rather than
  // rescheduling the pending one, so the default 2000ms tick has to elapse
  // before the new cadence is running.
  await page.waitForTimeout(2600);
  await watchOrbNotes(page);
  await resetHits(page);
  await page.waitForTimeout(2000);
  expect((await hits(page)).length, 'pulsing on its own').toBeGreaterThan(1);

  await page.locator('.ping-element').click({ button: 'right' });
  await setAutoplay(page, 'ping', false);
  await page.locator('#ping-edit-close').click();

  // Let ripples already in flight finish crossing the orb.
  await page.waitForTimeout(2000);
  await resetHits(page);
  await page.waitForTimeout(2000);
  expect(await hits(page), 'quiet with autoplay off').toHaveLength(0);

  await page.locator('.ping-element').click();
  await page.waitForTimeout(2000);
  expect(await hits(page), 'still pings by hand').toHaveLength(1);
});
