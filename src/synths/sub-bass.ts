import { getContext } from '../audio-engine';
import { noteToFrequency } from '../music-theory';
import { BASS_ENVELOPE } from '../config';

export class SubBassSynth {
  private outputGain: GainNode;
  private filter: BiquadFilterNode;
  private envelope = BASS_ENVELOPE;

  constructor() {
    const ctx = getContext();

    // Create output chain
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 800;
    this.filter.Q.value = 1;

    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 1;

    this.filter.connect(this.outputGain);
  }

  /**
   * Trigger a bass note
   */
  triggerNote(pitch: number, startTime: number, duration: number, velocity: number): void {
    const ctx = getContext();
    const frequency = noteToFrequency(pitch);

    // Create oscillator
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = frequency;

    // Add a subtle second harmonic for warmth
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = frequency * 2;

    // Create envelope gain
    const envGain = ctx.createGain();
    envGain.gain.value = 0;

    // Mix oscillators
    const oscGain = ctx.createGain();
    oscGain.gain.value = 0.85;

    const osc2Gain = ctx.createGain();
    osc2Gain.gain.value = 0.15;

    // Connect oscillators
    osc.connect(oscGain);
    osc2.connect(osc2Gain);
    oscGain.connect(envGain);
    osc2Gain.connect(envGain);
    envGain.connect(this.filter);

    // Apply envelope
    const { attack, decay, sustain, release } = this.envelope;
    const peakLevel = velocity;
    const sustainLevel = velocity * sustain;

    // Attack
    envGain.gain.setValueAtTime(0, startTime);
    envGain.gain.linearRampToValueAtTime(peakLevel, startTime + attack);

    // Decay to sustain
    envGain.gain.linearRampToValueAtTime(sustainLevel, startTime + attack + decay);

    // Sustain until release
    const releaseTime = startTime + duration;
    envGain.gain.setValueAtTime(sustainLevel, releaseTime);

    // Release
    envGain.gain.linearRampToValueAtTime(0, releaseTime + release);

    // Start and stop oscillators
    osc.start(startTime);
    osc2.start(startTime);
    osc.stop(releaseTime + release + 0.1);
    osc2.stop(releaseTime + release + 0.1);
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
   * Set filter cutoff
   */
  setFilterCutoff(hz: number): void {
    const ctx = getContext();
    this.filter.frequency.setTargetAtTime(hz, ctx.currentTime, 0.02);
  }
}
