import { DOM } from './state';
import type { OrbState } from './types';

let currentOrb: OrbState | null = null;

function refreshValueLabels(): void {
  DOM.orbEditAttackValue.textContent = `${Number(DOM.orbEditAttack.value).toFixed(2)}s`;
  DOM.orbEditDecayValue.textContent = `${Number(DOM.orbEditDecay.value).toFixed(2)}s`;
  DOM.orbEditSustainValue.textContent = Number(DOM.orbEditSustain.value).toFixed(2);
  DOM.orbEditReleaseValue.textContent = `${Number(DOM.orbEditRelease.value).toFixed(2)}s`;
  DOM.orbEditNoteIntervalValue.textContent = `${DOM.orbEditNoteInterval.value}ms`;
}

function applyFieldsToOrb(): void {
  if (!currentOrb) return;

  currentOrb.synth.oscillator.type = DOM.orbEditWaveform.value as any;
  currentOrb.synth.envelope.attack = Number(DOM.orbEditAttack.value);
  currentOrb.synth.envelope.decay = Number(DOM.orbEditDecay.value);
  currentOrb.synth.envelope.sustain = Number(DOM.orbEditSustain.value);
  currentOrb.synth.envelope.release = Number(DOM.orbEditRelease.value);
  currentOrb.noteDuration = DOM.orbEditNoteDuration.value;
  currentOrb.noteIntervalMs = Number(DOM.orbEditNoteInterval.value);

  refreshValueLabels();
}

export function openOrbEditor(orb: OrbState): void {
  currentOrb = orb;

  DOM.orbEditWaveform.value = orb.synth.oscillator.type as string;
  DOM.orbEditAttack.value = String(orb.synth.envelope.attack);
  DOM.orbEditDecay.value = String(orb.synth.envelope.decay);
  DOM.orbEditSustain.value = String(orb.synth.envelope.sustain);
  DOM.orbEditRelease.value = String(orb.synth.envelope.release);
  DOM.orbEditNoteDuration.value = orb.noteDuration;
  DOM.orbEditNoteInterval.value = String(orb.noteIntervalMs);

  refreshValueLabels();
  DOM.orbEditDialog.showModal();
}

export function bindOrbContextMenu(orb: OrbState): void {
  orb.el.addEventListener('contextmenu', (e: MouseEvent) => {
    e.preventDefault();
    openOrbEditor(orb);
  });
}

export function initOrbEditor(): void {
  DOM.orbEditForm.addEventListener('input', applyFieldsToOrb);

  DOM.orbEditClose.addEventListener('click', () => {
    DOM.orbEditDialog.close();
  });

  DOM.orbEditDialog.addEventListener('click', (e: MouseEvent) => {
    if (e.target === DOM.orbEditDialog) {
      DOM.orbEditDialog.close();
    }
  });

  DOM.orbEditDialog.addEventListener('close', () => {
    currentOrb = null;
  });
}
