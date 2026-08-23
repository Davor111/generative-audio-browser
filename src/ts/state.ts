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
  orbEditDialog: document.getElementById('orb-edit-dialog') as HTMLDialogElement,
  orbEditForm: document.getElementById('orb-edit-form') as HTMLFormElement,
  orbEditClose: document.getElementById('orb-edit-close') as HTMLButtonElement,
  orbEditWaveform: document.getElementById('orb-edit-waveform') as HTMLSelectElement,
  orbEditAttack: document.getElementById('orb-edit-attack') as HTMLInputElement,
  orbEditDecay: document.getElementById('orb-edit-decay') as HTMLInputElement,
  orbEditSustain: document.getElementById('orb-edit-sustain') as HTMLInputElement,
  orbEditRelease: document.getElementById('orb-edit-release') as HTMLInputElement,
  orbEditNoteDuration: document.getElementById('orb-edit-note-duration') as HTMLSelectElement,
  orbEditNoteInterval: document.getElementById('orb-edit-note-interval') as HTMLInputElement,
  orbEditAttackValue: document.getElementById('orb-edit-attack-value') as HTMLSpanElement,
  orbEditDecayValue: document.getElementById('orb-edit-decay-value') as HTMLSpanElement,
  orbEditSustainValue: document.getElementById('orb-edit-sustain-value') as HTMLSpanElement,
  orbEditReleaseValue: document.getElementById('orb-edit-release-value') as HTMLSpanElement,
  orbEditNoteIntervalValue: document.getElementById('orb-edit-note-interval-value') as HTMLSpanElement,
  eraseZone: document.getElementById('erase-zone') as HTMLElement,
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
