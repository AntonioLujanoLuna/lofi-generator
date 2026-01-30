import type { ChordProgression, Chord, RomanNumeral, MoodPreset, TransitionMatrix, ScaleMode } from '../types';
import { MOOD_CONFIGS, KEY_WEIGHTS, BARS_PER_PROGRESSION } from '../config';
import { romanToChord } from '../music-theory';
import { weightedRandom, randomFloat } from '../utils';

export class ChordProgressionGenerator {
  private transitionMatrix: TransitionMatrix;
  private preferredMode: ScaleMode = 'major';

  constructor(mood: MoodPreset = 'chill') {
    const config = MOOD_CONFIGS[mood];
    this.transitionMatrix = config.transitionWeights;
    this.preferredMode = config.preferredMode;
  }

  /**
   * Generate a chord progression
   */
  generate(length: number = BARS_PER_PROGRESSION): ChordProgression {
    // Select key based on weights
    const keys = Object.keys(KEY_WEIGHTS).map(Number);
    const weights = keys.map(k => KEY_WEIGHTS[k]);
    const key = weightedRandom(keys, weights);

    const mode = this.preferredMode;

    // Generate chord sequence using Markov chain
    const numerals: RomanNumeral[] = [];
    let currentNumeral: RomanNumeral = 'I';
    numerals.push(currentNumeral);

    for (let i = 1; i < length; i++) {
      currentNumeral = this.getNextChord(currentNumeral);
      numerals.push(currentNumeral);
    }

    // Convert numerals to Chords with possible extensions
    const chords: Chord[] = numerals.map(numeral => {
      const chord = romanToChord(numeral, key, mode);

      // 30% chance to extend to 9th chord
      if (randomFloat(0, 1) < 0.3) {
        if (chord.quality === 'maj7') {
          chord.quality = 'maj9';
        } else if (chord.quality === 'min7') {
          chord.quality = 'min9';
        }
      }

      return chord;
    });

    return {
      chords,
      key,
      mode,
      barsPerChord: 1
    };
  }

  /**
   * Set mood and update transition matrix
   */
  setMood(mood: MoodPreset): void {
    const config = MOOD_CONFIGS[mood];
    this.transitionMatrix = config.transitionWeights;
    this.preferredMode = config.preferredMode;
  }

  /**
   * Get next chord based on current chord using Markov chain
   */
  private getNextChord(current: RomanNumeral): RomanNumeral {
    const transitions = this.transitionMatrix[current];
    const numerals = Object.keys(transitions) as RomanNumeral[];
    const weights = numerals.map(n => transitions[n]);

    return weightedRandom(numerals, weights);
  }
}
