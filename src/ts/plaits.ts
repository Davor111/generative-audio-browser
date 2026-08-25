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
 * Creates one monophonic Plaits voice and connects it into `destination`.
 *
 * The caller owns `destination` and must create it first: spawnPowerSynth is
 * synchronous and needs a real Tone.Gain to register Woah sends against long
 * before the wasm has loaded.
 */
export async function createPlaitsVoice(destination: Gain): Promise<PlaitsVoice> {
  const bytes = await initPlaits();

  // Must go through Tone's factory rather than `new AudioWorkletNode(ctx, ...)`:
  // Tone wraps its context with standardized-audio-context, so `rawContext` is
  // not a native BaseAudioContext and the native constructor rejects it.
  const node = getContext().createAudioWorkletNode('plaits', { outputChannelCount: [2] });
  connect(node, destination);

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
