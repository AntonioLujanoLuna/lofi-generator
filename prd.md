# Lofi Generator PRD

## Overview

A browser-based algorithmic lofi music generator that creates endless, procedurally generated lofi hip-hop beats. Runs entirely client-side, deployable to GitHub Pages. Emphasizes procedural generation over sample dependency.

## Technical Stack

- **Language**: TypeScript (strict mode)
- **Build**: Vite (dev server + static build)
- **Audio**: Web Audio API (raw API, no libraries)
- **UI**: Vanilla TypeScript with minimal CSS
- **Deployment**: Static files to GitHub Pages via `vite build`

## Architecture

### File Structure

```
/lofi-generator
  index.html
  vite.config.ts
  tsconfig.json
  package.json
  /public
    /samples
      kick.wav
      snare.wav
      hat-closed.wav
      hat-open.wav
  /src
    main.ts                 # Entry point, UI binding
    audio-engine.ts         # Web Audio context, master chain, scheduling
    synths/
      sub-bass.ts           # Sub-bass synthesizer
      pad.ts                # Pad synthesizer with detuned oscillators
      index.ts              # Synth exports
    sampler.ts              # Sample loading and playback
    sequencer.ts            # Transport, timing, pattern playback
    generators/
      chord-progression.ts  # Markov chain chord generation
      bassline.ts           # Bass pattern generation
      drum-pattern.ts       # Drum pattern generation with variation
      index.ts              # Generator exports
    effects/
      lowpass-filter.ts     # Lowpass filter wrapper
      saturator.ts          # Tape saturation waveshaper
      reverb.ts             # Algorithmic reverb
      vinyl-noise.ts        # Procedural vinyl crackle/hiss
      sidechain.ts          # Sidechain compression
      index.ts              # Effect exports
    music-theory.ts         # Scales, chords, intervals, transposition
    config.ts               # Constants, tuning parameters
    types.ts                # Shared TypeScript interfaces and types
    utils.ts                # Helper functions (random, scheduling, etc.)
```

### Type Definitions (types.ts)

```typescript
// Core musical types
type NoteName = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';
type ChordQuality = 'maj7' | 'min7' | 'dom7' | 'min9' | 'maj9' | 'dim7' | 'min7b5';
type ScaleMode = 'major' | 'minor' | 'dorian' | 'mixolydian';
type RomanNumeral = 'I' | 'ii' | 'iii' | 'IV' | 'V' | 'vi' | 'vii°' | 'bVI' | 'bVII' | 'iv';

interface Chord {
  root: number;           // MIDI note number (0-11 for pitch class, or absolute)
  quality: ChordQuality;
  romanNumeral: RomanNumeral;
}

interface ChordProgression {
  chords: Chord[];
  key: number;            // Root note (0 = C)
  mode: ScaleMode;
  barsPerChord: number;
}

// Scheduling types
interface ScheduledNote {
  pitch: number;          // MIDI note number
  startTime: number;      // AudioContext time
  duration: number;       // Seconds
  velocity: number;       // 0-1
}

interface ScheduledDrumHit {
  sample: DrumSample;
  startTime: number;
  velocity: number;
}

type DrumSample = 'kick' | 'snare' | 'hat-closed' | 'hat-open';

interface DrumPattern {
  kick: boolean[];        // 16 steps
  snare: boolean[];
  hatClosed: boolean[];
  hatOpen: boolean[];
  velocities: {
    kick: number[];
    snare: number[];
    hatClosed: number[];
    hatOpen: number[];
  };
}

// Generator output types
interface BassNote {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
}

interface GeneratedBar {
  bass: BassNote[];
  drums: DrumPattern;
}

// Configuration types
type MoodPreset = 'chill' | 'rainy' | 'melancholic' | 'upbeat';

interface MoodConfig {
  bpmRange: [number, number];
  preferredMode: ScaleMode;
  filterCutoff: number;
  reverbWet: number;
  transitionWeights: TransitionMatrix;
}

type TransitionMatrix = Record<RomanNumeral, Record<RomanNumeral, number>>;

// Audio engine types
interface AudioBuses {
  master: GainNode;
  instruments: GainNode;
  drums: GainNode;
  bass: GainNode;
  pad: GainNode;
  ambience: GainNode;
}
```

### Module Responsibilities

**audio-engine.ts**
- Creates and manages `AudioContext`
- Builds master signal chain with typed bus structure
- Handles audio context resume on user interaction
- Exposes `getContext(): AudioContext`, `getBuses(): AudioBuses`
- Manages `AnalyserNode` for visualizations
- Provides `startAudio()`, `stopAudio()`, `isRunning(): boolean`

**synths/sub-bass.ts**
- `SubBassSynth` class
- Creates sine oscillator → gain envelope → lowpass filter
- Methods:
  - `triggerNote(pitch: number, startTime: number, duration: number, velocity: number): void`
  - `setLevel(gain: number): void`
  - `connect(destination: AudioNode): void`
- Envelope parameters configurable via constructor

**synths/pad.ts**
- `PadSynth` class
- Creates 3 detuned sawtooth oscillators → mix gain → filter with LFO → amplitude envelope
- Methods:
  - `triggerChord(pitches: number[], startTime: number, duration: number, velocity: number): void`
  - `setFilterCutoff(hz: number): void`
  - `setFilterLFODepth(cents: number): void`
  - `setLevel(gain: number): void`
  - `connect(destination: AudioNode): void`

**sampler.ts**
- `SampleLibrary` class: Async loads all samples into `Map<DrumSample, AudioBuffer>`
- `DrumSampler` class:
  - `play(sample: DrumSample, startTime: number, velocity: number): void`
  - `connect(destination: AudioNode): void`
- Uses `AudioBufferSourceNode` per trigger (one-shot)

**sequencer.ts**
- `Transport` class
- State: `playing: boolean`, `bpm: number`, `currentBeat: number`, `swingAmount: number`
- Lookahead scheduler using `setInterval` (25ms) + 100ms lookahead window
- Methods:
  - `start(): void`
  - `stop(): void`
  - `setBPM(bpm: number): void`
  - `setSwing(amount: number): void` (0.5 = straight, 0.67 = triplet swing)
  - `getCurrentBeat(): number`
  - `beatToTime(beat: number): number`
  - `onBeat(callback: (beat: number, time: number) => void): void`
- Handles swing by delaying odd 16th notes

**generators/chord-progression.ts**
- `ChordProgressionGenerator` class
- Stores `TransitionMatrix` for chord functions
- Constructor accepts `MoodConfig` to set weights
- Methods:
  - `generate(length: number): ChordProgression`
  - `setMood(mood: MoodPreset): void`
- Starts on I, walks Markov chain for `length` chords
- Resolves Roman numerals to actual chords based on key/mode

**generators/bassline.ts**
- `BasslineGenerator` class
- Methods:
  - `generateBar(chord: Chord, nextChord: Chord | null, barNumber: number): BassNote[]`
- Rules:
  - Beat 1: root note (high velocity)
  - Beat 3: 60% chance fifth (medium velocity)
  - Beat 4: 40% chance chromatic approach to next root (if chord changes)
- Applies slight timing humanization

**generators/drum-pattern.ts**
- `DrumPatternGenerator` class
- Methods:
  - `generatePattern(bars: number): DrumPattern[]`
  - `setDensity(density: number): void` (0-1, affects ghost note probability)
- Base template with probabilistic variation
- Ghost notes, dropouts, fills every 4 bars
- Velocity humanization built-in

**effects/lowpass-filter.ts**
- `LowpassFilter` class wrapping `BiquadFilterNode`
- Methods:
  - `setCutoff(hz: number): void`
  - `setResonance(q: number): void`
  - `getInputNode(): AudioNode`
  - `getOutputNode(): AudioNode`

**effects/saturator.ts**
- `Saturator` class using `WaveShaperNode`
- Soft clipping curve for tape warmth
- Methods:
  - `setDrive(amount: number): void` (0-1)
  - `getInputNode(): AudioNode`
  - `getOutputNode(): AudioNode`

**effects/reverb.ts**
- `SimpleReverb` class
- Algorithmic reverb using feedback delay network (4 delays with feedback matrix)
- Methods:
  - `setWetDry(wet: number): void` (0-1)
  - `setDecay(seconds: number): void`
  - `getInputNode(): AudioNode`
  - `getOutputNode(): AudioNode`

**effects/vinyl-noise.ts**
- `VinylNoise` class
- Procedurally generates:
  - Continuous filtered noise (pink-ish via lowpass + highpass)
  - Random crackle impulses (noise bursts at random intervals)
  - Subtle pitch wobble LFO (wow/flutter simulation)
- Methods:
  - `start(): void`
  - `stop(): void`
  - `setLevel(gain: number): void`
  - `setCrackleIntensity(intensity: number): void` (0-1)
  - `connect(destination: AudioNode): void`
- No samples required—pure synthesis

**effects/sidechain.ts**
- `SidechainCompressor` class
- Ducks input signal when triggered
- Methods:
  - `trigger(time: number): void` (called on kick hits)
  - `setDepth(db: number): void`
  - `setRelease(ms: number): void`
  - `getInputNode(): AudioNode`
  - `getOutputNode(): AudioNode`

**music-theory.ts**
- Pure functions, no classes
- `noteToFrequency(midiNote: number): number`
- `frequencyToNote(hz: number): number`
- `chordToMidiNotes(root: number, quality: ChordQuality): number[]`
- `romanToChord(numeral: RomanNumeral, key: number, mode: ScaleMode): Chord`
- `getScaleNotes(root: number, mode: ScaleMode): number[]`
- `isChordTone(note: number, chord: Chord): boolean`
- `isScaleTone(note: number, key: number, mode: ScaleMode): boolean`
- Constants: `CHORD_INTERVALS`, `SCALE_PATTERNS`, `ROMAN_NUMERAL_OFFSETS`

**config.ts**
- `DEFAULT_BPM = 75`
- `DEFAULT_SWING = 0.55`
- `DEFAULT_KEY = 0` (C)
- `DEFAULT_MODE = 'major'`
- `LOOKAHEAD_MS = 100`
- `SCHEDULE_INTERVAL_MS = 25`
- Envelope defaults for bass and pad
- Effect parameter defaults
- `MOOD_CONFIGS: Record<MoodPreset, MoodConfig>`
- `BASE_TRANSITION_MATRIX: TransitionMatrix`

**utils.ts**
- `randomFloat(min: number, max: number): number`
- `randomInt(min: number, max: number): number`
- `weightedRandom<T>(items: T[], weights: number[]): T`
- `clamp(value: number, min: number, max: number): number`
- `lerp(a: number, b: number, t: number): number`
- `dbToGain(db: number): number`
- `gainToDb(gain: number): number`

### Signal Flow

```
[SubBassSynth] → [Bass Bus Gain] ──────────────────┐
                                                   │
[PadSynth] → [Pad Bus Gain] ───────────────────────┼→ [Instrument Bus] → [Sidechain]
                                                   │          ↓
[DrumSampler] → [Drum Bus Gain] ───────────────────┘    [Lowpass Filter]
        │                                                      ↓
        └──────────────────────────────────────────→    [Saturator]
                  (sidechain trigger)                          ↓
                                                         [Reverb]
                                                              ↓
[VinylNoise] → [Ambience Bus Gain] ──────────────────→ [Master Gain]
                                                              ↓
                                                       [AnalyserNode]
                                                              ↓
                                                       [Destination]
```

## Core Features

### 1. Transport Controls
- Play/Pause toggle button
- BPM slider (60-100 range, default 75)
- Regenerate button (creates new progression and patterns)

### 2. Procedural Generation
- On page load and regenerate: generate new 4-bar chord progression
- Generate complementary bass and drum patterns
- Seamless looping

### 3. Sound Sources
- **Synthesized sub-bass**: Sine oscillator following chord roots
- **Synthesized pad**: 3 detuned sawtooth oscillators, filtered, slow envelope
- **Sampled drums**: Kick, snare, closed hat, open hat (4 samples total)
- **Synthesized vinyl ambience**: Procedural noise, crackle, wow/flutter

### 4. Effects Processing
- Global lowpass filter with adjustable cutoff
- Tape saturation
- Algorithmic reverb with wet/dry control
- Sidechain compression (kick ducks pad/bass)

### 5. Mix Controls
- Master volume slider
- Individual level sliders: Drums, Bass, Pad, Ambience
- Mute toggle buttons for each element

### 6. Mood Presets
- Dropdown selector: "Chill," "Rainy," "Melancholic," "Upbeat"
- Each preset adjusts: key/mode, tempo, chord weights, filter cutoff, reverb amount

### 7. Visual Feedback
- Frequency bar visualization using AnalyserNode
- Current chord symbol display
- Beat indicator (optional—simple pulsing element)

### 8. Export
- Record button using MediaRecorder API or OfflineAudioContext
- Export to WAV file download
- Free, no paywall

## UI Specification

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│                   [Frequency Bars Visualization]            │
│                        (height: 180px)                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│     Current Chord: Dm7              BPM: [====●====] 75     │
│                                                             │
│       [ ▶ Play ]    [ ↻ New ]    [ ● Rec ]                  │
│                                                             │
│     Mood: [ Chill        ▼ ]                                │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Mix                                                        │
│    Master    [════════●════]                                │
│    Drums     [══════●══════]   [M]                          │
│    Bass      [══════●══════]   [M]                          │
│    Pad       [══════●══════]   [M]                          │
│    Ambience  [════●════════]   [M]                          │
├─────────────────────────────────────────────────────────────┤
│  Effects                                                    │
│    Filter    [══════════●══]                                │
│    Reverb    [═════●═══════]                                │
└─────────────────────────────────────────────────────────────┘
```

### Visual Design

- **Theme**: Dark mode
- **Background**: `#0d0d0f` (near black)
- **Surface**: `#1a1a1f` (dark gray for panels)
- **Primary accent**: `#7c6f9f` (muted purple)
- **Secondary accent**: `#4a5568` (gray-blue)
- **Text primary**: `#e2e2e8`
- **Text secondary**: `#8888aa`
- **Font**: System sans-serif stack, or "Inter" if loading fonts
- **Border radius**: 8px for panels, 4px for buttons/inputs
- **Spacing**: 8px base unit

### Responsive Behavior

- Desktop (>768px): Full layout as shown
- Mobile (<768px): Stack vertically, full-width controls, smaller visualization

## Algorithmic Specifications

### Chord Progression Generation

**Chord Vocabulary**

Diatonic:
- I (maj7), ii (min7), iii (min7), IV (maj7), V (dom7), vi (min7), vii° (min7b5)

Extended (substituted randomly 30% of the time):
- I → Imaj9, ii → ii9, vi → vi9

Borrowed (modal interchange):
- bVII (dom7), iv (min7), bVI (maj7)

**Base Transition Matrix (Chill mood)**

```typescript
const BASE_TRANSITIONS: TransitionMatrix = {
  'I':    { 'I': 0.00, 'ii': 0.25, 'iii': 0.10, 'IV': 0.25, 'V': 0.15, 'vi': 0.18, 'vii°': 0.00, 'bVI': 0.00, 'bVII': 0.05, 'iv': 0.02 },
  'ii':   { 'I': 0.10, 'ii': 0.00, 'iii': 0.10, 'IV': 0.15, 'V': 0.45, 'vi': 0.10, 'vii°': 0.02, 'bVI': 0.00, 'bVII': 0.05, 'iv': 0.03 },
  'iii':  { 'I': 0.15, 'ii': 0.15, 'iii': 0.00, 'IV': 0.25, 'V': 0.10, 'vi': 0.30, 'vii°': 0.00, 'bVI': 0.00, 'bVII': 0.05, 'iv': 0.00 },
  'IV':   { 'I': 0.20, 'ii': 0.18, 'iii': 0.08, 'IV': 0.00, 'V': 0.30, 'vi': 0.12, 'vii°': 0.02, 'bVI': 0.00, 'bVII': 0.08, 'iv': 0.02 },
  'V':    { 'I': 0.50, 'ii': 0.05, 'iii': 0.05, 'IV': 0.12, 'V': 0.00, 'vi': 0.20, 'vii°': 0.00, 'bVI': 0.08, 'bVII': 0.00, 'iv': 0.00 },
  'vi':   { 'I': 0.10, 'ii': 0.30, 'iii': 0.12, 'IV': 0.25, 'V': 0.18, 'vi': 0.00, 'vii°': 0.00, 'bVI': 0.00, 'bVII': 0.03, 'iv': 0.02 },
  'vii°': { 'I': 0.50, 'ii': 0.10, 'iii': 0.20, 'IV': 0.10, 'V': 0.05, 'vi': 0.05, 'vii°': 0.00, 'bVI': 0.00, 'bVII': 0.00, 'iv': 0.00 },
  'bVI':  { 'I': 0.25, 'ii': 0.10, 'iii': 0.05, 'IV': 0.15, 'V': 0.25, 'vi': 0.05, 'vii°': 0.00, 'bVI': 0.00, 'bVII': 0.15, 'iv': 0.00 },
  'bVII': { 'I': 0.40, 'ii': 0.10, 'iii': 0.05, 'IV': 0.25, 'V': 0.08, 'vi': 0.10, 'vii°': 0.00, 'bVI': 0.00, 'bVII': 0.00, 'iv': 0.02 },
  'iv':   { 'I': 0.30, 'ii': 0.10, 'iii': 0.05, 'IV': 0.20, 'V': 0.25, 'vi': 0.05, 'vii°': 0.00, 'bVI': 0.00, 'bVII': 0.05, 'iv': 0.00 },
};
```

**Generation Algorithm**

1. Select random key (weighted toward C, F, G, D, Bb for pleasant registers)
2. Select mode based on mood preset
3. Start on I
4. For each subsequent chord (total 4):
   - Look up current chord's row in transition matrix
   - Apply mood-specific weight modifiers
   - Select next chord via weighted random
5. Return `ChordProgression` object

**Progression Length**: 4 bars (16 beats at 4/4), looping

**Harmonic Rhythm**: 1 chord per bar (4 beats)

### Bassline Generation

**Rules**

| Beat | Action | Probability | Velocity Range |
|------|--------|-------------|----------------|
| 1 | Play root | 100% | 0.8 - 1.0 |
| 2 | Rest or sustain | — | — |
| 3 | Play fifth | 60% | 0.5 - 0.7 |
| 3 | Play root (octave) | 20% | 0.5 - 0.7 |
| 3 | Rest | 20% | — |
| 4 | Chromatic approach to next root | 40% (if chord changes) | 0.4 - 0.6 |
| 4 | Rest | 60% | — |

**Register**: MIDI 36-48 (C2 to C3)

**Note Duration**: Sustained until next note (legato), or 0.9 beats if followed by rest

**Humanization**:
- Timing: ±8ms random offset
- Velocity: ±5% random variation

### Drum Pattern Generation

**Base Pattern** (16-step grid, one bar)

```
Step:    1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16
Kick:    X  .  .  .  .  .  .  .  X  .  .  .  .  .  X  .
Snare:   .  .  .  .  X  .  .  .  .  .  .  .  X  .  .  .
HH-C:    X  .  X  .  X  .  X  .  X  .  X  .  X  .  X  .
HH-O:    .  .  .  .  .  .  .  X  .  .  .  .  .  .  .  X
```

**Variation Rules**

| Variation | Probability | Details |
|-----------|-------------|---------|
| Ghost snare | 12% per empty step | Velocity 0.15 - 0.30 |
| Extra kick | 15% on steps 7, 13 | Velocity 0.6 - 0.8 |
| Kick dropout | 8% on weak kicks | Skip hit entirely |
| Open hat swap | 10% per closed hat | Replace closed with open |
| Hat dropout | 5% per hat hit | Skip hit |

**Fills** (every 4th bar, last 4 steps)

Replace steps 13-16 with:
- 70%: Snare roll (4 hits, velocity 0.4 → 0.9 ascending)
- 20%: Kick + snare unison hits
- 10%: Dropout (silence for tension)

**Swing**

Default swing: 0.55 (55%)

Applied by delaying steps 2, 4, 6, 8, 10, 12, 14, 16 by `(swingAmount - 0.5) * stepDuration`

**Humanization**

- Timing: Gaussian distribution, σ = 8ms
- Velocity: ±8% uniform random

### Mood Presets

```typescript
const MOOD_CONFIGS: Record<MoodPreset, MoodConfig> = {
  chill: {
    bpmRange: [70, 82],
    preferredMode: 'major',
    filterCutoff: 3200,
    reverbWet: 0.30,
    transitionWeights: { /* base weights */ }
  },
  rainy: {
    bpmRange: [62, 74],
    preferredMode: 'minor',
    filterCutoff: 2000,
    reverbWet: 0.50,
    transitionWeights: { 
      // Increase: iv, bVI, bVII
      // Decrease: I, V
    }
  },
  melancholic: {
    bpmRange: [58, 70],
    preferredMode: 'dorian',
    filterCutoff: 2400,
    reverbWet: 0.42,
    transitionWeights: {
      // Favor: vi, ii, deceptive cadences (V → vi)
      // Reduce: strong resolutions (V → I)
    }
  },
  upbeat: {
    bpmRange: [82, 96],
    preferredMode: 'mixolydian',
    filterCutoff: 5500,
    reverbWet: 0.18,
    transitionWeights: {
      // Favor: I, IV, V
      // Reduce: minor chords, borrowed chords
    }
  }
};
```

### Vinyl Noise Generation

**Continuous Noise Layer**

1. Create white noise source (ScriptProcessorNode or AudioWorklet with random values)
2. Apply bandpass filter: 200Hz - 4000Hz
3. Apply gentle lowpass at 5000Hz for warmth
4. Set level very low (gain ~0.03)

**Crackle Generation**

1. Schedule random impulses using setTimeout/setInterval
2. Interval: Random 50-400ms between crackles
3. Each crackle: Short burst of filtered noise (10-40ms duration)
4. Crackle filter: Highpass 2000Hz + bandpass peak around 4000Hz
5. Crackle velocity: Random 0.02 - 0.08

**Wow/Flutter (Pitch Wobble)**

1. LFO oscillator at 0.3-0.8Hz (random on init)
2. Modulates a delay time by ±2-4ms
3. Creates subtle pitch instability characteristic of tape/vinyl

## Sample Requirements

Only 4 drum samples required (all others synthesized):

| Filename | Description | Duration | Notes |
|----------|-------------|----------|-------|
| kick.wav | Warm, muted lofi kick | 200-400ms | Low thump, not clicky |
| snare.wav | Papery brush snare or rimshot | 200-400ms | Soft transient |
| hat-closed.wav | Soft closed hi-hat | 80-150ms | Dark, not bright |
| hat-open.wav | Open hi-hat with decay | 300-500ms | Natural fade |

**Format Requirements**:
- WAV or MP3 (WAV preferred)
- 44100Hz sample rate
- 16-bit minimum
- Mono
- Trimmed, no leading silence
- Normalized to -6dB peak
- License: CC0 or CC-BY

**Suggested Sources**:
- Freesound.org (filter by CC0 license)
- Bedroom Producers Blog free sample packs
- Self-recorded

## Implementation Phases

### Phase 1: Project Setup
1. Initialize npm project with TypeScript
2. Configure Vite with TypeScript support
3. Set up tsconfig.json (strict mode)
4. Create directory structure
5. Create index.html shell
6. Add basic CSS reset and dark theme variables
7. Verify dev server runs

### Phase 2: Audio Foundation
1. Implement `audio-engine.ts`:
   - AudioContext creation with user gesture handling
   - Bus structure (master, instruments, drums, bass, pad, ambience)
   - AnalyserNode setup
2. Implement `sampler.ts`:
   - Sample loading with fetch + decodeAudioData
   - Basic playback test
3. Verify audio output works with a test tone

### Phase 3: Sequencer
1. Implement `sequencer.ts`:
   - Transport state management
   - Lookahead scheduler loop
   - Beat-to-time conversion
   - Swing calculation
2. Create hardcoded 1-bar drum pattern for testing
3. Trigger drum samples in time
4. Verify timing accuracy over 2+ minutes

### Phase 4: Synthesizers
1. Implement `synths/sub-bass.ts`:
   - Oscillator + envelope + filter chain
   - Note triggering with proper cleanup
2. Implement `synths/pad.ts`:
   - Multi-oscillator with detune
   - Filter with LFO modulation
   - Amplitude envelope
3. Trigger test notes, verify sound quality
4. Connect to bus structure

### Phase 5: Music Theory & Generation
1. Implement `music-theory.ts` utilities
2. Implement `config.ts` with transition matrices
3. Implement `generators/chord-progression.ts`:
   - Markov chain walker
   - Chord resolution to MIDI notes
4. Implement `generators/bassline.ts`
5. Implement `generators/drum-pattern.ts`:
   - Base pattern with variation
   - Fill generation
   - Humanization
6. Generate full 4-bar sequence on button click
7. Play generated sequence in sync

### Phase 6: Effects
1. Implement `effects/lowpass-filter.ts`
2. Implement `effects/saturator.ts` with waveshaper curve
3. Implement `effects/reverb.ts` (feedback delay network)
4. Implement `effects/vinyl-noise.ts`:
   - Noise generator
   - Crackle impulses
   - Wow/flutter LFO
5. Implement `effects/sidechain.ts`
6. Wire effects into signal chain
7. Test and tune parameters

### Phase 7: UI Implementation
1. Build HTML structure matching layout spec
2. Style with CSS (dark theme, spacing, typography)
3. Bind transport controls (play/pause, regenerate)
4. Bind BPM slider with live update
5. Bind mix sliders to bus gains
6. Bind mute buttons
7. Bind effect sliders (filter, reverb)
8. Implement mood preset dropdown with parameter changes
9. Display current chord symbol (updates each bar)

### Phase 8: Visualization
1. Implement frequency bar analyzer:
   - Read from AnalyserNode
   - Render bars on canvas
   - Animate with requestAnimationFrame
2. Apply visual styling (colors, smoothing)
3. Optimize for performance

### Phase 9: Polish & Testing
1. Test all mood presets for musical quality
2. Fine-tune generation parameters
3. Test browser compatibility (Chrome, Firefox, Safari, Edge)
4. Handle edge cases:
   - AudioContext suspended state
   - Sample load failures
   - Rapid play/pause clicking
5. Add loading indicator during sample load
6. Responsive layout testing
7. Performance profiling

### Phase 10: Export Feature
1. Implement recording:
   - Create MediaRecorder attached to audio destination
   - Or use OfflineAudioContext for non-realtime render
2. Encode to WAV (or use MediaRecorder's webm, convert if needed)
3. Trigger download with generated filename
4. Add record button UI with recording state indicator

### Phase 11: Deployment
1. Configure Vite build for production
2. Test production build locally
3. Set up GitHub Pages deployment (manual or GitHub Actions)
4. Verify deployed version works correctly
5. Add README with project description and usage

## Acceptance Criteria

1. **Builds successfully**: `npm run build` completes without errors
2. **Audio plays**: Clicking play starts music, stop/pause stops it
3. **Timing is stable**: No audible glitches or drift over 10+ minutes
4. **Generation varies**: Each regenerate produces audibly different output
5. **Sounds lofi**: Output is recognizably warm, muted, relaxed lofi aesthetic
6. **Synths work**: Bass and pad sound full and musical, not harsh or thin
7. **Vinyl noise works**: Continuous subtle ambience with occasional crackles
8. **Controls responsive**: All sliders and buttons affect audio in real-time
9. **Moods differ**: Each preset produces distinctly different character
10. **Visualization works**: Frequency bars animate smoothly in sync with audio
11. **Export works**: Recording produces downloadable audio file
12. **Types pass**: `tsc --noEmit` passes with no errors
13. **Deploys**: App runs correctly on GitHub Pages

## Non-Goals (v1)

- Melody generation
- User sample upload
- Session save/load
- MIDI input/output
- Pattern editor UI
- Multiple scenes/arrangements
- Mobile app
- Social features
- Monetization

## Future Considerations (v2+)

- Melody generator with contour-based algorithm
- User-uploadable samples
- More mood presets
- Learned transition matrices from MIDI corpus
- WebMIDI output for external synths
- PWA with offline support
- Audio worklet for noise generation (better performance)
- Additional synth types (keys, lead)
