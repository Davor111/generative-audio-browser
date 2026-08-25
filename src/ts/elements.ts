import { Gain, Frequency, Time } from 'tone';
import { DOM, SOUND, MUSIC } from './state';
import {
  createOrbSynth,
  createDeepPadSynth,
  createWoahFX,
  createEtherealWindSound,
  createVoiceFX,
  VOICE_FX_DEFAULTS,
  walkNote,
} from './audio-engine';
import { createPlaitsVoice, PARAMS } from './plaits';
import { makeDraggable, applyLineVisuals, applyPingVisuals } from './utils';
import { DEFAULT_SCALE, buildScale } from './scales';
import { bindOrbContextMenu } from './orb-editor';
import { bindPadContextMenu } from './pad-editor';
import { bindWindContextMenu } from './wind-editor';
import { bindPowerSynthContextMenu } from './powersynth-editor';
import { bindLineContextMenu } from './line-editor';
import { bindPingContextMenu } from './ping-editor';
import type {
  OrbState,
  DeepPadState,
  TimewarpState,
  WoahState,
  EtherealWindState,
  ModulatorState,
  OrbitState,
  LineState,
  PingState,
  PowerSynthState,
  WoahSource,
} from '../types';

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

  DOM.container.appendChild(el);

  const editHint = document.createElement('span');
  editHint.classList.add('orb-edit-hint');
  editHint.textContent = 'right click to edit';
  el.appendChild(editHint);

  const { synth, distortion, outputNode } = createOrbSynth();
  const notes = buildScale('C', 3, DEFAULT_SCALE, 3);

  const orb: OrbState = {
    el,
    synth,
    distortion,
    outputNode,
    noteIdx: Math.floor(Math.random() * notes.length),
    noteDuration: '8n',
    noteIntervalMs: MUSIC.NOTE_INTERVAL_MS,
    autoplay: true,
    scale: DEFAULT_SCALE,
    root: 'C',
    baseOctave: 3,
    octaves: 3,
    notes,
    warped: false,
    woahAffected: false,
    modAffected: false,
    woahSends: new Map(),
    timerId: null,
    setAutoplay(on: boolean) {
      if (on) {
        if (orb.timerId === null) scheduleNextNote();
      } else if (orb.timerId !== null) {
        clearTimeout(orb.timerId);
        orb.timerId = null;
      }
    },
    trigger: () => playNote(),
  };

  for (const woah of SOUND.woahs) {
    registerSourceToWoah(orb, woah);
  }

  function playNote(): void {
    orb.noteIdx = walkNote(orb.noteIdx, orb.notes);
    synth.triggerAttackRelease(orb.notes[orb.noteIdx], orb.noteDuration);

    el.classList.remove('note-pulse');
    void el.offsetWidth;
    el.classList.add('note-pulse');
  }

  function scheduleNextNote(): void {
    // Nulling the timer here keeps the invariant setAutoplay relies on:
    // timerId is non-null exactly while a tick is pending.
    if (!orb.autoplay) {
      orb.timerId = null;
      return;
    }

    let interval = orb.noteIntervalMs;
    if (orb.warped) {
      interval = 150 + Math.random() * 700;
    }

    orb.timerId = setTimeout(() => {
      playNote();
      scheduleNextNote();
    }, interval);
  }
  scheduleNextNote();

  makeDraggable(el, {
    onErase: () => removeOrb(orb),
    // Only meaningful with autoplay off; otherwise the loop is already playing
    // and a stray tap would double up a note.
    onTap: () => {
      if (!orb.autoplay) orb.trigger();
    },
  });
  bindOrbContextMenu(orb);

  SOUND.orbs.push(orb);
  return orb;
}

export function removeOrb(orb: OrbState): void {
  if (orb.timerId !== null) clearTimeout(orb.timerId);
  for (const gain of orb.woahSends.values()) gain.dispose();
  orb.synth.dispose();
  orb.distortion.dispose();
  orb.outputNode.dispose();
  orb.el.remove();
  const idx = SOUND.orbs.indexOf(orb);
  if (idx !== -1) SOUND.orbs.splice(idx, 1);
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

  const tw: TimewarpState = { el, radius: MUSIC.TIMEWARP_RADIUS };
  makeDraggable(el, { onErase: () => removeTimewarp(tw) });
  SOUND.timewarps.push(tw);
  return tw;
}

export function removeTimewarp(tw: TimewarpState): void {
  tw.el.remove();
  const idx = SOUND.timewarps.indexOf(tw);
  if (idx !== -1) SOUND.timewarps.splice(idx, 1);
}

export function spawnDeepPad(x: number, y: number): DeepPadState {
  const el = document.createElement('div');
  el.classList.add('deeppad-element');
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;

  const glowRing = document.createElement('div');
  glowRing.classList.add('deeppad-glow-ring');
  el.appendChild(glowRing);

  DOM.container.appendChild(el);

  const editHint = document.createElement('span');
  editHint.classList.add('dp-edit-hint');
  editHint.textContent = 'right click to edit';
  el.appendChild(editHint);

  const { synth, filter, distortion, outputNode, baseFreq } = createDeepPadSynth();
  const notes = buildScale('C', 1, DEFAULT_SCALE, 2);
  const startIdx = Math.floor(Math.random() * notes.length);

  synth.triggerAttack(notes[startIdx]);

  const dp: DeepPadState = {
    el,
    synth,
    filter,
    distortion,
    outputNode,
    baseFreq,
    noteIdx: startIdx,
    noteIntervalMs: MUSIC.DEEPPAD_INTERVAL_MS,
    autoplay: true,
    scale: DEFAULT_SCALE,
    root: 'C',
    baseOctave: 1,
    octaves: 2,
    notes,
    warped: false,
    woahAffected: false,
    modAffected: false,
    woahSends: new Map(),
    timerId: null,
    setAutoplay(on: boolean) {
      if (on) {
        // Deep Pad drones rather than firing discrete notes, so switching it
        // back on means re-attacking, not just resuming the timer.
        synth.triggerAttack(dp.notes[dp.noteIdx]);
        if (dp.timerId === null) scheduleNextPadNote();
      } else {
        if (dp.timerId !== null) {
          clearTimeout(dp.timerId);
          dp.timerId = null;
        }
        synth.triggerRelease();
      }
    },
    trigger() {
      // While autoplay is on the voice is sustaining, so an attackRelease
      // would cut the drone off — move the pitch instead. Only when the drone
      // is released does a trigger mean a fresh swell.
      if (dp.autoplay) synth.setNote(advanceNote());
      else synth.triggerAttackRelease(advanceNote(), '2n');
    },
  };

  for (const woah of SOUND.woahs) {
    registerSourceToWoah(dp, woah);
  }

  function advanceNote(): string {
    dp.noteIdx = walkNote(dp.noteIdx, dp.notes);

    el.classList.remove('dp-note-change');
    void el.offsetWidth;
    el.classList.add('dp-note-change');

    return dp.notes[dp.noteIdx];
  }

  function scheduleNextPadNote(): void {
    if (!dp.autoplay) {
      dp.timerId = null;
      return;
    }

    let interval = dp.noteIntervalMs;
    if (dp.warped) {
      interval = 900 + Math.random() * 700;
      synth.portamento = 0.35;
    } else {
      synth.portamento = 1.2;
    }

    dp.timerId = setTimeout(() => {
      synth.setNote(advanceNote());
      scheduleNextPadNote();
    }, interval);
  }
  scheduleNextPadNote();

  makeDraggable(el, {
    onErase: () => removeDeepPad(dp),
    // The drone is released while autoplay is off, so a tap is a one-off
    // swell rather than a note on top of a sustaining voice.
    onTap: () => {
      if (!dp.autoplay) dp.trigger();
    },
  });
  bindPadContextMenu(dp);

  SOUND.deeppads.push(dp);
  return dp;
}

export function removeDeepPad(dp: DeepPadState): void {
  if (dp.timerId !== null) clearTimeout(dp.timerId);
  for (const gain of dp.woahSends.values()) gain.dispose();
  dp.synth.dispose();
  dp.filter.dispose();
  dp.distortion.dispose();
  dp.outputNode.dispose();
  dp.el.remove();
  const idx = SOUND.deeppads.indexOf(dp);
  if (idx !== -1) SOUND.deeppads.splice(idx, 1);
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

  const fx = createWoahFX();
  const woah: WoahState = { el, radius: MUSIC.WOAH_RADIUS, fx, warped: false };
  makeDraggable(el, { onErase: () => removeWoah(woah) });

  for (const orb of SOUND.orbs) registerSourceToWoah(orb, woah);
  for (const dp of SOUND.deeppads) registerSourceToWoah(dp, woah);
  for (const wind of SOUND.etheralwinds) registerSourceToWoah(wind, woah);

  SOUND.woahs.push(woah);
  return woah;
}

export function removeWoah(woah: WoahState): void {
  const sources: WoahSource[] = [...SOUND.orbs, ...SOUND.deeppads, ...SOUND.etheralwinds];
  for (const source of sources) {
    const gain = source.woahSends.get(woah);
    if (gain) {
      gain.dispose();
      source.woahSends.delete(woah);
    }
  }
  woah.fx.inputGain.dispose();
  woah.fx.delay.dispose();
  woah.fx.delayFilter.dispose();
  woah.fx.spaceReverb.dispose();
  woah.el.remove();
  const idx = SOUND.woahs.indexOf(woah);
  if (idx !== -1) SOUND.woahs.splice(idx, 1);
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

  const editHint = document.createElement('span');
  editHint.classList.add('wind-edit-hint');
  editHint.textContent = 'right click to edit';
  el.appendChild(editHint);

  const { noise, autoFilter, panner, outputNode } = createEtherealWindSound();
  noise.start();

  const wind: EtherealWindState = {
    el,
    noise,
    autoFilter,
    panner,
    outputNode,
    autoplay: true,
    woahAffected: false,
    woahSends: new Map(),
    setAutoplay(on: boolean) {
      // Unpitched, so there is nothing to schedule — the toggle simply starts
      // and stops the noise source. Restarting a stopped Tone.Noise is fine.
      if (on) noise.start();
      else noise.stop();
    },
  };
  makeDraggable(el, { onErase: () => removeEtherealWind(wind) });
  bindWindContextMenu(wind);

  for (const woah of SOUND.woahs) {
    registerSourceToWoah(wind, woah);
  }

  SOUND.etheralwinds.push(wind);
  return wind;
}

export function removeEtherealWind(wind: EtherealWindState): void {
  for (const gain of wind.woahSends.values()) gain.dispose();
  wind.noise.dispose();
  wind.autoFilter.dispose();
  wind.panner.dispose();
  wind.outputNode.dispose();
  wind.el.remove();
  const idx = SOUND.etheralwinds.indexOf(wind);
  if (idx !== -1) SOUND.etheralwinds.splice(idx, 1);
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

  const mod: ModulatorState = { el, radius: MUSIC.MODULATOR_RADIUS };
  makeDraggable(el, { onErase: () => removeModulator(mod) });
  SOUND.modulators.push(mod);
  return mod;
}

export function removeModulator(mod: ModulatorState): void {
  mod.el.remove();
  const idx = SOUND.modulators.indexOf(mod);
  if (idx !== -1) SOUND.modulators.splice(idx, 1);
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

  const orbit: OrbitState = { el, radius: MUSIC.ORBIT_RADIUS };
  makeDraggable(el, { onErase: () => removeOrbit(orbit) });
  SOUND.orbits.push(orbit);
  return orbit;
}

export function removeOrbit(orbit: OrbitState): void {
  orbit.el.remove();
  const idx = SOUND.orbits.indexOf(orbit);
  if (idx !== -1) SOUND.orbits.splice(idx, 1);
}

/** Defaults a freshly placed Line starts with; the editor reads these back. */
export const LINE_DEFAULTS = {
  angle: 0,
  length: MUSIC.LINE_RADIUS * 2,
  speed: 1.6,
};

export function spawnLine(x: number, y: number): LineState {
  const el = document.createElement('div');
  el.classList.add('line-element');
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;

  const radius = document.createElement('div');
  radius.classList.add('line-radius');
  radius.style.setProperty('--line-radius-size', `${MUSIC.LINE_RADIUS * 2}px`);
  const rail = document.createElement('div');
  rail.classList.add('line-rail');
  const core = document.createElement('div');
  core.classList.add('line-core');

  el.appendChild(radius);
  el.appendChild(rail);
  el.appendChild(core);
  DOM.container.appendChild(el);

  const editHint = document.createElement('span');
  editHint.classList.add('line-edit-hint');
  editHint.textContent = 'right click to edit';
  el.appendChild(editHint);

  const line: LineState = {
    el,
    radius: MUSIC.LINE_RADIUS,
    angle: LINE_DEFAULTS.angle,
    length: LINE_DEFAULTS.length,
    speed: LINE_DEFAULTS.speed,
    directions: new WeakMap(),
  };

  applyLineVisuals(line);

  makeDraggable(el, { onErase: () => removeLine(line) });
  bindLineContextMenu(line);

  SOUND.lines.push(line);
  return line;
}

/** Defaults a freshly placed Ping starts with; the editor reads these back. */
export const PING_DEFAULTS = {
  speed: 4,
  intervalMs: 2000,
};

export function spawnPing(x: number, y: number): PingState {
  const el = document.createElement('div');
  el.classList.add('ping-element');
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;

  const reachRing = document.createElement('div');
  reachRing.classList.add('ping-reach');
  const ring1 = document.createElement('div');
  ring1.classList.add('ping-ring-1');
  const ring2 = document.createElement('div');
  ring2.classList.add('ping-ring-2');
  const core = document.createElement('div');
  core.classList.add('ping-core');

  el.appendChild(reachRing);
  el.appendChild(ring2);
  el.appendChild(ring1);
  el.appendChild(core);
  DOM.container.appendChild(el);

  const editHint = document.createElement('span');
  editHint.classList.add('ping-edit-hint');
  editHint.textContent = 'right click to edit';
  el.appendChild(editHint);

  const ping: PingState = {
    el,
    reach: MUSIC.PING_REACH,
    speed: PING_DEFAULTS.speed,
    autoplay: true,
    intervalMs: PING_DEFAULTS.intervalMs,
    ripples: [],
    timerId: null,
    setAutoplay(on: boolean) {
      if (on) {
        if (ping.timerId === null) scheduleNextPing();
      } else if (ping.timerId !== null) {
        clearTimeout(ping.timerId);
        ping.timerId = null;
      }
    },
    trigger() {
      // The proximity loop owns expansion and hit-testing; throwing a ripple
      // is just adding one to the list.
      ping.ripples.push({ radius: 0, hit: new Set() });
      el.classList.remove('ping-pulse');
      void el.offsetWidth;
      el.classList.add('ping-pulse');
    },
  };

  function scheduleNextPing(): void {
    // Same invariant the generators keep: timerId is non-null exactly while a
    // tick is pending, which is what stops setAutoplay double-scheduling.
    if (!ping.autoplay) {
      ping.timerId = null;
      return;
    }
    ping.timerId = setTimeout(() => {
      ping.trigger();
      scheduleNextPing();
    }, ping.intervalMs);
  }
  scheduleNextPing();

  applyPingVisuals(ping);

  makeDraggable(el, {
    onErase: () => removePing(ping),
    // A hand-thrown stone, whether or not it is also pinging on its own.
    onTap: () => ping.trigger(),
  });
  bindPingContextMenu(ping);

  SOUND.pings.push(ping);
  return ping;
}

export function removePing(ping: PingState): void {
  if (ping.timerId !== null) clearTimeout(ping.timerId);
  ping.ripples.length = 0;
  ping.el.remove();
  const idx = SOUND.pings.indexOf(ping);
  if (idx !== -1) SOUND.pings.splice(idx, 1);
}

export function removeLine(line: LineState): void {
  line.el.remove();
  const idx = SOUND.lines.indexOf(line);
  if (idx !== -1) SOUND.lines.splice(idx, 1);
}

export function spawnPowerSynth(x: number, y: number): PowerSynthState {
  const el = document.createElement('div');
  el.classList.add('powersynth-element', 'powersynth-loading');
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;

  DOM.container.appendChild(el);

  const editHint = document.createElement('span');
  editHint.classList.add('powersynth-edit-hint');
  editHint.textContent = 'right click to edit';
  el.appendChild(editHint);

  // The output gain exists before the voice does: spawn is synchronous, so
  // Woah sends and element state have to be wired up now, while the wasm may
  // still be loading.
  const outputNode = new Gain(1).connect(SOUND.limiter!);

  // Inserted between the voice and outputNode, so volume and the Woah sends
  // both stay downstream of the effects.
  const fx = createVoiceFX(outputNode);

  const psNotes = buildScale('C', 3, DEFAULT_SCALE, 3);

  const powerSynth: PowerSynthState = {
    el,
    voice: null,
    outputNode,
    fx,
    noteIdx: Math.floor(Math.random() * psNotes.length),
    noteDuration: '8n',
    noteIntervalMs: MUSIC.NOTE_INTERVAL_MS,
    engine: 8,
    autoplay: true,
    scale: DEFAULT_SCALE,
    root: 'C',
    baseOctave: 3,
    octaves: 3,
    notes: psNotes,
    baseTimbre: 0.5,
    baseMorph: 0.5,
    harmonics: 0.5,
    fmAmount: 0,
    timbreMod: 0,
    morphMod: 0,
    decay: 0.5,
    lpgColour: 0.5,
    delayTime: VOICE_FX_DEFAULTS.delayTime,
    delayFeedback: VOICE_FX_DEFAULTS.feedback,
    delayMix: VOICE_FX_DEFAULTS.delayMix,
    reverbSend: VOICE_FX_DEFAULTS.reverbSend,
    mix: 0,
    warped: false,
    woahAffected: false,
    modAffected: false,
    woahSends: new Map(),
    timerId: null,
    releaseTimerId: null,
    disposed: false,
    setAutoplay(on: boolean) {
      if (on) {
        // The engine may still be loading; the load handler starts the loop
        // itself, and it checks autoplay before doing so.
        if (powerSynth.voice && powerSynth.timerId === null) scheduleNextNote();
      } else if (powerSynth.timerId !== null) {
        clearTimeout(powerSynth.timerId);
        powerSynth.timerId = null;
      }
    },
    trigger: () => triggerNote(),
  };

  for (const woah of SOUND.woahs) {
    registerSourceToWoah(powerSynth, woah);
  }

  function triggerNote(): void {
    const voice = powerSynth.voice;
    if (!voice) return;

    powerSynth.noteIdx = walkNote(powerSynth.noteIdx, powerSynth.notes);
    const midi = Frequency(powerSynth.notes[powerSynth.noteIdx]).toMidi();

    // NOTE goes first so the voice picks the pitch up on the rising edge
    // rather than a block late. MOD_LEVEL is what opens the low-pass gate —
    // without it the sustained engines stay inaudible.
    voice.setParam(PARAMS.NOTE, midi);
    voice.setParam(PARAMS.MOD_LEVEL, 1);
    voice.setParam(PARAMS.MOD_TRIGGER, 1);

    // Cleared before re-arming: at short intervals with long note lengths a
    // new note can fire before the previous release, and a stale timer would
    // gate the new note off early.
    if (powerSynth.releaseTimerId !== null) clearTimeout(powerSynth.releaseTimerId);
    powerSynth.releaseTimerId = setTimeout(() => {
      voice.setParam(PARAMS.MOD_TRIGGER, 0);
      voice.setParam(PARAMS.MOD_LEVEL, 0);
    }, Time(powerSynth.noteDuration).toMilliseconds());

    el.classList.remove('note-pulse');
    void el.offsetWidth;
    el.classList.add('note-pulse');
  }

  function scheduleNextNote(): void {
    if (!powerSynth.autoplay) {
      powerSynth.timerId = null;
      return;
    }

    let interval = powerSynth.noteIntervalMs;
    if (powerSynth.warped) {
      interval = 150 + Math.random() * 700;
    }

    powerSynth.timerId = setTimeout(() => {
      triggerNote();
      scheduleNextNote();
    }, interval);
  }

  void (async () => {
    try {
      const voice = await createPlaitsVoice(fx.input);
      // The element may have been erased while the engine was loading.
      if (powerSynth.disposed) {
        voice.dispose();
        return;
      }
      powerSynth.voice = voice;
      // Replayed from element state rather than hardcoded: the dialog may
      // have been edited while the engine was still loading.
      voice.setParam(PARAMS.ENGINE, powerSynth.engine);
      voice.setParam(PARAMS.HARMONICS, powerSynth.harmonics);
      voice.setParam(PARAMS.TIMBRE, powerSynth.baseTimbre);
      voice.setParam(PARAMS.MORPH, powerSynth.baseMorph);
      voice.setParam(PARAMS.FM_AMOUNT, powerSynth.fmAmount);
      voice.setParam(PARAMS.TIMBRE_MOD_AMOUNT, powerSynth.timbreMod);
      voice.setParam(PARAMS.MORPH_MOD_AMOUNT, powerSynth.morphMod);
      voice.setParam(PARAMS.DECAY, powerSynth.decay);
      voice.setParam(PARAMS.LPG_COLOUR, powerSynth.lpgColour);
      voice.setMix(powerSynth.mix);
      el.classList.remove('powersynth-loading');
      scheduleNextNote();
    } catch (err) {
      if (powerSynth.disposed) return;
      console.error('Power Synth engine failed to load', err);
      el.classList.remove('powersynth-loading');
      el.classList.add('powersynth-error');
    }
  })();

  makeDraggable(el, {
    onErase: () => removePowerSynth(powerSynth),
    onTap: () => {
      if (!powerSynth.autoplay) powerSynth.trigger();
    },
  });
  bindPowerSynthContextMenu(powerSynth);

  SOUND.powersynths.push(powerSynth);
  return powerSynth;
}

export function removePowerSynth(powerSynth: PowerSynthState): void {
  powerSynth.disposed = true;
  if (powerSynth.timerId !== null) clearTimeout(powerSynth.timerId);
  if (powerSynth.releaseTimerId !== null) clearTimeout(powerSynth.releaseTimerId);
  for (const gain of powerSynth.woahSends.values()) gain.dispose();
  powerSynth.voice?.dispose();
  powerSynth.fx.dispose();
  powerSynth.outputNode.dispose();
  powerSynth.el.remove();
  const idx = SOUND.powersynths.indexOf(powerSynth);
  if (idx !== -1) SOUND.powersynths.splice(idx, 1);
}
