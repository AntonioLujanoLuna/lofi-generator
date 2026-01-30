/**
 * Returns a random float between min (inclusive) and max (exclusive)
 */
export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Returns a random integer between min (inclusive) and max (inclusive)
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Selects an item from an array based on weighted probabilities
 */
export function weightedRandom<T>(items: T[], weights: number[]): T {
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return items[i];
    }
  }

  return items[items.length - 1];
}

/**
 * Clamps a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation between two values
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Converts decibels to linear gain
 */
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * Converts linear gain to decibels
 */
export function gainToDb(gain: number): number {
  return 20 * Math.log10(gain);
}

/**
 * Returns a gaussian random number with mean 0 and std 1
 */
export function gaussianRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Returns a gaussian random number with specified mean and standard deviation
 */
export function gaussian(mean: number, std: number): number {
  return mean + gaussianRandom() * std;
}
