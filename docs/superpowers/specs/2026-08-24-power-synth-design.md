# Power Synth — Mutable Instruments Plaits as a generator element

Date: 2026-08-24

## Summary

Add a seventh element type, **Power Synth**: a generator whose sound comes from
the Plaits DSP running as WebAssembly in an `AudioWorklet`, rather than from
Tone.js. It triggers and walks notes exactly like Orb, and a right-click dialog
exposes Plaits' engine selection and its full parameter set.

The wasm build comes from the sibling project `mi-plaits-wasm` (`web/plaits.wasm`
and `web/worklet.js`), vendored into this repo unmodified.

## Motivation

Every generator today is a Tone.js oscillator or noise source. Plaits brings 24
distinct synthesis engines — virtual analog, FM, wavetable, granular, physical
modelling, percussion — in a single voice, which is far more sonic range than
adding more Tone-based generators would give.

## Non-goals

- Polyphony per element. One element is one monophonic voice, matching Orb.
- Web MIDI, or any keyboard input. Notes come from the existing scheduler.
- Rebuilding the wasm as part of this repo's build. The `.wasm` is committed as
  a binary asset; regenerating it stays a task for `mi-plaits-wasm`.
- Working around the upstream engine-switch click (see Known Limitations).

## Architecture

### Module boundary

A new `src/ts/plaits.ts` owns everything wasm- and worklet-related. `audio-engine.ts`
stays purely Tone.js. `plaits.ts` exports:

| Export | Purpose |
|---|---|
| `PARAMS` | Param-id map mirroring `mi-plaits-wasm/src/params.rs` |
| `ENGINE_NAMES` | The 24 engine names, index-aligned with the `ENGINE` param |
| `initPlaits()` | Starts the fetch + worklet-module registration; returns/caches a promise |
| `createPlaitsVoice()` | Awaits readiness, returns one configured voice handle |

`createPlaitsVoice()` returns a handle — not a raw node — with `outputNode`
(a `Tone.Gain`), `setParam(id, value)`, `setParamIfChanged(id, value, epsilon)`,
`setMix(value)`, and `dispose()`. Callers never touch the port directly.

### Asset loading

`plaits.wasm` and `plaits-worklet.js` are vendored into `public/`. The worklet
is copied **verbatim** from `mi-plaits-wasm/web/worklet.js`; its transport (main
thread posts raw wasm *bytes*, the worklet compiles them itself) is a documented
workaround for Chromium dropping a `WebAssembly.Module` posted to an
`AudioWorkletProcessor` port. Do not "simplify" it to compile-once-and-post.

Both are resolved against `import.meta.env.BASE_URL`, because the site deploys
under the `/generative-audio-browser/` base path.

Loading is **eager but non-blocking**: `startAudio()` calls `initPlaits()` without
awaiting it. `initPlaits()` fetches the wasm, calls
`Tone.getContext().addAudioWorkletModule(url)`, and caches the resulting promise
at module scope so concurrent and later callers share one load. `Start Experience`
stays instant; by the time a user drags a Power Synth onto the canvas the load has
almost always finished.

### Audio graph

One `AudioWorkletNode` per element — a single monophonic Plaits voice, with its
own engine and parameters:

```
AudioWorkletNode('plaits')  →  Tone.Gain (outputNode)  →  SOUND.limiter
                                        ↓
                                   woahSends (per Woah instance)
```

`outputNode` is a real `Tone.Gain`, so `registerSourceToWoah()` and the Woah send
logic in `proximity.ts` work with no changes.

The node is created on Tone's own context (`Tone.getContext().rawContext`), so it
shares the master reverb/limiter chain and needs no second user gesture.

At voice creation, `TRIGGER_PATCHED` and `LEVEL_PATCHED` are set to `1`. That is
what makes the voice silent at rest — `MOD_TRIGGER` and `MOD_LEVEL` sit at 0
until a note fires, instead of the voice droning continuously.

**Rejected alternatives:**

- *A shared 8-voice pool*, as the `mi-plaits-wasm` demo uses. Elements need
  independent engines and parameters; a pool cannot provide that.
- *A separate `AudioContext` at a forced 48 kHz.* It could not route into the
  shared reverb/limiter or the Woah sends, and would require its own user gesture.

### Sample rate

Tone creates its context at the hardware rate, typically 44.1 or 48 kHz. The
worklet passes its own `sampleRate` to `plaits_new`, and `Voice::new(block_size,
sample_rate)` takes it, so pitch is correct at any rate. Plaits' DSP is voiced for
48 kHz, so a 44.1 kHz context sounds marginally different — acceptable, and not
worth forcing a second context over.

## Element behaviour

### Spawning

`spawnPowerSynth(x, y)` is **synchronous**, matching every other spawn function
and the existing `setupToolbarClick` / drop-handler signatures. It:

1. Builds the DOM node and pushes `PowerSynthState` into `SOUND.powersynths`
   immediately, with a `.powersynth-loading` class.
2. Starts an async tail that awaits `createPlaitsVoice()`, attaches the voice,
   clears the loading class, and starts the note loop.

Two failure paths must be handled:

- **Erased while loading.** `PowerSynthState.disposed` is checked after the await;
  if set, the freshly created voice is disposed immediately and no loop starts.
- **Load failed.** The element gets `.powersynth-error`, stays draggable and
  erasable, and logs to the console. It never becomes a silent element with no
  explanation.

### Note scheduling

Structurally identical to Orb: `walkNote()` over `MUSIC.NOTES`, a recursive
`setTimeout` keyed on `noteIntervalMs`, and a `note-pulse` class per hit. Only
the trigger differs:

```
attack   NOTE = Tone.Frequency(name).toMidi()
         MOD_LEVEL = 1
         MOD_TRIGGER = 1
release  MOD_TRIGGER = 0                    after noteDuration ms
         MOD_LEVEL = 0
```

`NOTE` is sent before the trigger so the voice picks the pitch up on the rising
edge rather than a block late.

Plaits' note scale matches Tone's MIDI numbering exactly — Plaits computes
`13.75 * 2^((n - 9) / 12)`, so MIDI 48 is 130.81 Hz, which is Tone's `C3`. No
offset correction is needed.

The release timer is separate from the interval timer; both must be cleared in
`removePowerSynth`.

## Proximity behaviour

| Modulator | Effect on Power Synth |
|---|---|
| Time Warp | `warped` flag; interval randomised to 150–850 ms. Identical to Orb. |
| Woah | Added to `allSoundSources`; existing send code unchanged. |
| Orbit | Added to `orbitableElements`. |
| Modulator | Sweeps `TIMBRE` and `MORPH` up from their dialog-set base values. |

The Modulator mapping is `effective = clamp(base + maxMod * 0.5, 0, 1)` for both
params. Base values live on the element state (`baseTimbre`, `baseMorph`) so the
dialog and the modulator never overwrite each other — the dialog writes the base,
the proximity loop derives the effective value from it every frame.

`TIMBRE`/`MORPH` are `postMessage` params, not `AudioParam`s, so `rampToIfChanged`
does not apply. `setParamIfChanged` on the voice handle plays the same role:
it drops sub-epsilon deltas, keeping the port quiet while a synth sits still.
Plaits interpolates most parameters internally, so per-frame updates should not
zipper; if a particular engine does, the fix belongs in the worklet, not here.

CSS state classes `warped`, `woah-affected`, and `mod-affected` are toggled in the
same block as Orb's and Deep Pad's.

## The edit dialog

`#powersynth-edit-dialog`, following the established orb/pad/wind editor pattern:
live apply on the form's `input` event, close button, backdrop-click to close,
`currentPowerSynth` cleared on `close`, and `bindPowerSynthContextMenu` wired from
the spawn function.

Layout is grouped sections in a two-column grid on wide screens, collapsing to one
column on mobile. The existing dialogs are single-column, but they carry 7–8 fields
against this one's 13.

| Group | Controls |
|---|---|
| Engine | engine (select, 24 options) |
| Timbre | harmonics, timbre, morph, FM amount, timbre mod amount, morph mod amount |
| Envelope | decay, LPG colour |
| Note & Output | note interval, note length, out/aux mix, volume |

All Plaits synthesis params are `0..1` ranges at `0.01` steps. Note interval and
note length mirror Orb's controls and ranges. Volume writes `outputNode.gain`.
Out/aux mix sends the worklet's `mix` message, blending Plaits' two output taps.

Editing `timbre` or `morph` writes the element's `baseTimbre` / `baseMorph`, not
the param directly — the proximity loop is the only writer of the effective value.

## Testing

Black-box style throughout — DOM and class assertions only, no inspection of
`SOUND` internals or audio signals.

Adding a `powersynth` entry to `ELEMENT_TYPES` in `tests/helpers.ts` extends the
existing table-driven spawn test in `spawn-elements.spec.ts` for free. That
shared table is the reason a new element type belongs there rather than in a
parallel spec file.

A new `tests/powersynth-editor.spec.ts` then covers what is specific to this
element, mirroring `orb-editor.spec.ts`:

- right-click opens `#powersynth-edit-dialog`, pre-filled with current values
- selecting a different engine updates the select and raises no console error
- moving a param slider updates its live readout
- close button and backdrop-click both close the dialog

Erase and drag coverage comes from `drag-and-erase.spec.ts`, which is Orb-specific
today; one erase case is added there for Power Synth, because erasing this element
type has a failure mode the others do not (disposal racing the wasm load).

Tests must wait for `.powersynth-loading` to clear before any interaction that
depends on the voice existing, and must reuse `spawnViaClick` from `tests/helpers.ts`
(which already waits out the spawn-in animation before returning coordinates).

## Files

**New**

- `public/plaits.wasm` — vendored binary, ~300 KB
- `public/plaits-worklet.js` — vendored verbatim from `mi-plaits-wasm/web/worklet.js`
- `src/ts/plaits.ts`
- `src/ts/powersynth-editor.ts`
- `src/css/powersynth.css`
- `src/css/powersynth-edit-dialog.css`
- `tests/powersynth-editor.spec.ts`

**Modified**

- `index.html` — toolbar button in the Generators section, dialog markup
- `style.css` — two `@import`s
- `src/ts/state.ts` — DOM refs for the dialog, `SOUND.powersynths: []`
- `src/types.d.ts` — `PowerSynthState`; add to `SoundState`, `SoundSource`, `OrbitableElement`
- `src/ts/elements.ts` — `spawnPowerSynth`, `removePowerSynth`
- `src/ts/proximity.ts` — flag reset, Time Warp, Modulator, Woah, Orbit, class toggles
- `src/app.ts` — `initPlaits()` in `startAudio`, drop-handler case, toolbar drag + click wiring, `initPowerSynthEditor()`
- `CLAUDE.md` — the element-type list, and a note on the vendored wasm assets

## Conventions

The element type id is `'powersynth'` — lowercase, no separator, consistent with
`'deeppad'` and `'etheralwind'`. It appears in `data-element`, the drag
`dataTransfer` payload, and the drop-handler switch. CSS classes are
`powersynth-element` and `powersynth-preview`, plus the shared state modifiers.

## Known limitations

- Switching to engines 2, 3, or 4 (six-op FM) parses a 4 KB sysex bank on the
  audio thread inside `Voice::render` and can click. This is upstream behaviour;
  it is documented in the dialog rather than worked around.
- The vendored `plaits.wasm` can drift from `mi-plaits-wasm`. `PARAMS` in
  `plaits.ts` must stay in sync with `src/params.rs` there. Unknown param ids are
  ignored by the Rust side, so a stale `.wasm` degrades rather than crashes.
- Each element runs its own worklet voice. Upstream benchmarks put the worst
  engine (FM) at 143x realtime, so dozens of elements are comfortable, but this
  is not free the way a silent modulator is.
