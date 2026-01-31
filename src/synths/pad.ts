import { getContext } from '../audio-engine';
import { noteToFrequency } from '../music-theory';
import { PAD_ENVELOPE } from '../config';

export class PadSynth {
  private outputGain: GainNode;
  private filter: BiquadFilterNode;
  private lfo: OscillatorNode;
  private lfoGain: GainNode;
  private envelope = PAD_ENVELOPE;
  private detuneAmounts = [-7, 0, 7]; // Cents
  private stereoWidth = 0.7; // 0-1, how spread the oscillators are L/R
  private stereoPans = [-1, 0, 1]; // L, C, R panning for detuned oscs

  constructor() {
    const ctx = getContext();

    // Create filter with LFO modulation
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 2000;
    this.filter.Q.value = 2;

    // LFO for filter modulation
    this.lfo = ctx.createOscillator();
    this.lfo.type = 'sine';
    this.lfo.frequency.value = 0.3;

    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = 200; // LFO depth in Hz

    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.filter.frequency);
    this.lfo.start();

    // Output gain
    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 1;

    this.filter.connect(this.outputGain);
  }

  /**
   * Trigger a chord (multiple notes)
   */
  triggerChord(pitches: number[], startTime: number, duration: number, velocity: number): void {
    const ctx = getContext();

    // Create a gain node for this chord's envelope
    const chordGain = ctx.createGain();
    chordGain.gain.value = 0;
    chordGain.connect(this.filter);

    // Create oscillators for each pitch with detuning and stereo spread
    const oscillators: OscillatorNode[] = [];

    for (const pitch of pitches) {
      const frequency = noteToFrequency(pitch);

      for (let i = 0; i < this.detuneAmounts.length; i++) {
        const detune = this.detuneAmounts[i];
        const pan = this.stereoPans[i] * this.stereoWidth;

        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = frequency;
        osc.detune.value = detune;

        // Individual oscillator gain for mixing
        const oscGain = ctx.createGain();
        oscGain.gain.value = 0.15 / pitches.length; // Normalize by number of notes

        // Stereo panner for width
        const panner = ctx.createStereoPanner();
        panner.pan.value = pan;

        osc.connect(oscGain);
        oscGain.connect(panner);
        panner.connect(chordGain);
        oscillators.push(osc);
      }
    }

    // Apply ADSR envelope
    const { attack, decay, sustain, release } = this.envelope;
    const peakLevel = velocity * 0.7;
    const sustainLevel = velocity * sustain * 0.7;

    // Attack
    chordGain.gain.setValueAtTime(0, startTime);
    chordGain.gain.linearRampToValueAtTime(peakLevel, startTime + attack);

    // Decay to sustain
    chordGain.gain.linearRampToValueAtTime(sustainLevel, startTime + attack + decay);

    // Sustain
    const releaseTime = startTime + duration;
    chordGain.gain.setValueAtTime(sustainLevel, releaseTime);

    // Release
    chordGain.gain.linearRampToValueAtTime(0, releaseTime + release);

    // Start and stop all oscillators
    for (const osc of oscillators) {
      osc.start(startTime);
      osc.stop(releaseTime + release + 0.1);
    }
  }

  /**
   * Set filter cutoff frequency
   */
  setFilterCutoff(hz: number): void {
    const ctx = getContext();
    this.filter.frequency.setTargetAtTime(hz, ctx.currentTime, 0.1);
  }

  /**
   * Set filter LFO depth
   */
  setFilterLFODepth(hz: number): void {
    const ctx = getContext();
    this.lfoGain.gain.setTargetAtTime(hz, ctx.currentTime, 0.1);
  }

  /**
   * Set filter resonance (Q)
   */
  setFilterResonance(q: number): void {
    const ctx = getContext();
    this.filter.Q.setTargetAtTime(q, ctx.currentTime, 0.1);
  }

  /**
   * Set output level
   */
  setLevel(gain: number): void {
    const ctx = getContext();
    this.outputGain.gain.setTargetAtTime(gain, ctx.currentTime, 0.02);
  }

  /**
   * Connect to destination
   */
  connect(destination: AudioNode): void {
    this.outputGain.connect(destination);
  }

  /**
   * Disconnect from all
   */
  disconnect(): void {
    this.outputGain.disconnect();
  }

  /**
   * Set LFO rate
   */
  setLFORate(hz: number): void {
    const ctx = getContext();
    this.lfo.frequency.setTargetAtTime(hz, ctx.currentTime, 0.1);
  }

  /**
   * Set stereo width (0 = mono, 1 = full stereo spread)
   */
  setStereoWidth(width: number): void {
    this.stereoWidth = Math.max(0, Math.min(1, width));
  }

  /**
   * Get current stereo width
   */
  getStereoWidth(): number {
    return this.stereoWidth;
  }
}
