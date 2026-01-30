import type { Chord, BassNote } from '../types';
import { getFifth, transposeToOctave } from '../music-theory';
import { randomFloat, gaussian } from '../utils';

export class BasslineGenerator {
  private baseOctave = 2; // MIDI octave for bass (C2 = 36)

  /**
   * Generate a bass pattern for one bar
   */
  generateBar(chord: Chord, nextChord: Chord | null, _barNumber: number): BassNote[] {
    const notes: BassNote[] = [];

    // Get root note in bass octave
    const root = transposeToOctave(chord.root, this.baseOctave);
    const fifth = transposeToOctave(getFifth(chord.root), this.baseOctave);
    const rootOctaveUp = root + 12;

    // Beat 1: Always play root (high velocity)
    notes.push({
      pitch: root,
      startBeat: 0 + this.humanizeTiming(),
      durationBeats: this.getNoteDuration(1),
      velocity: this.humanizeVelocity(randomFloat(0.8, 1.0))
    });

    // Beat 3: 60% fifth, 20% root octave up, 20% rest
    const beat3Roll = randomFloat(0, 1);
    if (beat3Roll < 0.6) {
      notes.push({
        pitch: fifth,
        startBeat: 2 + this.humanizeTiming(),
        durationBeats: this.getNoteDuration(2),
        velocity: this.humanizeVelocity(randomFloat(0.5, 0.7))
      });
    } else if (beat3Roll < 0.8) {
      notes.push({
        pitch: rootOctaveUp,
        startBeat: 2 + this.humanizeTiming(),
        durationBeats: this.getNoteDuration(2),
        velocity: this.humanizeVelocity(randomFloat(0.5, 0.7))
      });
    }
    // else: rest

    // Beat 4: 40% chromatic approach to next root (if chord changes)
    if (nextChord && nextChord.root !== chord.root && randomFloat(0, 1) < 0.4) {
      const nextRoot = transposeToOctave(nextChord.root, this.baseOctave);
      // Chromatic approach from below or above
      const approachNote = nextRoot > root ? nextRoot - 1 : nextRoot + 1;

      notes.push({
        pitch: approachNote,
        startBeat: 3 + this.humanizeTiming(),
        durationBeats: 0.9,
        velocity: this.humanizeVelocity(randomFloat(0.4, 0.6))
      });
    }

    return notes;
  }

  /**
   * Calculate note duration based on when next note might occur
   */
  private getNoteDuration(startBeat: number): number {
    // Legato - sustain until likely next note
    if (startBeat === 0) {
      return 1.9; // Hold until beat 2
    }
    return 0.9;
  }

  /**
   * Add slight timing humanization (±8ms converted to beats)
   * Assuming ~75 BPM, one beat = 800ms, so ±8ms ≈ ±0.01 beats
   */
  private humanizeTiming(): number {
    return gaussian(0, 0.01);
  }

  /**
   * Add velocity humanization (±5%)
   */
  private humanizeVelocity(velocity: number): number {
    const variation = gaussian(0, 0.05);
    return Math.max(0.1, Math.min(1.0, velocity + variation));
  }
}
