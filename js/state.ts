import type { SoundState } from './types';

export const DOM = {
  canvas: document.getElementById('canvas') as HTMLElement,
  container: document.getElementById('elements-container') as HTMLElement,
  startOverlay: document.getElementById('start-overlay') as HTMLElement,
  startBtn: document.getElementById('start-btn') as HTMLButtonElement,
  toolbarOrbBtn: document.getElementById('toolbar-orb') as HTMLButtonElement,
  toolbarTimewarpBtn: document.getElementById('toolbar-timewarp') as HTMLButtonElement,
  toolbarDeeppadBtn: document.getElementById('toolbar-deeppad') as HTMLButtonElement,
  toolbarWoahBtn: document.getElementById('toolbar-woah') as HTMLButtonElement,
  toolbarEtheralwindBtn: document.getElementById('toolbar-etheralwind') as HTMLButtonElement,
  toolbarModulatorBtn: document.getElementById('toolbar-modulator') as HTMLButtonElement,
  toolbarOrbitBtn: document.getElementById('toolbar-orbit') as HTMLButtonElement,
  connectionsCanvas: document.getElementById('connections-canvas') as HTMLCanvasElement,
  ctx: (document.getElementById('connections-canvas') as HTMLCanvasElement).getContext('2d')!,
};

export const SOUND: SoundState = {
  audioReady: false,
  masterReverb: null,
  limiter: null,
  orbs: [],
  timewarps: [],
  deeppads: [],
  woahs: [],
  etheralwinds: [],
  modulators: [],
  orbits: [],
};

export const MUSIC = {
  NOTES: [
    'C3', 'D3', 'E3', 'G3', 'A3',
    'C4', 'D4', 'E4', 'G4', 'A4',
    'C5', 'D5', 'E5', 'G5', 'A5',
  ],
  BASS_NOTES: [
    'C1', 'G1', 'A1',
    'C2', 'D2', 'E2', 'G2', 'A2',
  ],
  NOTE_INTERVAL_MS: 500,
  DEEPPAD_INTERVAL_MS: 5000,
  TIMEWARP_RADIUS: 200,
  WOAH_RADIUS: 220,
  MODULATOR_RADIUS: 210,
  ORBIT_RADIUS: 240,
};
