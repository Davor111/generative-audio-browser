# Power Synth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Power Synth" generator element whose sound comes from the Mutable Instruments Plaits DSP running as WebAssembly in an `AudioWorklet`, with Orb-style note triggering and a right-click dialog exposing Plaits' 24 engines and its full parameter set.

**Architecture:** One `AudioWorkletNode` per element — a single monophonic Plaits voice — created on Tone's own `AudioContext` so it feeds the existing `masterReverb → limiter` chain and the Woah sends. A new `src/ts/plaits.ts` owns all wasm/worklet concerns; `audio-engine.ts` stays purely Tone.js. The wasm is fetched eagerly-but-non-blocking from `startAudio()`, so `spawnPowerSynth` can stay synchronous like every other spawn function while its voice attaches asynchronously.

**Tech Stack:** TypeScript, Vite 6, Tone.js 15, raw Web Audio `AudioWorklet`, WebAssembly, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-24-power-synth-design.md`

## Global Constraints

- Element type id is exactly `'powersynth'` — lowercase, no separator. Used in `data-element`, the drag `dataTransfer` payload, and the drop-handler switch.
- CSS classes: `powersynth-element` (placed), `powersynth-preview` (toolbar swatch), plus shared state modifiers `is-dragging`, `warped`, `woah-affected`, `mod-affected`, and element-local `powersynth-loading` / `powersynth-error`.
- Dialog element ids use the `ps-edit-` prefix (`#ps-edit-dialog`, `#ps-edit-harmonics`, …). Readout spans are `<input-id>-value`.
- `npx tsc --noEmit` must exit 0 after every task. It is clean on `main` today; `yarn build` does **not** run it, so it must be run explicitly.
- Asset URLs must be built from `import.meta.env.BASE_URL` — the site deploys under `/generative-audio-browser/`. `plaits.ts` needs `/// <reference types="vite/client" />` as its first line for `import.meta.env` to type-check.
- Tests are black-box: DOM/class/count assertions only. Never inspect `SOUND` internals or audio signals.
- `public/plaits-worklet.js` is vendored from `mi-plaits-wasm/web/worklet.js` and differs from upstream **only** by the `stop` message. Do not otherwise refactor it — its wasm-bytes-over-postMessage transport is a deliberate Chromium workaround.
- Commit after every task.

---

### Task 1: Vendor the wasm assets and build the Plaits loader

**Files:**
- Create: `public/plaits.wasm` (copied binary)
- Create: `public/plaits-worklet.js` (copied, plus the `stop` message)
- Create: `src/ts/plaits.ts`
- Modify: `src/app.ts` (call `initPlaits()` from `startAudio`)
- Test: `tests/plaits-load.spec.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `PARAMS: Record<string, number>` — param id map
  - `ENGINE_NAMES: string[]` — 24 names, index-aligned with `PARAMS.ENGINE`
  - `initPlaits(): Promise<ArrayBuffer>`
  - `createPlaitsVoice(outputNode: Gain): Promise<PlaitsVoice>`
  - `interface PlaitsVoice { setParam(id: number, value: number): void; setParamIfChanged(id: number, value: number, epsilon?: number): void; setMix(value: number): void; dispose(): void; }`

- [ ] **Step 1: Copy the vendored assets**

```bash
cp /Users/mid1mu20/playground/mi-plaits-wasm/web/plaits.wasm public/plaits.wasm
cp /Users/mid1mu20/playground/mi-plaits-wasm/web/worklet.js public/plaits-worklet.js
ls -lh public/plaits.wasm public/plaits-worklet.js
```

Expected: `plaits.wasm` around 293K, `plaits-worklet.js` around 3K.

- [ ] **Step 2: Add the `stop` message to the vendored worklet**

Upstream's `process()` returns `true` unconditionally, so a disconnected node keeps rendering DSP forever. Without this, every erased Power Synth leaks a live wasm voice.

In `public/plaits-worklet.js`, extend the header comment, add `this.stopped = false;` to the constructor, add the `stop` case, and change the `process()` return.

Constructor — add after `this.mix = 0;`:

```js
    this.stopped = false;
```

`onMessage` — add before the closing `}` of the `switch`:

```js
      // Local addition (not upstream): without this, a disconnected node keeps
      // rendering Plaits DSP forever, because process() otherwise always
      // returns true. The demo page never removes a voice, so upstream never
      // needed it. Send this before dropping the last reference to a node.
      case 'stop':
        if (this.ready) {
          this.x.plaits_free(this.synth);
          this.ready = false;
        }
        this.stopped = true;
        break;
```

`process()` — replace the two `return true;` statements with `return !this.stopped;`:

```js
    if (!this.ready || frames !== BLOCK) {
      for (const channel of channels) channel.fill(0);
      return !this.stopped;
    }
```

and the final one:

```js
    return !this.stopped;
  }
```

- [ ] **Step 3: Write the failing test**

Create `tests/plaits-load.spec.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx playwright test tests/plaits-load.spec.ts`
Expected: FAIL — the first test times out waiting for a `plaits.wasm` response that nothing requests.

- [ ] **Step 5: Write `src/ts/plaits.ts`**

```ts
/// <reference types="vite/client" />
import { Gain, connect, getContext } from 'tone';

/**
 * Mirrors `mi-plaits-wasm/src/params.rs`. Keep in sync — the Rust side ignores
 * unknown ids, so a stale `.wasm` degrades quietly rather than crashing.
 */
export const PARAMS = {
  ENGINE: 0, NOTE: 1, HARMONICS: 2, TIMBRE: 3, MORPH: 4,
  DECAY: 5, LPG_COLOUR: 6, FM_AMOUNT: 7,
  TIMBRE_MOD_AMOUNT: 8, MORPH_MOD_AMOUNT: 9,
  MOD_ENGINE: 16, MOD_NOTE: 17, MOD_FREQUENCY: 18, MOD_HARMONICS: 19,
  MOD_TIMBRE: 20, MOD_MORPH: 21, MOD_TRIGGER: 22, MOD_LEVEL: 23,
  FREQUENCY_PATCHED: 32, TIMBRE_PATCHED: 33, MORPH_PATCHED: 34,
  TRIGGER_PATCHED: 35, LEVEL_PATCHED: 36,
} as const;

/** Index-aligned with the ENGINE param. */
export const ENGINE_NAMES = [
  'virtual analog VCF', 'phase distortion', 'six-op FM 1', 'six-op FM 2',
  'six-op FM 3', 'wave terrain', 'string machine', 'chiptune',
  'virtual analog', 'waveshaping', 'FM', 'grain',
  'additive', 'wavetable', 'chord', 'speech',
  'swarm', 'noise', 'particle', 'string',
  'modal', 'bass drum', 'snare drum', 'hi-hat',
];

const WASM_URL = `${import.meta.env.BASE_URL}plaits.wasm`;
const WORKLET_URL = `${import.meta.env.BASE_URL}plaits-worklet.js`;

const READY_TIMEOUT_MS = 5000;

let loadPromise: Promise<ArrayBuffer> | null = null;

/**
 * Fetches the wasm and registers the worklet module, caching the promise so
 * concurrent and later callers share one load. Called (unawaited) from
 * startAudio(), so the ~300KB fetch overlaps the start overlay dismissing
 * instead of delaying it.
 */
export function initPlaits(): Promise<ArrayBuffer> {
  if (!loadPromise) {
    loadPromise = (async () => {
      const [res] = await Promise.all([
        fetch(WASM_URL),
        getContext().addAudioWorkletModule(WORKLET_URL),
      ]);
      if (!res.ok) {
        throw new Error(`failed to fetch plaits.wasm: ${res.status} ${res.statusText}`);
      }
      return res.arrayBuffer();
    })();
    // Callers handle rejection themselves; this only stops an unhandled
    // rejection warning while nothing is awaiting the cached promise yet.
    loadPromise.catch(() => {});
  }
  return loadPromise;
}

export interface PlaitsVoice {
  setParam(id: number, value: number): void;
  setParamIfChanged(id: number, value: number, epsilon?: number): void;
  setMix(value: number): void;
  dispose(): void;
}

/**
 * Creates one monophonic Plaits voice and connects it into `outputNode`.
 *
 * The caller owns `outputNode` and must create it first: spawnPowerSynth is
 * synchronous and needs a real Tone.Gain to register Woah sends against long
 * before the wasm has loaded.
 */
export async function createPlaitsVoice(outputNode: Gain): Promise<PlaitsVoice> {
  const bytes = await initPlaits();
  const rawContext = getContext().rawContext as unknown as BaseAudioContext;

  const node = new AudioWorkletNode(rawContext, 'plaits', { outputChannelCount: [2] });
  connect(node, outputNode);

  // postMessage without a transfer list structured-clones the buffer, so one
  // fetched ArrayBuffer safely seeds every voice.
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('plaits worklet did not report ready')),
      READY_TIMEOUT_MS,
    );
    node.port.onmessage = (event: MessageEvent) => {
      if (event.data?.type === 'ready') {
        clearTimeout(timer);
        resolve();
      }
    };
    node.port.postMessage({ type: 'wasm', bytes });
  });

  const lastSent = new Map<number, number>();

  const setParam = (id: number, value: number): void => {
    lastSent.set(id, value);
    node.port.postMessage({ type: 'param', id, value });
  };

  // Patching trigger and level is what keeps the voice silent at rest:
  // MOD_TRIGGER and MOD_LEVEL stay at 0 until a note fires, so the voice
  // gates instead of droning continuously.
  setParam(PARAMS.TRIGGER_PATCHED, 1);
  setParam(PARAMS.LEVEL_PATCHED, 1);

  return {
    setParam,

    /**
     * The postMessage equivalent of proximity.ts's rampToIfChanged: the
     * proximity loop writes every frame, and most frames carry no real change.
     */
    setParamIfChanged(id: number, value: number, epsilon = 0.001): void {
      const last = lastSent.get(id);
      if (last !== undefined && Math.abs(last - value) < epsilon) return;
      setParam(id, value);
    },

    setMix(value: number): void {
      node.port.postMessage({ type: 'mix', value });
    },

    dispose(): void {
      // The stop message is what actually ends DSP rendering; disconnecting
      // alone would leave the processor running forever.
      node.port.postMessage({ type: 'stop' });
      node.port.onmessage = null;
      node.disconnect();
    },
  };
}
```

- [ ] **Step 6: Call `initPlaits()` from `startAudio`**

In `src/app.ts`, add to the import block:

```ts
import { initPlaits } from './ts/plaits';
```

and in `startAudio()`, after `initAudioEngine();`:

```ts
  // Eager but non-blocking: the ~300KB wasm fetch overlaps the overlay
  // dismissing rather than delaying it. spawnPowerSynth awaits the same
  // cached promise, so a very early spawn simply waits.
  initPlaits().catch((err) => {
    console.error('Plaits engine failed to load', err);
  });
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx playwright test tests/plaits-load.spec.ts && npx tsc --noEmit`
Expected: 2 passed, tsc exits 0.

- [ ] **Step 8: Commit**

```bash
git add public/plaits.wasm public/plaits-worklet.js src/ts/plaits.ts src/app.ts tests/plaits-load.spec.ts
git commit -m "Add the Plaits wasm engine loader

Vendors plaits.wasm and the AudioWorklet processor from mi-plaits-wasm,
with one local addition: a stop message, because upstream's process()
returns true unconditionally and would leak a live voice per erased
element. Loaded eagerly but non-blocking from startAudio."
```

---

### Task 2: Register the element type and its visuals

Everything except sound: the type is spawnable, draggable, and erasable, and renders as a distinct element. No audio yet — that keeps the visual/wiring review separate from the DSP review.

**Files:**
- Create: `src/css/powersynth.css`
- Modify: `style.css` (one `@import`)
- Modify: `index.html` (toolbar button)
- Modify: `src/css/variables.css` (colour tokens)
- Modify: `src/types.d.ts` (`PowerSynthState`, union members)
- Modify: `src/ts/state.ts` (`SOUND.powersynths`)
- Modify: `src/ts/elements.ts` (`spawnPowerSynth`, `removePowerSynth`)
- Modify: `src/app.ts` (drop case, toolbar drag + click wiring)
- Test: `tests/helpers.ts` (`ELEMENT_TYPES` entry)

**Interfaces:**
- Consumes: nothing from Task 1 yet (the voice attaches in Task 3).
- Produces:
  - `spawnPowerSynth(x: number, y: number): PowerSynthState`
  - `removePowerSynth(ps: PowerSynthState): void`
  - `PowerSynthState` with fields: `el`, `voice`, `outputNode`, `noteIdx`, `noteDuration`, `noteIntervalMs`, `engine`, `baseTimbre`, `baseMorph`, `mix`, `warped`, `woahAffected`, `modAffected`, `woahSends`, `timerId`, `releaseTimerId`, `disposed`
  - `DOM.toolbarPowersynthBtn`

- [ ] **Step 1: Write the failing test**

Add the entry to `ELEMENT_TYPES` in `tests/helpers.ts`, which extends the table-driven spawn test in `spawn-elements.spec.ts` automatically:

```ts
  { type: 'orbit', label: 'Orbit', elementClass: 'orbit-element' },
  { type: 'powersynth', label: 'Power Synth', elementClass: 'powersynth-element' },
] as const;
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test tests/spawn-elements.spec.ts`
Expected: FAIL — `clicking the Power Synth toolbar button places one powersynth-element` fails because no such toolbar button exists.

- [ ] **Step 3: Add the colour tokens**

In `src/css/variables.css`, after the Orbit colours block:

```css
  /* Power Synth colours (Acid Lime / Plaits) */
  --ps-core: hsl(78, 95%, 58%);
  --ps-glow: hsl(88, 85%, 40%);
  --ps-accent: hsl(60, 100%, 72%);
```

Hue 78 is unused: Orb is 258, Time Warp 190, Deep Pad 28, Woah 155, Wind 205, Modulator 340, Orbit 45.

- [ ] **Step 4: Create `src/css/powersynth.css`**

A hexagon, so it reads as a hardware module rather than another glowing ball.

```css
/* ──────────────────────────────────────────────
   Power Synth — Toolbar Preview
   ────────────────────────────────────────────── */
.powersynth-preview {
  clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);
  border-radius: 0;
  background: linear-gradient(145deg,
      var(--ps-accent) 0%,
      var(--ps-core) 45%,
      var(--ps-glow) 100%);
  box-shadow:
    0 0 10px hsla(78, 90%, 50%, 0.5),
    0 0 24px hsla(88, 80%, 42%, 0.25);
  animation: preview-pulse 2.4s ease-in-out infinite;
}

/* ──────────────────────────────────────────────
   Power Synth Element (on canvas)
   ────────────────────────────────────────────── */
.powersynth-element {
  position: absolute;
  width: 64px;
  height: 64px;
  cursor: grab;
  transform: translate(-50%, -50%) scale(1);
  filter: url(#bloom-filter);
  animation: psSpawnIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
  will-change: transform, box-shadow;
  transition: box-shadow 0.15s ease;
  touch-action: none;
  user-select: none;
}

.powersynth-element:active,
.powersynth-element.is-dragging {
  cursor: grabbing;
}

@keyframes psSpawnIn {
  from {
    transform: translate(-50%, -50%) scale(0);
    opacity: 0;
  }

  to {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
}

/* Hexagonal body */
.powersynth-element::before {
  content: '';
  position: absolute;
  inset: 0;
  clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);
  background: linear-gradient(145deg,
      var(--ps-accent) 0%,
      var(--ps-core) 45%,
      var(--ps-glow) 100%);
}

/* Inner core, offset so the body reads as a shell around it */
.powersynth-element::after {
  content: '';
  position: absolute;
  inset: 34%;
  border-radius: 50%;
  background: var(--ps-accent);
  box-shadow: 0 0 12px 3px hsla(60, 100%, 70%, 0.7);
  animation: psCorePulse 2.2s ease-in-out infinite;
}

@keyframes psCorePulse {

  0%,
  100% {
    opacity: 0.55;
    transform: scale(1);
  }

  50% {
    opacity: 1;
    transform: scale(1.25);
  }
}

/* Note pulsate — plays on each note trigger */
.powersynth-element.note-pulse {
  animation: psNotePulse 0.32s cubic-bezier(0.22, 1, 0.36, 1);
  box-shadow:
    0 0 22px 6px hsla(78, 90%, 58%, 0.6),
    0 0 48px 12px hsla(88, 80%, 42%, 0.3);
}

@keyframes psNotePulse {
  0% {
    transform: translate(-50%, -50%) scale(1);
  }

  40% {
    transform: translate(-50%, -50%) scale(1.28) rotate(6deg);
  }

  100% {
    transform: translate(-50%, -50%) scale(1);
  }
}

/* Waiting on the wasm engine — dimmed and slowly breathing */
.powersynth-element.powersynth-loading {
  animation: psLoading 1.1s ease-in-out infinite alternate;
}

@keyframes psLoading {
  from {
    opacity: 0.3;
  }

  to {
    opacity: 0.65;
  }
}

/* Engine failed to load — desaturated, but still draggable and erasable */
.powersynth-element.powersynth-error::before {
  background: linear-gradient(145deg,
      hsl(0, 0%, 55%) 0%,
      hsl(0, 0%, 38%) 45%,
      hsl(0, 0%, 22%) 100%);
}

.powersynth-element.powersynth-error::after {
  animation: none;
  background: hsl(0, 70%, 55%);
  box-shadow: 0 0 10px 2px hsla(0, 80%, 50%, 0.6);
}

/* State modifiers driven by the proximity loop */
.powersynth-element.warped::before {
  filter: hue-rotate(-40deg) saturate(1.3);
}

.powersynth-element.mod-affected {
  box-shadow: 0 0 26px 8px hsla(340, 90%, 55%, 0.45);
}

.powersynth-element.woah-affected::after {
  box-shadow: 0 0 18px 5px hsla(155, 95%, 55%, 0.75);
}

/* Hover hint — "right click to edit" */
.powersynth-edit-hint {
  position: absolute;
  left: 50%;
  top: calc(100% + 10px);
  transform: translateX(-50%);
  white-space: nowrap;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.01em;
  color: var(--text-primary);
  background: var(--bg-surface);
  border: 1px solid var(--toolbar-border);
  border-radius: var(--radius-sm);
  padding: 4px 9px;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--transition-fast);
  z-index: 10;
}

.powersynth-element:hover .powersynth-edit-hint {
  opacity: 1;
}
```

- [ ] **Step 5: Import the stylesheet**

In `style.css`, after the `orbit.css` import:

```css
@import './src/css/powersynth.css';
```

- [ ] **Step 6: Add the toolbar button**

In `index.html`, inside the Generators `.toolbar-category-items`, after the Ethereal Wind button:

```html
          <button class="toolbar-btn" data-element="powersynth" draggable="true" id="toolbar-powersynth">
            <span class="toolbar-preview powersynth-preview"></span>
            <span class="toolbar-label">Power Synth</span>
          </button>
```

- [ ] **Step 7: Add the type**

In `src/types.d.ts`, add the import for the voice handle at the top:

```ts
import type { PlaitsVoice } from './ts/plaits';
```

Add the interface after `EtherealWindState`:

```ts
export interface PowerSynthState {
  el: HTMLDivElement;
  /** Null until the wasm engine finishes loading, or forever if it failed. */
  voice: PlaitsVoice | null;
  outputNode: Gain;
  noteIdx: number;
  noteDuration: string;
  noteIntervalMs: number;
  engine: number;
  /**
   * The dialog writes these; the proximity loop is the only thing that writes
   * the actual TIMBRE/MORPH params, deriving them from these plus modulator
   * proximity. Keeping them separate stops the two from overwriting each other.
   */
  baseTimbre: number;
  baseMorph: number;
  mix: number;
  warped: boolean;
  woahAffected: boolean;
  modAffected: boolean;
  woahSends: Map<WoahState, Gain>;
  timerId: ReturnType<typeof setTimeout> | null;
  releaseTimerId: ReturnType<typeof setTimeout> | null;
  /** Set by removePowerSynth so a voice still loading is discarded on arrival. */
  disposed: boolean;
}
```

Add `powersynths: PowerSynthState[];` to `SoundState` after `orbits`, and extend the two unions:

```ts
export type SoundSource = OrbState | DeepPadState | EtherealWindState | PowerSynthState;
export type OrbitableElement =
  | OrbState
  | DeepPadState
  | TimewarpState
  | WoahState
  | EtherealWindState
  | ModulatorState
  | PowerSynthState;
```

- [ ] **Step 8: Add the state entries**

In `src/ts/state.ts`, add the DOM ref after `toolbarOrbitBtn`:

```ts
  toolbarPowersynthBtn: document.getElementById('toolbar-powersynth') as HTMLButtonElement,
```

and add to `SOUND`, after `orbits: []`:

```ts
  powersynths: [],
```

- [ ] **Step 9: Write `spawnPowerSynth` and `removePowerSynth`**

In `src/ts/elements.ts`, add `PowerSynthState` to the type import block, then append:

```ts
export function spawnPowerSynth(x: number, y: number): PowerSynthState {
  const el = document.createElement('div');
  el.classList.add('powersynth-element', 'powersynth-loading');
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;

  DOM.container.appendChild(el);

  const editHint = document.createElement('span');
  editHint.classList.add('powersynth-edit-hint');
  editHint.textContent = 'right click to edit';
  el.appendChild(editHint);

  // The output gain exists before the voice does: spawn is synchronous, so
  // Woah sends and element state have to be wired up now, while the wasm may
  // still be loading.
  const outputNode = new Gain(1).connect(SOUND.limiter!);

  const powerSynth: PowerSynthState = {
    el,
    voice: null,
    outputNode,
    noteIdx: Math.floor(Math.random() * MUSIC.NOTES.length),
    noteDuration: '8n',
    noteIntervalMs: MUSIC.NOTE_INTERVAL_MS,
    engine: 8,
    baseTimbre: 0.5,
    baseMorph: 0.5,
    mix: 0,
    warped: false,
    woahAffected: false,
    modAffected: false,
    woahSends: new Map(),
    timerId: null,
    releaseTimerId: null,
    disposed: false,
  };

  for (const woah of SOUND.woahs) {
    registerSourceToWoah(powerSynth, woah);
  }

  makeDraggable(el, { onErase: () => removePowerSynth(powerSynth) });

  SOUND.powersynths.push(powerSynth);
  return powerSynth;
}

export function removePowerSynth(powerSynth: PowerSynthState): void {
  powerSynth.disposed = true;
  if (powerSynth.timerId !== null) clearTimeout(powerSynth.timerId);
  if (powerSynth.releaseTimerId !== null) clearTimeout(powerSynth.releaseTimerId);
  for (const gain of powerSynth.woahSends.values()) gain.dispose();
  powerSynth.voice?.dispose();
  powerSynth.outputNode.dispose();
  powerSynth.el.remove();
  const idx = SOUND.powersynths.indexOf(powerSynth);
  if (idx !== -1) SOUND.powersynths.splice(idx, 1);
}
```

Engine 8 (virtual analog) is the default because it is sustained, forgiving, and speaks on every note — a percussive default like bass drum would make a new element sound broken.

- [ ] **Step 10: Wire it into `app.ts`**

Add `spawnPowerSynth` to the `./ts/elements` import block. Add the drop case after `case 'orbit':`:

```ts
    case 'powersynth':
      spawnPowerSynth(x, y);
      break;
```

Add the two wiring lines alongside their neighbours:

```ts
setupToolbarDrag(DOM.toolbarPowersynthBtn, 'powersynth');
```

```ts
setupToolbarClick(DOM.toolbarPowersynthBtn, spawnPowerSynth);
```

- [ ] **Step 11: Run the tests to verify they pass**

Run: `npx playwright test tests/spawn-elements.spec.ts && npx tsc --noEmit`
Expected: all spawn tests pass including the new Power Synth row; tsc exits 0.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "Add the Power Synth element type and its visuals

Spawnable, draggable and erasable, with a hexagonal acid-lime body that
distinguishes it from the round generators. No audio yet."
```

---

### Task 3: Attach the Plaits voice and the note loop

**Files:**
- Modify: `src/ts/elements.ts` (`spawnPowerSynth` async tail, note scheduling)
- Test: `tests/powersynth-voice.spec.ts`

**Interfaces:**
- Consumes: `createPlaitsVoice(outputNode)`, `PARAMS`, `PlaitsVoice` from Task 1; `PowerSynthState`, `spawnPowerSynth`, `removePowerSynth` from Task 2.
- Produces: an element that clears `.powersynth-loading` once its voice attaches, and gains `.note-pulse` on every scheduled note.

- [ ] **Step 1: Write the failing test**

Create `tests/powersynth-voice.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { startExperience, spawnViaClick } from './helpers';

test.beforeEach(async ({ page }) => {
  await startExperience(page);
});

test('a placed power synth finishes loading its engine', async ({ page }) => {
  await spawnViaClick(page, 'Power Synth');

  const powerSynth = page.locator('.powersynth-element');
  await expect(powerSynth).not.toHaveClass(/powersynth-loading/, { timeout: 10_000 });
  await expect(powerSynth).not.toHaveClass(/powersynth-error/);
});

test('a placed power synth pulses on its scheduled notes', async ({ page }) => {
  await spawnViaClick(page, 'Power Synth');

  const powerSynth = page.locator('.powersynth-element');
  await expect(powerSynth).not.toHaveClass(/powersynth-loading/, { timeout: 10_000 });

  // The note-pulse class is added and removed each note, so poll for it
  // rather than asserting on a single instant. The default interval is 500ms.
  await expect
    .poll(
      async () => {
        const seen = await powerSynth.evaluate((el) => el.classList.contains('note-pulse'));
        return seen;
      },
      { timeout: 5000, intervals: [50] },
    )
    .toBe(true);
});

test('erasing a power synth while its engine is still loading leaves nothing behind', async ({ page }) => {
  // Deliberately does NOT wait for loading to finish — this exercises the
  // disposed-during-load path, which is the one race this element has.
  await page.getByRole('button', { name: 'Power Synth', exact: true }).click();

  const powerSynth = page.locator('.powersynth-element');
  await expect(powerSynth).toHaveCount(1);

  await powerSynth.evaluate((el) => el.remove());

  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.waitForTimeout(3000);
  expect(errors).toEqual([]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test tests/powersynth-voice.spec.ts`
Expected: FAIL — `.powersynth-loading` is never removed, because nothing attaches a voice.

- [ ] **Step 3: Add the async tail and note loop**

In `src/ts/elements.ts`, add the imports:

```ts
import { Gain, Frequency, Time } from 'tone';
import { createPlaitsVoice, PARAMS } from './plaits';
```

(`Gain` is already imported — extend that line rather than adding a second import from `'tone'`.)

Then, inside `spawnPowerSynth`, between `makeDraggable(...)` and `SOUND.powersynths.push(...)`:

```ts
  function triggerNote(): void {
    const voice = powerSynth.voice;
    if (!voice) return;

    powerSynth.noteIdx = walkNote(powerSynth.noteIdx, MUSIC.NOTES);
    const midi = Frequency(MUSIC.NOTES[powerSynth.noteIdx]).toMidi();

    // NOTE goes first so the voice picks the pitch up on the rising edge
    // rather than a block late. MOD_LEVEL is what opens the low-pass gate —
    // without it the sustained engines stay inaudible.
    voice.setParam(PARAMS.NOTE, midi);
    voice.setParam(PARAMS.MOD_LEVEL, 1);
    voice.setParam(PARAMS.MOD_TRIGGER, 1);

    if (powerSynth.releaseTimerId !== null) clearTimeout(powerSynth.releaseTimerId);
    powerSynth.releaseTimerId = setTimeout(() => {
      voice.setParam(PARAMS.MOD_TRIGGER, 0);
      voice.setParam(PARAMS.MOD_LEVEL, 0);
    }, Time(powerSynth.noteDuration).toMilliseconds());

    el.classList.remove('note-pulse');
    void el.offsetWidth;
    el.classList.add('note-pulse');
  }

  function scheduleNextNote(): void {
    let interval = powerSynth.noteIntervalMs;
    if (powerSynth.warped) {
      interval = 150 + Math.random() * 700;
    }

    powerSynth.timerId = setTimeout(() => {
      triggerNote();
      scheduleNextNote();
    }, interval);
  }

  void (async () => {
    try {
      const voice = await createPlaitsVoice(outputNode);
      // The element may have been erased while the engine was loading.
      if (powerSynth.disposed) {
        voice.dispose();
        return;
      }
      powerSynth.voice = voice;
      voice.setParam(PARAMS.ENGINE, powerSynth.engine);
      voice.setParam(PARAMS.HARMONICS, 0.5);
      voice.setParam(PARAMS.TIMBRE, powerSynth.baseTimbre);
      voice.setParam(PARAMS.MORPH, powerSynth.baseMorph);
      voice.setParam(PARAMS.DECAY, 0.5);
      voice.setParam(PARAMS.LPG_COLOUR, 0.5);
      voice.setMix(powerSynth.mix);
      el.classList.remove('powersynth-loading');
      scheduleNextNote();
    } catch (err) {
      if (powerSynth.disposed) return;
      console.error('Power Synth engine failed to load', err);
      el.classList.remove('powersynth-loading');
      el.classList.add('powersynth-error');
    }
  })();
```

Note the release timer is cleared before being re-armed: at short intervals with long note lengths, a new note can fire before the previous release, and a stale timer would gate the new note off early.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx playwright test tests/powersynth-voice.spec.ts && npx tsc --noEmit`
Expected: 3 passed, tsc exits 0.

- [ ] **Step 5: Verify audibly in the browser**

Run `yarn dev`, open the app, click Start, place a Power Synth, and confirm it plays a walking melody with no console errors. The Playwright suite deliberately does not assert on audio, so this is the only check that sound actually comes out.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Give the Power Synth its Plaits voice and note loop

Orb-style walking-note scheduler, gating the voice with MOD_TRIGGER and
MOD_LEVEL. Handles both failure paths: erased-while-loading and a failed
engine load."
```

---

### Task 4: Wire the Power Synth into the proximity loop

**Files:**
- Modify: `src/ts/proximity.ts`
- Test: `tests/powersynth-proximity.spec.ts`

**Interfaces:**
- Consumes: `PowerSynthState` (with `baseTimbre`, `baseMorph`, `voice`), `PARAMS`, `SOUND.powersynths`.
- Produces: `warped`, `woah-affected`, `mod-affected` classes toggled on `.powersynth-element`.

- [ ] **Step 1: Write the failing test**

Create `tests/powersynth-proximity.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { startExperience, spawnViaClick } from './helpers';

test.beforeEach(async ({ page }) => {
  await startExperience(page);
});

test('dragging a modulator next to a power synth marks it mod-affected, and moving away clears it', async ({ page }) => {
  await spawnViaClick(page, 'Power Synth');
  await spawnViaClick(page, 'Modulator');

  const powerSynth = page.locator('.powersynth-element');
  const modulator = page.locator('.modulator-element');

  await expect(powerSynth).not.toHaveClass(/powersynth-loading/, { timeout: 10_000 });

  const psBox = await powerSynth.boundingBox();
  const modBox = await modulator.boundingBox();
  if (!psBox || !modBox) throw new Error('power synth or modulator not found');

  await page.mouse.move(modBox.x + modBox.width / 2, modBox.y + modBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(psBox.x + psBox.width / 2 + 20, psBox.y + psBox.height / 2, { steps: 15 });
  await page.mouse.up();

  await expect(powerSynth).toHaveClass(/mod-affected/);

  const canvas = await page.locator('#canvas').boundingBox();
  const farModBox = await modulator.boundingBox();
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
  const timewarp = page.locator('.timewarp-element');

  await expect(powerSynth).not.toHaveClass(/powersynth-loading/, { timeout: 10_000 });

  const psBox = await powerSynth.boundingBox();
  const twBox = await timewarp.boundingBox();
  if (!psBox || !twBox) throw new Error('power synth or time warp not found');

  await page.mouse.move(twBox.x + twBox.width / 2, twBox.y + twBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(psBox.x + psBox.width / 2 + 20, psBox.y + psBox.height / 2, { steps: 15 });
  await page.mouse.up();

  await expect(powerSynth).toHaveClass(/warped/);
});

test('dragging a woah next to a power synth marks it woah-affected', async ({ page }) => {
  await spawnViaClick(page, 'Power Synth');
  await spawnViaClick(page, 'Woah');

  const powerSynth = page.locator('.powersynth-element');
  const woah = page.locator('.woah-element');

  await expect(powerSynth).not.toHaveClass(/powersynth-loading/, { timeout: 10_000 });

  const psBox = await powerSynth.boundingBox();
  const woahBox = await woah.boundingBox();
  if (!psBox || !woahBox) throw new Error('power synth or woah not found');

  await page.mouse.move(woahBox.x + woahBox.width / 2, woahBox.y + woahBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(psBox.x + psBox.width / 2 + 20, psBox.y + psBox.height / 2, { steps: 15 });
  await page.mouse.up();

  await expect(powerSynth).toHaveClass(/woah-affected/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test tests/powersynth-proximity.spec.ts`
Expected: FAIL on all three — no proximity code touches power synths yet.

- [ ] **Step 3: Add the proximity wiring**

In `src/ts/proximity.ts`, add the import:

```ts
import { PARAMS } from './plaits';
```

**3a. Reset flags** — after the `for (const wind of SOUND.etheralwinds)` reset block:

```ts
  for (const ps of SOUND.powersynths) {
    ps.warped = false;
    ps.woahAffected = false;
    ps.modAffected = false;
  }
```

**3b. Orbit** — add to the `orbitableElements` array literal:

```ts
    ...SOUND.powersynths,
```

**3c. Time Warp** — inside the `for (const tw of SOUND.timewarps)` loop, after the `deeppads` block:

```ts
    for (const ps of SOUND.powersynths) {
      const psCenter = getCenter(ps.el);
      const dist = distance(twCenter, psCenter);
      if (dist <= tw.radius) {
        ps.warped = true;
        drawTwConnection(twCenter, psCenter, dist, tw.radius);
      }
    }
```

**3d. Modulator** — after the `for (const dp of SOUND.deeppads)` modulator block:

```ts
  for (const ps of SOUND.powersynths) {
    const psCenter = getCenter(ps.el);
    let maxMod = 0;

    for (const mod of SOUND.modulators) {
      const modCenter = getCenter(mod.el);
      const dist = distance(modCenter, psCenter);
      if (dist <= mod.radius) {
        const modAmount = 1 - (dist / mod.radius);
        if (modAmount > maxMod) maxMod = modAmount;
        drawModConnection(modCenter, psCenter, dist, mod.radius);
      }
    }

    ps.modAffected = maxMod > 0;

    // Plaits has no distortion stage, so the Modulator sweeps the engine's
    // own timbre and morph instead. This loop is the ONLY writer of those two
    // params — the dialog writes baseTimbre/baseMorph, and the effective value
    // is derived here, so the two never fight over the same number.
    if (ps.voice) {
      ps.voice.setParamIfChanged(PARAMS.TIMBRE, Math.min(1, ps.baseTimbre + maxMod * 0.5));
      ps.voice.setParamIfChanged(PARAMS.MORPH, Math.min(1, ps.baseMorph + maxMod * 0.5));
    }
  }
```

**3e. Woah** — add to the `allSoundSources` array literal:

```ts
    ...SOUND.powersynths,
```

**3f. Class toggles** — after the `for (const wind of SOUND.etheralwinds)` toggle block:

```ts
  for (const ps of SOUND.powersynths) {
    ps.el.classList.toggle('warped', ps.warped);
    ps.el.classList.toggle('woah-affected', ps.woahAffected);
    ps.el.classList.toggle('mod-affected', ps.modAffected);
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx playwright test tests/powersynth-proximity.spec.ts && npx tsc --noEmit`
Expected: 3 passed, tsc exits 0.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Wire the Power Synth into the proximity loop

Time Warp, Woah and Orbit behave as they do for Orb. The Modulator sweeps
Plaits' own timbre and morph rather than a distortion stage, since the
worklet chain has none."
```

---

### Task 5: The right-click edit dialog

**Files:**
- Create: `src/ts/powersynth-editor.ts`
- Create: `src/css/ps-edit-dialog.css`
- Modify: `index.html` (dialog markup)
- Modify: `style.css` (one `@import`)
- Modify: `src/ts/state.ts` (four DOM refs)
- Modify: `src/ts/elements.ts` (bind the context menu)
- Modify: `src/app.ts` (`initPowerSynthEditor()`)
- Test: `tests/powersynth-editor.spec.ts`

**Interfaces:**
- Consumes: `PowerSynthState`, `PARAMS`, `ENGINE_NAMES`.
- Produces: `initPowerSynthEditor(): void`, `openPowerSynthEditor(ps: PowerSynthState): void`, `bindPowerSynthContextMenu(ps: PowerSynthState): void`.

- [ ] **Step 1: Write the failing test**

Create `tests/powersynth-editor.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { startExperience, spawnViaClick } from './helpers';

test.beforeEach(async ({ page }) => {
  await startExperience(page);
  await spawnViaClick(page, 'Power Synth');
  await expect(page.locator('.powersynth-element')).not.toHaveClass(
    /powersynth-loading/,
    { timeout: 10_000 },
  );
});

test('shows a hover hint on the power synth', async ({ page }) => {
  const powerSynth = page.locator('.powersynth-element');
  await powerSynth.hover();
  await expect(powerSynth.locator('.powersynth-edit-hint')).toBeVisible();
});

test('right-clicking opens the edit dialog pre-filled with its current values', async ({ page }) => {
  await page.locator('.powersynth-element').click({ button: 'right' });

  const dialog = page.locator('#ps-edit-dialog');
  await expect(dialog).toBeVisible();
  await expect(page.locator('#ps-edit-engine')).toHaveValue('8');
  await expect(page.locator('#ps-edit-note-duration')).toHaveValue('8n');
  await expect(page.locator('#ps-edit-note-interval-value')).toHaveText('500ms');
  await expect(page.locator('#ps-edit-volume-value')).toHaveText('100%');
  await expect(page.locator('#ps-edit-timbre-value')).toHaveText('0.50');
});

test('the engine select offers all 24 Plaits engines', async ({ page }) => {
  await page.locator('.powersynth-element').click({ button: 'right' });
  await expect(page.locator('#ps-edit-engine option')).toHaveCount(24);
});

test('changing the engine updates the select and raises no console error', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.locator('.powersynth-element').click({ button: 'right' });
  await page.locator('#ps-edit-engine').selectOption('13');
  await expect(page.locator('#ps-edit-engine')).toHaveValue('13');

  await page.waitForTimeout(1000);
  expect(errors).toEqual([]);
});

test('moving the harmonics and volume sliders updates their live readouts', async ({ page }) => {
  await page.locator('.powersynth-element').click({ button: 'right' });

  await page.locator('#ps-edit-harmonics').fill('0.8');
  await page.locator('#ps-edit-harmonics').dispatchEvent('input');
  await expect(page.locator('#ps-edit-harmonics-value')).toHaveText('0.80');

  await page.locator('#ps-edit-volume').fill('0.3');
  await page.locator('#ps-edit-volume').dispatchEvent('input');
  await expect(page.locator('#ps-edit-volume-value')).toHaveText('30%');
});

test('the close button closes the dialog', async ({ page }) => {
  await page.locator('.powersynth-element').click({ button: 'right' });

  const dialog = page.locator('#ps-edit-dialog');
  await expect(dialog).toBeVisible();

  await page.locator('#ps-edit-close').click();
  await expect(dialog).toBeHidden();
});

test('clicking the backdrop closes the dialog', async ({ page }) => {
  await page.locator('.powersynth-element').click({ button: 'right' });

  const dialog = page.locator('#ps-edit-dialog');
  await expect(dialog).toBeVisible();

  await dialog.click({ position: { x: 2, y: 2 } });
  await expect(dialog).toBeHidden();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test tests/powersynth-editor.spec.ts`
Expected: FAIL — `#ps-edit-dialog` does not exist.

- [ ] **Step 3: Add the dialog markup**

In `index.html`, after the `#wind-edit-dialog` closing `</dialog>`:

```html
    <dialog id="ps-edit-dialog">
      <form id="ps-edit-form" method="dialog">
        <div class="ps-edit-header">
          <h2>Edit Power Synth</h2>
          <button type="button" id="ps-edit-close" aria-label="Close">&times;</button>
        </div>

        <h3 class="ps-edit-group">Engine</h3>
        <label class="ps-edit-field ps-edit-field-wide">
          <select id="ps-edit-engine"></select>
        </label>
        <p class="ps-edit-note">Engines 2–4 (six-op FM) load a patch bank on switch and may click once.</p>

        <h3 class="ps-edit-group">Timbre</h3>
        <div class="ps-edit-grid">
          <label class="ps-edit-field">
            <span class="ps-edit-label">Harmonics <span class="ps-edit-value" id="ps-edit-harmonics-value"></span></span>
            <input type="range" id="ps-edit-harmonics" min="0" max="1" step="0.01" />
          </label>
          <label class="ps-edit-field">
            <span class="ps-edit-label">Timbre <span class="ps-edit-value" id="ps-edit-timbre-value"></span></span>
            <input type="range" id="ps-edit-timbre" min="0" max="1" step="0.01" />
          </label>
          <label class="ps-edit-field">
            <span class="ps-edit-label">Morph <span class="ps-edit-value" id="ps-edit-morph-value"></span></span>
            <input type="range" id="ps-edit-morph" min="0" max="1" step="0.01" />
          </label>
          <label class="ps-edit-field">
            <span class="ps-edit-label">FM amount <span class="ps-edit-value" id="ps-edit-fm-value"></span></span>
            <input type="range" id="ps-edit-fm" min="0" max="1" step="0.01" />
          </label>
          <label class="ps-edit-field">
            <span class="ps-edit-label">Timbre mod <span class="ps-edit-value" id="ps-edit-timbre-mod-value"></span></span>
            <input type="range" id="ps-edit-timbre-mod" min="0" max="1" step="0.01" />
          </label>
          <label class="ps-edit-field">
            <span class="ps-edit-label">Morph mod <span class="ps-edit-value" id="ps-edit-morph-mod-value"></span></span>
            <input type="range" id="ps-edit-morph-mod" min="0" max="1" step="0.01" />
          </label>
        </div>

        <h3 class="ps-edit-group">Envelope</h3>
        <div class="ps-edit-grid">
          <label class="ps-edit-field">
            <span class="ps-edit-label">Decay <span class="ps-edit-value" id="ps-edit-decay-value"></span></span>
            <input type="range" id="ps-edit-decay" min="0" max="1" step="0.01" />
          </label>
          <label class="ps-edit-field">
            <span class="ps-edit-label">LPG colour <span class="ps-edit-value" id="ps-edit-lpg-value"></span></span>
            <input type="range" id="ps-edit-lpg" min="0" max="1" step="0.01" />
          </label>
        </div>

        <h3 class="ps-edit-group">Note &amp; Output</h3>
        <div class="ps-edit-grid">
          <label class="ps-edit-field">
            <span class="ps-edit-label">Note Interval <span class="ps-edit-value" id="ps-edit-note-interval-value"></span></span>
            <input type="range" id="ps-edit-note-interval" min="100" max="2000" step="50" />
          </label>
          <label class="ps-edit-field">
            <span class="ps-edit-label">Note Length</span>
            <select id="ps-edit-note-duration">
              <option value="16n">1/16</option>
              <option value="8n">1/8</option>
              <option value="4n">1/4</option>
              <option value="2n">1/2</option>
              <option value="1n">1/1</option>
            </select>
          </label>
          <label class="ps-edit-field">
            <span class="ps-edit-label">Out / Aux <span class="ps-edit-value" id="ps-edit-mix-value"></span></span>
            <input type="range" id="ps-edit-mix" min="0" max="1" step="0.01" />
          </label>
          <label class="ps-edit-field">
            <span class="ps-edit-label">Volume <span class="ps-edit-value" id="ps-edit-volume-value"></span></span>
            <input type="range" id="ps-edit-volume" min="0" max="1.2" step="0.01" />
          </label>
        </div>
      </form>
    </dialog>
```

- [ ] **Step 4: Create `src/css/ps-edit-dialog.css`**

```css
/* ──────────────────────────────────────────────
   Power Synth Edit Dialog

   Wider and grouped rather than the single column the other editors use:
   13 controls against their 7-8.
   ────────────────────────────────────────────── */
#ps-edit-dialog {
  margin: auto;
  min-width: 300px;
  max-width: 520px;
  padding: 22px 24px 26px;
  border: 1px solid var(--toolbar-border);
  border-radius: var(--radius-lg);
  background: var(--bg-surface);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  color: var(--text-primary);
  font-family: inherit;
  box-shadow:
    0 12px 48px hsla(88, 60%, 12%, 0.5),
    0 0 60px hsla(78, 80%, 45%, 0.12);
  animation: psEditIn 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
}

#ps-edit-dialog::backdrop {
  background: rgba(10, 12, 20, 0.72);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

@keyframes psEditIn {
  from {
    transform: scale(0.94) translateY(6px);
    opacity: 0;
  }

  to {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}

.ps-edit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.ps-edit-header h2 {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

#ps-edit-close {
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  transition: color var(--transition-fast), background var(--transition-fast);
}

#ps-edit-close:hover {
  color: var(--text-primary);
  background: var(--bg-surface-hover);
}

.ps-edit-group {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: var(--ps-core);
  margin: 20px 0 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--toolbar-border);
}

.ps-edit-group:first-of-type {
  margin-top: 0;
}

.ps-edit-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 20px;
}

.ps-edit-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.ps-edit-label {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  letter-spacing: 0.01em;
}

.ps-edit-value {
  color: var(--ps-core);
  font-variant-numeric: tabular-nums;
}

.ps-edit-note {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 8px;
  line-height: 1.4;
}

.ps-edit-field select {
  font-family: inherit;
  font-size: 13px;
  width: 100%;
  color: var(--text-primary);
  background: var(--bg-surface-hover);
  border: 1px solid var(--toolbar-border);
  border-radius: var(--radius-sm);
  padding: 7px 10px;
  cursor: pointer;
}

.ps-edit-field input[type='range'] {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: var(--bg-surface-hover);
  outline: none;
}

.ps-edit-field input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--ps-core);
  box-shadow: 0 0 8px hsla(78, 90%, 55%, 0.6);
  cursor: pointer;
}

.ps-edit-field input[type='range']::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border: none;
  border-radius: 50%;
  background: var(--ps-core);
  box-shadow: 0 0 8px hsla(78, 90%, 55%, 0.6);
  cursor: pointer;
}

@media (max-width: 560px) {
  .ps-edit-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

Add to `style.css`, after the `wind-edit-dialog.css` import:

```css
@import './src/css/ps-edit-dialog.css';
```

- [ ] **Step 5: Add the four DOM refs**

In `src/ts/state.ts`, after the wind editor refs:

```ts
  psEditDialog: document.getElementById('ps-edit-dialog') as HTMLDialogElement,
  psEditForm: document.getElementById('ps-edit-form') as HTMLFormElement,
  psEditClose: document.getElementById('ps-edit-close') as HTMLButtonElement,
  psEditEngine: document.getElementById('ps-edit-engine') as HTMLSelectElement,
```

The 13 inputs and their readouts are looked up by id inside the editor module instead, which keeps ~26 refs out of this file.

- [ ] **Step 6: Create `src/ts/powersynth-editor.ts`**

```ts
import { DOM } from './state';
import { PARAMS, ENGINE_NAMES } from './plaits';
import type { PowerSynthState } from '../types';

let currentPowerSynth: PowerSynthState | null = null;

const input = (id: string) => document.getElementById(id) as HTMLInputElement;
const readout = (id: string) => document.getElementById(`${id}-value`) as HTMLSpanElement;

/**
 * Sliders that write a Plaits param straight through. Timbre and morph are
 * deliberately absent: they write baseTimbre/baseMorph, because the proximity
 * loop is the only writer of the effective TIMBRE/MORPH values.
 */
const PLAITS_SLIDERS: Array<{ id: string; param: number }> = [
  { id: 'ps-edit-harmonics', param: PARAMS.HARMONICS },
  { id: 'ps-edit-fm', param: PARAMS.FM_AMOUNT },
  { id: 'ps-edit-timbre-mod', param: PARAMS.TIMBRE_MOD_AMOUNT },
  { id: 'ps-edit-morph-mod', param: PARAMS.MORPH_MOD_AMOUNT },
  { id: 'ps-edit-decay', param: PARAMS.DECAY },
  { id: 'ps-edit-lpg', param: PARAMS.LPG_COLOUR },
];

/** Every 0..1 param plus timbre/morph shares the same two-decimal readout. */
const UNIT_READOUTS = [
  ...PLAITS_SLIDERS.map((s) => s.id),
  'ps-edit-timbre',
  'ps-edit-morph',
  'ps-edit-mix',
];

function refreshValueLabels(): void {
  for (const id of UNIT_READOUTS) {
    readout(id).textContent = Number(input(id).value).toFixed(2);
  }
  readout('ps-edit-note-interval').textContent = `${input('ps-edit-note-interval').value}ms`;
  readout('ps-edit-volume').textContent =
    `${Math.round(Number(input('ps-edit-volume').value) * 100)}%`;
}

function applyFieldsToPowerSynth(): void {
  const ps = currentPowerSynth;
  if (!ps) return;

  ps.engine = Number(DOM.psEditEngine.value);
  ps.baseTimbre = Number(input('ps-edit-timbre').value);
  ps.baseMorph = Number(input('ps-edit-morph').value);
  ps.noteDuration = (document.getElementById('ps-edit-note-duration') as HTMLSelectElement).value;
  ps.noteIntervalMs = Number(input('ps-edit-note-interval').value);
  ps.mix = Number(input('ps-edit-mix').value);
  ps.outputNode.gain.value = Number(input('ps-edit-volume').value);

  // The engine may still be loading, or may have failed. The values above are
  // all stored on the element, so they take effect whenever a voice arrives.
  if (ps.voice) {
    ps.voice.setParam(PARAMS.ENGINE, ps.engine);
    for (const { id, param } of PLAITS_SLIDERS) {
      ps.voice.setParam(param, Number(input(id).value));
    }
    ps.voice.setMix(ps.mix);
  }

  refreshValueLabels();
}

export function openPowerSynthEditor(ps: PowerSynthState): void {
  currentPowerSynth = ps;

  DOM.psEditEngine.value = String(ps.engine);
  input('ps-edit-timbre').value = String(ps.baseTimbre);
  input('ps-edit-morph').value = String(ps.baseMorph);
  input('ps-edit-note-interval').value = String(ps.noteIntervalMs);
  input('ps-edit-mix').value = String(ps.mix);
  input('ps-edit-volume').value = String(ps.outputNode.gain.value);
  (document.getElementById('ps-edit-note-duration') as HTMLSelectElement).value = ps.noteDuration;

  refreshValueLabels();
  DOM.psEditDialog.showModal();
}

export function bindPowerSynthContextMenu(ps: PowerSynthState): void {
  ps.el.addEventListener('contextmenu', (e: MouseEvent) => {
    e.preventDefault();
    openPowerSynthEditor(ps);
  });
}

export function initPowerSynthEditor(): void {
  ENGINE_NAMES.forEach((name, i) => {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = `${i} — ${name}`;
    DOM.psEditEngine.append(option);
  });

  // The Plaits sliders default to the same values spawnPowerSynth sends to a
  // fresh voice, so an unopened dialog and a new element agree.
  for (const { id } of PLAITS_SLIDERS) {
    input(id).value = id === 'ps-edit-harmonics' || id === 'ps-edit-decay' || id === 'ps-edit-lpg'
      ? '0.5'
      : '0';
  }

  DOM.psEditForm.addEventListener('input', applyFieldsToPowerSynth);

  DOM.psEditClose.addEventListener('click', () => {
    DOM.psEditDialog.close();
  });

  DOM.psEditDialog.addEventListener('click', (e: MouseEvent) => {
    if (e.target === DOM.psEditDialog) {
      DOM.psEditDialog.close();
    }
  });

  DOM.psEditDialog.addEventListener('close', () => {
    currentPowerSynth = null;
  });
}
```

- [ ] **Step 7: Bind the context menu and init the editor**

In `src/ts/elements.ts`, add the import:

```ts
import { bindPowerSynthContextMenu } from './powersynth-editor';
```

and in `spawnPowerSynth`, after `makeDraggable(...)`:

```ts
  bindPowerSynthContextMenu(powerSynth);
```

In `src/app.ts`, add the import:

```ts
import { initPowerSynthEditor } from './ts/powersynth-editor';
```

and call it alongside the others:

```ts
initPowerSynthEditor();
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx playwright test tests/powersynth-editor.spec.ts && npx tsc --noEmit`
Expected: 7 passed, tsc exits 0.

- [ ] **Step 9: Verify audibly in the browser**

Run `yarn dev`, place a Power Synth, right-click it, and step through several engines (try 10 FM, 13 wavetable, 19 string, 21 bass drum) while moving timbre and morph. Confirm each engine changes the sound and nothing throws.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Add the Power Synth edit dialog

All 24 Plaits engines plus the full parameter set, grouped into a
two-column layout. Timbre and morph write base values so the Modulator
and the dialog do not fight over the same params."
```

---

### Task 6: Documentation and full-suite verification

**Files:**
- Modify: `CLAUDE.md`
- Modify: `readme.md`

**Interfaces:**
- Consumes: everything from Tasks 1–5.
- Produces: no code.

- [ ] **Step 1: Update `CLAUDE.md`**

In the module table, after the `src/ts/orb-editor.ts` row:

```
| `src/ts/plaits.ts` | Loads the Plaits wasm + AudioWorklet and hands out per-element voice handles |
| `src/ts/powersynth-editor.ts` | Right-click-to-edit modal for Power Synth (engine + all Plaits params) |
```

In the Element model section, extend the generators line:

```
- *Generators* (Orb, Deep Pad, Ethereal Wind, Power Synth) — produce sound on a recursive `setTimeout` note-scheduling loop.
```

In the Conventions section, extend the type id list to include `'powersynth'`.

Add a new subsection after the "Audio init guard" paragraph:

```markdown
**Plaits (Power Synth)**: `public/plaits.wasm` and `public/plaits-worklet.js` are
vendored binaries/sources from the sibling `mi-plaits-wasm` project, not built
here. The worklet differs from upstream only by a `stop` message, which is what
lets an erased element actually stop rendering DSP — upstream's `process()`
returns `true` unconditionally. `PARAMS` in `src/ts/plaits.ts` mirrors
`mi-plaits-wasm/src/params.rs` and must be kept in sync; unknown ids are ignored
on the Rust side, so drift degrades quietly rather than crashing. Unlike every
other generator, a Power Synth's audio node is a raw `AudioWorkletNode` rather
than a Tone.js node — it is connected into the Tone graph via `Tone.connect()`,
and its params are set by `postMessage`, not `AudioParam` automation. That is why
`proximity.ts` uses `voice.setParamIfChanged(...)` for it instead of
`rampToIfChanged(...)`.
```

- [ ] **Step 2: Update `readme.md`**

Read the file first and add Power Synth wherever the existing generator elements are listed, matching the surrounding tone and format.

- [ ] **Step 3: Run the full suite**

Run: `yarn test`
Expected: every spec passes, including the pre-existing ones.

- [ ] **Step 4: Verify the type-check and production build**

Run: `npx tsc --noEmit && yarn build`
Expected: tsc exits 0; the build succeeds and `dist/plaits.wasm` and `dist/plaits-worklet.js` are present.

```bash
ls -lh dist/plaits.wasm dist/plaits-worklet.js
```

- [ ] **Step 5: Verify the production build serves correctly**

Run `yarn preview`, open the served URL, click Start, and place a Power Synth. This is the check that `import.meta.env.BASE_URL` resolved correctly for the deployed base path — a dev-server-only test would not catch a broken asset URL.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Document the Power Synth element and its vendored wasm engine"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| Module boundary (`plaits.ts` exports) | 1 |
| Asset loading, `stop` message, `BASE_URL` | 1 |
| Eager non-blocking load from `startAudio` | 1 |
| Audio graph, `TRIGGER_PATCHED`/`LEVEL_PATCHED` | 1 (voice), 2 (output gain) |
| Sample rate | No code — worklet passes `sampleRate` through unchanged |
| Spawning, loading + error states, disposed race | 2 (scaffolding), 3 (async tail) |
| Note scheduling, MIDI conversion, release timer | 3 |
| Proximity: Time Warp, Woah, Orbit, Modulator | 4 |
| Edit dialog, all params, grouped layout | 5 |
| Testing | 1, 2, 3, 4, 5 |
| Files list | All |
| Conventions | Global Constraints |
| Known limitations | 5 (dialog note), 6 (CLAUDE.md) |

**Type consistency:** `PlaitsVoice` methods (`setParam`, `setParamIfChanged`, `setMix`, `dispose`) are defined in Task 1 and used with those exact names in Tasks 3, 4 and 5. `PowerSynthState` fields defined in Task 2 are used unchanged in 3, 4 and 5. `createPlaitsVoice(outputNode)` takes the gain created in Task 2 Step 9 and is called with it in Task 3 Step 3.

**Placeholder scan:** No TBDs. Every code step carries the actual code. The one step that says "read the file first" (Task 6 Step 2, `readme.md`) does so because the file's existing structure is not known at planning time and the change is a one-line list edit.
