import { initPhysics, handleResize } from './engine/physics';
import { initTrapdoor } from './entities/trapdoor';
import { spawnInitialBlocks, createBlock } from './entities/blocks';
import { initConstraints, getTotalMass, breakTrapdoor } from './engine/constraints';
import { startDOMSync } from './ui/domSync';
import { PHYSICS_CONFIG } from './config/constants';
import { playCoinShowerSFX, playButtonClickSFX, toggleMute } from './audio/audioManager';

const WIN_MASS = PHYSICS_CONFIG.MASS.WIN_THRESHOLD;
let gameState: 'init' | 'playing' | 'win' = 'init';

function init() {
  const container = document.getElementById('game-container');
  const uiLayer = document.getElementById('ui-layer');
  if (!container || !uiLayer) return;

  initPhysics(container);
  initTrapdoor(container);
  spawnInitialBlocks(uiLayer, container.clientWidth);
  initConstraints();
  startDOMSync();

  gameState = 'playing';

  // Sound Mute Toggle
  const soundBtn = document.getElementById('btn-sound');
  if (soundBtn) {
    soundBtn.addEventListener('click', (e) => {
      e.stopPropagation();
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
    // Register skip handler for both click and pointerdown to ensure immediate response
    const handleSkip = (e: Event) => {
      e.stopPropagation();
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

    adsSkipBtn.addEventListener('click', handleSkip);
    adsSkipBtn.addEventListener('pointerdown', handleSkip);

    adsBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
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
    restartBtn.addEventListener('click', () => {
      playButtonClickSFX();
      window.location.reload();
    });
  }

  // ── Resize ──────────────────────────────────────────────────────────────────
  window.addEventListener('resize', () => handleResize(container));
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
