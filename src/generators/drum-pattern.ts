import type { DrumPattern } from '../types';
import { randomFloat, gaussian } from '../utils';
import { STEPS_PER_BAR } from '../config';

export class DrumPatternGenerator {
  private density = 0.5; // 0-1, affects ghost note probability
  private phraseLength = 8; // 8-bar phrase for evolution

  // Base pattern template (16 steps)
  private baseKick = [true, false, false, false, false, false, false, false, true, false, false, false, false, false, true, false];
  private baseSnare = [false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false];
  private baseHatClosed = [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false];
  private baseHatOpen = [false, false, false, false, false, false, false, true, false, false, false, false, false, false, false, true];

  // 16-bar accent cycle for hi-hats
  private hatAccentCycle = [
    1.0, 0.6, 0.8, 0.6, 0.9, 0.6, 0.7, 0.6,
    1.0, 0.6, 0.8, 0.6, 0.9, 0.6, 0.8, 0.7
  ];

  /**
   * Generate drum patterns for multiple bars with evolution
   */
  generatePattern(bars: number): DrumPattern[] {
    const patterns: DrumPattern[] = [];

    for (let bar = 0; bar < bars; bar++) {
      const barInPhrase = bar % this.phraseLength;
      const isFillBar = (barInPhrase + 1) % 4 === 0; // Fill every 4th bar

      // Check for dropout bars (10% chance on bars 7-8 of phrase)
      const isDropoutBar = (barInPhrase === 6 || barInPhrase === 7) && randomFloat(0, 1) < 0.10;

      patterns.push(this.generateBar(bar, isFillBar, barInPhrase, isDropoutBar));
    }

    return patterns;
  }

  /**
   * Generate a single bar pattern with variations and evolution
   */
  private generateBar(barNumber: number, isFillBar: boolean, barInPhrase: number, isDropoutBar: boolean): DrumPattern {
    // Calculate density gradient (sparse → dense over 8 bars)
    const phraseDensity = 0.3 + (barInPhrase / this.phraseLength) * 0.5;
    const effectiveDensity = this.density * phraseDensity;

    const kick = [...this.baseKick];
    const snare = [...this.baseSnare];
    const hatClosed = [...this.baseHatClosed];
    const hatOpen = [...this.baseHatOpen];

    // Dropout bars: sparse drums for tension
    if (isDropoutBar) {
      // Keep only essential kicks and snares
      for (let step = 0; step < STEPS_PER_BAR; step++) {
        if (step !== 0 && step !== 4 && step !== 12) {
          kick[step] = false;
          snare[step] = false;
        }
        // Reduce hi-hats significantly
        if (randomFloat(0, 1) < 0.6) {
          hatClosed[step] = false;
          hatOpen[step] = false;
        }
      }
    } else {
      // Apply variations with density-based probability
      for (let step = 0; step < STEPS_PER_BAR; step++) {
        // Ghost snare: probability based on density
        if (!snare[step] && randomFloat(0, 1) < 0.12 * effectiveDensity) {
          snare[step] = true;
        }

        // Extra kick on steps 6 and 12: more likely later in phrase
        if ((step === 6 || step === 12) && !kick[step] && randomFloat(0, 1) < 0.15 * phraseDensity) {
          kick[step] = true;
        }

        // Kick dropout on weak kicks: less likely later in phrase
        if ((step === 8 || step === 14) && kick[step] && randomFloat(0, 1) < 0.08 * (1 - phraseDensity)) {
          kick[step] = false;
        }

        // Open hat swap: 10% chance
        if (hatClosed[step] && !hatOpen[step] && randomFloat(0, 1) < 0.10) {
          hatClosed[step] = false;
          hatOpen[step] = true;
        }

        // Hat dropout: less likely later in phrase
        if (hatClosed[step] && randomFloat(0, 1) < 0.05 * (1 - phraseDensity * 0.5)) {
          hatClosed[step] = false;
        }
      }
    }

    // Apply fill on last 4 steps of fill bars
    if (isFillBar && !isDropoutBar) {
      this.applyFill(kick, snare, hatClosed, hatOpen);
    }

    // Generate velocities with humanization
    const velocities = {
      kick: this.generateVelocities(kick, 0.85, 0.08),
      snare: this.generateVelocities(snare, 0.75, 0.08),
      hatClosed: this.generateHatVelocities(hatClosed, barNumber),
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
   * Generate hi-hat velocities with 16-bar accent cycle
   */
  private generateHatVelocities(pattern: boolean[], barNumber: number): number[] {
    const cyclePosition = barNumber % 16;
    const baseVelocity = 0.6 * this.hatAccentCycle[cyclePosition];

    return pattern.map((hit, step) => {
      if (!hit) return 0;
      // Add accent on downbeats
      const accentMultiplier = step % 4 === 0 ? 1.2 : 1.0;
      return Math.min(1.0, Math.max(0.1, (baseVelocity * accentMultiplier) + gaussian(0, 0.08)));
    });
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
