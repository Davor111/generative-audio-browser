import { expect, type Page } from '@playwright/test';

export const ELEMENT_TYPES = [
  { type: 'orb', label: 'Orb', elementClass: 'orb-element' },
  { type: 'timewarp', label: 'Time Warp', elementClass: 'timewarp-element' },
  { type: 'deeppad', label: 'Deep Pad', elementClass: 'deeppad-element' },
  { type: 'woah', label: 'Woah', elementClass: 'woah-element' },
  { type: 'etheralwind', label: 'Ethereal Wind', elementClass: 'etheralwind-element' },
  { type: 'modulator', label: 'Modulator', elementClass: 'modulator-element' },
  { type: 'orbit', label: 'Orbit', elementClass: 'orbit-element' },
  { type: 'powersynth', label: 'Power Synth', elementClass: 'powersynth-element' },
] as const;

/** Navigates to the app and clicks through the start overlay so audio (and spawning) is unlocked. */
export async function startExperience(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: '▶ Start Experience' }).click();
  await expect(page.locator('#start-overlay')).toHaveClass(/hidden/);
}

/** Clicks a toolbar button to place one of that element type at a random canvas position. */
export async function spawnViaClick(page: Page, label: string): Promise<void> {
  await page.getByRole('button', { name: label, exact: true }).click();

  // Every element plays a ~0.4-0.5s spawn-in animation (scale 0 -> 1). A
  // boundingBox() taken mid-animation (or on the very first frame, where the
  // box is still zero-sized) is unreliable for pointer-based drag targeting,
  // so wait for it to finish before handing control back to the test.
  await page.waitForTimeout(600);
}
