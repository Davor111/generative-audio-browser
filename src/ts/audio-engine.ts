import {
  Reverb,
  Limiter,
  Synth,
  Gain,
  WaveShaper,
  Filter,
  PingPongDelay,
  AutoFilter,
  AutoPanner,
  Noise,
} from 'tone';
import { SOUND, MUSIC } from './state';

export function initAudioEngine(): void {
  const reverb = new Reverb({ decay: 3.5, wet: 0.35 }).toDestination();
  SOUND.masterReverb = reverb;
  SOUND.limiter = new Limiter(-3).connect(reverb);
}

export interface SimpleDistortion {
  input: Gain;
  output: Gain;
  wet: { value: number; rampTo(target: number, rampTime: number): void };
  dispose(): void;
}

/**
 * A hand-rolled WaveShaper distortion with a plain-Gain dry/wet mix — same
 * curve math as Tone.Distortion, but without Tone's Effect/CrossFade base
 * class (which internally mixes via a StereoPannerNode + ChannelSplitter).
 * That CrossFade machinery — at ANY wet value, even fully dry or fully wet,
 * with or without automation — reliably corrupts Chromium's Web Audio graph
 * into permanent silence once paired with a synth that repeatedly retriggers
 * its own envelope (i.e. any of this app's note-scheduling loops). A plain
 * two-Gain dry/wet mix does not exhibit the bug.
 */
function createDistortion(amount: number, initialWet: number): SimpleDistortion {
  const k = amount * 100;
  const deg = Math.PI / 180;
  const shaper = new WaveShaper((x: number) => {
    if (Math.abs(x) < 0.001) return 0;
    return ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }, 4096);

  const input = new Gain(1);
  const dryGain = new Gain(1 - initialWet);
  const wetGain = new Gain(initialWet);
  const output = new Gain(1);

  input.connect(dryGain);
  dryGain.connect(output);
  input.connect(shaper);
  shaper.connect(wetGain);
  wetGain.connect(output);

  let currentWet = initialWet;

  return {
    input,
    output,
    wet: {
      get value() {
        return currentWet;
      },
      rampTo(target: number, rampTime: number) {
        currentWet = target;
        wetGain.gain.rampTo(target, rampTime);
        dryGain.gain.rampTo(1 - target, rampTime);
      },
    },
    dispose() {
      shaper.dispose();
      input.dispose();
      dryGain.dispose();
      wetGain.dispose();
      output.dispose();
    },
  };
}

export function createOrbSynth() {
  const detune = (Math.random() - 0.5) * 20;
  const synth = new Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.08, decay: 0.3, sustain: 0.15, release: 0.6 },
  });
  synth.detune.value = detune;

  const distortion = createDistortion(0.45, 0.0);
  const outputNode = new Gain(1).connect(SOUND.limiter!);
  synth.connect(distortion.input);
  distortion.output.connect(outputNode);

  return { synth, distortion, outputNode };
}

export function createDeepPadSynth() {
  const baseFreq = 240 + Math.random() * 80;
  const filter = new Filter({ frequency: baseFreq, type: 'lowpass', rolloff: -24 });

  const synth = new Synth({
    oscillator: { type: 'fatsawtooth' } as never,
    envelope: { attack: 1.8, decay: 1.5, sustain: 0.85, release: 2.5 },
    portamento: 1.2,
  }).connect(filter);

  synth.volume.value = -6;

  const distortion = createDistortion(0.35, 0.0);
  const outputNode = new Gain(1).connect(SOUND.limiter!);
  filter.connect(distortion.input);
  distortion.output.connect(outputNode);

  return { synth, filter, distortion, outputNode, baseFreq };
}

export function createWoahFX() {
  const inputGain = new Gain(1);

  const delay = new PingPongDelay({ delayTime: '8n.', feedback: 0.73, wet: 1.0 });
  const delayFilter = new Filter({ frequency: 2800, type: 'lowpass' });

  const spaceReverb = new Reverb({ decay: 9.0, preDelay: 0.05, wet: 0.75 });

  inputGain.connect(delay);
  delay.connect(delayFilter);

  const delayDirectGain = new Gain(0.8).connect(SOUND.limiter!);
  delayFilter.connect(delayDirectGain);
  delayFilter.connect(spaceReverb);
  spaceReverb.connect(SOUND.limiter!);

  return { inputGain, delay, delayFilter, spaceReverb };
}

export function createEtherealWindSound() {
  const noise = new Noise({ type: 'pink' });

  const sweepRate = 0.06 + (Math.random() - 0.5) * 0.02;
  const autoFilter = new AutoFilter({
    frequency: sweepRate,
    baseFrequency: 190 + Math.random() * 80,
    octaves: 4.3,
    filter: { type: 'bandpass', Q: 2.8, rolloff: -12 },
    depth: 0.95,
  }).start();

  const panner = new AutoPanner({ frequency: 0.04, depth: 0.7 }).start();

  const outputNode = new Gain(0.55).connect(SOUND.limiter!);

  noise.connect(autoFilter);
  autoFilter.connect(panner);
  panner.connect(outputNode);

  return { noise, autoFilter, panner, outputNode };
}

export function walkNote(currentIdx: number, scale: string[] = MUSIC.NOTES): number {
  const leap = Math.random() < 0.15;
  const maxStep = leap ? 4 : 2;
  const step = Math.floor(Math.random() * (maxStep * 2 + 1)) - maxStep;
  let next = currentIdx + step;
  if (next < 0) next += scale.length;
  if (next >= scale.length) next -= scale.length;
  return next;
}
