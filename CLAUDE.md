# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Browser-based algorithmic lofi music generator using Web Audio API. Creates endless procedural lofi hip-hop beats entirely client-side with no backend. Features Markov chain chord progressions, music-theory-aware bass generation, and multiple mood presets.

## Build Commands

```bash
npm run dev        # Start Vite dev server with hot reload
npm run build      # TypeScript compile + Vite production build (outputs to dist/)
npm run preview    # Preview production build locally
```

No testing framework is configured. TypeScript strict mode is the primary code quality enforcement.

## Architecture

### Layer Structure

```
UI Layer (main.ts)
    ↓
Audio Engine & Bus System (audio-engine.ts)
    ↓
Synthesis Layer (synths/, sampler.ts)
    ↓
Effects Chain (effects/)
    ↓
Web Audio API (native)
```

### Signal Flow

```
Drums Bus ┐
Bass Bus  ├→ Instruments Bus → Sidechain → Lowpass → Saturator → Reverb → Master → Output
Pad Bus   ┤
Ambience Bus (Vinyl Noise) ─────────────────────────────────────────↑
```

### Key Modules

- **main.ts**: Entry point, UI binding, application state, playback coordination
- **audio-engine.ts**: AudioContext creation, master bus routing
- **sequencer.ts**: Transport class with lookahead scheduler (100ms lookahead, 25ms polling)
- **config.ts**: Constants, mood configurations, Markov transition matrices
- **music-theory.ts**: MIDI/frequency conversion, chord/scale definitions
- **types.ts**: TypeScript interfaces for Chord, DrumPattern, BassNote, etc.

### Generators (src/generators/)

- **chord-progression.ts**: Markov chain generation with mood-specific transition weights
- **bassline.ts**: Music-theory-aware bass patterns following chord roots
- **drum-pattern.ts**: 16-step patterns with velocity variations

### Synths (src/synths/)

- **sub-bass.ts**: Sine oscillator with ADSR envelope
- **pad.ts**: 3 detuned sawtooths with LFO modulation and filter

### Effects (src/effects/)

All effects follow the pattern of exposing `getInputNode()` and `getOutputNode()` for connection chaining.

## Audio Node Pattern

Audio components encapsulate Web Audio nodes and expose only connection points:

```typescript
export class LowpassFilter {
  private filter: BiquadFilterNode;
  getInputNode(): AudioNode { return this.filter; }
  getOutputNode(): AudioNode { return this.filter; }
}
```

## Mood System

Mood presets (chill, rainy, melancholic, upbeat) modify:
- BPM range
- Scale mode (major, minor, dorian, mixolydian)
- Filter cutoff frequency
- Reverb wet level
- Chord transition probabilities

## Samples

Four WAV drum samples in `public/samples/`: kick, snare, hat-closed, hat-open. Loaded asynchronously at startup using relative paths (`./samples/`).

## Deployment

GitHub Actions deploys to GitHub Pages on push to main. Output is static files only.
