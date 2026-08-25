import * as Tone from 'tone';
import { DOM, SOUND } from './ts/state';
import { initAudioEngine } from './ts/audio-engine';
import { initPlaits } from './ts/plaits';
import {
  spawnOrb,
  spawnTimewarp,
  spawnDeepPad,
  spawnWoah,
  spawnEtherealWind,
  spawnModulator,
  spawnOrbit,
  spawnLine,
  spawnPing,
  spawnPowerSynth,
} from './ts/elements';
import { resizeConnectionsCanvas, proximityLoop } from './ts/proximity';

async function startAudio(): Promise<void> {
  await Tone.start();
  Tone.getDestination().volume.value = -8;
  initAudioEngine();

  // Eager but non-blocking: the ~300KB wasm fetch overlaps the overlay
  // dismissing rather than delaying it. spawnPowerSynth awaits the same
  // cached promise, so a very early spawn simply waits.
  initPlaits().catch((err) => {
    console.error('Plaits engine failed to load', err);
  });

  SOUND.audioReady = true;
  DOM.startOverlay.classList.add('hidden');
}

function setupToolbarDrag(btn: HTMLButtonElement, type: string): void {
  btn.addEventListener('dragstart', (e: DragEvent) => {
    e.dataTransfer!.setData('text/plain', type);
    e.dataTransfer!.effectAllowed = 'copy';
  });
}

function setSidebarCollapsed(collapsed: boolean): void {
  document.body.classList.toggle('toolbar-collapsed', collapsed);
  DOM.toolbarToggleBtn.setAttribute('aria-expanded', String(!collapsed));
  DOM.toolbarCloseBtn.setAttribute('aria-expanded', String(!collapsed));
  DOM.toolbarToggleBtn.setAttribute('aria-label', collapsed ? 'Open sidebar' : 'Close sidebar');
}

DOM.canvas.addEventListener('transitionend', (e: TransitionEvent) => {
  if (e.propertyName === 'left') resizeConnectionsCanvas();
});

const mobileMediaQuery = window.matchMedia('(max-width: 768px)');
setSidebarCollapsed(mobileMediaQuery.matches);

DOM.toolbarToggleBtn.addEventListener('click', () => setSidebarCollapsed(false));
DOM.toolbarCloseBtn.addEventListener('click', () => setSidebarCollapsed(true));
DOM.toolbarBackdrop.addEventListener('click', () => setSidebarCollapsed(true));

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
    case 'line':
      spawnLine(x, y);
      break;
    case 'ping':
      spawnPing(x, y);
      break;
    case 'powersynth':
      spawnPowerSynth(x, y);
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
setupToolbarDrag(DOM.toolbarLineBtn, 'line');
setupToolbarDrag(DOM.toolbarPingBtn, 'ping');
setupToolbarDrag(DOM.toolbarPowersynthBtn, 'powersynth');

setupToolbarClick(DOM.toolbarOrbBtn, spawnOrb);
setupToolbarClick(DOM.toolbarTimewarpBtn, spawnTimewarp);
setupToolbarClick(DOM.toolbarDeeppadBtn, spawnDeepPad);
setupToolbarClick(DOM.toolbarWoahBtn, spawnWoah);
setupToolbarClick(DOM.toolbarEtheralwindBtn, spawnEtherealWind);
setupToolbarClick(DOM.toolbarModulatorBtn, spawnModulator);
setupToolbarClick(DOM.toolbarOrbitBtn, spawnOrbit);
setupToolbarClick(DOM.toolbarLineBtn, spawnLine);
setupToolbarClick(DOM.toolbarPingBtn, spawnPing);
setupToolbarClick(DOM.toolbarPowersynthBtn, spawnPowerSynth);
