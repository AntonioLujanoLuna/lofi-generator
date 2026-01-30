import type { AudioBuses } from './types';
import { DEFAULT_MASTER_VOLUME, DEFAULT_DRUMS_VOLUME, DEFAULT_BASS_VOLUME, DEFAULT_PAD_VOLUME, DEFAULT_AMBIENCE_VOLUME } from './config';

let audioContext: AudioContext | null = null;
let buses: AudioBuses | null = null;
let analyser: AnalyserNode | null = null;
let isRunning = false;

/**
 * Initialize the audio context and create the bus structure
 */
export function initAudioEngine(): void {
  if (audioContext) return;

  audioContext = new AudioContext();

  // Create analyzer
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.8;

  // Create bus structure
  const master = audioContext.createGain();
  master.gain.value = DEFAULT_MASTER_VOLUME;

  const instruments = audioContext.createGain();
  instruments.gain.value = 1;

  const drums = audioContext.createGain();
  drums.gain.value = DEFAULT_DRUMS_VOLUME;

  const bass = audioContext.createGain();
  bass.gain.value = DEFAULT_BASS_VOLUME;

  const pad = audioContext.createGain();
  pad.gain.value = DEFAULT_PAD_VOLUME;

  const ambience = audioContext.createGain();
  ambience.gain.value = DEFAULT_AMBIENCE_VOLUME;

  buses = { master, instruments, drums, bass, pad, ambience };

  // Connect buses (basic routing - effects will be inserted later)
  drums.connect(instruments);
  bass.connect(instruments);
  pad.connect(instruments);
  instruments.connect(master);
  ambience.connect(master);
  master.connect(analyser);
  analyser.connect(audioContext.destination);
}

/**
 * Get the audio context
 */
export function getContext(): AudioContext {
  if (!audioContext) {
    initAudioEngine();
  }
  return audioContext!;
}

/**
 * Get the audio buses
 */
export function getBuses(): AudioBuses {
  if (!buses) {
    initAudioEngine();
  }
  return buses!;
}

/**
 * Get the analyser node for visualization
 */
export function getAnalyser(): AnalyserNode {
  if (!analyser) {
    initAudioEngine();
  }
  return analyser!;
}

/**
 * Resume audio context (required after user interaction)
 */
export async function resumeAudio(): Promise<void> {
  const ctx = getContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  isRunning = true;
}

/**
 * Suspend audio context
 */
export async function suspendAudio(): Promise<void> {
  const ctx = getContext();
  if (ctx.state === 'running') {
    await ctx.suspend();
  }
  isRunning = false;
}

/**
 * Check if audio is currently running
 */
export function isAudioRunning(): boolean {
  return isRunning && audioContext?.state === 'running';
}

/**
 * Get current audio time
 */
export function getCurrentTime(): number {
  return getContext().currentTime;
}

/**
 * Set master volume
 */
export function setMasterVolume(value: number): void {
  const b = getBuses();
  b.master.gain.setTargetAtTime(value, getContext().currentTime, 0.02);
}

/**
 * Set drums volume
 */
export function setDrumsVolume(value: number): void {
  const b = getBuses();
  b.drums.gain.setTargetAtTime(value, getContext().currentTime, 0.02);
}

/**
 * Set bass volume
 */
export function setBassVolume(value: number): void {
  const b = getBuses();
  b.bass.gain.setTargetAtTime(value, getContext().currentTime, 0.02);
}

/**
 * Set pad volume
 */
export function setPadVolume(value: number): void {
  const b = getBuses();
  b.pad.gain.setTargetAtTime(value, getContext().currentTime, 0.02);
}

/**
 * Set ambience volume
 */
export function setAmbienceVolume(value: number): void {
  const b = getBuses();
  b.ambience.gain.setTargetAtTime(value, getContext().currentTime, 0.02);
}

/**
 * Disconnect all buses (for cleanup or reconnecting with effects)
 */
export function disconnectBuses(): void {
  if (!buses) return;
  buses.drums.disconnect();
  buses.bass.disconnect();
  buses.pad.disconnect();
  buses.instruments.disconnect();
  buses.ambience.disconnect();
  buses.master.disconnect();
}

/**
 * Reconnect buses with optional effect chain insertion point
 */
export function reconnectBuses(effectsInput?: AudioNode, effectsOutput?: AudioNode): void {
  if (!buses || !audioContext || !analyser) return;

  buses.drums.connect(buses.instruments);
  buses.bass.connect(buses.instruments);
  buses.pad.connect(buses.instruments);

  if (effectsInput && effectsOutput) {
    buses.instruments.connect(effectsInput);
    effectsOutput.connect(buses.master);
  } else {
    buses.instruments.connect(buses.master);
  }

  buses.ambience.connect(buses.master);
  buses.master.connect(analyser);
  analyser.connect(audioContext.destination);
}

/**
 * Get the destination for the MediaRecorder
 */
export function getDestination(): AudioNode {
  return getContext().destination;
}

/**
 * Create a MediaStreamDestination for recording
 */
export function createMediaStreamDestination(): MediaStreamAudioDestinationNode {
  return getContext().createMediaStreamDestination();
}
