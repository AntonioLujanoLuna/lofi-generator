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

    // Create parallel delay lines (simpler, more stable than FDN)
    for (let i = 0; i < 4; i++) {
      const delay = ctx.createDelay(1);
      delay.delayTime.value = this.delayTimes[i];

      // Each delay has its own feedback loop (not cross-fed)
      const feedback = ctx.createGain();
      feedback.gain.value = 0.5; // Safe feedback amount

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 3000 - i * 400; // Progressively darker

      this.delays.push(delay);
      this.feedbacks.push(feedback);
      this.filters.push(filter);

      // Connect: input → delay → filter → feedback → delay (loop)
      //                              ↓
      //                          wetGain (output)
      this.inputGain.connect(delay);
      delay.connect(filter);
      filter.connect(feedback);
      feedback.connect(delay); // Self-feedback only
      filter.connect(this.wetGain);
    }

    // Connect dry path
    this.inputGain.connect(this.dryGain);
    this.dryGain.connect(this.outputGain);
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
    // Longer decay = higher feedback, but cap at 0.7 for stability
    const feedback = Math.min(0.7, seconds / 5);
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
