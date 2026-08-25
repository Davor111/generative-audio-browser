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
import type { SimpleDistortion, VoiceFX } from './ts/audio-engine';
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
  /**
   * The remaining Plaits params, mirrored here so each element owns its own
   * settings. The edit dialog is a singleton: without per-element storage it
   * restores the previously edited synth's slider positions and then writes
   * them onto whichever synth is open.
   */
  harmonics: number;
  fmAmount: number;
  timbreMod: number;
  morphMod: number;
  decay: number;
  lpgColour: number;
  /** Insert effects, sitting between the voice and `outputNode`. */
  fx: VoiceFX;
  delayTime: number;
  delayFeedback: number;
  delayMix: number;
  reverbSend: number;
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

export interface LineState {
  el: HTMLDivElement;
  /** Circular influence region, like every other modulator. */
  radius: number;
  /** Rail direction in degrees, 0 = pointing right. */
  angle: number;
  /** Rail length in px; elements bounce at +/- half of it. */
  length: number;
  /** Travel speed in px per frame. */
  speed: number;
  /**
   * Which way along the rail each element is currently travelling, flipped on
   * bounce. Keyed per element and owned by this Line, so two Lines acting on
   * the same element don't fight over one shared direction.
   */
  directions: WeakMap<HTMLElement, number>;
}

export interface SoundState {
  audioReady: boolean;
  masterReverb: Reverb | null;
  /** Shared reverb send bus that per-element FX chains feed. */
  fxReverb: Reverb | null;
  limiter: Limiter | null;
  orbs: OrbState[];
  timewarps: TimewarpState[];
  deeppads: DeepPadState[];
  woahs: WoahState[];
  etheralwinds: EtherealWindState[];
  modulators: ModulatorState[];
  orbits: OrbitState[];
  lines: LineState[];
  powersynths: PowerSynthState[];
}

export interface WoahSource {
  outputNode: Gain;
  woahSends: Map<WoahState, Gain>;
}

export type SoundSource = OrbState | DeepPadState | EtherealWindState | PowerSynthState;
/** Everything both movers can push around, regardless of which is moving. */
type MovableElement =
  | OrbState
  | DeepPadState
  | TimewarpState
  | WoahState
  | EtherealWindState
  | ModulatorState
  | PowerSynthState;

/**
 * Orbit moves lines; Line moves orbits; neither moves its own kind — otherwise
 * two of them in range of each other would drag each other around forever.
 */
export type OrbitableElement = MovableElement | LineState;
export type LineMovableElement = MovableElement | OrbitState;
