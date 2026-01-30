import type { MoodPreset, MoodConfig, TransitionMatrix, RomanNumeral } from './types';

// Timing constants
export const DEFAULT_BPM = 75;
export const DEFAULT_SWING = 0.55;
export const LOOKAHEAD_MS = 100;
export const SCHEDULE_INTERVAL_MS = 25;

// Musical constants
export const DEFAULT_KEY = 0; // C
export const DEFAULT_MODE = 'major' as const;
export const STEPS_PER_BAR = 16;
export const BEATS_PER_BAR = 4;
export const BARS_PER_PROGRESSION = 4;

// Envelope defaults
export const BASS_ENVELOPE = {
  attack: 0.01,
  decay: 0.1,
  sustain: 0.7,
  release: 0.3
};

export const PAD_ENVELOPE = {
  attack: 0.8,
  decay: 0.2,
  sustain: 0.6,
  release: 1.5
};

// Effect defaults
export const DEFAULT_FILTER_CUTOFF = 3200;
export const DEFAULT_REVERB_WET = 0.3;
export const DEFAULT_SATURATION = 0.3;
export const DEFAULT_SIDECHAIN_DEPTH = -12; // dB
export const DEFAULT_SIDECHAIN_RELEASE = 150; // ms

// Vinyl noise defaults
export const DEFAULT_VINYL_LEVEL = 0.03;
export const DEFAULT_CRACKLE_INTENSITY = 0.5;

// Volume defaults (0-1)
export const DEFAULT_MASTER_VOLUME = 0.8;
export const DEFAULT_DRUMS_VOLUME = 0.7;
export const DEFAULT_BASS_VOLUME = 0.7;
export const DEFAULT_PAD_VOLUME = 0.6;
export const DEFAULT_AMBIENCE_VOLUME = 0.4;

// Base transition matrix for chord progressions
export const BASE_TRANSITION_MATRIX: TransitionMatrix = {
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

// Helper to create modified transition matrices
function modifyTransitions(base: TransitionMatrix, modifications: Partial<Record<RomanNumeral, Partial<Record<RomanNumeral, number>>>>): TransitionMatrix {
  const result = JSON.parse(JSON.stringify(base)) as TransitionMatrix;
  for (const [from, toMods] of Object.entries(modifications)) {
    if (result[from as RomanNumeral]) {
      for (const [to, weight] of Object.entries(toMods!)) {
        result[from as RomanNumeral][to as RomanNumeral] = weight;
      }
      // Normalize weights
      const row = result[from as RomanNumeral];
      const total = Object.values(row).reduce((sum, w) => sum + w, 0);
      if (total > 0) {
        for (const key of Object.keys(row) as RomanNumeral[]) {
          row[key] /= total;
        }
      }
    }
  }
  return result;
}

// Mood configurations
export const MOOD_CONFIGS: Record<MoodPreset, MoodConfig> = {
  chill: {
    bpmRange: [70, 82],
    preferredMode: 'major',
    filterCutoff: 3200,
    reverbWet: 0.30,
    transitionWeights: BASE_TRANSITION_MATRIX
  },
  rainy: {
    bpmRange: [62, 74],
    preferredMode: 'minor',
    filterCutoff: 2000,
    reverbWet: 0.50,
    transitionWeights: modifyTransitions(BASE_TRANSITION_MATRIX, {
      'I': { 'iv': 0.15, 'bVI': 0.12, 'bVII': 0.15 },
      'V': { 'I': 0.25, 'vi': 0.35 },
      'vi': { 'iv': 0.15, 'bVI': 0.10 }
    })
  },
  melancholic: {
    bpmRange: [58, 70],
    preferredMode: 'dorian',
    filterCutoff: 2400,
    reverbWet: 0.42,
    transitionWeights: modifyTransitions(BASE_TRANSITION_MATRIX, {
      'I': { 'vi': 0.30, 'ii': 0.30 },
      'V': { 'vi': 0.45, 'I': 0.25 },
      'IV': { 'vi': 0.25, 'ii': 0.25 }
    })
  },
  upbeat: {
    bpmRange: [82, 96],
    preferredMode: 'mixolydian',
    filterCutoff: 5500,
    reverbWet: 0.18,
    transitionWeights: modifyTransitions(BASE_TRANSITION_MATRIX, {
      'I': { 'IV': 0.35, 'V': 0.30, 'vi': 0.10 },
      'IV': { 'I': 0.35, 'V': 0.35 },
      'V': { 'I': 0.55 }
    })
  }
};

// Preferred keys weighted by pleasantness in different registers
export const KEY_WEIGHTS: Record<number, number> = {
  0: 0.20,  // C
  2: 0.15,  // D
  5: 0.18,  // F
  7: 0.18,  // G
  10: 0.12, // Bb
  9: 0.10,  // A
  4: 0.07   // E
};
