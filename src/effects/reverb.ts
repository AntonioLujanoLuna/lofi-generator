import { getContext } from '../audio-engine';

export class SimpleReverb {
  private inputGain: GainNode;
  private wetGain: GainNode;
  private dryGain: GainNode;
  private outputGain: GainNode;
  private delays: DelayNode[] = [];
  private feedbacks: GainNode[] = [];
  private filters: BiquadFilterNode[] = [];

  // Delay times in seconds (prime-ish numbers for dense reverb)
  private delayTimes = [0.029, 0.037, 0.043, 0.053];
  private feedbackAmount = 0.7;

  constructor() {
    const ctx = getContext();

    // Create routing nodes
    this.inputGain = ctx.createGain();
    this.inputGain.gain.value = 1;

    this.wetGain = ctx.createGain();
    this.wetGain.gain.value = 0.3;

    this.dryGain = ctx.createGain();
    this.dryGain.gain.value = 0.7;

    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 1;

    // Create feedback delay network
    for (let i = 0; i < 4; i++) {
      const delay = ctx.createDelay(1);
      delay.delayTime.value = this.delayTimes[i];

      const feedback = ctx.createGain();
      feedback.gain.value = this.feedbackAmount;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 4000 - i * 500; // Varied filtering

      this.delays.push(delay);
      this.feedbacks.push(feedback);
      this.filters.push(filter);
    }

    // Connect the feedback delay network
    this.connectFDN();

    // Connect dry path
    this.inputGain.connect(this.dryGain);
    this.dryGain.connect(this.outputGain);
  }

  /**
   * Connect the feedback delay network
   */
  private connectFDN(): void {
    // Connect input to all delays
    for (let i = 0; i < 4; i++) {
      this.inputGain.connect(this.delays[i]);
      this.delays[i].connect(this.filters[i]);
      this.filters[i].connect(this.feedbacks[i]);
      this.filters[i].connect(this.wetGain);

      // Cross-feed to other delays for density
      for (let j = 0; j < 4; j++) {
        if (i !== j) {
          const crossGain = this.feedbacks[i];
          crossGain.connect(this.delays[j]);
        }
      }
    }

    this.wetGain.connect(this.outputGain);
  }

  /**
   * Set wet/dry mix (0-1)
   */
  setWetDry(wet: number): void {
    const ctx = getContext();
    this.wetGain.gain.setTargetAtTime(wet, ctx.currentTime, 0.05);
    this.dryGain.gain.setTargetAtTime(1 - wet, ctx.currentTime, 0.05);
  }

  /**
   * Set decay time by adjusting feedback
   */
  setDecay(seconds: number): void {
    // Longer decay = higher feedback
    const feedback = Math.min(0.95, seconds / 5);
    const ctx = getContext();

    for (const fb of this.feedbacks) {
      fb.gain.setTargetAtTime(feedback, ctx.currentTime, 0.05);
    }
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
