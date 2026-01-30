import { getContext } from '../audio-engine';
import { dbToGain } from '../utils';

export class SidechainCompressor {
  private inputGain: GainNode;
  private outputGain: GainNode;
  private depth: number = -12; // dB
  private release: number = 0.15; // seconds

  constructor() {
    const ctx = getContext();

    this.inputGain = ctx.createGain();
    this.inputGain.gain.value = 1;

    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 1;

    this.inputGain.connect(this.outputGain);
  }

  /**
   * Trigger sidechain ducking at specified time
   */
  trigger(time: number): void {
    const gainNode = this.outputGain;

    // Calculate ducking gain from dB depth
    const duckGain = dbToGain(this.depth);

    // Quick attack (5ms)
    const attackTime = 0.005;

    // Cancel any scheduled changes
    gainNode.gain.cancelScheduledValues(time);

    // Duck down quickly
    gainNode.gain.setValueAtTime(1, time);
    gainNode.gain.linearRampToValueAtTime(duckGain, time + attackTime);

    // Release back to normal
    gainNode.gain.linearRampToValueAtTime(1, time + attackTime + this.release);
  }

  /**
   * Set sidechain depth in dB (negative values)
   */
  setDepth(db: number): void {
    this.depth = Math.min(0, Math.max(-24, db));
  }

  /**
   * Set release time in milliseconds
   */
  setRelease(ms: number): void {
    this.release = ms / 1000;
  }

  /**
   * Get input node for connecting
   */
  getInputNode(): AudioNode {
    return this.inputGain;
  }

  /**
   * Get output node for connecting
   */
  getOutputNode(): AudioNode {
    return this.outputGain;
  }
}
