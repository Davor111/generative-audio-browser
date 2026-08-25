/**
 * Scale and note-range maths for the pitched generators.
 *
 * Note names are built here rather than via Tone's `Frequency`, so this module
 * has no audio-context dependency and stays unit-testable on its own.
 */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Semitone offsets from the root. */
export const SCALES: Record<string, number[]> = {
  'major-pentatonic': [0, 2, 4, 7, 9],
  'minor-pentatonic': [0, 3, 5, 7, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  blues: [0, 3, 5, 6, 7, 10],
  'harmonic-minor': [0, 2, 3, 5, 7, 8, 11],
  'whole-tone': [0, 2, 4, 6, 8, 10],
};

/** `[value, label]` pairs for the editor's scale select. */
export const SCALE_OPTIONS: Array<[string, string]> = [
  ['major-pentatonic', 'Major Pentatonic'],
  ['minor-pentatonic', 'Minor Pentatonic'],
  ['major', 'Major'],
  ['minor', 'Natural Minor'],
  ['dorian', 'Dorian'],
  ['mixolydian', 'Mixolydian'],
  ['lydian', 'Lydian'],
  ['blues', 'Blues'],
  ['harmonic-minor', 'Harmonic Minor'],
  ['whole-tone', 'Whole Tone'],
];

/** `[value, label]` pairs for the editor's root select. */
export const ROOT_OPTIONS: Array<[string, string]> = NOTE_NAMES.map((name) => [name, name]);

export const DEFAULT_SCALE = 'major-pentatonic';

/** MIDI note numbers outside this can't be rendered as a note name. */
const MIN_MIDI = 0;
const MAX_MIDI = 127;

function midiToNote(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

/** Middle C (C4) is MIDI 60, matching Tone's convention. */
function rootToMidi(root: string, octave: number): number {
  const pitchClass = NOTE_NAMES.indexOf(root);
  return (pitchClass === -1 ? 0 : pitchClass) + (octave + 1) * 12;
}

/**
 * Builds the note pool a generator walks over.
 *
 * `buildScale('C', 3, 'major-pentatonic', 3)` reproduces the original
 * hardcoded pool exactly (C3 D3 E3 G3 A3 C4 … A5) — that's what keeps a
 * freshly placed element sounding the way it always has.
 *
 * Notes run from the root upward: `octaves` is how many octaves *above* the
 * starting note to include, so the octave above the top one is excluded.
 */
export function buildScale(
  root: string,
  baseOctave: number,
  scaleId: string,
  octaves: number,
): string[] {
  const intervals = SCALES[scaleId] ?? SCALES[DEFAULT_SCALE];
  const rootMidi = rootToMidi(root, baseOctave);

  const notes: string[] = [];
  for (let octave = 0; octave < octaves; octave++) {
    for (const interval of intervals) {
      const midi = rootMidi + octave * 12 + interval;
      if (midi < MIN_MIDI || midi > MAX_MIDI) continue;
      notes.push(midiToNote(midi));
    }
  }

  // A range clamped away to nothing would break walkNote's modulo; fall back
  // to the root alone so the generator still has something to play.
  return notes.length > 0 ? notes : [midiToNote(Math.min(Math.max(rootMidi, MIN_MIDI), MAX_MIDI))];
}
