import { DOM } from './state';
import { PARAMS, ENGINE_NAMES } from './plaits';
import type { PowerSynthState } from '../types';

let currentPowerSynth: PowerSynthState | null = null;

const input = (id: string) => document.getElementById(id) as HTMLInputElement;
const readout = (id: string) => document.getElementById(`${id}-value`) as HTMLSpanElement;
const noteDurationSelect = () =>
  document.getElementById('ps-edit-note-duration') as HTMLSelectElement;

/**
 * Sliders that write a Plaits param straight through. Timbre and morph are
 * deliberately absent: they write baseTimbre/baseMorph, because the proximity
 * loop is the only writer of the effective TIMBRE/MORPH values.
 *
 * `initial` matches what spawnPowerSynth sends to a fresh voice, so an
 * unopened dialog and a newly placed element agree.
 */
const PLAITS_SLIDERS: Array<{ id: string; param: number; initial: number }> = [
  { id: 'ps-edit-harmonics', param: PARAMS.HARMONICS, initial: 0.5 },
  { id: 'ps-edit-fm', param: PARAMS.FM_AMOUNT, initial: 0 },
  { id: 'ps-edit-timbre-mod', param: PARAMS.TIMBRE_MOD_AMOUNT, initial: 0 },
  { id: 'ps-edit-morph-mod', param: PARAMS.MORPH_MOD_AMOUNT, initial: 0 },
  { id: 'ps-edit-decay', param: PARAMS.DECAY, initial: 0.5 },
  { id: 'ps-edit-lpg', param: PARAMS.LPG_COLOUR, initial: 0.5 },
];

/** Every 0..1 param shares the same two-decimal readout. */
const UNIT_READOUTS = [
  ...PLAITS_SLIDERS.map((slider) => slider.id),
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
  const powerSynth = currentPowerSynth;
  if (!powerSynth) return;

  powerSynth.engine = Number(DOM.psEditEngine.value);
  powerSynth.baseTimbre = Number(input('ps-edit-timbre').value);
  powerSynth.baseMorph = Number(input('ps-edit-morph').value);
  powerSynth.noteDuration = noteDurationSelect().value;
  powerSynth.noteIntervalMs = Number(input('ps-edit-note-interval').value);
  powerSynth.mix = Number(input('ps-edit-mix').value);
  powerSynth.outputNode.gain.value = Number(input('ps-edit-volume').value);

  // The engine may still be loading, or may have failed. Everything above is
  // stored on the element, so it takes effect whenever a voice arrives.
  if (powerSynth.voice) {
    powerSynth.voice.setParam(PARAMS.ENGINE, powerSynth.engine);
    for (const { id, param } of PLAITS_SLIDERS) {
      powerSynth.voice.setParam(param, Number(input(id).value));
    }
    powerSynth.voice.setMix(powerSynth.mix);
  }

  refreshValueLabels();
}

export function openPowerSynthEditor(powerSynth: PowerSynthState): void {
  currentPowerSynth = powerSynth;

  DOM.psEditEngine.value = String(powerSynth.engine);
  input('ps-edit-timbre').value = String(powerSynth.baseTimbre);
  input('ps-edit-morph').value = String(powerSynth.baseMorph);
  input('ps-edit-note-interval').value = String(powerSynth.noteIntervalMs);
  input('ps-edit-mix').value = String(powerSynth.mix);
  input('ps-edit-volume').value = String(powerSynth.outputNode.gain.value);
  noteDurationSelect().value = powerSynth.noteDuration;

  refreshValueLabels();
  DOM.psEditDialog.showModal();
}

export function bindPowerSynthContextMenu(powerSynth: PowerSynthState): void {
  powerSynth.el.addEventListener('contextmenu', (e: MouseEvent) => {
    e.preventDefault();
    openPowerSynthEditor(powerSynth);
  });
}

export function initPowerSynthEditor(): void {
  ENGINE_NAMES.forEach((name, i) => {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = `${i} — ${name}`;
    DOM.psEditEngine.append(option);
  });

  for (const { id, initial } of PLAITS_SLIDERS) {
    input(id).value = String(initial);
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
