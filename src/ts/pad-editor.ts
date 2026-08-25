import { createEditor, fmt } from './editor';
import { noteFields } from './note-fields';
import type { DeepPadState } from '../types';

const editor = createEditor<DeepPadState>({
  prefix: 'pad',
  title: 'Edit Deep Pad',
  accent: 'var(--dp-core)',
  glow: 'hsla(28, 85%, 55%, 0.6)',
  shadow: ['hsla(28, 80%, 20%, 0.5)', 'hsla(28, 80%, 50%, 0.12)'],
  width: '340px',
  sections: [
    {
      // Deep Pad is the bass voice, so its octave range starts lower.
      title: 'Notes',
      fields: noteFields<DeepPadState>({ minOctave: 0, maxOctave: 4, maxRange: 3 }),
    },
    {
      title: 'Voice',
      fields: [
        {
          name: 'waveform',
          label: 'Waveform',
          kind: 'select',
          options: [
            ['sine', 'Sine'],
            ['triangle', 'Triangle'],
            ['square', 'Square'],
            ['sawtooth', 'Sawtooth'],
            ['fatsawtooth', 'Fat Sawtooth'],
          ],
          read: (pad) => pad.synth.oscillator.type as string,
          write: (pad, raw) => {
            pad.synth.oscillator.type = raw as never;
          },
        },
        {
          name: 'attack',
          label: 'Attack',
          kind: 'range',
          min: 0.05,
          max: 4,
          step: 0.05,
          format: fmt.seconds,
          read: (pad) => pad.synth.envelope.attack as number,
          write: (pad, raw) => {
            pad.synth.envelope.attack = Number(raw);
          },
        },
        {
          name: 'decay',
          label: 'Decay',
          kind: 'range',
          min: 0.05,
          max: 4,
          step: 0.05,
          format: fmt.seconds,
          read: (pad) => pad.synth.envelope.decay as number,
          write: (pad, raw) => {
            pad.synth.envelope.decay = Number(raw);
          },
        },
        {
          name: 'sustain',
          label: 'Sustain',
          kind: 'range',
          min: 0,
          max: 1,
          step: 0.01,
          format: fmt.unit,
          read: (pad) => pad.synth.envelope.sustain,
          write: (pad, raw) => {
            pad.synth.envelope.sustain = Number(raw);
          },
        },
        {
          name: 'release',
          label: 'Release',
          kind: 'range',
          min: 0.05,
          max: 6,
          step: 0.05,
          format: fmt.seconds,
          read: (pad) => pad.synth.envelope.release as number,
          write: (pad, raw) => {
            pad.synth.envelope.release = Number(raw);
          },
        },
        {
          name: 'note-interval',
          label: 'Note Interval',
          kind: 'range',
          min: 1000,
          max: 10000,
          step: 250,
          format: fmt.ms,
          read: (pad) => pad.noteIntervalMs,
          write: (pad, raw) => {
            pad.noteIntervalMs = Number(raw);
          },
        },
        {
          name: 'volume',
          label: 'Volume',
          kind: 'range',
          min: 0,
          max: 1.2,
          step: 0.01,
          format: fmt.percent,
          read: (pad) => pad.outputNode.gain.value,
          write: (pad, raw) => {
            pad.outputNode.gain.value = Number(raw);
          },
        },
      ],
    },
  ],
});

export const openPadEditor = editor.open;
export const bindPadContextMenu = editor.bindContextMenu;
