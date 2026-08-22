import { Gain } from 'tone';
import { DOM, SOUND, MUSIC } from './state';
import {
  createOrbSynth,
  createDeepPadSynth,
  createWoahFX,
  createEtherealWindSound,
  walkNote,
} from './audio-engine';
import { makeDraggable } from './utils';
import type {
  OrbState,
  DeepPadState,
  TimewarpState,
  WoahState,
  EtherealWindState,
  ModulatorState,
  OrbitState,
  WoahSource,
} from './types';

export function registerSourceToWoah(source: WoahSource, woah: WoahState): void {
  if (!source.woahSends.has(woah)) {
    const sendGain = new Gain(0);
    source.outputNode.connect(sendGain);
    sendGain.connect(woah.fx.inputGain);
    source.woahSends.set(woah, sendGain);
  }
}

export function spawnOrb(x: number, y: number): OrbState {
  const el = document.createElement('div');
  el.classList.add('orb-element');
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;

  const hueShift = Math.floor(Math.random() * 40) - 20;
  el.style.setProperty('--orb-core', `hsl(${258 + hueShift}, 90%, 68%)`);
  el.style.setProperty('--orb-glow', `hsl(${258 + hueShift}, 82%, 52%)`);

  const breatheDur = 2.5 + Math.random() * 2;
  el.style.setProperty('--breathe-duration', `${breatheDur}s`);

  DOM.container.appendChild(el);

  el.addEventListener('animationend', function onSpawn(e: AnimationEvent) {
    if (e.animationName === 'orbSpawnIn') {
      el.classList.add('orb-breathing');
      el.removeEventListener('animationend', onSpawn);
    }
  });

  const { synth, distortion, outputNode } = createOrbSynth();
  let noteIdx = Math.floor(Math.random() * MUSIC.NOTES.length);

  const orb: OrbState = {
    el,
    synth,
    distortion,
    outputNode,
    noteIdx,
    warped: false,
    woahAffected: false,
    modAffected: false,
    woahSends: new Map(),
    timerId: null,
  };

  for (const woah of SOUND.woahs) {
    registerSourceToWoah(orb, woah);
  }

  function scheduleNextNote(): void {
    let interval = MUSIC.NOTE_INTERVAL_MS;
    if (orb.warped) {
      interval = 150 + Math.random() * 700;
    }

    orb.timerId = setTimeout(() => {
      orb.noteIdx = walkNote(orb.noteIdx, MUSIC.NOTES);
      synth.triggerAttackRelease(MUSIC.NOTES[orb.noteIdx], '8n');

      el.classList.remove('note-pulse');
      void el.offsetWidth;
      el.classList.add('note-pulse');

      scheduleNextNote();
    }, interval);
  }
  scheduleNextNote();

  makeDraggable(el);

  SOUND.orbs.push(orb);
  return orb;
}

export function spawnTimewarp(x: number, y: number): TimewarpState {
  const el = document.createElement('div');
  el.classList.add('timewarp-element');
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;

  const core = document.createElement('div');
  core.classList.add('timewarp-core');
  const ring = document.createElement('div');
  ring.classList.add('timewarp-ring');
  const radius = document.createElement('div');
  radius.classList.add('timewarp-radius');
  radius.style.setProperty('--tw-radius-size', `${MUSIC.TIMEWARP_RADIUS * 2}px`);

  el.appendChild(radius);
  el.appendChild(ring);
  el.appendChild(core);
  DOM.container.appendChild(el);

  el.addEventListener('animationend', function onSpawn(e: AnimationEvent) {
    if (e.animationName === 'twSpawnIn') {
      el.classList.add('timewarp-breathing');
      el.removeEventListener('animationend', onSpawn);
    }
  });

  makeDraggable(el);

  const tw: TimewarpState = { el, radius: MUSIC.TIMEWARP_RADIUS };
  SOUND.timewarps.push(tw);
  return tw;
}

export function spawnDeepPad(x: number, y: number): DeepPadState {
  const el = document.createElement('div');
  el.classList.add('deeppad-element');
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;

  const glowRing = document.createElement('div');
  glowRing.classList.add('deeppad-glow-ring');
  el.appendChild(glowRing);

  const breatheDur = 4.0 + Math.random() * 2;
  el.style.setProperty('--dp-breathe-duration', `${breatheDur}s`);

  DOM.container.appendChild(el);

  el.addEventListener('animationend', function onSpawn(e: AnimationEvent) {
    if (e.animationName === 'dpSpawnIn') {
      el.classList.add('deeppad-breathing');
      el.removeEventListener('animationend', onSpawn);
    }
  });

  const { synth, filter, distortion, outputNode, baseFreq } = createDeepPadSynth();
  let noteIdx = Math.floor(Math.random() * MUSIC.BASS_NOTES.length);

  synth.triggerAttack(MUSIC.BASS_NOTES[noteIdx]);

  const dp: DeepPadState = {
    el,
    synth,
    filter,
    distortion,
    outputNode,
    baseFreq,
    noteIdx,
    warped: false,
    woahAffected: false,
    modAffected: false,
    woahSends: new Map(),
    timerId: null,
  };

  for (const woah of SOUND.woahs) {
    registerSourceToWoah(dp, woah);
  }

  function scheduleNextPadNote(): void {
    let interval = MUSIC.DEEPPAD_INTERVAL_MS;
    if (dp.warped) {
      interval = 900 + Math.random() * 700;
      synth.portamento = 0.35;
    } else {
      synth.portamento = 1.2;
    }

    dp.timerId = setTimeout(() => {
      dp.noteIdx = walkNote(dp.noteIdx, MUSIC.BASS_NOTES);
      const newNote = MUSIC.BASS_NOTES[dp.noteIdx];

      synth.setNote(newNote);

      el.classList.remove('dp-note-change');
      void el.offsetWidth;
      el.classList.add('dp-note-change');

      scheduleNextPadNote();
    }, interval);
  }
  scheduleNextPadNote();

  makeDraggable(el);

  SOUND.deeppads.push(dp);
  return dp;
}

export function spawnWoah(x: number, y: number): WoahState {
  const el = document.createElement('div');
  el.classList.add('woah-element');
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;

  const core = document.createElement('div');
  core.classList.add('woah-core');
  const echoRing = document.createElement('div');
  echoRing.classList.add('woah-echo-ring');
  const echoRing2 = document.createElement('div');
  echoRing2.classList.add('woah-echo-ring-2');
  const radius = document.createElement('div');
  radius.classList.add('woah-radius');
  radius.style.setProperty('--woah-radius-size', `${MUSIC.WOAH_RADIUS * 2}px`);

  el.appendChild(radius);
  el.appendChild(echoRing2);
  el.appendChild(echoRing);
  el.appendChild(core);
  DOM.container.appendChild(el);

  el.addEventListener('animationend', function onSpawn(e: AnimationEvent) {
    if (e.animationName === 'woahSpawnIn') {
      el.classList.add('woah-breathing');
      el.removeEventListener('animationend', onSpawn);
    }
  });

  makeDraggable(el);

  const fx = createWoahFX();
  const woah: WoahState = { el, radius: MUSIC.WOAH_RADIUS, fx, warped: false };

  for (const orb of SOUND.orbs) registerSourceToWoah(orb, woah);
  for (const dp of SOUND.deeppads) registerSourceToWoah(dp, woah);
  for (const wind of SOUND.etheralwinds) registerSourceToWoah(wind, woah);

  SOUND.woahs.push(woah);
  return woah;
}

export function spawnEtherealWind(x: number, y: number): EtherealWindState {
  const el = document.createElement('div');
  el.classList.add('etheralwind-element');
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;

  const core = document.createElement('div');
  core.classList.add('wind-core');
  const spiral1 = document.createElement('div');
  spiral1.classList.add('wind-spiral-1');
  const spiral2 = document.createElement('div');
  spiral2.classList.add('wind-spiral-2');
  const halo = document.createElement('div');
  halo.classList.add('wind-halo');

  el.appendChild(halo);
  el.appendChild(spiral2);
  el.appendChild(spiral1);
  el.appendChild(core);
  DOM.container.appendChild(el);

  el.addEventListener('animationend', function onSpawn(e: AnimationEvent) {
    if (e.animationName === 'windSpawnIn') {
      el.classList.add('etheralwind-breathing');
      el.removeEventListener('animationend', onSpawn);
    }
  });

  makeDraggable(el);

  const { noise, autoFilter, panner, outputNode } = createEtherealWindSound();
  noise.start();

  const wind: EtherealWindState = {
    el,
    noise,
    autoFilter,
    panner,
    outputNode,
    woahAffected: false,
    woahSends: new Map(),
  };

  for (const woah of SOUND.woahs) {
    registerSourceToWoah(wind, woah);
  }

  SOUND.etheralwinds.push(wind);
  return wind;
}

export function spawnModulator(x: number, y: number): ModulatorState {
  const el = document.createElement('div');
  el.classList.add('modulator-element');
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;

  const core = document.createElement('div');
  core.classList.add('mod-core');
  const ring = document.createElement('div');
  ring.classList.add('mod-ring');
  const radius = document.createElement('div');
  radius.classList.add('mod-radius');
  radius.style.setProperty('--mod-radius-size', `${MUSIC.MODULATOR_RADIUS * 2}px`);

  el.appendChild(radius);
  el.appendChild(ring);
  el.appendChild(core);
  DOM.container.appendChild(el);

  el.addEventListener('animationend', function onSpawn(e: AnimationEvent) {
    if (e.animationName === 'modSpawnIn') {
      el.classList.add('modulator-breathing');
      el.removeEventListener('animationend', onSpawn);
    }
  });

  makeDraggable(el);

  const mod: ModulatorState = { el, radius: MUSIC.MODULATOR_RADIUS };
  SOUND.modulators.push(mod);
  return mod;
}

export function spawnOrbit(x: number, y: number): OrbitState {
  const el = document.createElement('div');
  el.classList.add('orbit-element');
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;

  const core = document.createElement('div');
  core.classList.add('orbit-core');
  const ring1 = document.createElement('div');
  ring1.classList.add('orbit-ring-1');
  const ring2 = document.createElement('div');
  ring2.classList.add('orbit-ring-2');
  const radius = document.createElement('div');
  radius.classList.add('orbit-radius');
  radius.style.setProperty('--orbit-radius-size', `${MUSIC.ORBIT_RADIUS * 2}px`);

  el.appendChild(radius);
  el.appendChild(ring2);
  el.appendChild(ring1);
  el.appendChild(core);
  DOM.container.appendChild(el);

  el.addEventListener('animationend', function onSpawn(e: AnimationEvent) {
    if (e.animationName === 'orbitSpawnIn') {
      el.classList.add('orbit-breathing');
      el.removeEventListener('animationend', onSpawn);
    }
  });

  makeDraggable(el);

  const orbit: OrbitState = { el, radius: MUSIC.ORBIT_RADIUS };
  SOUND.orbits.push(orbit);
  return orbit;
}
