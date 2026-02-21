/**
 * Physics system for Orchard Warfare.
 * Handles circle-vs-circle separation steering so units never overlap.
 *
 * Each unit must expose: { x, y, radius }
 */

/**
 * Pushes overlapping unit pairs apart so their circles no longer intersect.
 * Adjusts unit.x and unit.y directly (no velocity involved).
 *
 * @param {Array<{x: number, y: number, radius: number}>} units
 */
export function applySeparation(units) {
    for (let i = 0; i < units.length; i++) {
        for (let j = i + 1; j < units.length; j++) {
            const a = units[i];
            const b = units[j];

            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const distSq = dx * dx + dy * dy;
            const minDist = a.radius + b.radius;

            if (distSq < minDist * minDist) {
                const dist = Math.sqrt(distSq) || 0.0001;
                const overlap = (minDist - dist) / 2;
                const nx = dx / dist;
                const ny = dy / dist;

                // Push each unit away by half the overlap
                a.x -= nx * overlap;
                a.y -= ny * overlap;
                b.x += nx * overlap;
                b.y += ny * overlap;
            }
        }
    }
}
