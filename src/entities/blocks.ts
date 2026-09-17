import Matter from 'matter-js';
import { world, registerDynamicBody } from '../engine/physics';
import { PHYSICS_CONFIG } from '../config/constants';
import { registerEl } from '../ui/elementCache';

export interface BlockConfig {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  mass: number;
  title: string;
  content: string;
  hasBottomHook: boolean;
  type: 'cv' | 'ads';
}

export const blocksMap = new Map<string, Matter.Body>();
const blockStack: string[] = []; // Tracks display order for z-index management
export let activeClickBody: Matter.Body | null = null;

export function setActiveClickBody(body: Matter.Body | null) {
  activeClickBody = body;
}

export function createBlock(config: BlockConfig, uiContainer: HTMLElement) {
  // Create Physics Body
  const body = Matter.Bodies.rectangle(config.x, config.y, config.width, config.height, {
    friction: PHYSICS_CONFIG.FRICTION.BLOCK,
    frictionAir: PHYSICS_CONFIG.FRICTION.BLOCK_AIR,
    restitution: PHYSICS_CONFIG.RESTITUTION.BLOCK,
    collisionFilter: {
      group: -1,
      category: PHYSICS_CONFIG.COLLISION.CATEGORY_BLOCK,
      mask: PHYSICS_CONFIG.COLLISION.CATEGORY_WALL | PHYSICS_CONFIG.COLLISION.CATEGORY_TRAPDOOR
    },
    label: config.type,
    plugin: {
      id: config.id,
      hasBottomHook: config.hasBottomHook,
      state: 'grounded',
      width: config.width,
      height: config.height,
      zIndex: 10
    }
  });

  Matter.Body.setMass(body, config.mass);

  // Create UI Element
  const el = document.createElement('div');
  el.id = config.id;

  blockStack.push(config.id);
  const initialZ = 10 + blockStack.indexOf(config.id);
  el.style.zIndex = initialZ.toString();
  body.plugin.zIndex = initialZ;

  if (config.type === 'cv') {
    el.className = 'cv-block state-grounded flex flex-col justify-center items-center pointer-events-auto relative';
    el.style.width = `${config.width}px`;
    el.style.height = `${config.height}px`;
    el.innerHTML = `
      <div class="hook-top" id="${config.id}-hook-top"></div>
      ${config.hasBottomHook ? `<div class="hook-bottom" id="${config.id}-hook-bottom"></div>` : ''}
      <h3 class="pixel-title text-center px-2">${config.title}</h3>
      <p class="pixel-desc text-center px-2 mt-1">${config.content}</p>
      <div class="block-weight-badge">${config.mass}kg</div>
    `;
  } else if (config.type === 'ads') {
    el.className = 'ads-weight pointer-events-auto relative';
    el.style.width = `${config.width}px`;
    el.style.height = `${config.height}px`;
    el.innerHTML = `
      <div class="hook-top" id="${config.id}-hook-top"></div>
      <span class="pixel-title text-center" style="font-size: 22px;">50kg</span>
    `;
  }

  // Use DOM pointerdown for pixel-perfect hit detection respecting Z-index
  const setTarget = () => { setActiveClickBody(body); };
  el.addEventListener('mousedown', setTarget);
  el.addEventListener('touchstart', setTarget, { passive: true });

  uiContainer.appendChild(el);
  registerEl(config.id, el); // Cache for per-frame DOM sync

  Matter.World.add(world, body);
  registerDynamicBody(body); // Cache for per-frame velocity capping

  blocksMap.set(config.id, body);
  return { body, el };
}

export function spawnInitialBlocks(uiContainer: HTMLElement, containerWidth: number) {
  const blockWidth = Math.round(containerWidth * 0.54);
  const blockHeight = 110;

  // Spawn order determines visual stacking (later = higher z-index)
  createBlock({
    id: 'block-skills',
    x: containerWidth * 0.6, y: 600, width: blockWidth, height: blockHeight, mass: PHYSICS_CONFIG.MASS.BLOCK_SKILLS,
    title: 'Kỹ năng', content: 'JS/TS, HTML5 Canvas, Matter.js, OOP',
    hasBottomHook: true, type: 'cv'
  }, uiContainer);

  createBlock({
    id: 'block-edu',
    x: containerWidth * 0.4, y: 450, width: blockWidth, height: blockHeight, mass: PHYSICS_CONFIG.MASS.BLOCK_EDU,
    title: 'Học vấn', content: 'CNTT UET (2021-2026) | CPA 3.03 | N3',
    hasBottomHook: true, type: 'cv'
  }, uiContainer);

  createBlock({
    id: 'block-personal',
    x: containerWidth * 0.5, y: 300, width: blockWidth, height: blockHeight, mass: PHYSICS_CONFIG.MASS.BLOCK_PERSONAL,
    title: 'Lã Việt Cường', content: 'Developer | 2003 | Hà Nội',
    hasBottomHook: true, type: 'cv'
  }, uiContainer);
}

export function updateBlockState(body: Matter.Body, state: 'grounded' | 'dragging' | 'hooked') {
  if (!body.plugin || !body.plugin.id) return;
  body.plugin.state = state;

  const el = document.getElementById(body.plugin.id);
  if (el && (body.label === 'cv' || body.label === 'ads')) {
    el.classList.remove('state-grounded', 'state-dragging', 'state-hooked');
    el.classList.add(`state-${state}`);

    if (state === 'dragging') {
      // Hide tutorial on first drag
      const hint = document.getElementById('tutorial-hint');
      if (hint) hint.style.display = 'none';

      // Guard against ghost multi-touch: ensure only one block is dragging at a time
      blocksMap.forEach((b) => {
        if (b !== body && b.plugin?.state === 'dragging') {
          b.plugin.state = 'grounded';
          const bEl = document.getElementById(b.plugin.id);
          if (bEl) {
            bEl.classList.remove('state-dragging');
            bEl.classList.add('state-grounded');
          }
        }
      });

      el.style.zIndex = '100';
      body.plugin.zIndex = 100;
    } else {
      // On release, move this block to the back of the stack (lowest z among non-dragging)
      const idx = blockStack.indexOf(body.plugin.id);
      if (idx !== -1) {
        blockStack.splice(idx, 1);
        blockStack.unshift(body.plugin.id);
      }

      // Re-assign z-indexes starting from 10 to keep values stable and positive
      blockStack.forEach((id, index) => {
        const blockEl = document.getElementById(id);
        const blockBody = blocksMap.get(id);
        const z = 10 + index;
        if (blockEl && blockBody && blockBody.plugin.state !== 'dragging') {
          blockEl.style.zIndex = z.toString();
          blockBody.plugin.zIndex = z;
        }
      });
    }
  }
}
