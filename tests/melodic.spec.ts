import { test, expect, type Page } from '@playwright/test';
import { startExperience, spawnViaClick } from './helpers';

/**
 * Counts note events by listening for each generator's per-note CSS animation,
 * which is the only note-firing signal visible from outside the app.
 */
async function watchNotes(page: Page, selector: string, animation: string): Promise<void> {
  await page.evaluate(
    ([sel, anim]) => {
      const el = document.querySelector(sel) as HTMLElement;
      (window as any).__notes = 0;
      el.addEventListener('animationstart', (e) => {
        if ((e as AnimationEvent).animationName === anim) (window as any).__notes++;
      });
    },
    [selector, animation],
  );
}

const noteCount = (page: Page) => page.evaluate(() => (window as any).__notes as number);
const resetNotes = (page: Page) => page.evaluate(() => ((window as any).__notes = 0));

async function setAutoplay(page: Page, prefix: string, on: boolean): Promise<void> {
  const box = page.locator(`#${prefix}-edit-autoplay`);
  await box.setChecked(on);
  await box.dispatchEvent('input');
}

test.beforeEach(async ({ page }) => {
  await startExperience(page);
});

test('every generator dialog exposes an Autoplay toggle, on by default', async ({ page }) => {
  for (const [label, selector, prefix] of [
    ['Orb', '.orb-element', 'orb'],
    ['Deep Pad', '.deeppad-element', 'pad'],
    ['Ethereal Wind', '.etheralwind-element', 'wind'],
    ['Power Synth', '.powersynth-element', 'ps'],
  ] as const) {
    await spawnViaClick(page, label);
    await page.locator(selector).click({ button: 'right' });
    await expect(page.locator(`#${prefix}-edit-autoplay`)).toBeChecked();
    await page.locator(`#${prefix}-edit-close`).click();
  }
});

test('the pitched generators expose scale and range, Ethereal Wind does not', async ({ page }) => {
  await spawnViaClick(page, 'Orb');
  await page.locator('.orb-element').click({ button: 'right' });
  await expect(page.locator('#orb-edit-scale')).toHaveValue('major-pentatonic');
  await expect(page.locator('#orb-edit-root')).toHaveValue('C');
  await expect(page.locator('#orb-edit-octave-value')).toHaveText('3');
  await expect(page.locator('#orb-edit-range-value')).toHaveText('3 oct');
  await expect(page.locator('#orb-edit-scale option')).toHaveCount(10);
  await page.locator('#orb-edit-close').click();

  await spawnViaClick(page, 'Ethereal Wind');
  await page.locator('.etheralwind-element').click({ button: 'right' });
  await expect(page.locator('#wind-edit-autoplay')).toBeVisible();
  await expect(page.locator('#wind-edit-scale')).toHaveCount(0);
  await expect(page.locator('#wind-edit-range')).toHaveCount(0);
});

test('Deep Pad starts an octave lower than the Orb', async ({ page }) => {
  await spawnViaClick(page, 'Deep Pad');
  await page.locator('.deeppad-element').click({ button: 'right' });
  await expect(page.locator('#pad-edit-octave-value')).toHaveText('1');
  await expect(page.locator('#pad-edit-range-value')).toHaveText('2 oct');
});

test('turning autoplay off stops the note loop, and back on restarts it', async ({ page }) => {
  await spawnViaClick(page, 'Orb');
  await watchNotes(page, '.orb-element', 'orbNotePulse');

  await page.waitForTimeout(1200);
  expect(await noteCount(page), 'playing while autoplay is on').toBeGreaterThan(0);

  await page.locator('.orb-element').click({ button: 'right' });
  await setAutoplay(page, 'orb', false);
  await page.locator('#orb-edit-close').click();

  // Let any already-scheduled note land before we start counting.
  await page.waitForTimeout(700);
  await resetNotes(page);
  await page.waitForTimeout(1500);
  expect(await noteCount(page), 'silent while autoplay is off').toBe(0);

  await page.locator('.orb-element').click({ button: 'right' });
  await setAutoplay(page, 'orb', true);
  await page.locator('#orb-edit-close').click();

  await page.waitForTimeout(1200);
  expect(await noteCount(page), 'playing again').toBeGreaterThan(0);
});

test('with autoplay off, clicking a generator plays exactly one note', async ({ page }) => {
  await spawnViaClick(page, 'Orb');
  await page.locator('.orb-element').click({ button: 'right' });
  await setAutoplay(page, 'orb', false);
  await page.locator('#orb-edit-close').click();

  await page.waitForTimeout(700);
  await watchNotes(page, '.orb-element', 'orbNotePulse');
  await resetNotes(page);

  await page.locator('.orb-element').click();
  await page.waitForTimeout(300);
  expect(await noteCount(page)).toBe(1);

  await page.locator('.orb-element').click();
  await page.waitForTimeout(300);
  expect(await noteCount(page)).toBe(2);
});

test('dragging a silent generator moves it without playing a note', async ({ page }) => {
  await spawnViaClick(page, 'Orb');
  await page.locator('.orb-element').click({ button: 'right' });
  await setAutoplay(page, 'orb', false);
  await page.locator('#orb-edit-close').click();

  await page.waitForTimeout(700);
  await watchNotes(page, '.orb-element', 'orbNotePulse');
  await resetNotes(page);

  const box = (await page.locator('.orb-element').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 60, { steps: 12 });
  await page.mouse.up();

  await page.waitForTimeout(300);
  expect(await noteCount(page), 'a drag is not a tap').toBe(0);
});

test('autoplay off silences the Power Synth, and clicking still plays it', async ({ page }) => {
  await spawnViaClick(page, 'Power Synth');
  await expect(page.locator('.powersynth-element')).not.toHaveClass(/powersynth-loading/, {
    timeout: 10_000,
  });
  await watchNotes(page, '.powersynth-element', 'psNotePulse');

  await page.locator('.powersynth-element').click({ button: 'right' });
  await setAutoplay(page, 'ps', false);
  await page.locator('#ps-edit-close').click();

  await page.waitForTimeout(700);
  await resetNotes(page);
  await page.waitForTimeout(1500);
  expect(await noteCount(page), 'silent while autoplay is off').toBe(0);

  await page.locator('.powersynth-element').click();
  await page.waitForTimeout(300);
  expect(await noteCount(page)).toBe(1);
});

test('changing scale and range raises no console error', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await spawnViaClick(page, 'Orb');
  await page.locator('.orb-element').click({ button: 'right' });

  await page.locator('#orb-edit-scale').selectOption('harmonic-minor');
  await page.locator('#orb-edit-root').selectOption('F#');
  await expect(page.locator('#orb-edit-scale')).toHaveValue('harmonic-minor');

  // Shrinking the pool has to re-clamp noteIdx, or the walk indexes past the end.
  await page.locator('#orb-edit-range').fill('1');
  await page.locator('#orb-edit-range').dispatchEvent('input');
  await expect(page.locator('#orb-edit-range-value')).toHaveText('1 oct');

  await page.locator('#orb-edit-octave').fill('6');
  await page.locator('#orb-edit-octave').dispatchEvent('input');
  await page.locator('#orb-edit-close').click();

  // Long enough for several notes to fire from the newly built pool.
  await page.waitForTimeout(2000);
  expect(errors).toEqual([]);
});
