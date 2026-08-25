import { createEditor, fmt } from './editor';
import { noteFields } from './note-fields';
import type { OrbState } from '../types';

const editor = createEditor<OrbState>({
  prefix: 'orb',
  title: 'Edit Orb',
  accent: 'var(--orb-core)',
  glow: 'hsla(258, 85%, 65%, 0.6)',
  shadow: ['hsla(258, 80%, 20%, 0.5)', 'hsla(258, 80%, 50%, 0.12)'],
  width: '340px',
  sections: [
    {
      title: 'Notes',
      fields: noteFields<OrbState>({ minOctave: 1, maxOctave: 6, maxRange: 4 }),
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
          ],
          read: (orb) => orb.synth.oscillator.type as string,
          write: (orb, raw) => {
            orb.synth.oscillator.type = raw as never;
          },
        },
        {
          name: 'attack',
          label: 'Attack',
          kind: 'range',
          min: 0.01,
          max: 2,
          step: 0.01,
          format: fmt.seconds,
          read: (orb) => orb.synth.envelope.attack as number,
          write: (orb, raw) => {
            orb.synth.envelope.attack = Number(raw);
          },
        },
        {
          name: 'decay',
          label: 'Decay',
          kind: 'range',
          min: 0.01,
          max: 2,
          step: 0.01,
          format: fmt.seconds,
          read: (orb) => orb.synth.envelope.decay as number,
          write: (orb, raw) => {
            orb.synth.envelope.decay = Number(raw);
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
          read: (orb) => orb.synth.envelope.sustain,
          write: (orb, raw) => {
            orb.synth.envelope.sustain = Number(raw);
          },
        },
        {
          name: 'release',
          label: 'Release',
          kind: 'range',
          min: 0.01,
          max: 4,
          step: 0.01,
          format: fmt.seconds,
          read: (orb) => orb.synth.envelope.release as number,
          write: (orb, raw) => {
            orb.synth.envelope.release = Number(raw);
          },
        },
        {
          name: 'note-duration',
          label: 'Note Length',
          kind: 'select',
          options: [
            ['16n', '1/16'],
            ['8n', '1/8'],
            ['4n', '1/4'],
            ['2n', '1/2'],
            ['1n', '1/1'],
          ],
          read: (orb) => orb.noteDuration,
          write: (orb, raw) => {
            orb.noteDuration = raw;
          },
        },
        {
          name: 'note-interval',
          label: 'Note Interval',
          kind: 'range',
          min: 100,
          max: 2000,
          step: 50,
          format: fmt.ms,
          read: (orb) => orb.noteIntervalMs,
          write: (orb, raw) => {
            orb.noteIntervalMs = Number(raw);
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
          read: (orb) => orb.outputNode.gain.value,
          write: (orb, raw) => {
            orb.outputNode.gain.value = Number(raw);
          },
        },
      ],
    },
  ],
});

export const openOrbEditor = editor.open;
export const bindOrbContextMenu = editor.bindContextMenu;
