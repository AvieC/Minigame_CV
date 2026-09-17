import Matter from 'matter-js';
import { engine } from '../engine/physics';
import { blocksMap } from '../entities/blocks';
import { leftDoorBody, rightDoorBody, goldPieces } from '../entities/trapdoor';
import { getEl } from './elementCache';

export function startDOMSync() {
  Matter.Events.on(engine, 'afterUpdate', () => {
    // Sync Blocks
    blocksMap.forEach((body, id) => {
      const el = getEl(id);
      if (el) {
        const { x, y } = body.position;
        const angle = body.angle;
        const width = body.plugin?.width || (body.bounds.max.x - body.bounds.min.x);
        const height = body.plugin?.height || (body.bounds.max.y - body.bounds.min.y);
        el.style.transform = `translate(${x - width / 2}px, ${y - height / 2}px) rotate(${angle}rad)`;
      }
    });

    // Sync Trapdoor
    const leftEl = getEl('trapdoor-left');
    const rightEl = getEl('trapdoor-right');

    if (leftEl && leftDoorBody) {
      const { x, y } = leftDoorBody.position;
      const w = leftDoorBody.plugin?.width || 140;
      const h = leftDoorBody.plugin?.height || 20;
      leftEl.style.transform = `translate(${x - w / 2}px, ${y - h / 2}px) rotate(${leftDoorBody.angle}rad)`;
    }

    if (rightEl && rightDoorBody) {
      const { x, y } = rightDoorBody.position;
      const w = rightDoorBody.plugin?.width || 140;
      const h = rightDoorBody.plugin?.height || 20;
      rightEl.style.transform = `translate(${x - w / 2}px, ${y - h / 2}px) rotate(${rightDoorBody.angle}rad)`;
    }

    // Sync Gold Pieces
    goldPieces.forEach(gold => {
      const el = getEl(gold.plugin.id);
      if (el) {
        const { x, y } = gold.position;
        const w = gold.plugin.width || 36;
        const h = gold.plugin.height || 48;
        el.style.transform = `translate(${x - w / 2}px, ${y - h / 2}px) rotate(${gold.angle}rad)`;
      }
    });
  });
}
