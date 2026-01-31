import type { MelodyNote, Chord, ScaleMode } from '../types';
import { isChordTone, isScaleTone, chordToMidiNotes, transposeToOctave, SCALE_PATTERNS } from '../music-theory';
import { randomFloat, randomInt } from '../utils';
import { STEPS_PER_BAR } from '../config';

export class MelodyGenerator {
  private key = 0;
  private mode: ScaleMode = 'major';
  private octave = 5; // Melody octave
  private lastPitch: number | null = null;
  private motif: MelodyNote[] = [];
  private motifBarIndex = 0;
  private phraseBars = 4;

  /**
   * Set the key and mode for melody generation
   */
  setKeyAndMode(key: number, mode: ScaleMode): void {
    this.key = key;
    this.mode = mode;
  }

  /**
   * Generate a bar of melody for a given chord
   */
  generateBar(chord: Chord, barInPhrase: number): MelodyNote[] {
    // At the start of a phrase, generate a new motif
    if (barInPhrase % this.phraseBars === 0) {
      this.motif = this.generateMotif(chord);
      this.motifBarIndex = 0;
    }

    // Use the motif with variations
    const notes = this.applyMotifVariation(chord, barInPhrase);
    this.motifBarIndex++;

    return notes;
  }

  /**
   * Generate a 1-bar motif (building block for phrases)
   */
  private generateMotif(chord: Chord): MelodyNote[] {
    const notes: MelodyNote[] = [];
    let step = 0;

    // Decide density (2-5 notes per bar)
    const noteCount = randomInt(2, 5);
    const stepSpacing = Math.floor(STEPS_PER_BAR / noteCount);

    for (let i = 0; i < noteCount && step < STEPS_PER_BAR; i++) {
      const isStrongBeat = step % 4 === 0;
      const pitch = this.choosePitch(chord, isStrongBeat);

      if (pitch !== null) {
        // Duration: longer on strong beats
        const maxDuration = Math.min(stepSpacing + 2, STEPS_PER_BAR - step);
        const duration = isStrongBeat
          ? randomInt(2, Math.max(2, maxDuration))
          : randomInt(1, Math.max(1, maxDuration - 1));

        // Velocity: stronger on strong beats
        const velocity = isStrongBeat
          ? randomFloat(0.6, 0.8)
          : randomFloat(0.4, 0.65);

        notes.push({
          pitch,
          startStep: step,
          durationSteps: duration,
          velocity
        });

        this.lastPitch = pitch;
      }

      // Add some randomness to step spacing
      step += stepSpacing + randomInt(-1, 1);
      if (step < 0) step = 0;
    }

    // 30% chance to add a rest bar
    if (randomFloat(0, 1) < 0.3 && notes.length > 2) {
      notes.splice(randomInt(0, notes.length - 1), 1);
    }

    return notes;
  }

  /**
   * Apply variation to the motif for subsequent bars in phrase
   */
  private applyMotifVariation(chord: Chord, barInPhrase: number): MelodyNote[] {
    const barInMotif = barInPhrase % this.phraseBars;

    // Bar 0: original motif
    if (barInMotif === 0) {
      return this.motif.map(note => this.fitNoteToChord(note, chord));
    }

    // Bar 1: transpose motif
    if (barInMotif === 1) {
      const transpose = randomInt(-2, 2);
      return this.motif.map(note => {
        const newNote = this.fitNoteToChord({ ...note, pitch: note.pitch + transpose }, chord);
        return newNote;
      });
    }

    // Bar 2: rhythmic displacement (shift by 1-2 steps)
    if (barInMotif === 2) {
      const shift = randomInt(1, 2);
      return this.motif.map(note => {
        const newStep = (note.startStep + shift) % STEPS_PER_BAR;
        return this.fitNoteToChord({ ...note, startStep: newStep }, chord);
      }).filter(n => n.startStep + n.durationSteps <= STEPS_PER_BAR);
    }

    // Bar 3: new variation or rest
    if (randomFloat(0, 1) < 0.4) {
      // Rest bar for breathing
      return [];
    }

    // Generate new variation
    return this.generateMotif(chord);
  }

  /**
   * Fit a note to the current chord (adjust pitch if needed)
   */
  private fitNoteToChord(note: MelodyNote, chord: Chord): MelodyNote {
    const isStrongBeat = note.startStep % 4 === 0;

    // On strong beats, ensure we have a chord tone
    if (isStrongBeat && !isChordTone(note.pitch, chord)) {
      const chordNotes = chordToMidiNotes(transposeToOctave(chord.root, this.octave), chord.quality);
      // Find nearest chord tone
      let nearest = chordNotes[0];
      let minDist = Math.abs(note.pitch - nearest);
      for (const cn of chordNotes) {
        const dist = Math.abs(note.pitch - cn);
        if (dist < minDist) {
          minDist = dist;
          nearest = cn;
        }
      }
      return { ...note, pitch: nearest };
    }

    // On weak beats, allow scale tones
    if (!isScaleTone(note.pitch, this.key, this.mode)) {
      // Adjust to nearest scale tone
      const scale = SCALE_PATTERNS[this.mode];
      const pitchClass = note.pitch % 12;
      let nearest = (this.key + scale[0]) % 12;
      let minDist = Math.min(
        Math.abs(pitchClass - nearest),
        12 - Math.abs(pitchClass - nearest)
      );

      for (const interval of scale) {
        const scaleTone = (this.key + interval) % 12;
        const dist = Math.min(
          Math.abs(pitchClass - scaleTone),
          12 - Math.abs(pitchClass - scaleTone)
        );
        if (dist < minDist) {
          minDist = dist;
          nearest = scaleTone;
        }
      }

      const octave = Math.floor(note.pitch / 12);
      return { ...note, pitch: octave * 12 + nearest };
    }

    return note;
  }

  /**
   * Choose a pitch based on chord and beat strength
   */
  private choosePitch(chord: Chord, isStrongBeat: boolean): number | null {
    const chordNotes = chordToMidiNotes(transposeToOctave(chord.root, this.octave), chord.quality);
    const scale = SCALE_PATTERNS[this.mode].map(i => (this.key + i) % 12);

    let candidates: number[];

    if (isStrongBeat) {
      // Strong beats: chord tones only
      candidates = chordNotes;
    } else {
      // Weak beats: scale tones allowed
      const baseOctave = this.octave * 12 + 12; // MIDI note at octave start
      candidates = scale.map(pc => baseOctave + pc);
      // Add chord tones with higher probability (duplicate them)
      candidates = [...candidates, ...chordNotes, ...chordNotes];
    }

    // Apply contour rules: prefer stepwise motion
    if (this.lastPitch !== null) {
      // Filter candidates to prefer small intervals
      const close = candidates.filter(p => Math.abs(p - this.lastPitch!) <= 4);
      if (close.length > 0 && randomFloat(0, 1) < 0.7) {
        candidates = close;
      }

      // If last interval was a leap (> 4 semitones), resolve stepwise
      const lastInterval = this.lastPitch - (candidates[0] || this.lastPitch);
      if (Math.abs(lastInterval) > 4) {
        const stepwise = candidates.filter(p =>
          Math.abs(p - this.lastPitch!) <= 2
        );
        if (stepwise.length > 0) {
          candidates = stepwise;
        }
      }
    }

    if (candidates.length === 0) return null;

    return candidates[randomInt(0, candidates.length - 1)];
  }

  /**
   * Reset state for new progression
   */
  reset(): void {
    this.lastPitch = null;
    this.motif = [];
    this.motifBarIndex = 0;
  }
}
