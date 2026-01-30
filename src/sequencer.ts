import type { BeatCallback } from './types';
import { getContext, getCurrentTime } from './audio-engine';
import { DEFAULT_BPM, DEFAULT_SWING, LOOKAHEAD_MS, SCHEDULE_INTERVAL_MS, STEPS_PER_BAR } from './config';

export class Transport {
  private bpm: number = DEFAULT_BPM;
  private swingAmount: number = DEFAULT_SWING;
  private playing: boolean = false;
  private currentStep: number = 0;
  private nextStepTime: number = 0;
  private schedulerInterval: number | null = null;
  private beatCallbacks: BeatCallback[] = [];

  constructor() {
    this.bpm = DEFAULT_BPM;
    this.swingAmount = DEFAULT_SWING;
  }

  /**
   * Start the transport
   */
  start(): void {
    if (this.playing) return;

    this.playing = true;
    this.currentStep = 0;
    this.nextStepTime = getCurrentTime() + 0.1; // Small delay to start

    // Start scheduler loop
    this.schedulerInterval = window.setInterval(() => {
      this.schedule();
    }, SCHEDULE_INTERVAL_MS);
  }

  /**
   * Stop the transport
   */
  stop(): void {
    this.playing = false;
    if (this.schedulerInterval !== null) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
    this.currentStep = 0;
  }

  /**
   * Check if transport is playing
   */
  isPlaying(): boolean {
    return this.playing;
  }

  /**
   * Set BPM
   */
  setBPM(bpm: number): void {
    this.bpm = Math.max(30, Math.min(200, bpm));
  }

  /**
   * Get current BPM
   */
  getBPM(): number {
    return this.bpm;
  }

  /**
   * Set swing amount (0.5 = straight, 0.67 = triplet swing)
   */
  setSwing(amount: number): void {
    this.swingAmount = Math.max(0.5, Math.min(0.75, amount));
  }

  /**
   * Get current step (0-15 for one bar)
   */
  getCurrentStep(): number {
    return this.currentStep;
  }

  /**
   * Get current beat (0-3 for one bar)
   */
  getCurrentBeat(): number {
    return Math.floor(this.currentStep / 4);
  }

  /**
   * Convert beat number to audio context time
   */
  beatToTime(beat: number): number {
    const secondsPerBeat = 60 / this.bpm;
    return beat * secondsPerBeat;
  }

  /**
   * Convert step number to audio context time
   */
  stepToTime(step: number): number {
    const secondsPerStep = 60 / this.bpm / 4; // 16th notes
    return step * secondsPerStep;
  }

  /**
   * Get duration of one step in seconds
   */
  getStepDuration(): number {
    return 60 / this.bpm / 4;
  }

  /**
   * Get duration of one beat in seconds
   */
  getBeatDuration(): number {
    return 60 / this.bpm;
  }

  /**
   * Register a callback to be called on each step
   */
  onBeat(callback: BeatCallback): void {
    this.beatCallbacks.push(callback);
  }

  /**
   * Remove all beat callbacks
   */
  clearCallbacks(): void {
    this.beatCallbacks = [];
  }

  /**
   * Internal scheduler - looks ahead and schedules beats
   */
  private schedule(): void {
    const ctx = getContext();
    const currentTime = ctx.currentTime;
    const lookaheadTime = LOOKAHEAD_MS / 1000;

    while (this.nextStepTime < currentTime + lookaheadTime) {
      // Apply swing to off-beat 16th notes (steps 1, 3, 5, 7, 9, 11, 13, 15)
      const isOffBeat = this.currentStep % 2 === 1;
      const swingOffset = isOffBeat ? (this.swingAmount - 0.5) * this.getStepDuration() : 0;
      const scheduledTime = this.nextStepTime + swingOffset;

      // Call all registered callbacks
      for (const callback of this.beatCallbacks) {
        callback(this.currentStep, scheduledTime);
      }

      // Advance to next step
      this.nextStepTime += this.getStepDuration();
      this.currentStep = (this.currentStep + 1) % STEPS_PER_BAR;
    }
  }
}

// Default transport instance
let defaultTransport: Transport | null = null;

export function getTransport(): Transport {
  if (!defaultTransport) {
    defaultTransport = new Transport();
  }
  return defaultTransport;
}
