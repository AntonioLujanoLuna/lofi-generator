import type { DrumSample } from './types';
import { getContext, getBuses } from './audio-engine';

const sampleBuffers = new Map<DrumSample, AudioBuffer>();

const SAMPLE_PATHS: Record<DrumSample, string> = {
  'kick': './samples/kick.wav',
  'snare': './samples/snare.wav',
  'hat-closed': './samples/hat-closed.wav',
  'hat-open': './samples/hat-open.wav'
};

/**
 * Load all drum samples
 */
export async function loadSamples(): Promise<void> {
  const ctx = getContext();

  const loadPromises = Object.entries(SAMPLE_PATHS).map(async ([name, path]) => {
    try {
      const response = await fetch(path);
      if (!response.ok) {
        console.warn(`Failed to load sample ${name}: ${response.statusText}`);
        return;
      }
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      sampleBuffers.set(name as DrumSample, audioBuffer);
    } catch (error) {
      console.warn(`Error loading sample ${name}:`, error);
    }
  });

  await Promise.all(loadPromises);
}

/**
 * Check if all samples are loaded
 */
export function areSamplesLoaded(): boolean {
  return sampleBuffers.size === Object.keys(SAMPLE_PATHS).length;
}

/**
 * Play a drum sample
 */
export function playDrumSample(sample: DrumSample, startTime: number, velocity: number): void {
  const buffer = sampleBuffers.get(sample);
  if (!buffer) return;

  const ctx = getContext();
  const buses = getBuses();

  // Create buffer source
  const source = ctx.createBufferSource();
  source.buffer = buffer;

  // Create gain node for velocity
  const gainNode = ctx.createGain();
  gainNode.gain.value = velocity;

  // Connect
  source.connect(gainNode);
  gainNode.connect(buses.drums);

  // Schedule playback
  source.start(startTime);
}

/**
 * Get the buffer for a sample (used for sidechain detection)
 */
export function getSampleBuffer(sample: DrumSample): AudioBuffer | undefined {
  return sampleBuffers.get(sample);
}

/**
 * Class-based drum sampler for more control
 */
export class DrumSampler {
  private outputGain: GainNode;

  constructor() {
    const ctx = getContext();
    this.outputGain = ctx.createGain();
    this.outputGain.gain.value = 1;
  }

  play(sample: DrumSample, startTime: number, velocity: number): void {
    const buffer = sampleBuffers.get(sample);
    if (!buffer) return;

    const ctx = getContext();

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gainNode = ctx.createGain();
    gainNode.gain.value = velocity;

    source.connect(gainNode);
    gainNode.connect(this.outputGain);

    source.start(startTime);
  }

  connect(destination: AudioNode): void {
    this.outputGain.connect(destination);
  }

  disconnect(): void {
    this.outputGain.disconnect();
  }

  setLevel(gain: number): void {
    const ctx = getContext();
    this.outputGain.gain.setTargetAtTime(gain, ctx.currentTime, 0.02);
  }
}
