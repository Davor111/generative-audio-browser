import { test, expect } from '@playwright/test';

test('shows the start overlay on load', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#start-overlay')).toBeVisible();
  await expect(page.locator('#start-overlay')).not.toHaveClass(/hidden/);
});

test('clicking Start hides the overlay and unlocks spawning', async ({ page }) => {
  await page.goto('/');

  // Before audio starts, clicking a toolbar button must not place anything.
  await page.getByRole('button', { name: 'Orb', exact: true }).click();
  await expect(page.locator('.orb-element')).toHaveCount(0);

  await page.getByRole('button', { name: '▶ Start Experience' }).click();
  await expect(page.locator('#start-overlay')).toHaveClass(/hidden/);

  await page.getByRole('button', { name: 'Orb', exact: true }).click();
  await expect(page.locator('.orb-element')).toHaveCount(1);
});
