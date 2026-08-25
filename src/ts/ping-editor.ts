import { createEditor, fmt } from './editor';
import { autoplayField } from './note-fields';
import { applyPingVisuals } from './utils';
import type { PingState } from '../types';

const editor = createEditor<PingState>({
  prefix: 'ping',
  title: 'Edit Ping',
  accent: 'var(--ping-core)',
  glow: 'hsla(295, 90%, 68%, 0.6)',
  shadow: ['hsla(295, 70%, 18%, 0.5)', 'hsla(295, 90%, 55%, 0.12)'],
  width: '340px',
  sections: [
    {
      note: 'Click a Ping to throw a single ripple by hand, autoplay or not.',
      fields: [
        autoplayField<PingState>(),
        {
          name: 'interval',
          label: 'Interval',
          kind: 'range',
          min: 200,
          max: 4000,
          step: 100,
          format: fmt.ms,
          read: (ping) => ping.intervalMs,
          write: (ping, raw) => {
            // Takes effect on the next tick rather than rescheduling the
            // pending one, so dragging the slider doesn't stutter the pulse.
            ping.intervalMs = Number(raw);
          },
        },
        {
          name: 'speed',
          label: 'Speed',
          kind: 'range',
          min: 1,
          max: 12,
          step: 0.5,
          format: (raw) => `${Number(raw).toFixed(1)} px/f`,
          read: (ping) => ping.speed,
          write: (ping, raw) => {
            ping.speed = Number(raw);
          },
        },
        {
          name: 'reach',
          label: 'Reach',
          kind: 'range',
          min: 100,
          max: 400,
          step: 10,
          format: (raw) => `${raw}px`,
          read: (ping) => ping.reach,
          write: (ping, raw) => {
            ping.reach = Number(raw);
            applyPingVisuals(ping);
          },
        },
      ],
    },
  ],
});

export const openPingEditor = editor.open;
export const bindPingContextMenu = editor.bindContextMenu;
