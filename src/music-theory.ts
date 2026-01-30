import type { ChordQuality, RomanNumeral, ScaleMode, Chord } from './types';

// MIDI note to frequency conversion (A4 = 440Hz = MIDI 69)
export function noteToFrequency(midiNote: number): number {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

export function frequencyToNote(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440);
}

// Chord intervals (semitones from root)
export const CHORD_INTERVALS: Record<ChordQuality, number[]> = {
  'maj7': [0, 4, 7, 11],
  'min7': [0, 3, 7, 10],
  'dom7': [0, 4, 7, 10],
  'min9': [0, 3, 7, 10, 14],
  'maj9': [0, 4, 7, 11, 14],
  'dim7': [0, 3, 6, 9],
  'min7b5': [0, 3, 6, 10]
};

// Scale patterns (semitones from root)
export const SCALE_PATTERNS: Record<ScaleMode, number[]> = {
  'major': [0, 2, 4, 5, 7, 9, 11],
  'minor': [0, 2, 3, 5, 7, 8, 10],
  'dorian': [0, 2, 3, 5, 7, 9, 10],
  'mixolydian': [0, 2, 4, 5, 7, 9, 10]
};

// Roman numeral to scale degree offset and quality
export const ROMAN_NUMERAL_INFO: Record<RomanNumeral, { offset: number; quality: ChordQuality; borrowed?: boolean }> = {
  'I': { offset: 0, quality: 'maj7' },
  'ii': { offset: 2, quality: 'min7' },
  'iii': { offset: 4, quality: 'min7' },
  'IV': { offset: 5, quality: 'maj7' },
  'V': { offset: 7, quality: 'dom7' },
  'vi': { offset: 9, quality: 'min7' },
  'vii°': { offset: 11, quality: 'min7b5' },
  'bVI': { offset: 8, quality: 'maj7', borrowed: true },
  'bVII': { offset: 10, quality: 'dom7', borrowed: true },
  'iv': { offset: 5, quality: 'min7', borrowed: true }
};

// Note names for display
export const NOTE_NAMES: string[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Convert a chord root and quality to an array of MIDI note numbers
 * @param root Root note as MIDI number (absolute)
 * @param quality Chord quality
 * @returns Array of MIDI note numbers
 */
export function chordToMidiNotes(root: number, quality: ChordQuality): number[] {
  const intervals = CHORD_INTERVALS[quality];
  return intervals.map(interval => root + interval);
}

/**
 * Convert a Roman numeral to a Chord object
 * @param numeral Roman numeral
 * @param key Key root note (0-11)
 * @param mode Scale mode
 * @returns Chord object
 */
export function romanToChord(numeral: RomanNumeral, key: number, mode: ScaleMode): Chord {
  const info = ROMAN_NUMERAL_INFO[numeral];

  // Get the scale degree offset based on mode
  let offset = info.offset;

  // For borrowed chords, use the absolute offset
  // For diatonic chords, adjust based on mode
  if (!info.borrowed) {
    const scale = SCALE_PATTERNS[mode];
    // Find the closest scale tone to the offset
    const degree = getDegreeFromOffset(offset);
    offset = scale[degree] ?? offset;
  }

  const root = (key + offset) % 12;

  return {
    root,
    quality: info.quality,
    romanNumeral: numeral
  };
}

/**
 * Get scale degree (0-6) from semitone offset
 */
function getDegreeFromOffset(offset: number): number {
  const majorScale = SCALE_PATTERNS.major;
  const index = majorScale.indexOf(offset);
  return index >= 0 ? index : 0;
}

/**
 * Get all scale notes for a given root and mode
 * @param root Root note (0-11)
 * @param mode Scale mode
 * @returns Array of pitch classes (0-11)
 */
export function getScaleNotes(root: number, mode: ScaleMode): number[] {
  const pattern = SCALE_PATTERNS[mode];
  return pattern.map(interval => (root + interval) % 12);
}

/**
 * Check if a note is a chord tone
 */
export function isChordTone(note: number, chord: Chord): boolean {
  const chordNotes = chordToMidiNotes(chord.root, chord.quality).map(n => n % 12);
  return chordNotes.includes(note % 12);
}

/**
 * Check if a note is in the scale
 */
export function isScaleTone(note: number, key: number, mode: ScaleMode): boolean {
  const scaleNotes = getScaleNotes(key, mode);
  return scaleNotes.includes(note % 12);
}

/**
 * Get the fifth of a chord root
 */
export function getFifth(root: number): number {
  return (root + 7) % 12;
}

/**
 * Get display name for a chord
 */
export function getChordDisplayName(chord: Chord): string {
  const rootName = NOTE_NAMES[chord.root % 12];
  const qualityDisplay: Record<ChordQuality, string> = {
    'maj7': 'maj7',
    'min7': 'm7',
    'dom7': '7',
    'min9': 'm9',
    'maj9': 'maj9',
    'dim7': 'dim7',
    'min7b5': 'm7b5'
  };
  return rootName + qualityDisplay[chord.quality];
}

/**
 * Transpose a MIDI note to a specific octave range
 */
export function transposeToOctave(midiNote: number, targetOctave: number): number {
  const pitchClass = midiNote % 12;
  return pitchClass + (targetOctave + 1) * 12;
}
