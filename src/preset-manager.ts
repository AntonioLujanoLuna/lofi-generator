import type { MoodPreset } from './types';

export interface Preset {
  name: string;
  mood: MoodPreset;
  bpm: number;
  filterCutoff: number;
  reverbWet: number;
  volumes: {
    master: number;
    drums: number;
    bass: number;
    pad: number;
    ambience: number;
    melody: number;
  };
  tapeWow: number;
  tapeFlutter: number;
  padStereoWidth: number;
}

const STORAGE_KEY = 'lofi-generator-presets';

// Default factory presets
const DEFAULT_PRESETS: Preset[] = [
  {
    name: 'Late Night',
    mood: 'chill',
    bpm: 72,
    filterCutoff: 2400,
    reverbWet: 0.4,
    volumes: { master: 80, drums: 60, bass: 70, pad: 65, ambience: 45, melody: 55 },
    tapeWow: 6,
    tapeFlutter: 2,
    padStereoWidth: 0.8
  },
  {
    name: 'Study Session',
    mood: 'chill',
    bpm: 78,
    filterCutoff: 3500,
    reverbWet: 0.25,
    volumes: { master: 70, drums: 55, bass: 65, pad: 50, ambience: 30, melody: 60 },
    tapeWow: 4,
    tapeFlutter: 1,
    padStereoWidth: 0.6
  },
  {
    name: 'Coffee Shop',
    mood: 'upbeat',
    bpm: 86,
    filterCutoff: 4500,
    reverbWet: 0.2,
    volumes: { master: 75, drums: 70, bass: 70, pad: 55, ambience: 35, melody: 65 },
    tapeWow: 3,
    tapeFlutter: 1.5,
    padStereoWidth: 0.7
  },
  {
    name: 'Rainy Window',
    mood: 'rainy',
    bpm: 66,
    filterCutoff: 1800,
    reverbWet: 0.55,
    volumes: { master: 75, drums: 50, bass: 65, pad: 70, ambience: 55, melody: 45 },
    tapeWow: 8,
    tapeFlutter: 3,
    padStereoWidth: 0.9
  },
  {
    name: 'Midnight Blues',
    mood: 'melancholic',
    bpm: 62,
    filterCutoff: 2200,
    reverbWet: 0.48,
    volumes: { master: 70, drums: 45, bass: 60, pad: 68, ambience: 40, melody: 58 },
    tapeWow: 7,
    tapeFlutter: 2.5,
    padStereoWidth: 0.85
  }
];

export class PresetManager {
  private presets: Preset[] = [];
  private currentPresetName: string | null = null;

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Load presets from localStorage, initialize with defaults if empty
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Preset[];
        // Merge with defaults (defaults first, then user presets)
        const userPresets = parsed.filter(
          p => !DEFAULT_PRESETS.some(d => d.name === p.name)
        );
        this.presets = [...DEFAULT_PRESETS, ...userPresets];
      } else {
        this.presets = [...DEFAULT_PRESETS];
      }
    } catch {
      this.presets = [...DEFAULT_PRESETS];
    }
  }

  /**
   * Save presets to localStorage
   */
  private saveToStorage(): void {
    try {
      // Only save non-default presets
      const userPresets = this.presets.filter(
        p => !DEFAULT_PRESETS.some(d => d.name === p.name)
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userPresets));
    } catch {
      console.warn('Failed to save presets to localStorage');
    }
  }

  /**
   * Get all preset names
   */
  getPresetNames(): string[] {
    return this.presets.map(p => p.name);
  }

  /**
   * Get all presets
   */
  getPresets(): Preset[] {
    return [...this.presets];
  }

  /**
   * Get a preset by name
   */
  getPreset(name: string): Preset | undefined {
    return this.presets.find(p => p.name === name);
  }

  /**
   * Get the currently loaded preset name
   */
  getCurrentPresetName(): string | null {
    return this.currentPresetName;
  }

  /**
   * Set the current preset name (for tracking)
   */
  setCurrentPresetName(name: string | null): void {
    this.currentPresetName = name;
  }

  /**
   * Save a new preset or update existing
   */
  savePreset(preset: Preset): void {
    const existingIndex = this.presets.findIndex(p => p.name === preset.name);
    if (existingIndex >= 0) {
      // Don't overwrite default presets
      if (DEFAULT_PRESETS.some(d => d.name === preset.name)) {
        // Save as new preset with different name
        preset.name = `${preset.name} (Custom)`;
        this.presets.push(preset);
      } else {
        this.presets[existingIndex] = preset;
      }
    } else {
      this.presets.push(preset);
    }
    this.currentPresetName = preset.name;
    this.saveToStorage();
  }

  /**
   * Delete a preset by name (can't delete default presets)
   */
  deletePreset(name: string): boolean {
    if (DEFAULT_PRESETS.some(d => d.name === name)) {
      return false; // Can't delete defaults
    }

    const index = this.presets.findIndex(p => p.name === name);
    if (index >= 0) {
      this.presets.splice(index, 1);
      if (this.currentPresetName === name) {
        this.currentPresetName = null;
      }
      this.saveToStorage();
      return true;
    }
    return false;
  }

  /**
   * Check if a preset is a default (non-deletable)
   */
  isDefaultPreset(name: string): boolean {
    return DEFAULT_PRESETS.some(d => d.name === name);
  }

  /**
   * Export presets as JSON string
   */
  exportPresets(): string {
    return JSON.stringify(this.presets, null, 2);
  }

  /**
   * Import presets from JSON string
   */
  importPresets(json: string): boolean {
    try {
      const imported = JSON.parse(json) as Preset[];
      if (!Array.isArray(imported)) {
        return false;
      }

      // Validate preset structure
      for (const preset of imported) {
        if (!preset.name || !preset.mood || typeof preset.bpm !== 'number') {
          return false;
        }
      }

      // Merge with existing, avoiding duplicates
      for (const preset of imported) {
        if (!this.presets.some(p => p.name === preset.name)) {
          this.presets.push(preset);
        }
      }

      this.saveToStorage();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reset to default presets only
   */
  resetToDefaults(): void {
    this.presets = [...DEFAULT_PRESETS];
    this.currentPresetName = null;
    localStorage.removeItem(STORAGE_KEY);
  }
}
