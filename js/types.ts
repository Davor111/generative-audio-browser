import type {
  Synth,
  Reverb,
  Limiter,
  Distortion,
  Gain,
  Filter,
  PingPongDelay,
  AutoFilter,
  AutoPanner,
  Noise,
} from 'tone';

export interface OrbState {
  el: HTMLDivElement;
  synth: Synth;
  distortion: Distortion;
  outputNode: Gain;
  noteIdx: number;
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
  distortion: Distortion;
  outputNode: Gain;
  baseFreq: number;
  noteIdx: number;
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
}

export interface WoahSource {
  outputNode: Gain;
  woahSends: Map<WoahState, Gain>;
}

export type SoundSource = OrbState | DeepPadState | EtherealWindState;
export type OrbitableElement =
  | OrbState
  | DeepPadState
  | TimewarpState
  | WoahState
  | EtherealWindState
  | ModulatorState;
