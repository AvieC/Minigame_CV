// Web Audio API Synthesizer (0 KB external asset dependency)

let audioCtx: AudioContext | null = null;
let isMutedState = false;

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
 * Ensures AudioContext is unlocked on first user gesture (browser autoplay compliance)
 */
export function unlockAudio() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume();
  }
}

// Automatically bind unlock handlers to common user interactions once
if (typeof window !== 'undefined') {
  const unlock = () => {
    unlockAudio();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
}

export function isMuted(): boolean {
  return isMutedState;
}

export function toggleMute(): boolean {
  isMutedState = !isMutedState;
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
