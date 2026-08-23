import { DOM } from './state';
import type { EtherealWindState } from '../types';

let currentWind: EtherealWindState | null = null;

function refreshValueLabels(): void {
  DOM.windEditSweepRateValue.textContent = `${Number(DOM.windEditSweepRate.value).toFixed(2)}Hz`;
  DOM.windEditFilterFreqValue.textContent = `${DOM.windEditFilterFreq.value}Hz`;
  DOM.windEditFilterRangeValue.textContent = `${Number(DOM.windEditFilterRange.value).toFixed(1)} oct`;
  DOM.windEditFilterDepthValue.textContent = `${Math.round(Number(DOM.windEditFilterDepth.value) * 100)}%`;
  DOM.windEditPanRateValue.textContent = `${Number(DOM.windEditPanRate.value).toFixed(2)}Hz`;
  DOM.windEditPanDepthValue.textContent = `${Math.round(Number(DOM.windEditPanDepth.value) * 100)}%`;
  DOM.windEditVolumeValue.textContent = `${Math.round(Number(DOM.windEditVolume.value) * 100)}%`;
}

function applyFieldsToWind(): void {
  if (!currentWind) return;

  currentWind.noise.type = DOM.windEditNoiseType.value as any;
  currentWind.autoFilter.frequency.value = Number(DOM.windEditSweepRate.value);
  currentWind.autoFilter.baseFrequency = Number(DOM.windEditFilterFreq.value);
  currentWind.autoFilter.octaves = Number(DOM.windEditFilterRange.value);
  currentWind.autoFilter.depth.value = Number(DOM.windEditFilterDepth.value);
  currentWind.panner.frequency.value = Number(DOM.windEditPanRate.value);
  currentWind.panner.depth.value = Number(DOM.windEditPanDepth.value);
  currentWind.outputNode.gain.value = Number(DOM.windEditVolume.value);

  refreshValueLabels();
}

export function openWindEditor(wind: EtherealWindState): void {
  currentWind = wind;

  DOM.windEditNoiseType.value = wind.noise.type as string;
  DOM.windEditSweepRate.value = String(wind.autoFilter.frequency.value);
  DOM.windEditFilterFreq.value = String(wind.autoFilter.baseFrequency);
  DOM.windEditFilterRange.value = String(wind.autoFilter.octaves);
  DOM.windEditFilterDepth.value = String(wind.autoFilter.depth.value);
  DOM.windEditPanRate.value = String(wind.panner.frequency.value);
  DOM.windEditPanDepth.value = String(wind.panner.depth.value);
  DOM.windEditVolume.value = String(wind.outputNode.gain.value);

  refreshValueLabels();
  DOM.windEditDialog.showModal();
}

export function bindWindContextMenu(wind: EtherealWindState): void {
  wind.el.addEventListener('contextmenu', (e: MouseEvent) => {
    e.preventDefault();
    openWindEditor(wind);
  });
}

export function initWindEditor(): void {
  DOM.windEditForm.addEventListener('input', applyFieldsToWind);

  DOM.windEditClose.addEventListener('click', () => {
    DOM.windEditDialog.close();
  });

  DOM.windEditDialog.addEventListener('click', (e: MouseEvent) => {
    if (e.target === DOM.windEditDialog) {
      DOM.windEditDialog.close();
    }
  });

  DOM.windEditDialog.addEventListener('close', () => {
    currentWind = null;
  });
}
