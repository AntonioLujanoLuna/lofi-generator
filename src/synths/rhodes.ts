import { getContext } from '../audio-engine';
import { noteToFrequency } from '../music-theory';

export const RHODES_ENVELOPE = {
  attack: 0.005,
  decay: 0.3,
  sustain: 0.3,
  release: 0.8
};

export class RhodesSynth {
  private outputGain: GainNode;
  private tremoloLfo: OscillatorNode;
  private tremoloGain: GainNode;
  private envelope = RHODES_ENVELOPE;

  // FM synthesis parameters
  private modulatorRatio = 14; // Ratio for tine-like sound
  private baseModIndex = 2.5; // Base modulation index

  constructor() {
    const ctx = getContext();

    // Output gain with tremolo modulation
    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 1;

    // Tremolo LFO (5-7 Hz typical for Rhodes)
    this.tremoloLfo = ctx.createOscillator();
    this.tremoloLfo.type = 'sine';
    this.tremoloLfo.frequency.value = 5.5;

    this.tremoloGain = ctx.createGain();
    this.tremoloGain.gain.value = 0.15; // Tremolo depth

    this.tremoloLfo.connect(this.tremoloGain);
    this.tremoloGain.connect(this.outputGain.gain);
    this.tremoloLfo.start();
  }

  /**
   * Trigger a single note with FM synthesis
   */
  triggerNote(pitch: number, startTime: number, duration: number, velocity: number): void {
    const ctx = getContext();
    const frequency = noteToFrequency(pitch);

    // Velocity affects brightness and level
    const velocityBrightness = 0.5 + velocity * 0.5;
    const velocityLevel = 0.3 + velocity * 0.4;

    // Create carrier oscillator (sine)
    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.value = frequency;

    // Create modulator oscillator (sine)
    const modulator = ctx.createOscillator();
    modulator.type = 'sine';
    modulator.frequency.value = frequency * this.modulatorRatio;

    // Modulator gain (controls FM amount)
    const modGain = ctx.createGain();
    const peakModIndex = this.baseModIndex * velocityBrightness;
    const sustainModIndex = peakModIndex * 0.2;

    // Modulation index envelope: high attack decaying to fundamental
    modGain.gain.setValueAtTime(0, startTime);
    modGain.gain.linearRampToValueAtTime(
      frequency * peakModIndex,
      startTime + this.envelope.attack
    );
    modGain.gain.exponentialRampToValueAtTime(
      Math.max(frequency * sustainModIndex, 1),
      startTime + this.envelope.attack + this.envelope.decay
    );

    // Connect modulator to carrier frequency
    modulator.connect(modGain);
    modGain.connect(carrier.frequency);

    // Carrier output gain envelope
    const carrierGain = ctx.createGain();
    const { attack, decay, sustain, release } = this.envelope;
    const peakLevel = velocityLevel;
    const sustainLevel = velocityLevel * sustain;

    // ADSR envelope
    carrierGain.gain.setValueAtTime(0, startTime);
    carrierGain.gain.linearRampToValueAtTime(peakLevel, startTime + attack);
    carrierGain.gain.exponentialRampToValueAtTime(
      Math.max(sustainLevel, 0.001),
      startTime + attack + decay
    );

    // Sustain until release
    const releaseTime = startTime + duration;
    carrierGain.gain.setValueAtTime(sustainLevel, releaseTime);
    carrierGain.gain.exponentialRampToValueAtTime(0.001, releaseTime + release);

    // Connect carrier to output
    carrier.connect(carrierGain);
    carrierGain.connect(this.outputGain);

    // Start and stop oscillators
    carrier.start(startTime);
    modulator.start(startTime);
    carrier.stop(releaseTime + release + 0.1);
    modulator.stop(releaseTime + release + 0.1);
  }

  /**
   * Set tremolo rate (Hz)
   */
  setTremoloRate(hz: number): void {
    const ctx = getContext();
    this.tremoloLfo.frequency.setTargetAtTime(hz, ctx.currentTime, 0.1);
  }

  /**
   * Set tremolo depth (0-1)
   */
  setTremoloDepth(depth: number): void {
    const ctx = getContext();
    this.tremoloGain.gain.setTargetAtTime(
      Math.max(0, Math.min(1, depth)) * 0.3,
      ctx.currentTime,
      0.1
    );
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
}
