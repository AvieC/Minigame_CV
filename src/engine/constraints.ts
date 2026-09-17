import Matter from 'matter-js';
import { world, mouseConstraint } from './physics';
import { updateBlockState, blocksMap } from '../entities/blocks';
import { leftDoorBody, rightDoorBody, trapdoorConfig, lockConstraint } from '../entities/trapdoor';
import { PHYSICS_CONFIG } from '../config/constants';
import { playHookSuccessSFX } from '../audio/audioManager';

const SNAP_RADIUS = PHYSICS_CONFIG.CONSTRAINTS.SNAP_RADIUS;
export const activeConstraints: Matter.Constraint[] = [];
let totalMassOnTrapdoor = 0;
let isBroken = false;

// We need a dynamic hook point on the trapdoor that moves as the door sags
export function getTrapdoorHookPoint() {
  // Shift left by 6px because the J-hook has a 4px right border and its resting center is slightly left of the edge
  const localX = trapdoorConfig.doorWidth / 2 - 10;
  const localY = trapdoorConfig.doorHeight / 2 + 12;

  // Transform local point to world coordinates using the body's angle and position
  return {
    x: leftDoorBody.position.x + localX * Math.cos(leftDoorBody.angle) - localY * Math.sin(leftDoorBody.angle),
    y: leftDoorBody.position.y + localX * Math.sin(leftDoorBody.angle) + localY * Math.cos(leftDoorBody.angle)
  };
}

export function getBlockTopHookPoint(body: Matter.Body) {
  // O-ring is top: -16px, height: 20px. The hole center/top is approx 12px above the top edge.
  const localY = body.plugin.height / 2 + 12;
  return {
    x: body.position.x + localY * Math.sin(body.angle),
    y: body.position.y - localY * Math.cos(body.angle)
  };
}

export function getBlockBottomHookPoint(body: Matter.Body) {
  // J-hook is bottom: -20px, height: 20px. The resting point is 12px below the bottom edge.
  const localY = body.plugin.height / 2 + 12;
  return {
    x: body.position.x - localY * Math.sin(body.angle),
    y: body.position.y + localY * Math.cos(body.angle)
  };
}

export function initConstraints() {
  if (isBroken) return;

  // Detach block when dragging starts
  Matter.Events.on(mouseConstraint, 'startdrag', (event) => {
    if (isBroken) return;
    const body = (event as any).body;
    if (!body || !blocksMap.has(body.plugin.id)) return;

    updateBlockState(body, 'dragging');
    detachBlock(body);
  });

  // Attempt to snap when dragging ends
  Matter.Events.on(mouseConstraint, 'enddrag', (event) => {
    if (isBroken) return;
    const body = (event as any).body;
    if (!body || !blocksMap.has(body.plugin.id)) return;

    const snapped = attemptSnap(body);
    if (!snapped) {
      updateBlockState(body, 'grounded');
    }
  });
}

function attemptSnap(block: Matter.Body): boolean {
  // If already hooked at top, ignore
  if (activeConstraints.some(c => c.bodyB === block && c.label === 'hook-top')) return true;

  const topHook = getBlockTopHookPoint(block);

  // 1. Check distance to Trapdoor Hook
  // Trapdoor hook can only hold ONE block chain. If occupied, skip trapdoor hook.
  const isTrapdoorOccupied = activeConstraints.some(c => c.bodyA === leftDoorBody && c.label === 'hook-top');
  if (!isTrapdoorOccupied) {
    const trapdoorHook = getTrapdoorHookPoint();
    if (Matter.Vector.magnitude(Matter.Vector.sub(topHook, trapdoorHook)) < SNAP_RADIUS) {
      hookToTrapdoor(block);
      return true;
    }
  }

  // 2. Check distance to other valid bodies (must be connected to trapdoor!)
  const validAnchors = getConnectedBodiesToTrapdoor();

  for (const anchor of validAnchors) {
    if (anchor === block || anchor === leftDoorBody || anchor === rightDoorBody) continue; // trapdoor doors are handled above

    // Cannot hook to something that doesn't have a bottom hook (like Ads weight)
    if (anchor.plugin && anchor.plugin.hasBottomHook === false) continue;

    // Each hook can only pair with ONE child block. If occupied, disable hook.
    const isAnchorOccupied = activeConstraints.some(c => c.bodyA === anchor && c.label === 'hook-top');
    if (isAnchorOccupied) continue;

    const bottomHook = getBlockBottomHookPoint(anchor);
    const distToBottom = Matter.Vector.magnitude(Matter.Vector.sub(topHook, bottomHook));
    if (distToBottom < SNAP_RADIUS) {
      hookBlocks(anchor, block);
      return true;
    }
  }
  return false;
}

function detachBlock(block: Matter.Body) {
  const oldConnected = getConnectedBodiesToTrapdoor();
  const constraintsToRemove = activeConstraints.filter(c => c.bodyB === block && c.label === 'hook-top');

  if (constraintsToRemove.length > 0) {
    Matter.World.remove(world, constraintsToRemove);

    // Remove from active array
    for (const c of constraintsToRemove) {
      const idx = activeConstraints.indexOf(c);
      if (idx > -1) activeConstraints.splice(idx, 1);
    }

    const newConnected = getConnectedBodiesToTrapdoor();

    // Set blocks that fell off to grounded
    oldConnected.forEach(b => {
      if (b !== leftDoorBody && b !== rightDoorBody && !newConnected.has(b) && b !== block) {
        updateBlockState(b, 'grounded');
      }
    });

    recalculateMass();
  }
}

function hookToTrapdoor(block: Matter.Body) {
  const constraint = Matter.Constraint.create({
    bodyA: leftDoorBody,
    pointA: {
      x: trapdoorConfig.doorWidth / 2 - 10,
      y: trapdoorConfig.doorHeight / 2 + 12
    },
    bodyB: block,
    pointB: { x: 0, y: -block.plugin.height / 2 - 12 }, // O-ring point
    length: 0, // 0 length means perfectly hooked together
    stiffness: PHYSICS_CONFIG.CONSTRAINTS.HOOK_STIFFNESS,
    damping: PHYSICS_CONFIG.CONSTRAINTS.HOOK_DAMPING,
    render: { type: 'line', strokeStyle: '#ffffff', lineWidth: 2 },
    label: 'hook-top'
  });

  Matter.World.add(world, constraint);
  activeConstraints.push(constraint);

  playHookSuccessSFX();

  // Anything now connected should be 'hooked'
  const newConnected = getConnectedBodiesToTrapdoor();
  newConnected.forEach(b => {
    if (b !== leftDoorBody && b !== rightDoorBody) updateBlockState(b, 'hooked');
  });

  recalculateMass();
}

function hookBlocks(topBlock: Matter.Body, bottomBlock: Matter.Body) {
  const constraint = Matter.Constraint.create({
    bodyA: topBlock,
    pointA: { x: 0, y: topBlock.plugin.height / 2 + 12 }, // J-hook point
    bodyB: bottomBlock,
    pointB: { x: 0, y: -bottomBlock.plugin.height / 2 - 12 }, // O-ring point
    length: 0, // Perfectly hooked
    stiffness: PHYSICS_CONFIG.CONSTRAINTS.HOOK_STIFFNESS,
    damping: PHYSICS_CONFIG.CONSTRAINTS.HOOK_DAMPING,
    render: { type: 'line', strokeStyle: '#ffffff', lineWidth: 2 },
    label: 'hook-top'
  });

  Matter.World.add(world, constraint);
  activeConstraints.push(constraint);

  playHookSuccessSFX();

  // Anything now connected should be 'hooked'
  const newConnected = getConnectedBodiesToTrapdoor();
  newConnected.forEach(b => {
    if (b !== leftDoorBody && b !== rightDoorBody) updateBlockState(b, 'hooked');
  });

  recalculateMass();
}

function getConnectedBodiesToTrapdoor(): Set<Matter.Body> {
  const connectedBodies = new Set<Matter.Body>();

  const explore = (body: Matter.Body) => {
    activeConstraints.forEach(c => {
      if (c.bodyA === body && c.bodyB && !connectedBodies.has(c.bodyB)) {
        connectedBodies.add(c.bodyB);
        explore(c.bodyB);
      }
    });
  };

  connectedBodies.add(leftDoorBody);
  connectedBodies.add(rightDoorBody);
  explore(leftDoorBody);
  explore(rightDoorBody);
  return connectedBodies;
}


export function recalculateMass() {
  const connectedBodies = getConnectedBodiesToTrapdoor();

  totalMassOnTrapdoor = 0;
  connectedBodies.forEach(b => {
    if (b !== leftDoorBody && b !== rightDoorBody) {
      totalMassOnTrapdoor += b.mass;
    }
  });

  // Custom Event for game loop
  const event = new CustomEvent('massUpdated', { detail: { mass: totalMassOnTrapdoor } });
  window.dispatchEvent(event);
}

export function breakTrapdoor() {
  if (isBroken) return;
  isBroken = true;
  // Remove the lock constraint holding the trapdoors together
  if (lockConstraint) {
    Matter.World.remove(world, lockConstraint);
  }
}

export function getTotalMass() {
  return totalMassOnTrapdoor;
}
