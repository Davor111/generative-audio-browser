import {
  Reverb,
  Limiter,
  Synth,
  Distortion,
  Gain,
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

export function createOrbSynth() {
  const detune = (Math.random() - 0.5) * 20;
  const synth = new Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.08, decay: 0.3, sustain: 0.15, release: 0.6 },
  });
  synth.detune.value = detune;

  const distortion = new Distortion({ distortion: 0.45, wet: 0.0 });
  const outputNode = new Gain(1).connect(SOUND.limiter!);
  synth.connect(distortion);
  distortion.connect(outputNode);

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

  const distortion = new Distortion({ distortion: 0.35, wet: 0.0 });
  const outputNode = new Gain(1).connect(SOUND.limiter!);
  filter.connect(distortion);
  distortion.connect(outputNode);

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
