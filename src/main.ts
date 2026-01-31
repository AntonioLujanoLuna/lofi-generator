import type { MoodPreset, ChordProgression, DrumPattern, BassNote, MelodyNote, Chord } from './types';
import { initAudioEngine, resumeAudio, getContext, getBuses, getAnalyser, setMasterVolume, setDrumsVolume, setBassVolume, setPadVolume, setAmbienceVolume } from './audio-engine';
import { loadSamples, playDrumSample } from './sampler';
import { getTransport } from './sequencer';
import { SubBassSynth, PadSynth, RhodesSynth } from './synths';
import { ChordProgressionGenerator, BasslineGenerator, DrumPatternGenerator, MelodyGenerator } from './generators';
import { LowpassFilter, Saturator, SimpleReverb, VinylNoise, SidechainCompressor, TapeDegradation } from './effects';
import { chordToMidiNotes, getChordDisplayName, transposeToOctave, voiceLeadTo } from './music-theory';
import { MOOD_CONFIGS, BARS_PER_PROGRESSION, STEPS_PER_BAR } from './config';
import { randomInt } from './utils';
import { SongStructureManager } from './song-structure';
import { PresetManager, Preset } from './preset-manager';

// State
let isPlaying = false;
let isRecording = false;
let currentMood: MoodPreset = 'chill';
let progression: ChordProgression | null = null;
let drumPatterns: DrumPattern[] = [];
let bassPatterns: BassNote[][] = [];
let melodyPatterns: MelodyNote[][] = [];
let currentBar = 0;
let previousPadVoicing: number[] = [];

// Audio components
let bassSynth: SubBassSynth;
let padSynth: PadSynth;
let rhodesSynth: RhodesSynth;
let lowpassFilter: LowpassFilter;
let saturator: Saturator;
let reverb: SimpleReverb;
let vinylNoise: VinylNoise;
let sidechain: SidechainCompressor;
let tapeDegradation: TapeDegradation;

// Generators
let chordGen: ChordProgressionGenerator;
let bassGen: BasslineGenerator;
let drumGen: DrumPatternGenerator;
let melodyGen: MelodyGenerator;

// Song structure
let songStructure: SongStructureManager;

// Preset manager
let presetManager: PresetManager;

// Recording
let mediaRecorder: MediaRecorder | null = null;
let recordedChunks: Blob[] = [];

// Mute states (user manual mutes, separate from song structure)
const muteStates = {
  drums: false,
  bass: false,
  pad: false,
  ambience: false,
  melody: false
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
const melodyVolume = document.getElementById('melody-volume') as HTMLInputElement | null;
const melodyMute = document.getElementById('melody-mute') as HTMLButtonElement | null;
const presetSelect = document.getElementById('preset-select') as HTMLSelectElement | null;
const savePresetBtn = document.getElementById('save-preset-btn') as HTMLButtonElement | null;
const sectionDisplay = document.getElementById('section-display') as HTMLSpanElement | null;

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
  rhodesSynth = new RhodesSynth();

  // Create effects
  lowpassFilter = new LowpassFilter();
  saturator = new Saturator();
  reverb = new SimpleReverb();
  vinylNoise = new VinylNoise();
  sidechain = new SidechainCompressor();
  tapeDegradation = new TapeDegradation();

  // Wire up signal chain
  const buses = getBuses();

  // Disconnect default routing (instruments already connected to drums/bass/pad in audio-engine)
  buses.instruments.disconnect();

  // New routing: instruments → sidechain → lowpass → saturator → tape → reverb → master
  buses.instruments.connect(sidechain.getInputNode());
  sidechain.getOutputNode().connect(lowpassFilter.getInputNode());
  lowpassFilter.getOutputNode().connect(saturator.getInputNode());
  saturator.getOutputNode().connect(tapeDegradation.getInputNode());
  tapeDegradation.getOutputNode().connect(reverb.getInputNode());
  reverb.getOutputNode().connect(buses.master);

  // Connect synths to buses
  bassSynth.connect(buses.bass);
  padSynth.connect(buses.pad);
  rhodesSynth.connect(buses.pad); // Rhodes shares pad bus

  // Connect vinyl noise to ambience
  vinylNoise.connect(buses.ambience);

  // Create generators
  chordGen = new ChordProgressionGenerator(currentMood);
  bassGen = new BasslineGenerator();
  drumGen = new DrumPatternGenerator();
  melodyGen = new MelodyGenerator();

  // Create song structure manager
  songStructure = new SongStructureManager();
  songStructure.onFilterSweep(handleFilterSweep);

  // Create preset manager
  presetManager = new PresetManager();

  // Generate initial content
  generateNewContent();

  // Setup transport callbacks
  const transport = getTransport();
  transport.onBeat(handleBeat);

  // Bind UI events
  bindEvents();

  // Bind keyboard shortcuts
  bindKeyboardShortcuts();

  // Parse URL parameters and apply them
  applyUrlParams();

  // Set initial effect values
  const moodConfig = MOOD_CONFIGS[currentMood];
  lowpassFilter.setCutoff(moodConfig.filterCutoff);
  reverb.setWetDry(moodConfig.reverbWet);
  filterCutoff.value = String(moodConfig.filterCutoff);
  reverbWet.value = String(moodConfig.reverbWet * 100);

  // Initialize preset UI
  initPresetUI();

  // Setup visualization
  setupVisualization();

  // Hide loading
  loadingEl.classList.add('hidden');
}

/**
 * Generate new chord progression, bass, drum, and melody patterns
 */
function generateNewContent(): void {
  const moodConfig = MOOD_CONFIGS[currentMood];

  // Generate chord progression
  progression = chordGen.generate(BARS_PER_PROGRESSION);

  // Generate drum patterns
  drumPatterns = drumGen.generatePattern(BARS_PER_PROGRESSION);

  // Set key and mode for melody generator
  melodyGen.setKeyAndMode(progression.key, progression.mode);
  melodyGen.reset();

  // Generate bass and melody patterns
  bassPatterns = [];
  melodyPatterns = [];
  previousPadVoicing = [];

  for (let i = 0; i < progression.chords.length; i++) {
    const chord = progression.chords[i];
    const nextChord = progression.chords[(i + 1) % progression.chords.length];
    bassPatterns.push(bassGen.generateBar(chord, nextChord, i));
    melodyPatterns.push(melodyGen.generateBar(chord, i));
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

  // Reset bar counter and song structure
  currentBar = 0;
  songStructure.reset();
  updateSectionDisplay();
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
  const melodyPattern = melodyPatterns[bar];
  const chord = progression.chords[bar];

  // Get song structure mute states (combined with user mutes)
  const structureMutes = songStructure.getMuteStates();
  const effectiveMutes = {
    drums: muteStates.drums || structureMutes.drums,
    bass: muteStates.bass || structureMutes.bass,
    pad: muteStates.pad || structureMutes.pad,
    melody: muteStates.melody || structureMutes.melody
  };

  // Play drums
  if (!effectiveMutes.drums) {
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
  if (!effectiveMutes.bass) {
    for (const note of bassPattern) {
      const noteStep = Math.floor(note.startBeat * 4); // Convert beat to step
      if (noteStep === step) {
        const duration = transport.beatToTime(note.durationBeats);
        bassSynth.triggerNote(note.pitch, time, duration, note.velocity);
      }
    }
  }

  // Play melody notes on Rhodes
  if (!effectiveMutes.melody) {
    for (const note of melodyPattern) {
      if (note.startStep === step) {
        const duration = transport.stepToTime(note.durationSteps);
        rhodesSynth.triggerNote(note.pitch, time, duration, note.velocity);
      }
    }
  }

  // Play pad chord at the start of each bar with voice leading
  if (step === 0 && !effectiveMutes.pad) {
    const padOctave = 4; // Middle octave for pad
    const baseRoot = transposeToOctave(chord.root, padOctave);

    // Use voice leading if we have a previous voicing
    let chordNotes: number[];
    if (previousPadVoicing.length > 0) {
      chordNotes = voiceLeadTo(previousPadVoicing, baseRoot, chord.quality);
    } else {
      chordNotes = chordToMidiNotes(baseRoot, chord.quality);
    }
    previousPadVoicing = chordNotes;

    const duration = transport.beatToTime(4); // Full bar
    padSynth.triggerChord(chordNotes, time, duration, 0.6);

    // Update chord display
    updateChordDisplay(chord);
  }

  // Advance bar counter at the end of each bar
  if (step === STEPS_PER_BAR - 1) {
    const barDuration = transport.beatToTime(4);
    const sectionChanged = songStructure.advanceBar(time, barDuration);
    if (sectionChanged) {
      updateSectionDisplay();
    }
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
 * Update section display
 */
function updateSectionDisplay(): void {
  if (sectionDisplay) {
    const section = songStructure.getCurrentSection();
    sectionDisplay.textContent = section.charAt(0).toUpperCase() + section.slice(1);
  }
}

/**
 * Handle filter sweep at section transitions
 */
function handleFilterSweep(direction: 'up' | 'down', startTime: number, durationBars: number): void {
  const transport = getTransport();
  const duration = transport.beatToTime(durationBars * 4);
  const ctx = getContext();

  const startFreq = direction === 'up' ? 400 : 4000;
  const endFreq = direction === 'up' ? 4000 : 400;

  // Animate filter cutoff
  lowpassFilter.setCutoff(startFreq);
  // Schedule smooth transition
  const steps = 20;
  const stepDuration = duration / steps;

  for (let i = 0; i <= steps; i++) {
    const t = startTime + (i * stepDuration) - ctx.currentTime;
    if (t > 0) {
      setTimeout(() => {
        const progress = i / steps;
        const freq = startFreq + (endFreq - startFreq) * progress;
        lowpassFilter.setCutoff(freq);
      }, t * 1000);
    }
  }
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

    // Update URL
    updateUrlParams();
  });

  // BPM slider
  bpmSlider.addEventListener('input', () => {
    const bpm = parseInt(bpmSlider.value, 10);
    const transport = getTransport();
    transport.setBPM(bpm);
    bpmValue.textContent = String(bpm);
    updateUrlParams();
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

  // Melody volume and mute (if UI elements exist)
  if (melodyVolume) {
    melodyVolume.addEventListener('input', () => {
      if (!muteStates.melody) {
        const vol = parseInt(melodyVolume.value, 10) / 100;
        rhodesSynth.setLevel(vol);
      }
    });
  }

  if (melodyMute) {
    melodyMute.addEventListener('click', () => {
      muteStates.melody = !muteStates.melody;
      melodyMute.classList.toggle('muted', muteStates.melody);
      if (melodyVolume) {
        rhodesSynth.setLevel(muteStates.melody ? 0 : parseInt(melodyVolume.value, 10) / 100);
      }
    });
  }

  // Effect controls
  filterCutoff.addEventListener('input', () => {
    lowpassFilter.setCutoff(parseInt(filterCutoff.value, 10));
  });

  reverbWet.addEventListener('input', () => {
    reverb.setWetDry(parseInt(reverbWet.value, 10) / 100);
  });
}

/**
 * Initialize preset UI
 */
function initPresetUI(): void {
  if (!presetSelect) return;

  // Populate preset dropdown
  populatePresetSelect();

  // Preset select change handler
  presetSelect.addEventListener('change', () => {
    const presetName = presetSelect.value;
    if (presetName) {
      loadPreset(presetName);
    }
  });

  // Save preset button
  if (savePresetBtn) {
    savePresetBtn.addEventListener('click', () => {
      const name = prompt('Enter preset name:');
      if (name && name.trim()) {
        saveCurrentAsPreset(name.trim());
      }
    });
  }
}

/**
 * Populate preset select dropdown
 */
function populatePresetSelect(): void {
  if (!presetSelect) return;

  presetSelect.innerHTML = '<option value="">-- Select Preset --</option>';
  for (const name of presetManager.getPresetNames()) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    presetSelect.appendChild(option);
  }
}

/**
 * Load a preset by name
 */
function loadPreset(name: string): void {
  const preset = presetManager.getPreset(name);
  if (!preset) return;

  // Apply mood
  currentMood = preset.mood;
  moodSelect.value = preset.mood;
  chordGen.setMood(currentMood);

  // Apply BPM
  const transport = getTransport();
  transport.setBPM(preset.bpm);
  bpmSlider.value = String(preset.bpm);
  bpmValue.textContent = String(preset.bpm);

  // Apply filter and reverb
  lowpassFilter.setCutoff(preset.filterCutoff);
  reverb.setWetDry(preset.reverbWet);
  filterCutoff.value = String(preset.filterCutoff);
  reverbWet.value = String(preset.reverbWet * 100);

  // Apply volumes
  setMasterVolume(preset.volumes.master / 100);
  masterVolume.value = String(preset.volumes.master);

  setDrumsVolume(preset.volumes.drums / 100);
  drumsVolume.value = String(preset.volumes.drums);

  setBassVolume(preset.volumes.bass / 100);
  bassVolumeEl.value = String(preset.volumes.bass);

  setPadVolume(preset.volumes.pad / 100);
  padVolume.value = String(preset.volumes.pad);

  setAmbienceVolume(preset.volumes.ambience / 100);
  ambienceVolume.value = String(preset.volumes.ambience);

  if (melodyVolume) {
    rhodesSynth.setLevel(preset.volumes.melody / 100);
    melodyVolume.value = String(preset.volumes.melody);
  }

  // Apply tape settings
  tapeDegradation.setWowDepth(preset.tapeWow);
  tapeDegradation.setFlutterDepth(preset.tapeFlutter);

  // Apply pad stereo width
  padSynth.setStereoWidth(preset.padStereoWidth);

  // Track current preset
  presetManager.setCurrentPresetName(name);

  // Regenerate content for new mood
  generateNewContent();
  updateUrlParams();
}

/**
 * Save current settings as a preset
 */
function saveCurrentAsPreset(name: string): void {
  const transport = getTransport();

  const preset: Preset = {
    name,
    mood: currentMood,
    bpm: transport.getBPM(),
    filterCutoff: parseInt(filterCutoff.value, 10),
    reverbWet: parseInt(reverbWet.value, 10) / 100,
    volumes: {
      master: parseInt(masterVolume.value, 10),
      drums: parseInt(drumsVolume.value, 10),
      bass: parseInt(bassVolumeEl.value, 10),
      pad: parseInt(padVolume.value, 10),
      ambience: parseInt(ambienceVolume.value, 10),
      melody: melodyVolume ? parseInt(melodyVolume.value, 10) : 60
    },
    tapeWow: 5, // Default, could add UI controls for these
    tapeFlutter: 2,
    padStereoWidth: padSynth.getStereoWidth()
  };

  presetManager.savePreset(preset);
  populatePresetSelect();

  if (presetSelect) {
    presetSelect.value = name;
  }
}

/**
 * Parse URL parameters and apply them
 */
function applyUrlParams(): void {
  const params = new URLSearchParams(window.location.search);

  // Apply mood if valid
  const mood = params.get('mood');
  if (mood && ['chill', 'rainy', 'melancholic', 'upbeat'].includes(mood)) {
    currentMood = mood as MoodPreset;
    moodSelect.value = mood;
    chordGen.setMood(currentMood);

    // Update effects for mood
    const moodConfig = MOOD_CONFIGS[currentMood];
    lowpassFilter.setCutoff(moodConfig.filterCutoff);
    reverb.setWetDry(moodConfig.reverbWet);
    filterCutoff.value = String(moodConfig.filterCutoff);
    reverbWet.value = String(moodConfig.reverbWet * 100);
  }

  // Apply BPM if valid
  const bpmParam = params.get('bpm');
  if (bpmParam) {
    const bpm = parseInt(bpmParam, 10);
    if (bpm >= 60 && bpm <= 100) {
      const transport = getTransport();
      transport.setBPM(bpm);
      bpmSlider.value = String(bpm);
      bpmValue.textContent = String(bpm);
    }
  }
}

/**
 * Update URL with current settings (without reload)
 */
function updateUrlParams(): void {
  const transport = getTransport();
  const params = new URLSearchParams();
  params.set('mood', currentMood);
  params.set('bpm', String(transport.getBPM()));

  const newUrl = `${window.location.pathname}?${params.toString()}`;
  history.replaceState(null, '', newUrl);
}

/**
 * Bind keyboard shortcuts
 */
function bindKeyboardShortcuts(): void {
  document.addEventListener('keydown', (e) => {
    // Ignore if user is typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
      return;
    }

    switch (e.code) {
      case 'Space':
        e.preventDefault(); // Prevent page scroll
        togglePlay();
        break;
      case 'KeyR':
        toggleRecord();
        break;
      case 'KeyN':
        generateNewContent();
        break;
    }
  });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
