import { initPhysics, handleResize } from './engine/physics';
import { initTrapdoor } from './entities/trapdoor';
import { spawnInitialBlocks, createBlock } from './entities/blocks';
import { initConstraints, getTotalMass, breakTrapdoor } from './engine/constraints';
import { startDOMSync } from './ui/domSync';
import { PHYSICS_CONFIG } from './config/constants';
import { playCoinShowerSFX, playButtonClickSFX, toggleMute } from './audio/audioManager';

const WIN_MASS = PHYSICS_CONFIG.MASS.WIN_THRESHOLD;
let gameState: 'init' | 'playing' | 'win' = 'init';

// ── Viewport Height Fix (Chrome Android URL bar bug) ─────────────────────────
// `100vh` on mobile Chrome includes the browser UI (URL bar + nav bar), making
// the game taller than the visible area. `100dvh` fixes this in Chrome 108+.
// For older browsers we polyfill via a CSS custom property --app-h from window.innerHeight.
function applyViewportHeight() {
  const dvhSupported = CSS.supports('height', '1dvh');
  if (!dvhSupported) {
    const vh = window.innerHeight;
    document.documentElement.style.setProperty('--app-h', `${vh}px`);
    document.body.style.height = `${vh}px`;
    const container = document.getElementById('game-container');
    if (container) container.style.height = `${vh}px`;
  }
}

applyViewportHeight();

function init() {
  const container = document.getElementById('game-container');
  const uiLayer = document.getElementById('ui-layer');
  if (!container || !uiLayer) return;

  initPhysics(container);
  initTrapdoor(container);
  spawnInitialBlocks(uiLayer, container.clientWidth, container.clientHeight);
  initConstraints();
  startDOMSync();

  gameState = 'playing';

  // Helper for cross-platform mobile touch & mouse button handling
  const bindButton = (btn: HTMLElement, callback: (e: Event) => void) => {
    let triggered = false;
    const handler = (e: Event) => {
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
      if (triggered) return;
      triggered = true;
      callback(e);
      setTimeout(() => { triggered = false; }, 300);
    };

    btn.addEventListener('pointerdown', handler);
    btn.addEventListener('touchstart', handler, { passive: false });
    btn.addEventListener('click', handler);
  };

  // Sound Mute Toggle
  const soundBtn = document.getElementById('btn-sound');
  if (soundBtn) {
    bindButton(soundBtn, () => {
      const muted = toggleMute();
      soundBtn.textContent = muted ? '🔇' : '🔊';
      playButtonClickSFX();
    });
  }

  // Cache progress bar elements once — massUpdated fires on every hook/unhook, not every frame
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');

  window.addEventListener('massUpdated', (e: any) => {
    if (gameState !== 'playing') return;
    const mass = e.detail.mass;
    const progressPercent = Math.min((mass / WIN_MASS) * 100, 100);
    if (progressBar) progressBar.style.height = `${progressPercent}%`;
    if (progressText) progressText.textContent = `${Math.round(mass)} / ${WIN_MASS} kg`;
    if (mass >= WIN_MASS) checkWinCondition();
  });

  // ── Ads Button ──────────────────────────────────────────────────────────────
  const adsBtn = document.getElementById('btn-ads');
  const adsPopup = document.getElementById('ads-popup');
  const adsSkipBtn = document.getElementById('ads-skip-btn') as HTMLButtonElement;
  const adsCountdown = document.getElementById('ads-countdown');
  const adsProgressBar = document.getElementById('ads-progress-bar') as HTMLElement;

  let adsUsed = false;
  let adsTimerRunning = false;

  if (adsBtn && adsPopup && adsSkipBtn) {
    const handleSkip = () => {
      if (adsSkipBtn.disabled) return;
      playButtonClickSFX();
      adsUsed = true;
      adsPopup.classList.add('hidden');
      adsPopup.classList.remove('flex');

      createBlock({
        id: `block-ads-${Date.now()}`,
        x: container.clientWidth / 2,
        y: -100,
        width: 120,
        height: 120,
        mass: PHYSICS_CONFIG.MASS.ADS_WEIGHT,
        title: 'Ads',
        content: `${PHYSICS_CONFIG.MASS.ADS_WEIGHT}kg`,
        hasBottomHook: false,
        type: 'ads'
      }, uiLayer);
    };

    bindButton(adsSkipBtn, handleSkip);

    bindButton(adsBtn, () => {
      if (adsUsed || adsTimerRunning) return;
      playButtonClickSFX();
      adsTimerRunning = true;

      adsPopup.classList.remove('hidden');
      adsPopup.classList.add('flex');
      adsBtn.classList.add('hidden');

      const DURATION = 5000;
      const startTime = performance.now();
      let secondsLeft = 5;

      function drainBar(now: number) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / DURATION, 1);
        if (adsProgressBar) {
          adsProgressBar.style.width = `${(1 - progress) * 100}%`;
        }

        const newSecondsLeft = Math.ceil((DURATION - elapsed) / 1000);
        if (newSecondsLeft !== secondsLeft && newSecondsLeft >= 0) {
          secondsLeft = newSecondsLeft;
          if (adsCountdown) adsCountdown.textContent = String(secondsLeft);
        }

        if (progress < 1) {
          requestAnimationFrame(drainBar);
        } else {
          // Countdown done — unlock skip
          adsSkipBtn.disabled = false;
          adsSkipBtn.classList.remove('text-white/40', 'cursor-not-allowed', 'border-white/20');
          adsSkipBtn.classList.add('text-white', 'cursor-pointer', 'border-white/60', 'hover:bg-white/30');
          if (adsCountdown) adsCountdown.textContent = '';
          adsSkipBtn.innerHTML = 'Bỏ qua &nbsp;⏭';
        }
      }
      requestAnimationFrame(drainBar);
    });
  }

  // ── Restart Button ──────────────────────────────────────────────────────────
  const restartBtn = document.getElementById('btn-restart');
  if (restartBtn) {
    bindButton(restartBtn, () => {
      playButtonClickSFX();
      window.location.reload();
    });
  }

  // ── Resize & Orientation Change ─────────────────────────────────────────────
  window.addEventListener('resize', () => handleResize(container));

  // On mobile, when the device rotates, the physics world layout (trapdoor
  // positions, block spawn coords) becomes stale. A full reload is the simplest
  // safe reset. We debounce to avoid firing during normal browser resize.
  let orientationReloadTimer: ReturnType<typeof setTimeout> | null = null;
  const maybeReload = () => {
    if (orientationReloadTimer) clearTimeout(orientationReloadTimer);
    orientationReloadTimer = setTimeout(() => {
      if (gameState !== 'win') window.location.reload();
    }, 400);
  };
  window.addEventListener('orientationchange', maybeReload);
}

function checkWinCondition() {
  // Debounce: wait 1s for physics to settle before confirming win
  setTimeout(() => {
    if (gameState !== 'playing' || getTotalMass() < WIN_MASS) return;

    gameState = 'win';
    breakTrapdoor();
    playCoinShowerSFX();

    // Brief delay so the player watches the gold rain before banner appears
    setTimeout(() => {
      const chibi = document.getElementById('chibi');
      if (chibi) chibi.className = 'chibi celebration';

      const banner = document.getElementById('win-banner');
      if (banner) banner.classList.remove('hidden');
    }, 1500);
  }, 1000);
}

window.onload = init;
