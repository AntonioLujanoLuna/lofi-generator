import { getContext } from '../audio-engine';
import { DEFAULT_FILTER_CUTOFF } from '../config';

export class LowpassFilter {
  private filter: BiquadFilterNode;

  constructor() {
    const ctx = getContext();
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = DEFAULT_FILTER_CUTOFF;
    this.filter.Q.value = 0.7;
  }

  /**
   * Set filter cutoff frequency
   */
  setCutoff(hz: number): void {
    const ctx = getContext();
    this.filter.frequency.setTargetAtTime(hz, ctx.currentTime, 0.05);
  }

  /**
   * Get current cutoff frequency
   */
  getCutoff(): number {
    return this.filter.frequency.value;
  }

  /**
   * Set filter resonance (Q)
   */
  setResonance(q: number): void {
    const ctx = getContext();
    this.filter.Q.setTargetAtTime(q, ctx.currentTime, 0.05);
  }

  /**
   * Get input node for connecting
   */
  getInputNode(): AudioNode {
    return this.filter;
  }

  /**
   * Get output node for connecting
   */
  getOutputNode(): AudioNode {
    return this.filter;
  }
}
