import { createEditor, fmt } from './editor';
import type { EtherealWindState } from '../types';

const editor = createEditor<EtherealWindState>({
  prefix: 'wind',
  title: 'Edit Ethereal Wind',
  accent: 'var(--wind-core)',
  glow: 'hsla(205, 90%, 75%, 0.6)',
  shadow: ['hsla(215, 80%, 30%, 0.5)', 'hsla(205, 90%, 70%, 0.12)'],
  width: '340px',
  sections: [
    {
      fields: [
        {
          name: 'noise-type',
          label: 'Noise Type',
          kind: 'select',
          options: [
            ['white', 'White'],
            ['pink', 'Pink'],
            ['brown', 'Brown'],
          ],
          read: (wind) => wind.noise.type as string,
          write: (wind, raw) => {
            wind.noise.type = raw as never;
          },
        },
        {
          name: 'sweep-rate',
          label: 'Sweep Rate',
          kind: 'range',
          min: 0.01,
          max: 0.3,
          step: 0.01,
          format: fmt.hz,
          read: (wind) => wind.autoFilter.frequency.value as number,
          write: (wind, raw) => {
            wind.autoFilter.frequency.value = Number(raw);
          },
        },
        {
          name: 'filter-freq',
          label: 'Filter Frequency',
          kind: 'range',
          min: 80,
          max: 600,
          step: 10,
          format: fmt.hzWhole,
          read: (wind) => wind.autoFilter.baseFrequency as number,
          write: (wind, raw) => {
            wind.autoFilter.baseFrequency = Number(raw);
          },
        },
        {
          name: 'filter-range',
          label: 'Filter Range',
          kind: 'range',
          min: 1,
          max: 8,
          step: 0.1,
          format: fmt.octaves,
          read: (wind) => wind.autoFilter.octaves,
          write: (wind, raw) => {
            wind.autoFilter.octaves = Number(raw);
          },
        },
        {
          name: 'filter-depth',
          label: 'Filter Depth',
          kind: 'range',
          min: 0,
          max: 1,
          step: 0.01,
          format: fmt.percent,
          read: (wind) => wind.autoFilter.depth.value,
          write: (wind, raw) => {
            wind.autoFilter.depth.value = Number(raw);
          },
        },
        {
          name: 'pan-rate',
          label: 'Pan Rate',
          kind: 'range',
          min: 0.01,
          max: 0.5,
          step: 0.01,
          format: fmt.hz,
          read: (wind) => wind.panner.frequency.value as number,
          write: (wind, raw) => {
            wind.panner.frequency.value = Number(raw);
          },
        },
        {
          name: 'pan-depth',
          label: 'Pan Depth',
          kind: 'range',
          min: 0,
          max: 1,
          step: 0.01,
          format: fmt.percent,
          read: (wind) => wind.panner.depth.value,
          write: (wind, raw) => {
            wind.panner.depth.value = Number(raw);
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
          read: (wind) => wind.outputNode.gain.value,
          write: (wind, raw) => {
            wind.outputNode.gain.value = Number(raw);
          },
        },
      ],
    },
  ],
});

export const openWindEditor = editor.open;
export const bindWindContextMenu = editor.bindContextMenu;
