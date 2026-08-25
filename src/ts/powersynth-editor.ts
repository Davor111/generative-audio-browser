import { createEditor, fmt, type RangeField } from './editor';
import { noteFields } from './note-fields';
import { PARAMS, ENGINE_NAMES } from './plaits';
import type { PowerSynthState } from '../types';

/** Element fields that map 1:1 onto a 0..1 Plaits param. */
type PlaitsKey = 'harmonics' | 'fmAmount' | 'timbreMod' | 'morphMod' | 'decay' | 'lpgColour';

/**
 * A unit slider that stores its value on the element and forwards it to the
 * voice. The voice may still be loading (or have failed), so the write is
 * optional — spawnPowerSynth replays the stored values once the engine lands.
 */
function plaitsSlider(
  name: string,
  label: string,
  key: PlaitsKey,
  param: number,
): RangeField<PowerSynthState> {
  return {
    name,
    label,
    kind: 'range',
    min: 0,
    max: 1,
    step: 0.01,
    format: fmt.unit,
    read: (ps) => ps[key],
    write: (ps, raw) => {
      ps[key] = Number(raw);
      ps.voice?.setParam(param, ps[key]);
    },
  };
}

/**
 * Timbre and morph are deliberately not `plaitsSlider`s: they write
 * baseTimbre/baseMorph, because the proximity loop is the only writer of the
 * effective TIMBRE/MORPH params and would otherwise fight the dialog.
 */
function baseSlider(
  name: string,
  label: string,
  key: 'baseTimbre' | 'baseMorph',
): RangeField<PowerSynthState> {
  return {
    name,
    label,
    kind: 'range',
    min: 0,
    max: 1,
    step: 0.01,
    format: fmt.unit,
    read: (ps) => ps[key],
    write: (ps, raw) => {
      ps[key] = Number(raw);
    },
  };
}

const editor = createEditor<PowerSynthState>({
  prefix: 'ps',
  title: 'Edit Power Synth',
  accent: 'var(--ps-core)',
  glow: 'hsla(78, 90%, 55%, 0.6)',
  shadow: ['hsla(88, 60%, 12%, 0.5)', 'hsla(78, 80%, 45%, 0.12)'],
  width: '520px',
  sections: [
    {
      title: 'Engine',
      note: 'Engines 2–4 (six-op FM) load a patch bank on switch and may click once.',
      fields: [
        {
          name: 'engine',
          kind: 'select',
          options: ENGINE_NAMES.map(
            (engineName, i) => [String(i), `${i} — ${engineName}`] as [string, string],
          ),
          read: (ps) => ps.engine,
          write: (ps, raw) => {
            ps.engine = Number(raw);
            ps.voice?.setParam(PARAMS.ENGINE, ps.engine);
          },
        },
      ],
    },
    {
      title: 'Timbre',
      grid: true,
      fields: [
        plaitsSlider('harmonics', 'Harmonics', 'harmonics', PARAMS.HARMONICS),
        baseSlider('timbre', 'Timbre', 'baseTimbre'),
        baseSlider('morph', 'Morph', 'baseMorph'),
        plaitsSlider('fm', 'FM amount', 'fmAmount', PARAMS.FM_AMOUNT),
        plaitsSlider('timbre-mod', 'Timbre mod', 'timbreMod', PARAMS.TIMBRE_MOD_AMOUNT),
        plaitsSlider('morph-mod', 'Morph mod', 'morphMod', PARAMS.MORPH_MOD_AMOUNT),
      ],
    },
    {
      title: 'Envelope',
      grid: true,
      fields: [
        plaitsSlider('decay', 'Decay', 'decay', PARAMS.DECAY),
        plaitsSlider('lpg', 'LPG colour', 'lpgColour', PARAMS.LPG_COLOUR),
      ],
    },
    {
      title: 'Effects',
      grid: true,
      note: 'Delay and reverb start fully dry — raise Delay mix or Reverb send to bring them in.',
      fields: [
        {
          name: 'delay-time',
          label: 'Delay time',
          kind: 'range',
          // Capped by the VoiceFX delay node's maxDelay.
          min: 0.02,
          max: 1.2,
          step: 0.01,
          format: fmt.seconds,
          read: (ps) => ps.delayTime,
          write: (ps, raw) => {
            ps.delayTime = Number(raw);
            ps.fx.setDelayTime(ps.delayTime);
          },
        },
        {
          name: 'delay-feedback',
          label: 'Feedback',
          kind: 'range',
          min: 0,
          // Short of 1: at unity the loop never decays.
          max: 0.9,
          step: 0.01,
          format: fmt.percent,
          read: (ps) => ps.delayFeedback,
          write: (ps, raw) => {
            ps.delayFeedback = Number(raw);
            ps.fx.setFeedback(ps.delayFeedback);
          },
        },
        {
          name: 'delay-mix',
          label: 'Delay mix',
          kind: 'range',
          min: 0,
          max: 1,
          step: 0.01,
          format: fmt.percent,
          read: (ps) => ps.delayMix,
          write: (ps, raw) => {
            ps.delayMix = Number(raw);
            ps.fx.setDelayMix(ps.delayMix);
          },
        },
        {
          name: 'reverb-send',
          label: 'Reverb send',
          kind: 'range',
          min: 0,
          max: 1,
          step: 0.01,
          format: fmt.percent,
          read: (ps) => ps.reverbSend,
          write: (ps, raw) => {
            ps.reverbSend = Number(raw);
            ps.fx.setReverbSend(ps.reverbSend);
          },
        },
      ],
    },
    {
      title: 'Notes',
      grid: true,
      fields: noteFields<PowerSynthState>({ minOctave: 1, maxOctave: 6, maxRange: 4 }),
    },
    {
      title: 'Output',
      grid: true,
      fields: [
        {
          name: 'note-interval',
          label: 'Note Interval',
          kind: 'range',
          min: 100,
          max: 2000,
          step: 50,
          format: fmt.ms,
          read: (ps) => ps.noteIntervalMs,
          write: (ps, raw) => {
            ps.noteIntervalMs = Number(raw);
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
          read: (ps) => ps.noteDuration,
          write: (ps, raw) => {
            ps.noteDuration = raw;
          },
        },
        {
          name: 'mix',
          label: 'Out / Aux',
          kind: 'range',
          min: 0,
          max: 1,
          step: 0.01,
          format: fmt.unit,
          read: (ps) => ps.mix,
          write: (ps, raw) => {
            ps.mix = Number(raw);
            ps.voice?.setMix(ps.mix);
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
          read: (ps) => ps.outputNode.gain.value,
          write: (ps, raw) => {
            ps.outputNode.gain.value = Number(raw);
          },
        },
      ],
    },
  ],
});

export const openPowerSynthEditor = editor.open;
export const bindPowerSynthContextMenu = editor.bindContextMenu;
