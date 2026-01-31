import { getContext } from '../audio-engine';

export const TAPE_DEFAULTS = {
  wowDepth: 5,       // cents of pitch variation
  wowRate: 0.4,      // Hz
  flutterDepth: 2,   // cents
  flutterRate: 5.5,  // Hz
  saturation: 0.3,   // 0-1
  highpassFreq: 60   // Hz, base highpass frequency
};

export class TapeDegradation {
  private inputGain: GainNode;
  private outputGain: GainNode;

  // Wow (slow pitch modulation)
  private wowOsc: OscillatorNode;
  private wowGain: GainNode;
  private wowDelay: DelayNode;

  // Flutter (faster pitch modulation)
  private flutterOsc: OscillatorNode;
  private flutterGain: GainNode;

  // Saturation
  private waveshaper: WaveShaperNode;

  // Dynamic highpass
  private highpass: BiquadFilterNode;
  private highpassEnvFollower: GainNode;

  constructor() {
    const ctx = getContext();

    // Input/output
    this.inputGain = ctx.createGain();
    this.inputGain.gain.value = 1;
    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 1;

    // Create delay node for pitch modulation via delay time
    this.wowDelay = ctx.createDelay(0.1);
    this.wowDelay.delayTime.value = 0.01; // 10ms base delay

    // Wow LFO (0.3-0.5 Hz, ~5 cents)
    this.wowOsc = ctx.createOscillator();
    this.wowOsc.type = 'sine';
    this.wowOsc.frequency.value = TAPE_DEFAULTS.wowRate;

    this.wowGain = ctx.createGain();
    // Convert cents to delay time modulation
    // 5 cents = 0.29% pitch change, which needs ~0.3ms delay modulation at 10ms base
    this.wowGain.gain.value = 0.0003 * TAPE_DEFAULTS.wowDepth;

    this.wowOsc.connect(this.wowGain);
    this.wowGain.connect(this.wowDelay.delayTime);

    // Flutter LFO (4-7 Hz, ~2 cents)
    this.flutterOsc = ctx.createOscillator();
    this.flutterOsc.type = 'sine';
    this.flutterOsc.frequency.value = TAPE_DEFAULTS.flutterRate;

    this.flutterGain = ctx.createGain();
    this.flutterGain.gain.value = 0.0003 * TAPE_DEFAULTS.flutterDepth;

    this.flutterOsc.connect(this.flutterGain);
    this.flutterGain.connect(this.wowDelay.delayTime);

    // Asymmetric saturation waveshaper
    this.waveshaper = ctx.createWaveShaper();
    this.waveshaper.curve = this.makeAsymmetricCurve(TAPE_DEFAULTS.saturation) as Float32Array<ArrayBuffer> | null;
    this.waveshaper.oversample = '2x';

    // Dynamic highpass (cutoff increases with level)
    this.highpass = ctx.createBiquadFilter();
    this.highpass.type = 'highpass';
    this.highpass.frequency.value = TAPE_DEFAULTS.highpassFreq;
    this.highpass.Q.value = 0.7;

    // Simple envelope follower for dynamic highpass
    this.highpassEnvFollower = ctx.createGain();
    this.highpassEnvFollower.gain.value = 30; // Modulation amount

    // Connect signal chain: input → delay (wow/flutter) → highpass → waveshaper → output
    this.inputGain.connect(this.wowDelay);
    this.wowDelay.connect(this.highpass);
    this.highpass.connect(this.waveshaper);
    this.waveshaper.connect(this.outputGain);

    // Start LFOs
    this.wowOsc.start();
    this.flutterOsc.start();
  }

  /**
   * Create asymmetric saturation curve (positive peaks saturate earlier)
   */
  private makeAsymmetricCurve(amount: number): Float32Array {
    const samples = 44100;
    const buffer = new ArrayBuffer(samples * 4);
    const curve = new Float32Array(buffer);
    const asymmetry = 0.3; // How much more positive peaks saturate

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1; // -1 to 1

      if (x >= 0) {
        // Positive half: more aggressive saturation
        const k = amount * (1 + asymmetry);
        curve[i] = Math.tanh(x * (1 + k * 2)) / Math.tanh(1 + k * 2);
      } else {
        // Negative half: gentler saturation
        const k = amount * (1 - asymmetry * 0.5);
        curve[i] = Math.tanh(x * (1 + k * 2)) / Math.tanh(1 + k * 2);
      }
    }

    return curve;
  }

  /**
   * Set wow depth (cents)
   */
  setWowDepth(cents: number): void {
    const ctx = getContext();
    this.wowGain.gain.setTargetAtTime(0.0003 * cents, ctx.currentTime, 0.1);
  }

  /**
   * Set wow rate (Hz)
   */
  setWowRate(hz: number): void {
    const ctx = getContext();
    this.wowOsc.frequency.setTargetAtTime(hz, ctx.currentTime, 0.1);
  }

  /**
   * Set flutter depth (cents)
   */
  setFlutterDepth(cents: number): void {
    const ctx = getContext();
    this.flutterGain.gain.setTargetAtTime(0.0003 * cents, ctx.currentTime, 0.1);
  }

  /**
   * Set flutter rate (Hz)
   */
  setFlutterRate(hz: number): void {
    const ctx = getContext();
    this.flutterOsc.frequency.setTargetAtTime(hz, ctx.currentTime, 0.1);
  }

  /**
   * Set saturation amount (0-1)
   */
  setSaturation(amount: number): void {
    this.waveshaper.curve = this.makeAsymmetricCurve(Math.max(0, Math.min(1, amount))) as Float32Array<ArrayBuffer> | null;
  }

  /**
   * Set highpass frequency
   */
  setHighpassFreq(hz: number): void {
    const ctx = getContext();
    this.highpass.frequency.setTargetAtTime(hz, ctx.currentTime, 0.1);
  }

  /**
   * Set overall wet/dry mix via output gain
   */
  setMix(mix: number): void {
    const ctx = getContext();
    this.outputGain.gain.setTargetAtTime(mix, ctx.currentTime, 0.02);
  }

  /**
   * Get input node for connection
   */
  getInputNode(): AudioNode {
    return this.inputGain;
  }

  /**
   * Get output node for connection
   */
  getOutputNode(): AudioNode {
    return this.outputGain;
  }
}
