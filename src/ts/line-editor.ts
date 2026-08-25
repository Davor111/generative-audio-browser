import { createEditor } from './editor';
import { applyLineVisuals } from './utils';
import type { LineState } from '../types';

/**
 * The first modulator with an editor. A circle is rotationally symmetric so
 * Orbit needs no direction control; a rail is useless without one, and once
 * you can aim it you need its reach and pace too.
 */
const editor = createEditor<LineState>({
  prefix: 'line',
  title: 'Edit Line',
  accent: 'var(--line-core)',
  glow: 'hsla(4, 95%, 62%, 0.6)',
  shadow: ['hsla(4, 70%, 18%, 0.5)', 'hsla(4, 90%, 50%, 0.12)'],
  width: '340px',
  sections: [
    {
      fields: [
        {
          name: 'angle',
          label: 'Angle',
          kind: 'range',
          min: 0,
          max: 359,
          step: 1,
          format: (raw) => `${raw}°`,
          read: (line) => line.angle,
          write: (line, raw) => {
            line.angle = Number(raw);
            applyLineVisuals(line);
          },
        },
        {
          name: 'length',
          label: 'Length',
          kind: 'range',
          min: 120,
          // Beyond the influence diameter an element would bounce out of range
          // and freeze, so the rail stops where the radius does.
          max: 480,
          step: 10,
          format: (raw) => `${raw}px`,
          read: (line) => line.length,
          write: (line, raw) => {
            line.length = Number(raw);
            applyLineVisuals(line);
          },
        },
        {
          name: 'speed',
          label: 'Speed',
          kind: 'range',
          min: 0.2,
          max: 5,
          step: 0.1,
          format: (raw) => Number(raw).toFixed(1),
          read: (line) => line.speed,
          write: (line, raw) => {
            line.speed = Number(raw);
          },
        },
      ],
    },
  ],
});

export const openLineEditor = editor.open;
export const bindLineContextMenu = editor.bindContextMenu;
