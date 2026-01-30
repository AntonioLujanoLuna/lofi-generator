import type { MoodPreset, ChordProgression, DrumPattern, BassNote, Chord } from './types';
import { initAudioEngine, resumeAudio, getContext, getBuses, getAnalyser, setMasterVolume, setDrumsVolume, setBassVolume, setPadVolume, setAmbienceVolume } from './audio-engine';
import { loadSamples, playDrumSample } from './sampler';
import { getTransport } from './sequencer';
import { SubBassSynth, PadSynth } from './synths';
import { ChordProgressionGenerator, BasslineGenerator, DrumPatternGenerator } from './generators';
import { LowpassFilter, Saturator, SimpleReverb, VinylNoise, SidechainCompressor } from './effects';
import { chordToMidiNotes, getChordDisplayName, transposeToOctave } from './music-theory';
import { MOOD_CONFIGS, BARS_PER_PROGRESSION, STEPS_PER_BAR } from './config';
import { randomInt } from './utils';

// State
let isPlaying = false;
let isRecording = false;
let currentMood: MoodPreset = 'chill';
let progression: ChordProgression | null = null;
let drumPatterns: DrumPattern[] = [];
let bassPatterns: BassNote[][] = [];
let currentBar = 0;

// Audio components
let bassSynth: SubBassSynth;
let padSynth: PadSynth;
let lowpassFilter: LowpassFilter;
let saturator: Saturator;
let reverb: SimpleReverb;
let vinylNoise: VinylNoise;
let sidechain: SidechainCompressor;

// Generators
let chordGen: ChordProgressionGenerator;
let bassGen: BasslineGenerator;
let drumGen: DrumPatternGenerator;

// Recording
let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];

// Mute states
const muteStates = {
  drums: false,
  bass: false,
  pad: false,
  ambience: false
};

// DOM Elements
const playBtn = document.getElementById('play-btn') as HTMLButtonElement;
const regenerateBtn = document.getElementById('regenerate-btn') as HTMLButtonElement;
const recordBtn = document.getElementById('record-btn') as HTMLButtonElement;
const moodSelect = document.getElementById('mood-select') as HTMLSelectElement;
const bpmSlider = document.getElementById('bpm-slider') as HTMLInputElement;
const bpmValue = document.getElementById('bpm-value') as HTMLSpanElement;
const currentChordEl = document.getElementById('current-chord') as HTMLSpanElement;
const masterVolume = document.getElementById('master-volume') as HTMLInputElement;
const drumsVolume = document.getElementById('drums-volume') as HTMLInputElement;
const bassVolumeEl = document.getElementById('bass-volume') as HTMLInputElement;
const padVolume = document.getElementById('pad-volume') as HTMLInputElement;
const ambienceVolume = document.getElementById('ambience-volume') as HTMLInputElement;
const drumsMute = document.getElementById('drums-mute') as HTMLButtonElement;
const bassMute = document.getElementById('bass-mute') as HTMLButtonElement;
const padMute = document.getElementById('pad-mute') as HTMLButtonElement;
const ambienceMute = document.getElementById('ambience-mute') as HTMLButtonElement;
const filterCutoff = document.getElementById('filter-cutoff') as HTMLInputElement;
const reverbWet = document.getElementById('reverb-wet') as HTMLInputElement;
const loadingEl = document.getElementById('loading') as HTMLDivElement;
const visualizer = document.getElementById('visualizer') as HTMLCanvasElement;

/**
 * Initialize the application
 */
async function init(): Promise<void> {
  // Initialize audio engine
  initAudioEngine();

  // Load samples
  await loadSamples();

  // Create synths
  bassSynth = new SubBassSynth();
  padSynth = new PadSynth();

  // Create effects
  lowpassFilter = new LowpassFilter();
  saturator = new Saturator();
  reverb = new SimpleReverb();
  vinylNoise = new VinylNoise();
  sidechain = new SidechainCompressor();

  // Wire up signal chain
  const buses = getBuses();

  // Disconnect default routing (instruments already connected to drums/bass/pad in audio-engine)
  buses.instruments.disconnect();

  // New routing: instruments → sidechain → lowpass → saturator → reverb → master
  // (drums/bass/pad → instruments connections already exist from audio-engine.ts)
  buses.instruments.connect(sidechain.getInputNode());
  sidechain.getOutputNode().connect(lowpassFilter.getInputNode());
  lowpassFilter.getOutputNode().connect(saturator.getInputNode());
  saturator.getOutputNode().connect(reverb.getInputNode());
  reverb.getOutputNode().connect(buses.master);

  // Connect synths to buses
  bassSynth.connect(buses.bass);
  padSynth.connect(buses.pad);

  // Connect vinyl noise to ambience
  vinylNoise.connect(buses.ambience);

  // Create generators
  chordGen = new ChordProgressionGenerator(currentMood);
  bassGen = new BasslineGenerator();
  drumGen = new DrumPatternGenerator();

  // Generate initial content
  generateNewContent();

  // Setup transport callbacks
  const transport = getTransport();
  transport.onBeat(handleBeat);

  // Bind UI events
  bindEvents();

  // Set initial effect values
  const moodConfig = MOOD_CONFIGS[currentMood];
  lowpassFilter.setCutoff(moodConfig.filterCutoff);
  reverb.setWetDry(moodConfig.reverbWet);
  filterCutoff.value = String(moodConfig.filterCutoff);
  reverbWet.value = String(moodConfig.reverbWet * 100);

  // Setup visualization
  setupVisualization();

  // Hide loading
  loadingEl.classList.add('hidden');
}

/**
 * Generate new chord progression, bass, and drum patterns
 */
function generateNewContent(): void {
  const moodConfig = MOOD_CONFIGS[currentMood];

  // Generate chord progression
  progression = chordGen.generate(BARS_PER_PROGRESSION);

  // Generate drum patterns
  drumPatterns = drumGen.generatePattern(BARS_PER_PROGRESSION);

  // Generate bass patterns
  bassPatterns = [];
  for (let i = 0; i < progression.chords.length; i++) {
    const chord = progression.chords[i];
    const nextChord = progression.chords[(i + 1) % progression.chords.length];
    bassPatterns.push(bassGen.generateBar(chord, nextChord, i));
  }

  // Set BPM from mood range
  const bpm = randomInt(moodConfig.bpmRange[0], moodConfig.bpmRange[1]);
  const transport = getTransport();
  transport.setBPM(bpm);
  bpmSlider.value = String(bpm);
  bpmValue.textContent = String(bpm);

  // Update chord display
  if (progression && progression.chords.length > 0) {
    updateChordDisplay(progression.chords[0]);
  }

  // Reset bar counter
  currentBar = 0;
}

/**
 * Handle each step (16th note)
 */
function handleBeat(step: number, time: number): void {
  if (!progression || !drumPatterns.length) return;

  const transport = getTransport();
  const bar = currentBar % BARS_PER_PROGRESSION;
  const drumPattern = drumPatterns[bar];
  const bassPattern = bassPatterns[bar];
  const chord = progression.chords[bar];

  // Play drums
  if (!muteStates.drums) {
    if (drumPattern.kick[step]) {
      playDrumSample('kick', time, drumPattern.velocities.kick[step]);
      // Trigger sidechain on kick
      sidechain.trigger(time);
    }
    if (drumPattern.snare[step]) {
      playDrumSample('snare', time, drumPattern.velocities.snare[step]);
    }
    if (drumPattern.hatClosed[step]) {
      playDrumSample('hat-closed', time, drumPattern.velocities.hatClosed[step]);
    }
    if (drumPattern.hatOpen[step]) {
      playDrumSample('hat-open', time, drumPattern.velocities.hatOpen[step]);
    }
  }

  // Play bass notes
  if (!muteStates.bass) {
    for (const note of bassPattern) {
      const noteStep = Math.floor(note.startBeat * 4); // Convert beat to step
      if (noteStep === step) {
        const duration = transport.beatToTime(note.durationBeats);
        bassSynth.triggerNote(note.pitch, time, duration, note.velocity);
      }
    }
  }

  // Play pad chord at the start of each bar
  if (step === 0 && !muteStates.pad) {
    const padOctave = 4; // Middle octave for pad
    const chordNotes = chordToMidiNotes(transposeToOctave(chord.root, padOctave), chord.quality);
    const duration = transport.beatToTime(4); // Full bar
    padSynth.triggerChord(chordNotes, time, duration, 0.6);

    // Update chord display
    updateChordDisplay(chord);
  }

  // Advance bar counter at the end of each bar
  if (step === STEPS_PER_BAR - 1) {
    currentBar = (currentBar + 1) % BARS_PER_PROGRESSION;
  }
}

/**
 * Update the chord display
 */
function updateChordDisplay(chord: Chord): void {
  currentChordEl.textContent = getChordDisplayName(chord);
}

/**
 * Toggle play/pause
 */
async function togglePlay(): Promise<void> {
  const transport = getTransport();

  if (isPlaying) {
    transport.stop();
    vinylNoise.stop();
    isPlaying = false;
    playBtn.innerHTML = '<span class="play-icon">▶</span> Play';
    playBtn.classList.remove('playing');
  } else {
    await resumeAudio();
    transport.start();
    vinylNoise.start();
    isPlaying = true;
    playBtn.innerHTML = '<span class="play-icon">■</span> Stop';
    playBtn.classList.add('playing');
  }
}

/**
 * Start/stop recording
 */
function toggleRecord(): void {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

/**
 * Start recording audio
 */
function startRecording(): void {
  const ctx = getContext();
  const dest = ctx.createMediaStreamDestination();

  // Connect master to recording destination
  const buses = getBuses();
  buses.master.connect(dest);

  // Create MediaRecorder
  mediaRecorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm' });
  recordedChunks = [];

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };

  mediaRecorder.onstop = () => {
    // Create blob and download
    const blob = new Blob(recordedChunks, { type: 'audio/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lofi-${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);

    // Disconnect recording destination
    buses.master.disconnect(dest);
  };

  mediaRecorder.start();
  isRecording = true;
  recordBtn.classList.add('recording');
  recordBtn.innerHTML = '<span class="record-icon">■</span> Stop';
}

/**
 * Stop recording
 */
function stopRecording(): void {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  isRecording = false;
  recordBtn.classList.remove('recording');
  recordBtn.innerHTML = '<span class="record-icon">●</span> Rec';
}

/**
 * Setup visualization
 */
function setupVisualization(): void {
  const analyser = getAnalyser();
  const ctx = visualizer.getContext('2d')!;

  // Set canvas size
  const resize = () => {
    visualizer.width = visualizer.offsetWidth * window.devicePixelRatio;
    visualizer.height = visualizer.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  };
  resize();
  window.addEventListener('resize', resize);

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  function draw(): void {
    requestAnimationFrame(draw);

    analyser.getByteFrequencyData(dataArray);

    const width = visualizer.offsetWidth;
    const height = visualizer.offsetHeight;

    // Clear
    ctx.fillStyle = '#1a1a1f';
    ctx.fillRect(0, 0, width, height);

    // Draw bars
    const barCount = 32;
    const barWidth = width / barCount - 2;
    const step = Math.floor(bufferLength / barCount);

    for (let i = 0; i < barCount; i++) {
      const value = dataArray[i * step];
      const barHeight = (value / 255) * height * 0.9;

      // Gradient color
      const hue = 260 + (i / barCount) * 30; // Purple to blue-purple
      ctx.fillStyle = `hsla(${hue}, 40%, 60%, 0.8)`;

      const x = i * (barWidth + 2);
      const y = height - barHeight;

      ctx.fillRect(x, y, barWidth, barHeight);
    }
  }

  draw();
}

/**
 * Bind UI event handlers
 */
function bindEvents(): void {
  // Play button
  playBtn.addEventListener('click', togglePlay);

  // Regenerate button
  regenerateBtn.addEventListener('click', () => {
    generateNewContent();
  });

  // Record button
  recordBtn.addEventListener('click', toggleRecord);

  // Mood select
  moodSelect.addEventListener('change', () => {
    currentMood = moodSelect.value as MoodPreset;
    chordGen.setMood(currentMood);

    // Update effects for mood
    const moodConfig = MOOD_CONFIGS[currentMood];
    lowpassFilter.setCutoff(moodConfig.filterCutoff);
    reverb.setWetDry(moodConfig.reverbWet);
    filterCutoff.value = String(moodConfig.filterCutoff);
    reverbWet.value = String(moodConfig.reverbWet * 100);

    // Regenerate content
    generateNewContent();
  });

  // BPM slider
  bpmSlider.addEventListener('input', () => {
    const bpm = parseInt(bpmSlider.value, 10);
    const transport = getTransport();
    transport.setBPM(bpm);
    bpmValue.textContent = String(bpm);
  });

  // Volume sliders
  masterVolume.addEventListener('input', () => {
    setMasterVolume(parseInt(masterVolume.value, 10) / 100);
  });

  drumsVolume.addEventListener('input', () => {
    if (!muteStates.drums) {
      setDrumsVolume(parseInt(drumsVolume.value, 10) / 100);
    }
  });

  bassVolumeEl.addEventListener('input', () => {
    if (!muteStates.bass) {
      setBassVolume(parseInt(bassVolumeEl.value, 10) / 100);
    }
  });

  padVolume.addEventListener('input', () => {
    if (!muteStates.pad) {
      setPadVolume(parseInt(padVolume.value, 10) / 100);
    }
  });

  ambienceVolume.addEventListener('input', () => {
    if (!muteStates.ambience) {
      setAmbienceVolume(parseInt(ambienceVolume.value, 10) / 100);
    }
  });

  // Mute buttons
  drumsMute.addEventListener('click', () => {
    muteStates.drums = !muteStates.drums;
    drumsMute.classList.toggle('muted', muteStates.drums);
    setDrumsVolume(muteStates.drums ? 0 : parseInt(drumsVolume.value, 10) / 100);
  });

  bassMute.addEventListener('click', () => {
    muteStates.bass = !muteStates.bass;
    bassMute.classList.toggle('muted', muteStates.bass);
    setBassVolume(muteStates.bass ? 0 : parseInt(bassVolumeEl.value, 10) / 100);
  });

  padMute.addEventListener('click', () => {
    muteStates.pad = !muteStates.pad;
    padMute.classList.toggle('muted', muteStates.pad);
    setPadVolume(muteStates.pad ? 0 : parseInt(padVolume.value, 10) / 100);
  });

  ambienceMute.addEventListener('click', () => {
    muteStates.ambience = !muteStates.ambience;
    ambienceMute.classList.toggle('muted', muteStates.ambience);
    setAmbienceVolume(muteStates.ambience ? 0 : parseInt(ambienceVolume.value, 10) / 100);
  });

  // Effect controls
  filterCutoff.addEventListener('input', () => {
    lowpassFilter.setCutoff(parseInt(filterCutoff.value, 10));
  });

  reverbWet.addEventListener('input', () => {
    reverb.setWetDry(parseInt(reverbWet.value, 10) / 100);
  });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
