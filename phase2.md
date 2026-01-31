## High-Impact Additions

**1. Melody/Lead Generator**
The most obvious missing layer. A simple approach:
- Constrain to chord tones on strong beats, scale tones on weak beats
- Use contour rules (not too many leaps, resolve large intervals stepwise)
- Implement motif repetition with variation (transpose, rhythmic displacement)

```typescript
// Sketch of the approach
interface MelodyNote {
  pitch: number;
  startStep: number;
  durationSteps: number;
  velocity: number;
}

class MelodyGenerator {
  private motifLength = 4; // bars
  private noteDensity = 0.3; // probability of note on each step
  
  generatePhrase(chord: Chord, scale: number[], length: number): MelodyNote[] {
    // Weight toward chord tones, especially on downbeats
    // Implement call-and-response patterns
    // Add rests for breathing room
  }
}
```

**2. Rhodes/EP Synth**
The pad is nice, but lofi begs for that Rhodes character—bell-like attack, subtle tremolo:

```typescript
class RhodesSynth {
  // Two-operator FM for the bell
  // Sine carrier + sine modulator (ratio ~1:14 for tine sound)
  // Tremolo LFO on amplitude
  // Velocity-sensitive brightness
}
```

**3. Tape Degradation Suite**
Your vinyl noise is good, but tape characteristics are different:
- **Wow/flutter**: You have this, but increase depth and add randomness to the LFO rate
- **Saturation with asymmetry**: Tape saturates differently on positive vs negative peaks
- **High-frequency rolloff that increases with level**: Use a dynamic lowpass
- **Subtle pitch drift**: Slow random modulation of playback rate

## Medium-Effort Improvements

**4. Drum Pattern Evolution**
Currently patterns are static per bar. Add:
- Gradual density increase toward phrase endings
- Hi-hat velocity accents that follow a longer cycle (8 or 16 bars)
- Occasional dropout bars for tension

**5. Chord Voicing Intelligence**
`chordToMidiNotes` currently stacks intervals from root. Better voicings:
- Drop 2 voicings (move second-from-top note down an octave)
- Voice leading between chords (minimize movement)
- Register-aware spacing (wider intervals in bass, tighter up top)

```typescript
function voiceLeadTo(prevVoicing: number[], nextChord: Chord): number[] {
  // Find voicing of nextChord that minimizes total semitone movement
  // from prevVoicing
}
```

**6. Song Structure**
Add macro-level form:
- 8-bar phrases with variation between A/B sections
- Instrument dropouts (bass out for 4 bars, drums solo, etc.)
- Filter sweeps and builds at phrase boundaries

## Polish & UX

**7. Preset System**
Save/load to localStorage:
```typescript
interface Preset {
  mood: MoodPreset;
  bpm: number;
  volumes: Record<string, number>;
  filterCutoff: number;
  reverbWet: number;
  // Optionally: seed for reproducible generation
}
```

**8. Better Visualization**
Your frequency bars are fine, but consider:
- Waveform scope showing the sidechain pumping
- Simple piano roll showing what's playing
- Chord diagram

**9. MIDI Clock Output**
For syncing external gear/DAWs via Web MIDI API.

## Technical Debt Worth Addressing

- **Reverb**: Your parallel-delay approach works but sounds metallic. Consider a proper Schroeder or Freeverb topology, or use convolution with a short IR.
- **Sample loading**: Add progress indication and error recovery
- **Audio worklets**: For the vinyl crackle and saturation, worklets would give you sample-accurate processing and better performance

## Quick Wins

1. Add keyboard shortcuts (space = play, R = record, N = new)
2. PWA manifest for installability
3. URL parameter sharing (`?mood=rainy&bpm=68`)
4. More drum variation—rim shots, shaker loops
5. Stereo width on the pad (subtle L/R detuning)

