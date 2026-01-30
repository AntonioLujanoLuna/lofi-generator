import { getContext } from '../audio-engine';

export class Saturator {
  private waveshaper: WaveShaperNode;
  private inputGain: GainNode;
  private outputGain: GainNode;

  constructor() {
    const ctx = getContext();

    this.inputGain = ctx.createGain();
    this.inputGain.gain.value = 1;

    this.waveshaper = ctx.createWaveShaper();
    this.waveshaper.curve = this.createSoftClipCurve(0.3);
    this.waveshaper.oversample = '2x';

    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 0.9; // Compensate for added harmonics

    this.inputGain.connect(this.waveshaper);
    this.waveshaper.connect(this.outputGain);
  }

  /**
   * Set drive amount (0-1)
   */
  setDrive(amount: number): void {
    this.waveshaper.curve = this.createSoftClipCurve(amount);
  }

  /**
   * Create a soft clipping curve for tape-like saturation
   */
  private createSoftClipCurve(amount: number): WaveShaperNode['curve'] {
    const samples = 44100;
    const buffer = new ArrayBuffer(samples * 4);
    const curve = new Float32Array(buffer);
    const k = amount * 50 + 1; // Drive factor

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      // Soft clipping using tanh-like curve
      curve[i] = (Math.PI + k) * x / (Math.PI + k * Math.abs(x));
    }

    return curve;
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
