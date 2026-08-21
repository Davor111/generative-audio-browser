/* ============================================================
   Generative Audio Browser — app.js
   ============================================================ */

(() => {
  'use strict';

  /* ── DOM refs ── */
  const canvas               = document.getElementById('canvas');
  const container            = document.getElementById('elements-container');
  const startOverlay         = document.getElementById('start-overlay');
  const startBtn             = document.getElementById('start-btn');
  const toolbarOrbBtn        = document.getElementById('toolbar-orb');
  const toolbarTimewarpBtn   = document.getElementById('toolbar-timewarp');
  const toolbarDeeppadBtn    = document.getElementById('toolbar-deeppad');
  const toolbarWoahBtn       = document.getElementById('toolbar-woah');
  const toolbarEtheralwindBtn = document.getElementById('toolbar-etheralwind');
  const toolbarModulatorBtn  = document.getElementById('toolbar-modulator');
  const toolbarOrbitBtn      = document.getElementById('toolbar-orbit');
  const connectionsCanvas    = document.getElementById('connections-canvas');
  const ctx                  = connectionsCanvas.getContext('2d');

  /* ── Audio state ── */
  let audioReady = false;

  /* ── All active instances ── */
  const orbs         = [];
  const timewarps    = [];
  const deeppads     = [];
  const woahs        = [];
  const etheralwinds = [];
  const modulators   = [];
  const orbits       = [];

  /* ── Musical configuration ── */
  const NOTES = [
    'C3', 'D3', 'E3', 'G3', 'A3',
    'C4', 'D4', 'E4', 'G4', 'A4',
    'C5', 'D5', 'E5', 'G5', 'A5',
  ];

  // Deep bass drone notes (octaves 1 & 2)
  const BASS_NOTES = [
    'C1', 'G1', 'A1',
    'C2', 'D2', 'E2', 'G2', 'A2',
  ];

  const NOTE_INTERVAL_MS    = 500;
  const DEEPPAD_INTERVAL_MS = 5000;
  const TIMEWARP_RADIUS     = 200; // px — influence radius
  const WOAH_RADIUS         = 220; // px — delay + long reverb radius
  const MODULATOR_RADIUS    = 210; // px — harmonic drive/filter modulation radius
  const ORBIT_RADIUS        = 240; // px — orbital capture & trajectory radius

  /* ============================================================
     Audio Engine
     ============================================================ */

  let masterReverb, limiter;

  function initAudioEngine() {
    masterReverb = new Tone.Reverb({ decay: 3.5, wet: 0.35 }).toDestination();
    limiter      = new Tone.Limiter(-3).connect(masterReverb);
  }

  function createOrbSynth() {
    const detune = (Math.random() - 0.5) * 20;
    const synth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.08, decay: 0.3, sustain: 0.15, release: 0.6 },
    });
    synth.detune.value = detune;

    const distortion = new Tone.Distortion({
      distortion: 0.45,
      wet: 0.0,
    });

    const outputNode = new Tone.Gain(1).connect(limiter);
    synth.connect(distortion);
    distortion.connect(outputNode);

    return { synth, distortion, outputNode };
  }

  /**
   * Warm, low-register drone synth for Deep Pad
   */
  function createDeepPadSynth() {
    const baseFreq = 240 + Math.random() * 80;
    const filter = new Tone.Filter({
      frequency: baseFreq,
      type: 'lowpass',
      rolloff: -24,
    });

    const synth = new Tone.Synth({
      oscillator: { type: 'fatsawtooth', count: 3, spread: 25 },
      envelope: {
        attack: 1.8,
        decay: 1.5,
        sustain: 0.85,
        release: 2.5,
      },
      portamento: 1.2,
    }).connect(filter);

    synth.volume.value = -6;

    const distortion = new Tone.Distortion({
      distortion: 0.35,
      wet: 0.0,
    });

    const outputNode = new Tone.Gain(1).connect(limiter);
    filter.connect(distortion);
    distortion.connect(outputNode);

    return { synth, filter, distortion, outputNode, baseFreq };
  }

  /**
   * Dedicated Delay + Massive Cavern Reverb FX unit for each Woah element
   */
  function createWoahFX() {
    const inputGain = new Tone.Gain(1);

    // Rich ping-pong style feedback delay with long lingering repeats
    const delay = new Tone.PingPongDelay({
      delayTime: '8n.',
      feedback: 0.73,  // High feedback for long, evolving echo cascades
      wet: 1.0,        // 100% wet echo signal
    });

    // Dedicated delay tone filter to keep long echo repeats warm and analog-like
    const delayFilter = new Tone.Filter({
      frequency: 2800,
      type: 'lowpass',
    });

    // Massive 9.0-second space reverb
    const spaceReverb = new Tone.Reverb({
      decay: 9.0,
      preDelay: 0.05,
      wet: 0.75,
    });

    // Routing: input -> delay -> filter
    inputGain.connect(delay);
    delay.connect(delayFilter);

    // Send clear delay echoes directly to limiter
    const delayDirectGain = new Tone.Gain(0.8).connect(limiter);
    delayFilter.connect(delayDirectGain);

    // Also wash echoes through the cavern reverb
    delayFilter.connect(spaceReverb);
    spaceReverb.connect(limiter);

    return { inputGain, delay, delayFilter, spaceReverb };
  }

  /**
   * Ethereal Wind — White/pink noise with a slow continuous resonant filter sweep
   */
  function createEtherealWindSound() {
    const noise = new Tone.Noise({
      type: 'pink',
    });

    const sweepRate = 0.06 + (Math.random() - 0.5) * 0.02;
    const autoFilter = new Tone.AutoFilter({
      frequency: sweepRate,
      baseFrequency: 190 + Math.random() * 80,
      octaves: 4.3,
      filter: {
        type: 'bandpass',
        Q: 2.8,
        rolloff: -12,
      },
      depth: 0.95,
    }).start();

    const panner = new Tone.AutoPanner({
      frequency: 0.04,
      depth: 0.7,
    }).start();

    const outputNode = new Tone.Gain(0.55).connect(limiter);

    noise.connect(autoFilter);
    autoFilter.connect(panner);
    panner.connect(outputNode);

    return { noise, autoFilter, panner, outputNode };
  }

  /* ============================================================
     Note-Walking Algorithms
     ============================================================ */

  function walkNote(currentIdx, scale = NOTES) {
    const leap = Math.random() < 0.15;
    const maxStep = leap ? 4 : 2;
    const step = Math.floor(Math.random() * (maxStep * 2 + 1)) - maxStep;
    let next = currentIdx + step;
    if (next < 0) next += scale.length;
    if (next >= scale.length) next -= scale.length;
    return next;
  }

  /* ============================================================
     Helpers
     ============================================================ */

  /** Centre of a positioned element relative to #canvas */
  function getCenter(el) {
    return {
      x: parseFloat(el.style.left),
      y: parseFloat(el.style.top),
    };
  }

  function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** Generic dragging setup shared by elements */
  function makeDraggable(el, { onDragStart, onDragEnd } = {}) {
    let dragging = false;
    let offsetX = 0, offsetY = 0;

    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      dragging = true;
      el.classList.add('is-dragging');
      el.setPointerCapture(e.pointerId);

      const canvasRect = canvas.getBoundingClientRect();
      const currentX = parseFloat(el.style.left) || (e.clientX - canvasRect.left);
      const currentY = parseFloat(el.style.top) || (e.clientY - canvasRect.top);

      offsetX = (e.clientX - canvasRect.left) - currentX;
      offsetY = (e.clientY - canvasRect.top) - currentY;

      if (onDragStart) onDragStart();
    });

    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const canvasRect = canvas.getBoundingClientRect();
      let newX = (e.clientX - canvasRect.left) - offsetX;
      let newY = (e.clientY - canvasRect.top) - offsetY;

      // Keep within canvas bounds
      newX = Math.max(30, Math.min(canvasRect.width - 30, newX));
      newY = Math.max(30, Math.min(canvasRect.height - 30, newY));

      el.style.left = `${newX}px`;
      el.style.top = `${newY}px`;
    });

    const stop = (e) => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove('is-dragging');
      if (e && e.pointerId && el.hasPointerCapture(e.pointerId)) {
        el.releasePointerCapture(e.pointerId);
      }
      if (onDragEnd) onDragEnd();
    };

    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);
  }

  /* ============================================================
     Orb Element
     ============================================================ */

  function spawnOrb(x, y) {
    const el = document.createElement('div');
    el.classList.add('orb-element');
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    const hueShift = Math.floor(Math.random() * 40) - 20;
    el.style.setProperty('--orb-core', `hsl(${258 + hueShift}, 90%, 68%)`);
    el.style.setProperty('--orb-glow', `hsl(${258 + hueShift}, 82%, 52%)`);

    const breatheDur = 2.5 + Math.random() * 2;
    el.style.setProperty('--breathe-duration', `${breatheDur}s`);

    container.appendChild(el);

    el.addEventListener('animationend', function onSpawn(e) {
      if (e.animationName === 'orbSpawnIn') {
        el.classList.add('orb-breathing');
        el.removeEventListener('animationend', onSpawn);
      }
    });

    /* ── Audio ── */
    const { synth, distortion, outputNode } = createOrbSynth();
    let noteIdx = Math.floor(Math.random() * NOTES.length);

    /* ── Recursive setTimeout for dynamic timing ── */
    const orb = {
      el, synth, distortion, outputNode, noteIdx,
      warped: false,
      woahAffected: false,
      modAffected: false,
      woahSends: new Map(),
      timerId: null,
    };

    // Connect this orb to existing Woah effect nodes
    for (const woah of woahs) {
      registerSourceToWoah(orb, woah);
    }

    function scheduleNextNote() {
      let interval = NOTE_INTERVAL_MS;
      if (orb.warped) {
        interval = 150 + Math.random() * 700; // 150 – 850ms
      }

      orb.timerId = setTimeout(() => {
        orb.noteIdx = walkNote(orb.noteIdx, NOTES);
        synth.triggerAttackRelease(NOTES[orb.noteIdx], '8n');

        // Pulsate
        el.classList.remove('note-pulse');
        void el.offsetWidth;
        el.classList.add('note-pulse');

        scheduleNextNote();
      }, interval);
    }
    scheduleNextNote();

    /* ── Dragging ── */
    makeDraggable(el);

    orbs.push(orb);
    return orb;
  }

  /* ============================================================
     Time Warp Element
     ============================================================ */

  function spawnTimewarp(x, y) {
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
    radius.style.setProperty('--tw-radius-size', `${TIMEWARP_RADIUS * 2}px`);

    el.appendChild(radius);
    el.appendChild(ring);
    el.appendChild(core);
    container.appendChild(el);

    el.addEventListener('animationend', function onSpawn(e) {
      if (e.animationName === 'twSpawnIn') {
        el.classList.add('timewarp-breathing');
        el.removeEventListener('animationend', onSpawn);
      }
    });

    makeDraggable(el);

    const tw = { el, radius: TIMEWARP_RADIUS };
    timewarps.push(tw);
    return tw;
  }

  /* ============================================================
     Deep Pad Element
     ============================================================ */

  function spawnDeepPad(x, y) {
    const el = document.createElement('div');
    el.classList.add('deeppad-element');
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    const glowRing = document.createElement('div');
    glowRing.classList.add('deeppad-glow-ring');
    el.appendChild(glowRing);

    const breatheDur = 4.0 + Math.random() * 2;
    el.style.setProperty('--dp-breathe-duration', `${breatheDur}s`);

    container.appendChild(el);

    el.addEventListener('animationend', function onSpawn(e) {
      if (e.animationName === 'dpSpawnIn') {
        el.classList.add('deeppad-breathing');
        el.removeEventListener('animationend', onSpawn);
      }
    });

    /* ── Audio ── */
    const { synth, filter, distortion, outputNode, baseFreq } = createDeepPadSynth();
    let noteIdx = Math.floor(Math.random() * BASS_NOTES.length);

    synth.triggerAttack(BASS_NOTES[noteIdx]);

    /* ── Recursive drone note scheduler ── */
    const dp = {
      el, synth, filter, distortion, outputNode, baseFreq, noteIdx,
      warped: false,
      woahAffected: false,
      modAffected: false,
      woahSends: new Map(),
      timerId: null,
    };

    // Connect this pad to existing Woah effect nodes
    for (const woah of woahs) {
      registerSourceToWoah(dp, woah);
    }

    function scheduleNextPadNote() {
      let interval = DEEPPAD_INTERVAL_MS;
      if (dp.warped) {
        interval = 900 + Math.random() * 700; // 900ms – 1600ms
        synth.portamento = 0.35;
      } else {
        synth.portamento = 1.2;
      }

      dp.timerId = setTimeout(() => {
        dp.noteIdx = walkNote(dp.noteIdx, BASS_NOTES);
        const newNote = BASS_NOTES[dp.noteIdx];

        synth.setNote(newNote);

        el.classList.remove('dp-note-change');
        void el.offsetWidth;
        el.classList.add('dp-note-change');

        scheduleNextPadNote();
      }, interval);
    }
    scheduleNextPadNote();

    makeDraggable(el);

    deeppads.push(dp);
    return dp;
  }

  /* ============================================================
     Woah Element (Delay + Long Space Reverb)
     ============================================================ */

  function registerSourceToWoah(source, woah) {
    if (!source.woahSends.has(woah)) {
      const sendGain = new Tone.Gain(0);
      source.outputNode.connect(sendGain);
      sendGain.connect(woah.fx.inputGain);
      source.woahSends.set(woah, sendGain);
    }
  }

  function spawnWoah(x, y) {
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
    radius.style.setProperty('--woah-radius-size', `${WOAH_RADIUS * 2}px`);

    el.appendChild(radius);
    el.appendChild(echoRing2);
    el.appendChild(echoRing);
    el.appendChild(core);
    container.appendChild(el);

    el.addEventListener('animationend', function onSpawn(e) {
      if (e.animationName === 'woahSpawnIn') {
        el.classList.add('woah-breathing');
        el.removeEventListener('animationend', onSpawn);
      }
    });

    makeDraggable(el);

    /* ── Audio FX ── */
    const fx = createWoahFX();

    const woah = { el, radius: WOAH_RADIUS, fx, warped: false };

    // Register all existing sound sources to this new Woah instance
    for (const orb of orbs) {
      registerSourceToWoah(orb, woah);
    }
    for (const dp of deeppads) {
      registerSourceToWoah(dp, woah);
    }
    for (const wind of etheralwinds) {
      registerSourceToWoah(wind, woah);
    }

    woahs.push(woah);
    return woah;
  }

  /* ============================================================
     Ethereal Wind Element (White/Pink Noise Filter Sweep)
     ============================================================ */

  function spawnEtherealWind(x, y) {
    const el = document.createElement('div');
    el.classList.add('etheralwind-element');
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    const core     = document.createElement('div');
    core.classList.add('wind-core');
    const spiral1  = document.createElement('div');
    spiral1.classList.add('wind-spiral-1');
    const spiral2  = document.createElement('div');
    spiral2.classList.add('wind-spiral-2');
    const halo     = document.createElement('div');
    halo.classList.add('wind-halo');

    el.appendChild(halo);
    el.appendChild(spiral2);
    el.appendChild(spiral1);
    el.appendChild(core);
    container.appendChild(el);

    el.addEventListener('animationend', function onSpawn(e) {
      if (e.animationName === 'windSpawnIn') {
        el.classList.add('etheralwind-breathing');
        el.removeEventListener('animationend', onSpawn);
      }
    });

    makeDraggable(el);

    /* ── Audio ── */
    const { noise, autoFilter, panner, outputNode } = createEtherealWindSound();
    noise.start();

    const wind = {
      el,
      noise,
      autoFilter,
      panner,
      outputNode,
      woahAffected: false,
      woahSends: new Map(),
    };

    // Connect this wind to existing Woah effect nodes
    for (const woah of woahs) {
      registerSourceToWoah(wind, woah);
    }

    etheralwinds.push(wind);
    return wind;
  }

  /* ============================================================
     Modulator Element (Harmonic Distortion & Waveform Warper)
     ============================================================ */

  function spawnModulator(x, y) {
    const el = document.createElement('div');
    el.classList.add('modulator-element');
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    const core   = document.createElement('div');
    core.classList.add('mod-core');
    const ring   = document.createElement('div');
    ring.classList.add('mod-ring');
    const radius = document.createElement('div');
    radius.classList.add('mod-radius');
    radius.style.setProperty('--mod-radius-size', `${MODULATOR_RADIUS * 2}px`);

    el.appendChild(radius);
    el.appendChild(ring);
    el.appendChild(core);
    container.appendChild(el);

    el.addEventListener('animationend', function onSpawn(e) {
      if (e.animationName === 'modSpawnIn') {
        el.classList.add('modulator-breathing');
        el.removeEventListener('animationend', onSpawn);
      }
    });

    makeDraggable(el);

    const mod = { el, radius: MODULATOR_RADIUS };
    modulators.push(mod);
    return mod;
  }

  /* ============================================================
     Orbit Element (Gravitational Celestial Attractor)
     ============================================================ */

  function spawnOrbit(x, y) {
    const el = document.createElement('div');
    el.classList.add('orbit-element');
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;

    const core   = document.createElement('div');
    core.classList.add('orbit-core');
    const ring1  = document.createElement('div');
    ring1.classList.add('orbit-ring-1');
    const ring2  = document.createElement('div');
    ring2.classList.add('orbit-ring-2');
    const radius = document.createElement('div');
    radius.classList.add('orbit-radius');
    radius.style.setProperty('--orbit-radius-size', `${ORBIT_RADIUS * 2}px`);

    el.appendChild(radius);
    el.appendChild(ring2);
    el.appendChild(ring1);
    el.appendChild(core);
    container.appendChild(el);

    el.addEventListener('animationend', function onSpawn(e) {
      if (e.animationName === 'orbitSpawnIn') {
        el.classList.add('orbit-breathing');
        el.removeEventListener('animationend', onSpawn);
      }
    });

    makeDraggable(el);

    const orbit = { el, radius: ORBIT_RADIUS };
    orbits.push(orbit);
    return orbit;
  }

  /* ============================================================
     Proximity Detection & Connection Drawing
     ============================================================ */

  function resizeConnectionsCanvas() {
    const rect = canvas.getBoundingClientRect();
    connectionsCanvas.width = rect.width * devicePixelRatio;
    connectionsCanvas.height = rect.height * devicePixelRatio;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  resizeConnectionsCanvas();
  window.addEventListener('resize', resizeConnectionsCanvas);

  /** Run every frame: calculate orbital motion, proximity, audio modulation, and draw connections */
  function proximityLoop() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Reset states
    for (const orb of orbs) {
      orb.warped = false;
      orb.woahAffected = false;
      orb.modAffected = false;
    }
    for (const dp of deeppads) {
      dp.warped = false;
      dp.woahAffected = false;
      dp.modAffected = false;
    }
    for (const woah of woahs) {
      woah.warped = false;
    }
    for (const wind of etheralwinds) {
      wind.woahAffected = false;
    }

    /* ── 0. Orbit Physics (Move elements trapped in gravitational orbit) ── */
    const orbitableElements = [
      ...orbs,
      ...deeppads,
      ...timewarps,
      ...woahs,
      ...etheralwinds,
      ...modulators,
    ];

    for (const orbit of orbits) {
      const orbitCenter = getCenter(orbit.el);

      for (const item of orbitableElements) {
        // Do not orbit while actively dragged by the user
        if (item.el.classList.contains('is-dragging')) continue;

        const itemCenter = getCenter(item.el);
        const dist = distance(orbitCenter, itemCenter);

        if (dist <= orbit.radius && dist > 14) {
          const currentAngle = Math.atan2(itemCenter.y - orbitCenter.y, itemCenter.x - orbitCenter.x);
          // Rotation speed slightly faster the closer to the singularity core
          const angularSpeed = 0.012 + (1 - dist / orbit.radius) * 0.016;
          const newAngle = currentAngle + angularSpeed;

          let newX = orbitCenter.x + Math.cos(newAngle) * dist;
          let newY = orbitCenter.y + Math.sin(newAngle) * dist;

          // Keep within canvas bounds
          newX = Math.max(30, Math.min(rect.width - 30, newX));
          newY = Math.max(30, Math.min(rect.height - 30, newY));

          item.el.style.left = `${newX}px`;
          item.el.style.top = `${newY}px`;

          drawOrbitConnection(orbitCenter, itemCenter, dist, orbit.radius);
        }
      }
    }

    /* ── 1. Time Warp Proximity (Orbs, Deep Pads, Woahs) ── */
    for (const tw of timewarps) {
      const twCenter = getCenter(tw.el);

      // Orbs -> Randomized timing
      for (const orb of orbs) {
        const orbCenter = getCenter(orb.el);
        const dist = distance(twCenter, orbCenter);

        if (dist <= tw.radius) {
          orb.warped = true;
          drawTwConnection(twCenter, orbCenter, dist, tw.radius);
        }
      }

      // Deep Pads -> Accelerated note changes
      for (const dp of deeppads) {
        const dpCenter = getCenter(dp.el);
        const dist = distance(twCenter, dpCenter);

        if (dist <= tw.radius) {
          dp.warped = true;
          drawTwConnection(twCenter, dpCenter, dist, tw.radius);
        }
      }

      // Woah -> Accelerated delay speed (rapid echo flutter)
      for (const woah of woahs) {
        const woahCenter = getCenter(woah.el);
        const dist = distance(twCenter, woahCenter);

        if (dist <= tw.radius) {
          woah.warped = true;
          drawTwConnection(twCenter, woahCenter, dist, tw.radius);
        }
      }
    }

    // Modulate Woah delay speed based on warped state
    for (const woah of woahs) {
      if (woah.warped) {
        woah.fx.delay.delayTime.rampTo(0.11, 0.12);
      } else {
        woah.fx.delay.delayTime.rampTo(0.375, 0.2);
      }
      woah.el.classList.toggle('warped', woah.warped);
    }

    /* ── 2. Modulator Proximity (Harmonic Distortion / Filter Drive) ── */
    // Process Orbs
    for (const orb of orbs) {
      const orbCenter = getCenter(orb.el);
      let maxMod = 0;

      for (const mod of modulators) {
        const modCenter = getCenter(mod.el);
        const dist = distance(modCenter, orbCenter);

        if (dist <= mod.radius) {
          const modAmount = 1 - (dist / mod.radius);
          if (modAmount > maxMod) maxMod = modAmount;
          drawModConnection(modCenter, orbCenter, dist, mod.radius);
        }
      }

      if (maxMod > 0) {
        orb.modAffected = true;
        orb.distortion.wet.rampTo(maxMod * 0.85, 0.06);
      } else {
        orb.distortion.wet.rampTo(0, 0.1);
      }
    }

    // Process Deep Pads
    for (const dp of deeppads) {
      const dpCenter = getCenter(dp.el);
      let maxMod = 0;

      for (const mod of modulators) {
        const modCenter = getCenter(mod.el);
        const dist = distance(modCenter, dpCenter);

        if (dist <= mod.radius) {
          const modAmount = 1 - (dist / mod.radius);
          if (modAmount > maxMod) maxMod = modAmount;
          drawModConnection(modCenter, dpCenter, dist, mod.radius);
        }
      }

      if (maxMod > 0) {
        dp.modAffected = true;
        dp.distortion.wet.rampTo(maxMod * 0.8, 0.06);
        // Open up filter cutoff smoothly for rich harmonic brightness
        dp.filter.frequency.rampTo(dp.baseFreq + maxMod * 1200, 0.06);
      } else {
        dp.distortion.wet.rampTo(0, 0.1);
        dp.filter.frequency.rampTo(dp.baseFreq, 0.15);
      }
    }

    /* ── 3. Woah (Delay + Long Reverb) Proximity ── */
    const allSoundSources = [...orbs, ...deeppads, ...etheralwinds];

    for (const woah of woahs) {
      const woahCenter = getCenter(woah.el);

      for (const source of allSoundSources) {
        const sourceCenter = getCenter(source.el);
        const dist = distance(woahCenter, sourceCenter);
        const sendGainNode = source.woahSends.get(woah);

        if (dist <= woah.radius) {
          source.woahAffected = true;

          const closeness = 1 - (dist / woah.radius);
          const targetGain = Math.min(1.0, closeness * 1.2);

          if (sendGainNode) {
            sendGainNode.gain.rampTo(targetGain, 0.05);
          }

          // Draw emerald reverberant echo connection
          ctx.save();
          ctx.strokeStyle = `hsla(155, 95%, 52%, ${0.2 + closeness * 0.55})`;
          ctx.lineWidth = 1.5 + closeness * 2.5;
          ctx.beginPath();
          ctx.moveTo(woahCenter.x, woahCenter.y);
          ctx.lineTo(sourceCenter.x, sourceCenter.y);
          ctx.stroke();

          ctx.fillStyle = `hsla(155, 95%, 60%, ${0.4 + closeness * 0.5})`;
          ctx.beginPath();
          ctx.arc(sourceCenter.x, sourceCenter.y, 4 + closeness * 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          if (sendGainNode) {
            sendGainNode.gain.rampTo(0, 0.08);
          }
        }
      }
    }

    // Apply visual CSS classes
    for (const orb of orbs) {
      orb.el.classList.toggle('warped', orb.warped);
      orb.el.classList.toggle('woah-affected', orb.woahAffected);
      orb.el.classList.toggle('mod-affected', orb.modAffected);
    }
    for (const dp of deeppads) {
      dp.el.classList.toggle('warped', dp.warped);
      dp.el.classList.toggle('woah-affected', dp.woahAffected);
      dp.el.classList.toggle('mod-affected', dp.modAffected);
    }
    for (const wind of etheralwinds) {
      wind.el.classList.toggle('woah-affected', wind.woahAffected);
    }

    requestAnimationFrame(proximityLoop);
  }

  function drawTwConnection(from, to, dist, radius) {
    const alpha = 1 - (dist / radius);
    ctx.save();
    ctx.strokeStyle = `hsla(190, 80%, 60%, ${0.15 + alpha * 0.4})`;
    ctx.lineWidth = 1 + alpha * 1.5;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.fillStyle = `hsla(190, 85%, 65%, ${0.3 + alpha * 0.4})`;
    ctx.beginPath();
    ctx.arc(to.x, to.y, 3 + alpha * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawModConnection(from, to, dist, radius) {
    const alpha = 1 - (dist / radius);
    ctx.save();
    ctx.strokeStyle = `hsla(340, 95%, 60%, ${0.2 + alpha * 0.55})`;
    ctx.lineWidth = 1.5 + alpha * 2.2;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    ctx.fillStyle = `hsla(340, 100%, 68%, ${0.4 + alpha * 0.5})`;
    ctx.beginPath();
    ctx.arc(to.x, to.y, 4 + alpha * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawOrbitConnection(from, to, dist, radius) {
    const alpha = 1 - (dist / radius);
    ctx.save();
    // Circular orbital trajectory guide line
    ctx.strokeStyle = `hsla(45, 100%, 60%, ${0.15 + alpha * 0.35})`;
    ctx.lineWidth = 1 + alpha * 1.2;
    ctx.setLineDash([2, 5]);
    ctx.beginPath();
    ctx.arc(from.x, from.y, dist, 0, Math.PI * 2);
    ctx.stroke();

    // Beam to orbiting body
    ctx.setLineDash([1, 4]);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    // Orbiting particle tracker
    ctx.setLineDash([]);
    ctx.fillStyle = `hsla(45, 100%, 75%, ${0.4 + alpha * 0.5})`;
    ctx.beginPath();
    ctx.arc(to.x, to.y, 3 + alpha * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  requestAnimationFrame(proximityLoop);

  /* ============================================================
     Start / Audio Init
     ============================================================ */

  async function startAudio() {
    await Tone.start();
    Tone.getDestination().volume.value = -8;
    initAudioEngine();
    audioReady = true;
    startOverlay.classList.add('hidden');
  }

  startBtn.addEventListener('click', startAudio);

  /* ============================================================
     Toolbar → Canvas: Drag & Drop
     ============================================================ */

  function setupToolbarDrag(btn, type) {
    btn.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', type);
      e.dataTransfer.effectAllowed = 'copy';
    });
  }

  setupToolbarDrag(toolbarOrbBtn, 'orb');
  setupToolbarDrag(toolbarTimewarpBtn, 'timewarp');
  setupToolbarDrag(toolbarDeeppadBtn, 'deeppad');
  setupToolbarDrag(toolbarWoahBtn, 'woah');
  setupToolbarDrag(toolbarEtheralwindBtn, 'etheralwind');
  setupToolbarDrag(toolbarModulatorBtn, 'modulator');
  setupToolbarDrag(toolbarOrbitBtn, 'orbit');

  canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    canvas.classList.add('drag-over');
  });

  canvas.addEventListener('dragleave', () => {
    canvas.classList.remove('drag-over');
  });

  canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    canvas.classList.remove('drag-over');
    if (!audioReady) return;

    const type = e.dataTransfer.getData('text/plain');
    const canvasRect = canvas.getBoundingClientRect();
    const x = e.clientX - canvasRect.left;
    const y = e.clientY - canvasRect.top;

    if (type === 'orb') spawnOrb(x, y);
    if (type === 'timewarp') spawnTimewarp(x, y);
    if (type === 'deeppad') spawnDeepPad(x, y);
    if (type === 'woah') spawnWoah(x, y);
    if (type === 'etheralwind') spawnEtherealWind(x, y);
    if (type === 'modulator') spawnModulator(x, y);
    if (type === 'orbit') spawnOrbit(x, y);
  });

  /* ── Click as alternative to dragging ── */
  function setupToolbarClick(btn, spawnFn) {
    btn.addEventListener('click', () => {
      if (!audioReady) return;
      const rect = canvas.getBoundingClientRect();
      const pad = 100;
      const x = pad + Math.random() * (rect.width - pad * 2);
      const y = pad + Math.random() * (rect.height - pad * 2);
      spawnFn(x, y);
    });
  }

  setupToolbarClick(toolbarOrbBtn, spawnOrb);
  setupToolbarClick(toolbarTimewarpBtn, spawnTimewarp);
  setupToolbarClick(toolbarDeeppadBtn, spawnDeepPad);
  setupToolbarClick(toolbarWoahBtn, spawnWoah);
  setupToolbarClick(toolbarEtheralwindBtn, spawnEtherealWind);
  setupToolbarClick(toolbarModulatorBtn, spawnModulator);
  setupToolbarClick(toolbarOrbitBtn, spawnOrbit);

})();
