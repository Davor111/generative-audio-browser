import { DOM } from './state';
import type { DeepPadState } from '../types';

let currentPad: DeepPadState | null = null;

function refreshValueLabels(): void {
  DOM.padEditAttackValue.textContent = `${Number(DOM.padEditAttack.value).toFixed(2)}s`;
  DOM.padEditDecayValue.textContent = `${Number(DOM.padEditDecay.value).toFixed(2)}s`;
  DOM.padEditSustainValue.textContent = Number(DOM.padEditSustain.value).toFixed(2);
  DOM.padEditReleaseValue.textContent = `${Number(DOM.padEditRelease.value).toFixed(2)}s`;
  DOM.padEditNoteIntervalValue.textContent = `${DOM.padEditNoteInterval.value}ms`;
  DOM.padEditVolumeValue.textContent = `${Math.round(Number(DOM.padEditVolume.value) * 100)}%`;
}

function applyFieldsToPad(): void {
  if (!currentPad) return;

  currentPad.synth.oscillator.type = DOM.padEditWaveform.value as any;
  currentPad.synth.envelope.attack = Number(DOM.padEditAttack.value);
  currentPad.synth.envelope.decay = Number(DOM.padEditDecay.value);
  currentPad.synth.envelope.sustain = Number(DOM.padEditSustain.value);
  currentPad.synth.envelope.release = Number(DOM.padEditRelease.value);
  currentPad.noteIntervalMs = Number(DOM.padEditNoteInterval.value);
  currentPad.outputNode.gain.value = Number(DOM.padEditVolume.value);

  refreshValueLabels();
}

export function openPadEditor(pad: DeepPadState): void {
  currentPad = pad;

  DOM.padEditWaveform.value = pad.synth.oscillator.type as string;
  DOM.padEditAttack.value = String(pad.synth.envelope.attack);
  DOM.padEditDecay.value = String(pad.synth.envelope.decay);
  DOM.padEditSustain.value = String(pad.synth.envelope.sustain);
  DOM.padEditRelease.value = String(pad.synth.envelope.release);
  DOM.padEditNoteInterval.value = String(pad.noteIntervalMs);
  DOM.padEditVolume.value = String(pad.outputNode.gain.value);

  refreshValueLabels();
  DOM.padEditDialog.showModal();
}

export function bindPadContextMenu(pad: DeepPadState): void {
  pad.el.addEventListener('contextmenu', (e: MouseEvent) => {
    e.preventDefault();
    openPadEditor(pad);
  });
}

export function initPadEditor(): void {
  DOM.padEditForm.addEventListener('input', applyFieldsToPad);

  DOM.padEditClose.addEventListener('click', () => {
    DOM.padEditDialog.close();
  });

  DOM.padEditDialog.addEventListener('click', (e: MouseEvent) => {
    if (e.target === DOM.padEditDialog) {
      DOM.padEditDialog.close();
    }
  });

  DOM.padEditDialog.addEventListener('close', () => {
    currentPad = null;
  });
}
