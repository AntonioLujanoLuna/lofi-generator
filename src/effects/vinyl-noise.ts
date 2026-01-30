import { getContext } from '../audio-engine';
import { randomFloat } from '../utils';

export class VinylNoise {
  private outputGain: GainNode;
  private noiseGain: GainNode;
  private crackleGain: GainNode;
  private noiseSource: AudioBufferSourceNode | null = null;
  private crackleInterval: number | null = null;
  private isRunning = false;

  // Filters for shaping noise
  private highpass: BiquadFilterNode;
  private lowpass: BiquadFilterNode;
  private bandpass: BiquadFilterNode;

  // Wow/flutter
  private wowLfo: OscillatorNode | null = null;
  private wowDelay: DelayNode;
  private wowDepth: GainNode;

  constructor() {
    const ctx = getContext();

    // Create output gain
    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 0.03;

    // Noise path
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 1;

    // Crackle path
    this.crackleGain = ctx.createGain();
    this.crackleGain.gain.value = 0.5;

    // Noise shaping filters
    this.highpass = ctx.createBiquadFilter();
    this.highpass.type = 'highpass';
    this.highpass.frequency.value = 200;

    this.lowpass = ctx.createBiquadFilter();
    this.lowpass.type = 'lowpass';
    this.lowpass.frequency.value = 5000;

    this.bandpass = ctx.createBiquadFilter();
    this.bandpass.type = 'bandpass';
    this.bandpass.frequency.value = 4000;
    this.bandpass.Q.value = 1;

    // Wow/flutter delay
    this.wowDelay = ctx.createDelay(0.05);
    this.wowDelay.delayTime.value = 0.003;

    this.wowDepth = ctx.createGain();
    this.wowDepth.gain.value = 0.002;

    // Connect noise path
    this.noiseGain.connect(this.highpass);
    this.highpass.connect(this.lowpass);
    this.lowpass.connect(this.wowDelay);
    this.wowDelay.connect(this.outputGain);

    // Connect crackle path
    this.crackleGain.connect(this.bandpass);
    this.bandpass.connect(this.outputGain);

    // Wow LFO modulates delay time
    this.wowDepth.connect(this.wowDelay.delayTime);
  }

  /**
   * Start generating noise
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const ctx = getContext();

    // Create noise buffer
    const bufferSize = ctx.sampleRate * 2; // 2 seconds
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Fill with white noise
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    // Create noise source (looping)
    this.noiseSource = ctx.createBufferSource();
    this.noiseSource.buffer = buffer;
    this.noiseSource.loop = true;
    this.noiseSource.connect(this.noiseGain);
    this.noiseSource.start();

    // Start wow/flutter LFO
    this.wowLfo = ctx.createOscillator();
    this.wowLfo.type = 'sine';
    this.wowLfo.frequency.value = randomFloat(0.3, 0.8);
    this.wowLfo.connect(this.wowDepth);
    this.wowLfo.start();

    // Start crackle generator
    this.scheduleCrackle();
  }

  /**
   * Stop generating noise
   */
  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.noiseSource) {
      this.noiseSource.stop();
      this.noiseSource.disconnect();
      this.noiseSource = null;
    }

    if (this.wowLfo) {
      this.wowLfo.stop();
      this.wowLfo.disconnect();
      this.wowLfo = null;
    }

    if (this.crackleInterval !== null) {
      clearTimeout(this.crackleInterval);
      this.crackleInterval = null;
    }
  }

  /**
   * Schedule random crackle sounds
   */
  private scheduleCrackle(): void {
    if (!this.isRunning) return;

    // Play a crackle
    this.playCrackle();

    // Schedule next crackle (50-400ms interval)
    const nextInterval = randomFloat(50, 400);
    this.crackleInterval = window.setTimeout(() => {
      this.scheduleCrackle();
    }, nextInterval);
  }

  /**
   * Play a single crackle sound
   */
  private playCrackle(): void {
    const ctx = getContext();

    // Create short noise burst
    const duration = randomFloat(0.01, 0.04); // 10-40ms
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Fill with noise, with quick amplitude envelope
    for (let i = 0; i < bufferSize; i++) {
      const env = 1 - (i / bufferSize); // Decay envelope
      data[i] = (Math.random() * 2 - 1) * env;
    }

    // Create source
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Create gain for velocity
    const gain = ctx.createGain();
    gain.gain.value = randomFloat(0.02, 0.08);

    // High-pass filter for crackle character
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2000;

    source.connect(hp);
    hp.connect(gain);
    gain.connect(this.crackleGain);

    source.start();
  }

  /**
   * Set overall level
   */
  setLevel(gain: number): void {
    const ctx = getContext();
    this.outputGain.gain.setTargetAtTime(gain, ctx.currentTime, 0.05);
  }

  /**
   * Set crackle intensity (0-1)
   */
  setCrackleIntensity(intensity: number): void {
    const ctx = getContext();
    this.crackleGain.gain.setTargetAtTime(intensity, ctx.currentTime, 0.05);
  }

  /**
   * Connect to destination
   */
  connect(destination: AudioNode): void {
    this.outputGain.connect(destination);
  }

  /**
   * Disconnect
   */
  disconnect(): void {
    this.outputGain.disconnect();
  }
}
