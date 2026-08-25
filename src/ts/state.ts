import type { SoundState } from '../types';

export const DOM = {
  canvas: document.getElementById('canvas') as HTMLElement,
  container: document.getElementById('elements-container') as HTMLElement,
  startOverlay: document.getElementById('start-overlay') as HTMLElement,
  startBtn: document.getElementById('start-btn') as HTMLButtonElement,
  toolbarToggleBtn: document.getElementById('toolbar-toggle') as HTMLButtonElement,
  toolbarCloseBtn: document.getElementById('toolbar-close') as HTMLButtonElement,
  toolbarBackdrop: document.getElementById('toolbar-backdrop') as HTMLElement,
  toolbarOrbBtn: document.getElementById('toolbar-orb') as HTMLButtonElement,
  toolbarTimewarpBtn: document.getElementById('toolbar-timewarp') as HTMLButtonElement,
  toolbarDeeppadBtn: document.getElementById('toolbar-deeppad') as HTMLButtonElement,
  toolbarWoahBtn: document.getElementById('toolbar-woah') as HTMLButtonElement,
  toolbarEtheralwindBtn: document.getElementById('toolbar-etheralwind') as HTMLButtonElement,
  toolbarModulatorBtn: document.getElementById('toolbar-modulator') as HTMLButtonElement,
  toolbarOrbitBtn: document.getElementById('toolbar-orbit') as HTMLButtonElement,
  toolbarLineBtn: document.getElementById('toolbar-line') as HTMLButtonElement,
  toolbarPingBtn: document.getElementById('toolbar-ping') as HTMLButtonElement,
  toolbarPowersynthBtn: document.getElementById('toolbar-powersynth') as HTMLButtonElement,
  connectionsCanvas: document.getElementById('connections-canvas') as HTMLCanvasElement,
  ctx: (document.getElementById('connections-canvas') as HTMLCanvasElement).getContext('2d')!,
  eraseZone: document.getElementById('erase-zone') as HTMLElement,
};

export const SOUND: SoundState = {
  audioReady: false,
  masterReverb: null,
  fxReverb: null,
  limiter: null,
  orbs: [],
  timewarps: [],
  deeppads: [],
  woahs: [],
  etheralwinds: [],
  modulators: [],
  orbits: [],
  lines: [],
  pings: [],
  powersynths: [],
};

/**
 * Note pools are no longer global — each pitched generator builds its own from
 * its scale, root and range (see src/ts/scales.ts). What stays here is timing
 * and the modulator radii.
 */
export const MUSIC = {
  NOTE_INTERVAL_MS: 500,
  DEEPPAD_INTERVAL_MS: 5000,
  TIMEWARP_RADIUS: 200,
  WOAH_RADIUS: 220,
  MODULATOR_RADIUS: 210,
  ORBIT_RADIUS: 240,
  LINE_RADIUS: 240,
  PING_REACH: 260,
};
