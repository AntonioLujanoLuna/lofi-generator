import type { SongSection, SectionConfig, InstrumentMuteState } from './types';

// Default section configurations
const SECTION_CONFIGS: SectionConfig[] = [
  {
    name: 'intro',
    lengthBars: 8,
    mutes: { drums: true, bass: true, pad: false, melody: true },
    filterSweep: 'up'
  },
  {
    name: 'verse',
    lengthBars: 16,
    mutes: { drums: false, bass: false, pad: false, melody: false }
  },
  {
    name: 'breakdown',
    lengthBars: 8,
    mutes: { drums: true, bass: false, pad: false, melody: true },
    filterSweep: 'down'
  },
  {
    name: 'buildup',
    lengthBars: 8,
    mutes: { drums: false, bass: false, pad: false, melody: false },
    filterSweep: 'up'
  }
];

export type FilterSweepCallback = (direction: 'up' | 'down', startTime: number, durationBars: number) => void;

export class SongStructureManager {
  private sections: SectionConfig[] = [...SECTION_CONFIGS];
  private currentSectionIndex = 0;
  private barInSection = 0;
  private totalBars = 0;
  private enabled = true;
  private filterSweepCallback: FilterSweepCallback | null = null;

  constructor() {
    this.reset();
  }

  /**
   * Enable or disable song structure (when disabled, all instruments play)
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if song structure is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get the current section
   */
  getCurrentSection(): SongSection {
    return this.sections[this.currentSectionIndex].name;
  }

  /**
   * Get current section config
   */
  getCurrentSectionConfig(): SectionConfig {
    return this.sections[this.currentSectionIndex];
  }

  /**
   * Get instrument mute states for current section
   */
  getMuteStates(): InstrumentMuteState {
    if (!this.enabled) {
      return { drums: false, bass: false, pad: false, melody: false };
    }
    return { ...this.sections[this.currentSectionIndex].mutes };
  }

  /**
   * Get bars remaining in current section
   */
  getBarsRemaining(): number {
    const config = this.sections[this.currentSectionIndex];
    return config.lengthBars - this.barInSection;
  }

  /**
   * Get total bars played
   */
  getTotalBars(): number {
    return this.totalBars;
  }

  /**
   * Get bar position in current section
   */
  getBarInSection(): number {
    return this.barInSection;
  }

  /**
   * Register callback for filter sweeps at section transitions
   */
  onFilterSweep(callback: FilterSweepCallback): void {
    this.filterSweepCallback = callback;
  }

  /**
   * Advance to next bar, handles section transitions
   * Returns true if section changed
   */
  advanceBar(currentTime: number, _barDuration: number): boolean {
    this.totalBars++;
    this.barInSection++;

    const currentConfig = this.sections[this.currentSectionIndex];

    // Check if we've completed the current section
    if (this.barInSection >= currentConfig.lengthBars) {
      this.barInSection = 0;
      this.currentSectionIndex = (this.currentSectionIndex + 1) % this.sections.length;

      const nextConfig = this.sections[this.currentSectionIndex];

      // Trigger filter sweep if configured
      if (nextConfig.filterSweep && this.filterSweepCallback) {
        this.filterSweepCallback(nextConfig.filterSweep, currentTime, nextConfig.lengthBars / 2);
      }

      return true;
    }

    return false;
  }

  /**
   * Check if about to transition to new section
   */
  isTransitioning(): boolean {
    const config = this.sections[this.currentSectionIndex];
    return this.barInSection >= config.lengthBars - 2;
  }

  /**
   * Reset to beginning
   */
  reset(): void {
    this.currentSectionIndex = 0;
    this.barInSection = 0;
    this.totalBars = 0;
  }

  /**
   * Skip to a specific section
   */
  skipToSection(section: SongSection): void {
    const index = this.sections.findIndex(s => s.name === section);
    if (index !== -1) {
      this.currentSectionIndex = index;
      this.barInSection = 0;
    }
  }

  /**
   * Get all section names in order
   */
  getSectionOrder(): SongSection[] {
    return this.sections.map(s => s.name);
  }

  /**
   * Get progress through current section (0-1)
   */
  getSectionProgress(): number {
    const config = this.sections[this.currentSectionIndex];
    return this.barInSection / config.lengthBars;
  }
}
