import type { DrumPattern } from '../types';
import { randomFloat, gaussian } from '../utils';
import { STEPS_PER_BAR } from '../config';

export class DrumPatternGenerator {
  private density = 0.5; // 0-1, affects ghost note probability

  // Base pattern template (16 steps)
  private baseKick = [true, false, false, false, false, false, false, false, true, false, false, false, false, false, true, false];
  private baseSnare = [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false];
  private baseHatClosed = [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false];
  private baseHatOpen = [false, false, false, false, false, false, false, true, false, false, false, false, false, false, false, true];

  /**
   * Generate drum patterns for multiple bars
   */
  generatePattern(bars: number): DrumPattern[] {
    const patterns: DrumPattern[] = [];

    for (let bar = 0; bar < bars; bar++) {
      const isFillBar = (bar + 1) % 4 === 0; // Fill every 4th bar
      patterns.push(this.generateBar(bar, isFillBar));
    }

    return patterns;
  }

  /**
   * Generate a single bar pattern with variations
   */
  private generateBar(_barNumber: number, isFillBar: boolean): DrumPattern {
    const kick = [...this.baseKick];
    const snare = [...this.baseSnare];
    const hatClosed = [...this.baseHatClosed];
    const hatOpen = [...this.baseHatOpen];

    // Apply variations
    for (let step = 0; step < STEPS_PER_BAR; step++) {
      // Ghost snare: 12% chance on empty steps
      if (!snare[step] && randomFloat(0, 1) < 0.12 * this.density) {
        snare[step] = true;
      }

      // Extra kick on steps 6 (7th step) and 12 (13th step): 15% chance
      if ((step === 6 || step === 12) && !kick[step] && randomFloat(0, 1) < 0.15) {
        kick[step] = true;
      }

      // Kick dropout on weak kicks (step 8 and 14): 8% chance
      if ((step === 8 || step === 14) && kick[step] && randomFloat(0, 1) < 0.08) {
        kick[step] = false;
      }

      // Open hat swap: 10% chance to replace closed with open
      if (hatClosed[step] && !hatOpen[step] && randomFloat(0, 1) < 0.10) {
        hatClosed[step] = false;
        hatOpen[step] = true;
      }

      // Hat dropout: 5% chance
      if (hatClosed[step] && randomFloat(0, 1) < 0.05) {
        hatClosed[step] = false;
      }
    }

    // Apply fill on last 4 steps of fill bars
    if (isFillBar) {
      this.applyFill(kick, snare, hatClosed, hatOpen);
    }

    // Generate velocities with humanization
    const velocities = {
      kick: this.generateVelocities(kick, 0.85, 0.08),
      snare: this.generateVelocities(snare, 0.75, 0.08),
      hatClosed: this.generateVelocities(hatClosed, 0.6, 0.08),
      hatOpen: this.generateVelocities(hatOpen, 0.65, 0.08)
    };

    // Mark ghost snares with lower velocity
    for (let step = 0; step < STEPS_PER_BAR; step++) {
      // Ghost snares are on non-beat positions
      if (snare[step] && step !== 4 && step !== 12) {
        velocities.snare[step] = randomFloat(0.15, 0.30);
      }
    }

    return { kick, snare, hatClosed, hatOpen, velocities };
  }

  /**
   * Apply a fill pattern to the last 4 steps
   */
  private applyFill(kick: boolean[], snare: boolean[], hatClosed: boolean[], hatOpen: boolean[]): void {
    const fillType = randomFloat(0, 1);

    // Clear last 4 steps
    for (let step = 12; step < 16; step++) {
      kick[step] = false;
      snare[step] = false;
      hatClosed[step] = false;
      hatOpen[step] = false;
    }

    if (fillType < 0.70) {
      // Snare roll (4 hits)
      snare[12] = true;
      snare[13] = true;
      snare[14] = true;
      snare[15] = true;
    } else if (fillType < 0.90) {
      // Kick + snare unison
      kick[12] = true;
      snare[12] = true;
      kick[14] = true;
      snare[14] = true;
    }
    // else: dropout (silence for tension)
  }

  /**
   * Generate velocity array with humanization
   */
  private generateVelocities(pattern: boolean[], baseVelocity: number, variation: number): number[] {
    return pattern.map(hit => {
      if (!hit) return 0;
      return Math.max(0.1, Math.min(1.0, baseVelocity + gaussian(0, variation)));
    });
  }

  /**
   * Set pattern density (affects ghost note probability)
   */
  setDensity(density: number): void {
    this.density = Math.max(0, Math.min(1, density));
  }

  /**
   * Get current density
   */
  getDensity(): number {
    return this.density;
  }
}
