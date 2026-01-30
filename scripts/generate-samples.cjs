// Generate synthetic lofi drum samples
// Run with: node scripts/generate-samples.js

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;

// WAV file writer
function writeWav(filename, samples) {
  const buffer = Buffer.alloc(44 + samples.length * 2);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples.length * 2, 40);

  // Write samples
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.floor(sample * 32767), 44 + i * 2);
  }

  fs.writeFileSync(filename, buffer);
  console.log(`Written: ${filename}`);
}

// Generate kick drum - sine wave with pitch drop
function generateKick() {
  const duration = 0.35; // seconds
  const samples = new Float32Array(Math.floor(SAMPLE_RATE * duration));

  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;

    // Pitch envelope - starts at 150Hz, drops to 40Hz
    const pitchEnv = Math.exp(-t * 25);
    const freq = 40 + 110 * pitchEnv;

    // Amplitude envelope
    const ampEnv = Math.exp(-t * 8);

    // Generate sine wave
    const phase = 2 * Math.PI * freq * t;
    samples[i] = Math.sin(phase) * ampEnv * 0.8;

    // Add a bit of click at the start
    if (t < 0.005) {
      samples[i] += Math.sin(2 * Math.PI * 3000 * t) * (1 - t / 0.005) * 0.3;
    }
  }

  // Apply soft saturation for warmth
  for (let i = 0; i < samples.length; i++) {
    samples[i] = Math.tanh(samples[i] * 1.5) * 0.7;
  }

  return samples;
}

// Generate snare - noise + tone body
function generateSnare() {
  const duration = 0.25; // seconds
  const samples = new Float32Array(Math.floor(SAMPLE_RATE * duration));

  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;

    // Noise component (snare wires)
    const noiseEnv = Math.exp(-t * 15);
    const noise = (Math.random() * 2 - 1) * noiseEnv * 0.6;

    // Tone component (drum body)
    const toneEnv = Math.exp(-t * 25);
    const tone = Math.sin(2 * Math.PI * 180 * t) * toneEnv * 0.5;

    samples[i] = noise + tone;
  }

  // Bandpass filter simulation (simple averaging)
  const filtered = new Float32Array(samples.length);
  for (let i = 2; i < samples.length - 2; i++) {
    filtered[i] = (samples[i-2] + samples[i-1] + samples[i] + samples[i+1] + samples[i+2]) / 5;
    filtered[i] = samples[i] * 0.7 + filtered[i] * 0.3;
  }

  // Apply soft clipping
  for (let i = 0; i < filtered.length; i++) {
    filtered[i] = Math.tanh(filtered[i] * 2) * 0.6;
  }

  return filtered;
}

// Generate closed hi-hat - high frequency noise
function generateHatClosed() {
  const duration = 0.08; // seconds
  const samples = new Float32Array(Math.floor(SAMPLE_RATE * duration));

  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;

    // Fast decay envelope
    const env = Math.exp(-t * 50);

    // High-frequency noise
    let noise = Math.random() * 2 - 1;

    // Simple highpass (differentiation)
    if (i > 0) {
      noise = noise - samples[i-1] * 0.8;
    }

    samples[i] = noise * env * 0.4;
  }

  // Additional highpass filtering
  const filtered = new Float32Array(samples.length);
  let prev = 0;
  for (let i = 0; i < samples.length; i++) {
    filtered[i] = samples[i] - prev;
    prev = samples[i] * 0.3;
  }

  return filtered;
}

// Generate open hi-hat - longer high frequency noise
function generateHatOpen() {
  const duration = 0.4; // seconds
  const samples = new Float32Array(Math.floor(SAMPLE_RATE * duration));

  for (let i = 0; i < samples.length; i++) {
    const t = i / SAMPLE_RATE;

    // Slower decay envelope
    const env = Math.exp(-t * 8);

    // High-frequency noise with some metallic character
    let noise = Math.random() * 2 - 1;

    // Add some tonal component for metallic ring
    const ring = Math.sin(2 * Math.PI * 6000 * t) * 0.2 +
                 Math.sin(2 * Math.PI * 8500 * t) * 0.15;

    samples[i] = (noise * 0.7 + ring * 0.3) * env * 0.35;
  }

  // Highpass filtering
  const filtered = new Float32Array(samples.length);
  let prev = 0;
  for (let i = 0; i < samples.length; i++) {
    filtered[i] = samples[i] - prev * 0.5;
    prev = samples[i];
  }

  return filtered;
}

// Create output directory and generate samples
const outputDir = path.join(__dirname, '..', 'public', 'samples');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('Generating lofi drum samples...\n');

writeWav(path.join(outputDir, 'kick.wav'), generateKick());
writeWav(path.join(outputDir, 'snare.wav'), generateSnare());
writeWav(path.join(outputDir, 'hat-closed.wav'), generateHatClosed());
writeWav(path.join(outputDir, 'hat-open.wav'), generateHatOpen());

console.log('\nDone! Samples generated in public/samples/');
