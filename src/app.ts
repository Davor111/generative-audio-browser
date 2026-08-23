import * as Tone from 'tone';
import { DOM, SOUND } from './ts/state';
import { initAudioEngine } from './ts/audio-engine';
import {
  spawnOrb,
  spawnTimewarp,
  spawnDeepPad,
  spawnWoah,
  spawnEtherealWind,
  spawnModulator,
  spawnOrbit,
} from './ts/elements';
import { resizeConnectionsCanvas, proximityLoop } from './ts/proximity';
import { initOrbEditor } from './ts/orb-editor';
import { initPadEditor } from './ts/pad-editor';

async function startAudio(): Promise<void> {
  await Tone.start();
  Tone.getDestination().volume.value = -8;
  initAudioEngine();
  SOUND.audioReady = true;
  DOM.startOverlay.classList.add('hidden');
}

function setupToolbarDrag(btn: HTMLButtonElement, type: string): void {
  btn.addEventListener('dragstart', (e: DragEvent) => {
    e.dataTransfer!.setData('text/plain', type);
    e.dataTransfer!.effectAllowed = 'copy';
  });
}

function setupToolbarClick(btn: HTMLButtonElement, spawnFn: (x: number, y: number) => void): void {
  btn.addEventListener('click', () => {
    if (!SOUND.audioReady) return;
    const rect = DOM.canvas.getBoundingClientRect();
    const pad = 100;
    const x = pad + Math.random() * (rect.width - pad * 2);
    const y = pad + Math.random() * (rect.height - pad * 2);
    spawnFn(x, y);
  });
}

resizeConnectionsCanvas();
window.addEventListener('resize', resizeConnectionsCanvas);
requestAnimationFrame(proximityLoop);
initOrbEditor();
initPadEditor();

DOM.startBtn.addEventListener('click', startAudio);

DOM.canvas.addEventListener('dragover', (e: DragEvent) => {
  e.preventDefault();
  e.dataTransfer!.dropEffect = 'copy';
  DOM.canvas.classList.add('drag-over');
});

DOM.canvas.addEventListener('dragleave', () => {
  DOM.canvas.classList.remove('drag-over');
});

DOM.canvas.addEventListener('drop', (e: DragEvent) => {
  e.preventDefault();
  DOM.canvas.classList.remove('drag-over');
  if (!SOUND.audioReady) return;

  const type = e.dataTransfer!.getData('text/plain');
  const canvasRect = DOM.canvas.getBoundingClientRect();
  const x = e.clientX - canvasRect.left;
  const y = e.clientY - canvasRect.top;

  switch (type) {
    case 'orb':
      spawnOrb(x, y);
      break;
    case 'timewarp':
      spawnTimewarp(x, y);
      break;
    case 'deeppad':
      spawnDeepPad(x, y);
      break;
    case 'woah':
      spawnWoah(x, y);
      break;
    case 'etheralwind':
      spawnEtherealWind(x, y);
      break;
    case 'modulator':
      spawnModulator(x, y);
      break;
    case 'orbit':
      spawnOrbit(x, y);
      break;
  }

});

setupToolbarDrag(DOM.toolbarOrbBtn, 'orb');
setupToolbarDrag(DOM.toolbarTimewarpBtn, 'timewarp');
setupToolbarDrag(DOM.toolbarDeeppadBtn, 'deeppad');
setupToolbarDrag(DOM.toolbarWoahBtn, 'woah');
setupToolbarDrag(DOM.toolbarEtheralwindBtn, 'etheralwind');
setupToolbarDrag(DOM.toolbarModulatorBtn, 'modulator');
setupToolbarDrag(DOM.toolbarOrbitBtn, 'orbit');

setupToolbarClick(DOM.toolbarOrbBtn, spawnOrb);
setupToolbarClick(DOM.toolbarTimewarpBtn, spawnTimewarp);
setupToolbarClick(DOM.toolbarDeeppadBtn, spawnDeepPad);
setupToolbarClick(DOM.toolbarWoahBtn, spawnWoah);
setupToolbarClick(DOM.toolbarEtheralwindBtn, spawnEtherealWind);
setupToolbarClick(DOM.toolbarModulatorBtn, spawnModulator);
setupToolbarClick(DOM.toolbarOrbitBtn, spawnOrbit);
