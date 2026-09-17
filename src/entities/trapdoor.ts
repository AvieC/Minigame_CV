import Matter from 'matter-js';
import { world, registerDynamicBody } from '../engine/physics';
import { GAME_CONFIG, PHYSICS_CONFIG } from '../config/constants';
import { registerEl } from '../ui/elementCache';

export let leftDoorBody: Matter.Body;
export let rightDoorBody: Matter.Body;
export let lockConstraint: Matter.Constraint;
export const goldPieces: Matter.Body[] = [];

export const trapdoorConfig = {
  doorWidth: 0,
  doorHeight: 20
};

export function initTrapdoor(container: HTMLElement) {
  const containerWidth = container.clientWidth;
  const doorWidth = containerWidth * GAME_CONFIG.TRAPDOOR.DOOR_WIDTH_RATIO;
  const doorHeight = GAME_CONFIG.TRAPDOOR.DOOR_HEIGHT;
  const trapdoorY = GAME_CONFIG.TRAPDOOR.Y_POS;
  const centerX = containerWidth / 2;

  trapdoorConfig.doorWidth = doorWidth;
  trapdoorConfig.doorHeight = doorHeight;

  // Size and cache the trapdoor DOM elements
  const leftEl = document.getElementById('trapdoor-left');
  const rightEl = document.getElementById('trapdoor-right');

  if (leftEl) {
    leftEl.style.width = `${doorWidth}px`;
    leftEl.style.height = `${doorHeight}px`;
    registerEl('trapdoor-left', leftEl);
  }
  if (rightEl) {
    rightEl.style.width = `${doorWidth}px`;
    rightEl.style.height = `${doorHeight}px`;
    registerEl('trapdoor-right', rightEl);
  }

  // Left Door
  leftDoorBody = Matter.Bodies.rectangle(centerX - doorWidth / 2, trapdoorY, doorWidth, doorHeight, {
    frictionAir: PHYSICS_CONFIG.FRICTION.TRAPDOOR_AIR,
    collisionFilter: {
      group: -2,
      category: PHYSICS_CONFIG.COLLISION.CATEGORY_TRAPDOOR,
      mask: PHYSICS_CONFIG.COLLISION.CATEGORY_WALL | PHYSICS_CONFIG.COLLISION.CATEGORY_BLOCK | PHYSICS_CONFIG.COLLISION.CATEGORY_GOLD
    },
    label: 'trapdoor-left',
    plugin: { width: doorWidth, height: doorHeight }
  });
  Matter.Body.setMass(leftDoorBody, PHYSICS_CONFIG.MASS.TRAPDOOR_DOOR);

  // Right Door
  rightDoorBody = Matter.Bodies.rectangle(centerX + doorWidth / 2, trapdoorY, doorWidth, doorHeight, {
    frictionAir: PHYSICS_CONFIG.FRICTION.TRAPDOOR_AIR,
    collisionFilter: {
      group: -2,
      category: PHYSICS_CONFIG.COLLISION.CATEGORY_TRAPDOOR,
      mask: PHYSICS_CONFIG.COLLISION.CATEGORY_WALL | PHYSICS_CONFIG.COLLISION.CATEGORY_BLOCK | PHYSICS_CONFIG.COLLISION.CATEGORY_GOLD
    },
    label: 'trapdoor-right',
    plugin: { width: doorWidth, height: doorHeight }
  });
  Matter.Body.setMass(rightDoorBody, PHYSICS_CONFIG.MASS.TRAPDOOR_DOOR);

  Matter.World.add(world, [leftDoorBody, rightDoorBody]);
  registerDynamicBody(leftDoorBody);
  registerDynamicBody(rightDoorBody);

  // Left Hinge — anchored to world
  const leftAnchor = Matter.Constraint.create({
    pointA: { x: centerX - doorWidth, y: trapdoorY },
    bodyB: leftDoorBody,
    pointB: { x: -doorWidth / 2, y: 0 },
    stiffness: PHYSICS_CONFIG.CONSTRAINTS.HINGE_STIFFNESS,
    length: PHYSICS_CONFIG.CONSTRAINTS.HINGE_LENGTH
  });

  // Right Hinge — anchored to world
  const rightAnchor = Matter.Constraint.create({
    pointA: { x: centerX + doorWidth, y: trapdoorY },
    bodyB: rightDoorBody,
    pointB: { x: doorWidth / 2, y: 0 },
    stiffness: PHYSICS_CONFIG.CONSTRAINTS.HINGE_STIFFNESS,
    length: PHYSICS_CONFIG.CONSTRAINTS.HINGE_LENGTH
  });

  // Center Lock — holds both doors flat until win condition breaks it
  lockConstraint = Matter.Constraint.create({
    bodyA: leftDoorBody,
    pointA: { x: doorWidth / 2, y: 0 },
    bodyB: rightDoorBody,
    pointB: { x: -doorWidth / 2, y: 0 },
    stiffness: PHYSICS_CONFIG.CONSTRAINTS.HINGE_STIFFNESS,
    length: PHYSICS_CONFIG.CONSTRAINTS.HINGE_LENGTH
  });

  Matter.World.add(world, [leftAnchor, rightAnchor, lockConstraint]);

  createGoldPile(centerX, trapdoorY - 30);
}

function createGoldPile(x: number, y: number) {
  const goldContainer = document.getElementById('gold-container');
  if (!goldContainer) return;

  const numPieces = GAME_CONFIG.TRAPDOOR.GOLD_COUNT;
  for (let i = 0; i < numPieces; i++) {
    const px = x + (Math.random() - 0.5) * 120;
    const py = y - (Math.random() * 120);
    const height = 48 + Math.random() * 16;
    const width = height * 0.75;

    // Physics body is 75% of visual size for better collision feel
    const bodyWidth = width * 0.75;
    const bodyHeight = height * 0.75;

    const gold = Matter.Bodies.rectangle(px, py, bodyWidth, bodyHeight, {
      chamfer: { radius: bodyWidth / 2 },
      restitution: PHYSICS_CONFIG.RESTITUTION.GOLD,
      friction: PHYSICS_CONFIG.FRICTION.GOLD,
      frictionAir: PHYSICS_CONFIG.FRICTION.GOLD_AIR,
      collisionFilter: {
        category: PHYSICS_CONFIG.COLLISION.CATEGORY_GOLD,
        mask: PHYSICS_CONFIG.COLLISION.CATEGORY_WALL | PHYSICS_CONFIG.COLLISION.CATEGORY_TRAPDOOR | PHYSICS_CONFIG.COLLISION.CATEGORY_GOLD
      },
      label: 'gold',
      plugin: { id: `gold-${i}`, width, height }
    });
    Matter.Body.setMass(gold, PHYSICS_CONFIG.MASS.GOLD_PIECE);

    goldPieces.push(gold);
    registerDynamicBody(gold);

    const el = document.createElement('div');
    el.id = `gold-${i}`;
    el.className = 'gold-coin absolute z-0 pointer-events-none select-none';
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    goldContainer.appendChild(el);
    registerEl(`gold-${i}`, el); // Cache for per-frame DOM sync
  }

  Matter.World.add(world, goldPieces);
}
