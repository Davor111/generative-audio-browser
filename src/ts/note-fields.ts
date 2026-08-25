import { isChecked, type Field } from './editor';
import { SCALE_OPTIONS, ROOT_OPTIONS, buildScale } from './scales';
import type { Autoplayable, PitchedGenerator } from '../types';

/**
 * The Autoplay / Scale / Root / Octave / Range block shared by every pitched
 * generator's editor. Orb, Deep Pad and Power Synth differ only in which
 * octaves make sense for them, so the whole block is one call per editor.
 */

/** Rebuilds a generator's note pool and keeps its walk position in range. */
export function refreshNotes(gen: PitchedGenerator): void {
  gen.notes = buildScale(gen.root, gen.baseOctave, gen.scale, gen.octaves);
  // The pool can shrink (fewer octaves, or a smaller scale), which would leave
  // noteIdx pointing past the end and walkNote's modulo wrapping oddly.
  if (gen.noteIdx >= gen.notes.length) gen.noteIdx = gen.notes.length - 1;
}

export interface NoteFieldOptions {
  /** Lowest selectable starting octave — Deep Pad lives lower than the rest. */
  minOctave: number;
  maxOctave: number;
  /** Most octaves the range slider will span. */
  maxRange: number;
}

/**
 * The Autoplay toggle on its own — Ethereal Wind is unpitched, so it takes
 * this without the scale and range controls.
 */
export function autoplayField<T extends Autoplayable>(): Field<T> {
  return {
    name: 'autoplay',
    label: 'Autoplay',
    kind: 'checkbox',
    read: (gen) => gen.autoplay,
    write: (gen, raw) => {
      const next = isChecked(raw);
      // setAutoplay restarts loops and retriggers drones, so calling it on
      // every keystroke in the dialog would stutter the sound.
      if (next === gen.autoplay) return;
      gen.autoplay = next;
      gen.setAutoplay(next);
    },
  };
}

export function noteFields<T extends PitchedGenerator>(
  options: NoteFieldOptions,
): Array<Field<T>> {
  return [
    autoplayField<T>(),
    {
      name: 'scale',
      label: 'Scale',
      kind: 'select',
      options: SCALE_OPTIONS,
      read: (gen) => gen.scale,
      write: (gen, raw) => {
        gen.scale = raw;
        refreshNotes(gen);
      },
    },
    {
      name: 'root',
      label: 'Root',
      kind: 'select',
      options: ROOT_OPTIONS,
      read: (gen) => gen.root,
      write: (gen, raw) => {
        gen.root = raw;
        refreshNotes(gen);
      },
    },
    {
      name: 'octave',
      label: 'Octave',
      kind: 'range',
      min: options.minOctave,
      max: options.maxOctave,
      step: 1,
      format: (raw) => raw,
      read: (gen) => gen.baseOctave,
      write: (gen, raw) => {
        gen.baseOctave = Number(raw);
        refreshNotes(gen);
      },
    },
    {
      name: 'range',
      label: 'Range',
      kind: 'range',
      min: 1,
      max: options.maxRange,
      step: 1,
      format: (raw) => `${raw} oct`,
      read: (gen) => gen.octaves,
      write: (gen, raw) => {
        gen.octaves = Number(raw);
        refreshNotes(gen);
      },
    },
  ];
}
