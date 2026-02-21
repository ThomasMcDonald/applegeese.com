/**
 * Combat system for Orchard Warfare.
 * Handles auto-attacking and unit death (removal when hp <= 0).
 *
 * Each unit must expose:
 *   { x, y, team, hp, attack, attackRange, attackCooldown, attackTimer, state, vx, vy }
 *
 * attackTimer tracks remaining seconds until the unit may attack again.
 * state is set to 'attacking' while a target is in range, otherwise left unchanged.
 */

/**
 * Updates combat for all units: finds nearest enemy in range, stops the unit,
 * deals damage on cooldown, then removes any unit whose hp has dropped to 0 or below.
 *
 * @param {Array<object>} units  Mutable array of unit objects (modified in place).
 * @param {number}        dt     Delta time in seconds since the last frame.
 */
export function updateCombat(units, dt) {
    for (const unit of units) {
        unit.attackTimer = (unit.attackTimer || 0) - dt;

        // Find the closest enemy unit within attack range (use squared distance to avoid sqrt)
        let nearestEnemy = null;
        let nearestDistSq = Infinity;
        const attackRangeSq = unit.attackRange * unit.attackRange;

        for (const other of units) {
            if (other.team === unit.team) continue;

            const dx = other.x - unit.x;
            const dy = other.y - unit.y;
            const distSq = dx * dx + dy * dy;

            if (distSq <= attackRangeSq && distSq < nearestDistSq) {
                nearestDistSq = distSq;
                nearestEnemy = other;
            }
        }

        if (nearestEnemy) {
            // Stop movement and switch to attacking state
            unit.state = 'attacking';
            unit.vx = 0;
            unit.vy = 0;

            // Deal damage once per cooldown period
            if (unit.attackTimer <= 0) {
                nearestEnemy.hp -= unit.attack;
                unit.attackTimer = unit.attackCooldown;
            }
        }
    }

    // Remove units that have been killed (hp <= 0)
    for (let i = units.length - 1; i >= 0; i--) {
        if (units[i].hp <= 0) {
            units.splice(i, 1);
        }
    }
}
