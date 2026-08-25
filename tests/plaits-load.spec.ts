import { test, expect } from '@playwright/test';
import { startExperience } from './helpers';

test('starting the experience fetches the Plaits wasm from the base path', async ({ page }) => {
  const wasmResponse = page.waitForResponse(
    (res) => res.url().endsWith('/generative-audio-browser/plaits.wasm'),
    { timeout: 10_000 },
  );

  await startExperience(page);

  const res = await wasmResponse;
  expect(res.status()).toBe(200);
});

test('starting the experience registers the Plaits worklet without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await startExperience(page);
  // Give the fetch + addModule round trip time to fail if it is going to.
  await page.waitForTimeout(2000);

  expect(errors).toEqual([]);
});
