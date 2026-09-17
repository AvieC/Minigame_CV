import Matter from 'matter-js';
import { PHYSICS_CONFIG, GAME_CONFIG } from '../config/constants';
import { activeClickBody, setActiveClickBody } from '../entities/blocks';
import { playWoodImpactSFX } from '../audio/audioManager';

export const engine = Matter.Engine.create();
export const world = engine.world;
let runner: Matter.Runner;
export let mouseConstraint: Matter.MouseConstraint;

let floor: Matter.Body;
let leftWall: Matter.Body;
let rightWall: Matter.Body;

// Cache of non-static bodies for per-tick velocity capping.
// Avoids Matter.Composite.allBodies() traversal every frame.
const dynamicBodies: Matter.Body[] = [];

export function registerDynamicBody(body: Matter.Body): void {
  dynamicBodies.push(body);
}

export function initPhysics(container: HTMLElement) {
  runner = Matter.Runner.create();
  Matter.Runner.run(runner, engine);

  // Mouse interaction
  const mouse = Matter.Mouse.create(container);
  mouseConstraint = Matter.MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
      stiffness: PHYSICS_CONFIG.CONSTRAINTS.MOUSE_STIFFNESS,
      damping: PHYSICS_CONFIG.CONSTRAINTS.MOUSE_DAMPING,
      // @ts-ignore — angularStiffness exists in Matter.js but is missing from @types/matter-js
      angularStiffness: 0, // IMPORTANT: allows the block to swing freely when grabbed
      render: { visible: false }
    }
  });

  Matter.World.add(world, mouseConstraint);

  // Override Matter.js body selection — use DOM hit-test result for pixel-perfect Z-index accuracy
  Matter.Events.on(mouseConstraint, 'mousedown', (event) => {
    if (activeClickBody) {
      const targetBody = activeClickBody;
      const point = event.mouse.position;

      mouseConstraint.body = targetBody;
      mouseConstraint.constraint.bodyB = targetBody;
      mouseConstraint.constraint.pointA = { x: point.x, y: point.y };
      mouseConstraint.constraint.pointB = {
        x: point.x - targetBody.position.x,
        y: point.y - targetBody.position.y
      };
      (mouseConstraint.constraint as any).angleB = targetBody.angle;

      setActiveClickBody(null);
    }
  });

  // Add boundaries to prevent objects from escaping the container
  const width = container.clientWidth;
  const height = container.clientHeight;
  const thickness = 60;

  floor = Matter.Bodies.rectangle(width / 2, height + thickness / 2, width, thickness, { isStatic: true });
  leftWall = Matter.Bodies.rectangle(-thickness / 2, height / 2, thickness, height * 2, { isStatic: true });
  rightWall = Matter.Bodies.rectangle(width + thickness / 2, height / 2, thickness, height * 2, { isStatic: true });

  Matter.World.add(world, [floor, leftWall, rightWall]);

  // Cap velocity to prevent tunnelling through the 20px trapdoor
  const maxVelocity = 15; // Must be < trapdoor thickness (20px)
  Matter.Events.on(engine, 'beforeUpdate', () => {
    for (const body of dynamicBodies) {
      let vx = body.velocity.x;
      let vy = body.velocity.y;
      let modified = false;

      // Prevent CV/Ads blocks from flying above the trapdoor
      if (body.label === 'cv' || body.label === 'ads') {
        const minY = GAME_CONFIG.TRAPDOOR.Y_POS + 45;
        if (body.position.y < minY) {
          Matter.Body.setPosition(body, { x: body.position.x, y: minY });
          if (vy < 0) { vy = 0; modified = true; }
        }
      }

      if (vx > maxVelocity) { vx = maxVelocity; modified = true; }
      else if (vx < -maxVelocity) { vx = -maxVelocity; modified = true; }

      if (vy > maxVelocity) { vy = maxVelocity; modified = true; }
      else if (vy < -maxVelocity) { vy = -maxVelocity; modified = true; }

      if (modified) {
        Matter.Body.setVelocity(body, { x: vx, y: vy });
      }
    }
  });

  // Listen for collision impact sounds
  Matter.Events.on(engine, 'collisionStart', (event) => {
    try {
      for (const pair of event.pairs) {
        const { bodyA, bodyB } = pair;
        if (!bodyA || !bodyB) continue;
        if (bodyA.label === 'cv' || bodyB.label === 'cv' || bodyA.label === 'ads' || bodyB.label === 'ads') {
          const relVelX = (bodyA.velocity?.x || 0) - (bodyB.velocity?.x || 0);
          const relVelY = (bodyA.velocity?.y || 0) - (bodyB.velocity?.y || 0);
          const speed = Math.sqrt(relVelX * relVelX + relVelY * relVelY);
          if (speed > 2.5) {
            playWoodImpactSFX(speed);
          }
        }
      }
    } catch {}
  });

  return { engine, world, runner, mouseConstraint };
}

export function handleResize(container: HTMLElement) {
  const width = container.clientWidth;
  const height = container.clientHeight;
  const thickness = 60;

  if (floor) {
    Matter.Body.setPosition(floor, { x: width / 2, y: height + thickness / 2 });
  }
  if (rightWall) {
    Matter.Body.setPosition(rightWall, { x: width + thickness / 2, y: height / 2 });
  }
}
