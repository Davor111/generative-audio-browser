import { test, expect } from '@playwright/test';
import { buildScale, SCALES, SCALE_OPTIONS, ROOT_OPTIONS } from '../src/ts/scales';

// Pure unit tests — scales.ts deliberately avoids Tone, so it needs no browser.

/** The pool that was hardcoded as MUSIC.NOTES before scales existed. */
const LEGACY_NOTES = [
  'C3', 'D3', 'E3', 'G3', 'A3',
  'C4', 'D4', 'E4', 'G4', 'A4',
  'C5', 'D5', 'E5', 'G5', 'A5',
];

test('the Orb/Power Synth defaults reproduce the original hardcoded pool', () => {
  expect(buildScale('C', 3, 'major-pentatonic', 3)).toEqual(LEGACY_NOTES);
});

test('range controls how many octaves above the root are included', () => {
  expect(buildScale('C', 3, 'major-pentatonic', 1)).toEqual(['C3', 'D3', 'E3', 'G3', 'A3']);
  expect(buildScale('C', 3, 'major-pentatonic', 2)).toHaveLength(10);
  // The octave above the top one is excluded — the pool ends at A5, not C6.
  expect(buildScale('C', 3, 'major-pentatonic', 3)).not.toContain('C6');
});

test('the root sets both the pitch class and the starting octave', () => {
  expect(buildScale('A', 3, 'minor', 1)).toEqual(['A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4']);
  expect(buildScale('F#', 2, 'major-pentatonic', 1)).toEqual(['F#2', 'G#2', 'A#2', 'C#3', 'D#3']);
});

test('every offered scale has intervals and starts on the root', () => {
  for (const [id, label] of SCALE_OPTIONS) {
    expect(SCALES[id], `${label} has intervals`).toBeDefined();
    expect(SCALES[id][0], `${label} starts on the root`).toBe(0);
    expect(buildScale('C', 3, id, 1)[0], `${label} builds from the root`).toBe('C3');
  }
});

test('every offered root builds a pool', () => {
  for (const [root] of ROOT_OPTIONS) {
    expect(buildScale(root, 3, 'major', 1)).toHaveLength(7);
  }
});

test('an unknown scale falls back rather than producing an empty pool', () => {
  expect(buildScale('C', 3, 'not-a-scale', 1)).toEqual(['C3', 'D3', 'E3', 'G3', 'A3']);
});

test('a range running past MIDI 127 is clamped but never left empty', () => {
  const pool = buildScale('C', 9, 'major', 3);
  expect(pool.length).toBeGreaterThan(0);
  // G9 is MIDI 127; nothing above it can exist.
  expect(pool).not.toContain('A9');
  expect(buildScale('C', 10, 'major', 1).length).toBeGreaterThan(0);
});
