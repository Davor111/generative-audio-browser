# Generative Audio Browser

**[Live demo](https://Davor111.github.io/generative-audio-browser/)**

An interactive generative audio-visual experience in the browser. Drag animated elements onto a canvas to build evolving soundscapes. Work in progress.

## How it works

The canvas holds two categories of element:

- **Generators** (Orb, Deep Pad, Ethereal Wind) — produce sound continuously on recursive `setTimeout` note-scheduling loops, walking a pentatonic scale
- **Modulators** (Time Warp, Woah, Modulator, Orbit) — silent; each has an influence radius and reshapes nearby generators in real time

Every animation frame a proximity loop (`requestAnimationFrame`) computes distances between all modulators and generators, ramps Tone.js audio parameters (`.rampTo()`), and draws connector lines on an overlay `<canvas>`.

| Element | Effect |
|---|---|
| **Orb** | Melodic sine synth, walks pentatonic notes |
| **Deep Pad** | Fat sawtooth bass with slow portamento |
| **Ethereal Wind** | Pink noise through a sweeping band-pass auto-filter |
| **Time Warp** | Speeds up note scheduling of nearby generators |
| **Woah** | Feeds nearby generators into a ping-pong delay + reverb send |
| **Modulator** | Drives distortion wet mix on nearby generators |
| **Orbit** | Physically rotates nearby elements around itself |

All audio routes through a shared `Limiter → Reverb` master chain. The DOM (`el.style.left` / `el.style.top`) is the source of truth for element position — there is no separate coordinate model.

## Stack

- **TypeScript** — strict mode, compiled by Vite
- **Vite** — dev server and production bundler
- **Tone.js v15** — Web Audio abstraction (oscillators, effects, scheduling)
- No framework, no state library

## Running locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`, click **Start Experience**, then drag or click elements from the sidebar onto the canvas.

```bash
npm run build    # production bundle → dist/
npm run preview  # serve the dist/ build locally
```

## Deploying

The repo includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that builds and deploys to GitHub Pages on every push to `main`. Enable it once in **Settings → Pages → Source → GitHub Actions**.
