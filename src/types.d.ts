import type {
  Synth,
  Reverb,
  Limiter,
  Gain,
  Filter,
  PingPongDelay,
  AutoFilter,
  AutoPanner,
  Noise,
} from 'tone';
import type { SimpleDistortion } from './ts/audio-engine';
import type { PlaitsVoice } from './ts/plaits';

export interface OrbState {
  el: HTMLDivElement;
  synth: Synth;
  distortion: SimpleDistortion;
  outputNode: Gain;
  noteIdx: number;
  noteDuration: string;
  noteIntervalMs: number;
  warped: boolean;
  woahAffected: boolean;
  modAffected: boolean;
  woahSends: Map<WoahState, Gain>;
  timerId: ReturnType<typeof setTimeout> | null;
}

export interface DeepPadState {
  el: HTMLDivElement;
  synth: Synth;
  filter: Filter;
  distortion: SimpleDistortion;
  outputNode: Gain;
  baseFreq: number;
  noteIdx: number;
  noteIntervalMs: number;
  warped: boolean;
  woahAffected: boolean;
  modAffected: boolean;
  woahSends: Map<WoahState, Gain>;
  timerId: ReturnType<typeof setTimeout> | null;
}

export interface TimewarpState {
  el: HTMLDivElement;
  radius: number;
}

export interface WoahFX {
  inputGain: Gain;
  delay: PingPongDelay;
  delayFilter: Filter;
  spaceReverb: Reverb;
}

export interface WoahState {
  el: HTMLDivElement;
  radius: number;
  fx: WoahFX;
  warped: boolean;
}

export interface EtherealWindState {
  el: HTMLDivElement;
  noise: Noise;
  autoFilter: AutoFilter;
  panner: AutoPanner;
  outputNode: Gain;
  woahAffected: boolean;
  woahSends: Map<WoahState, Gain>;
}

export interface PowerSynthState {
  el: HTMLDivElement;
  /** Null until the wasm engine finishes loading, or forever if it failed. */
  voice: PlaitsVoice | null;
  outputNode: Gain;
  noteIdx: number;
  noteDuration: string;
  noteIntervalMs: number;
  engine: number;
  /**
   * The dialog writes these; the proximity loop is the only thing that writes
   * the actual TIMBRE/MORPH params, deriving them from these plus modulator
   * proximity. Keeping them separate stops the two from overwriting each other.
   */
  baseTimbre: number;
  baseMorph: number;
  mix: number;
  warped: boolean;
  woahAffected: boolean;
  modAffected: boolean;
  woahSends: Map<WoahState, Gain>;
  timerId: ReturnType<typeof setTimeout> | null;
  releaseTimerId: ReturnType<typeof setTimeout> | null;
  /** Set by removePowerSynth so a voice still loading is discarded on arrival. */
  disposed: boolean;
}

export interface ModulatorState {
  el: HTMLDivElement;
  radius: number;
}

export interface OrbitState {
  el: HTMLDivElement;
  radius: number;
}

export interface SoundState {
  audioReady: boolean;
  masterReverb: Reverb | null;
  limiter: Limiter | null;
  orbs: OrbState[];
  timewarps: TimewarpState[];
  deeppads: DeepPadState[];
  woahs: WoahState[];
  etheralwinds: EtherealWindState[];
  modulators: ModulatorState[];
  orbits: OrbitState[];
  powersynths: PowerSynthState[];
}

export interface WoahSource {
  outputNode: Gain;
  woahSends: Map<WoahState, Gain>;
}

export type SoundSource = OrbState | DeepPadState | EtherealWindState | PowerSynthState;
export type OrbitableElement =
  | OrbState
  | DeepPadState
  | TimewarpState
  | WoahState
  | EtherealWindState
  | ModulatorState
  | PowerSynthState;
