// Core musical types
export type NoteName = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';
export type ChordQuality = 'maj7' | 'min7' | 'dom7' | 'min9' | 'maj9' | 'dim7' | 'min7b5';
export type ScaleMode = 'major' | 'minor' | 'dorian' | 'mixolydian';
export type RomanNumeral = 'I' | 'ii' | 'iii' | 'IV' | 'V' | 'vi' | 'vii°' | 'bVI' | 'bVII' | 'iv';

export interface Chord {
  root: number;           // MIDI note number (0-11 for pitch class, or absolute)
  quality: ChordQuality;
  romanNumeral: RomanNumeral;
}

export interface ChordProgression {
  chords: Chord[];
  key: number;            // Root note (0 = C)
  mode: ScaleMode;
  barsPerChord: number;
}

// Scheduling types
export interface ScheduledNote {
  pitch: number;          // MIDI note number
  startTime: number;      // AudioContext time
  duration: number;       // Seconds
  velocity: number;       // 0-1
}

export interface ScheduledDrumHit {
  sample: DrumSample;
  startTime: number;
  velocity: number;
}

export type DrumSample = 'kick' | 'snare' | 'hat-closed' | 'hat-open';

export interface DrumPattern {
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
export interface BassNote {
  pitch: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
}

export interface GeneratedBar {
  bass: BassNote[];
  drums: DrumPattern;
}

// Configuration types
export type MoodPreset = 'chill' | 'rainy' | 'melancholic' | 'upbeat';

export interface MoodConfig {
  bpmRange: [number, number];
  preferredMode: ScaleMode;
  filterCutoff: number;
  reverbWet: number;
  transitionWeights: TransitionMatrix;
}

export type TransitionMatrix = Record<RomanNumeral, Record<RomanNumeral, number>>;

// Audio engine types
export interface AudioBuses {
  master: GainNode;
  instruments: GainNode;
  drums: GainNode;
  bass: GainNode;
  pad: GainNode;
  ambience: GainNode;
}

// Callback types
export type BeatCallback = (beat: number, time: number) => void;
