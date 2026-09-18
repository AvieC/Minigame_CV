// Web Audio API Synthesizer (0 KB external asset dependency)

let audioCtx: AudioContext | null = null;
let isMutedState = false;

/**
 * 8-Bit BGM Melody extracted from Hoa_Ca.mid (33 notes)
 * Each note format: [frequencyInHz, startTimeInSeconds, durationInSeconds]
 */
const HOA_CA_MELODY: [number, number, number][] = [
  [220.0, 0.0, 0.75],     // Note 57 (A3)
  [233.08, 0.75, 0.75],   // Note 58 (A#3)
  [261.63, 1.5, 0.75],    // Note 60 (C4)
  [220.0, 2.25, 1.0],     // Note 57 (A3)
  [196.0, 3.25, 0.125],   // Note 55 (G3)
  [174.61, 3.375, 0.188], // Note 53 (F3)
  [196.0, 3.562, 1.188],  // Note 55 (G3)
  [220.0, 5.5, 0.75],     // Note 57 (A3)
  [233.08, 6.25, 0.75],   // Note 58 (A#3)
  [261.63, 7.0, 0.75],    // Note 60 (C4)
  [220.0, 7.75, 1.0],     // Note 57 (A3)
  [233.08, 8.75, 0.125],  // Note 58 (A#3)
  [220.0, 8.875, 0.188],  // Note 57 (A3)
  [196.0, 9.062, 1.125],  // Note 55 (G3)
  [220.0, 11.0, 0.75],    // Note 57 (A3)
  [233.08, 11.75, 0.75],  // Note 58 (A#3)
  [261.63, 12.5, 0.75],   // Note 60 (C4)
  [220.0, 13.25, 1.0],    // Note 57 (A3)
  [196.0, 14.25, 0.125],  // Note 55 (G3)
  [174.61, 14.375, 0.188], // Note 53 (F3)
  [196.0, 14.562, 1.188], // Note 55 (G3)
  [220.0, 16.5, 0.75],    // Note 57 (A3)
  [233.08, 17.25, 0.75],  // Note 58 (A#3)
  [261.63, 18.0, 0.75],   // Note 60 (C4)
  [220.0, 18.75, 1.0],    // Note 57 (A3)
  [233.08, 19.75, 0.125], // Note 58 (A#3)
  [220.0, 19.875, 0.188], // Note 57 (A3)
  [196.0, 20.062, 0.438], // Note 55 (G3)
  [174.61, 20.5, 0.125],  // Note 53 (F3)
  [174.61, 20.688, 0.125], // Note 53 (F3)
  [164.81, 20.875, 0.125], // Note 52 (E3)
  [174.61, 21.062, 0.25], // Note 53 (F3)
  [146.83, 21.375, 0.25], // Note 50 (D3)
];

const BGM_LOOP_DURATION = 22.0; // Seconds per loop

let activeBgmNodes: { osc: OscillatorNode; gain: GainNode }[] = [];
let bgmTimeoutId: any = null;
let isBgmPlaying = false;

function getAudioContext(): AudioContext | null {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Stop current BGM loop and cancel future notes
 */
export function stopBGM() {
  isBgmPlaying = false;
  if (bgmTimeoutId !== null) {
    clearTimeout(bgmTimeoutId);
    bgmTimeoutId = null;
  }
  activeBgmNodes.forEach(({ osc, gain }) => {
    try {
      osc.stop();
      osc.disconnect();
      gain.disconnect();
    } catch {}
  });
  activeBgmNodes = [];
}

/**
 * Start playing 8-Bit BGM (Hoa_Ca) on loop
 */
export function startBGM() {
  if (isMutedState || isBgmPlaying) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  isBgmPlaying = true;
  scheduleBgmLoop(ctx);
}

function scheduleBgmLoop(ctx: AudioContext) {
  if (!isBgmPlaying || isMutedState) return;

  const now = ctx.currentTime;
  activeBgmNodes = [];

  // Lowpass filter for warm retro 8-bit sound
  const bgmFilter = ctx.createBiquadFilter();
  bgmFilter.type = 'lowpass';
  bgmFilter.frequency.setValueAtTime(1400, now);
  bgmFilter.connect(ctx.destination);

  HOA_CA_MELODY.forEach(([freq, startTime, duration]) => {
    const noteTime = now + startTime;

    // Lead Square Oscillator (Retro 8-bit sound)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, noteTime);

    // Subtle 8-bit envelope
    const baseGain = 0.07; // Soft background volume
    gain.gain.setValueAtTime(0, noteTime);
    gain.gain.linearRampToValueAtTime(baseGain, noteTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, noteTime + duration - 0.01);

    osc.connect(gain);
    gain.connect(bgmFilter);

    osc.start(noteTime);
    osc.stop(noteTime + duration);

    activeBgmNodes.push({ osc, gain });
  });

  // Schedule next loop
  bgmTimeoutId = setTimeout(() => {
    if (isBgmPlaying && !isMutedState) {
      scheduleBgmLoop(ctx);
    }
  }, BGM_LOOP_DURATION * 1000);
}

/**
 * Ensures AudioContext is unlocked on first user gesture (browser autoplay compliance)
 */
export function unlockAudio() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume();
  }
  if (!isMutedState && !isBgmPlaying) {
    startBGM();
  }
}

// Automatically bind unlock handlers to common user interactions once
if (typeof window !== 'undefined') {
  const unlock = () => {
    unlockAudio();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('touchstart', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('touchstart', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
}

export function isMuted(): boolean {
  return isMutedState;
}

export function toggleMute(): boolean {
  isMutedState = !isMutedState;
  if (isMutedState) {
    stopBGM();
  } else {
    startBGM();
  }
  return isMutedState;
}

/**
 * SFX 1: Hook Snap (Clink-Ring!)
 * Metallic click + bright 2-note chime ring when a block hooks to J or another block
 */
export function playHookSuccessSFX() {
  try {
    if (isMutedState) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Metallic Snap (Fast pitch drop square/triangle)
    const snapOsc = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snapOsc.type = 'triangle';
    snapOsc.frequency.setValueAtTime(900, now);
    snapOsc.frequency.exponentialRampToValueAtTime(200, now + 0.05);

    snapGain.gain.setValueAtTime(0.3, now);
    snapGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

    snapOsc.connect(snapGain);
    snapGain.connect(ctx.destination);

    snapOsc.start(now);
    snapOsc.stop(now + 0.05);

    // 2. Bright Metallic Ring (Dual sine note: E6 1318Hz -> B6 1975Hz)
    const ring1 = ctx.createOscillator();
    const ring2 = ctx.createOscillator();
    const ringGain = ctx.createGain();

    ring1.type = 'sine';
    ring2.type = 'sine';

    ring1.frequency.setValueAtTime(1318.51, now + 0.03); // E6
    ring2.frequency.setValueAtTime(1975.53, now + 0.03); // B6

    ringGain.gain.setValueAtTime(0.01, now);
    ringGain.gain.setValueAtTime(0.25, now + 0.03);
    ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    ring1.connect(ringGain);
    ring2.connect(ringGain);
    ringGain.connect(ctx.destination);

    ring1.start(now + 0.03);
    ring2.start(now + 0.03);
    ring1.stop(now + 0.35);
    ring2.stop(now + 0.35);
  } catch {}
}

/**
 * SFX 2: Wood Impact (Thud!)
 * Deep pitch-drop wooden thud scaled with drop velocity
 */
export function playWoodImpactSFX(velocity: number = 5) {
  try {
    if (isMutedState) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    // Scale volume and pitch by velocity (clamped 0.1 to 1.0)
    const intensity = Math.min(Math.max(velocity / 12, 0.15), 1.0);
    const now = ctx.currentTime;

    // 1. Thud Pitch Drop (Triangle wave 180Hz -> 45Hz)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160 + intensity * 60, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);

    gain.gain.setValueAtTime(0.35 * intensity, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);

    // 2. Low-pass filtered noise bump for wood body resonance
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.2 * intensity, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    // Simple noise generator
    const bufferSize = ctx.sampleRate * 0.08;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    noise.start(now);
  } catch {}
}

/**
 * SFX 3: Coin Shower
 * Rapid sequence of 10 coin clinks when victory/gold rain occurs
 */
export function playCoinShowerSFX() {
  try {
    if (isMutedState) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const baseFrequencies = [2637, 2960, 3135, 3520, 3951, 4186, 2793, 3322, 3729, 4400];
    const now = ctx.currentTime;

    for (let i = 0; i < 10; i++) {
      const timeOffset = now + i * 0.07 + Math.random() * 0.03;
      const freq = baseFrequencies[i % baseFrequencies.length];

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, timeOffset);

      gain.gain.setValueAtTime(0.18, timeOffset);
      gain.gain.exponentialRampToValueAtTime(0.001, timeOffset + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(timeOffset);
      osc.stop(timeOffset + 0.09);
    }
  } catch {}
}

/**
 * SFX 4: Button Click (Retro 8-bit Pop)
 */
export function playButtonClickSFX() {
  try {
    if (isMutedState) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(350, now);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.04);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  } catch {}
}
