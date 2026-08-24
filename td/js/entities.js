"use strict";

class Tower {
    constructor(c, r, type) {
        this.c = c;
        this.r = r;
        this.type = type;
        this.def = TOWER_DEFS[type];
        this.x = (c + 0.5) * TILE_SIZE;
        this.y = (r + 0.5) * TILE_SIZE;
        this.cooldown = 0;
        this.id = `tower-${c}-${r}-${Math.random().toString(36).slice(2, 8)}`;
        const b = typeof meta !== "undefined" ? meta.bonuses() : null;
        this.metaRangeBonus = b ? b.rangeBonus : 0;
        this.metaDamageMult = b ? b.damageMult : 1;
        this.metaFireRateMult = b ? b.fireRateMult : 1;
    }

    get rangePx() {
        return (this.def.range + this.metaRangeBonus) * TILE_SIZE;
    }

    sellValue(refundRate) {
        return Math.floor(this.def.cost * refundRate);
    }

    update(dt, enemies, difficulty, pondBuffMult) {
        if (this.def.noAttack) return null;

        this.cooldown -= dt;
        if (this.cooldown > 0) return null;

        const rangeSq = this.rangePx * this.rangePx;
        let target = null;
        let bestProgress = -1;

        for (const enemy of enemies) {
            if (enemy.dead || enemy.reachedNest) continue;
            const dx = enemy.x - this.x;
            const dy = enemy.y - this.y;
            if (dx * dx + dy * dy > rangeSq) continue;
            if (enemy.pathProgress > bestProgress) {
                bestProgress = enemy.pathProgress;
                target = enemy;
            }
        }

        if (!target) return null;

        const dmgMult =
            (difficulty.towerDamageMult || 1) * this.metaDamageMult;
        const fireRateMult =
            (pondBuffMult || 1) * this.metaFireRateMult;
        this.cooldown = 1 / (this.def.fireRate * fireRateMult);

        return {
            tower: this,
            target,
            damage: this.def.damage * dmgMult,
        };
    }
}

class Projectile {
    constructor(tower, target, damage) {
        this.x = tower.x;
        this.y = tower.y;
        this.target = target;
        this.damage = damage;
        this.towerType = tower.type;
        this.def = tower.def;
        this.alive = true;
        this.hit = false;
        this.arcOffset = 0;

        if (tower.type === "CATAPULT") {
            this.speed = 280;
            this.radius = 7;
            this.color = "#e74c3c";
            this.emoji = "🍎";
            this.arc = true;
            this.ring = false;
            this.splash = (tower.def.splash || 1) * TILE_SIZE;
        } else if (tower.type === "HONK") {
            this.speed = 420;
            this.radius = 5;
            this.color = "#e67e22";
            this.emoji = null;
            this.arc = false;
            this.ring = true;
            this.splash = 0;
        } else {
            this.speed = 380;
            this.radius = 4;
            this.color = "#f1c40f";
            this.emoji = null;
            this.arc = false;
            this.ring = false;
            this.splash = 0;
        }

        this.tx = target.x;
        this.ty = target.y;
        const dx = this.tx - this.x;
        const dy = this.ty - this.y;
        this.travelDist = Math.sqrt(dx * dx + dy * dy) || 1;
        this.progress = 0;
        this.angle = Math.atan2(dy, dx);
    }

    update(dt) {
        if (!this.alive) return;

        if (this.target && !this.target.dead && !this.target.reachedNest) {
            this.tx = this.target.x;
            this.ty = this.target.y;
        }

        const dx = this.tx - this.x;
        const dy = this.ty - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 10 || this.progress >= 1) {
            this.x = this.tx;
            this.y = this.ty;
            this.hit = true;
            this.alive = false;
            return;
        }

        const step = this.speed * dt;
        this.x += (dx / dist) * step;
        this.y += (dy / dist) * step;
        this.angle = Math.atan2(dy, dx);
        this.progress += step / this.travelDist;

        if (this.arc) {
            this.arcOffset =
                Math.sin(Math.min(1, Math.max(0, this.progress)) * Math.PI) * 28;
        } else {
            this.arcOffset = 0;
        }
    }

    get drawY() {
        return this.y - (this.arcOffset || 0);
    }
}

class Enemy {
    constructor(type, difficulty, spawnPos) {
        const def = ENEMY_DEFS[type];
        this.type = type;
        this.def = def;
        this.emoji = def.emoji;
        this.color = def.color || "#e67e22";
        this.radius = def.radius || 8;
        const hpMult = difficulty.enemyHpMult || 1;
        this.maxHp = Math.floor(def.hp * hpMult);
        this.hp = this.maxHp;
        this.speed = def.speed * (difficulty.enemySpeedMult || 1);
        this.reward = def.reward;
        this.splashResist = def.splashResist || 1;
        this.regen = def.regen || 0;
        this.pathProgress = 0;
        this.slowMult = 1;
        this.slowTimer = 0;
        this.dead = false;
        this.reachedNest = false;
        this.lastHitTime = -999;
        this.x = spawnPos ? spawnPos.x : TILE_SIZE * 0.4;
        this.y = spawnPos ? spawnPos.y : CANVAS_H / 2;
        this.sepX = 0;
        this.sepY = 0;
    }

    static fromSave(data, difficulty) {
        const e = new Enemy(data.type, difficulty, {
            x: data.x,
            y: data.y,
        });
        if (typeof data.hp === "number") e.hp = Math.min(e.maxHp, data.hp);
        e.slowMult = data.slowMult || 1;
        e.slowTimer = data.slowTimer || 0;
        e.pathProgress = data.pathProgress || 0;
        e.lastHitTime = data.lastHitTime != null ? data.lastHitTime : -999;
        return e;
    }

    serialize() {
        return {
            type: this.type,
            x: this.x,
            y: this.y,
            hp: this.hp,
            slowMult: this.slowMult,
            slowTimer: this.slowTimer,
            pathProgress: this.pathProgress,
            lastHitTime: this.lastHitTime,
        };
    }

    applySlow(amount, duration) {
        this.slowMult = Math.min(this.slowMult, 1 - amount);
        this.slowTimer = Math.max(this.slowTimer, duration);
    }

    takeDamage(amount, damageType, now) {
        let dmg = amount;
        if (damageType === "splash") {
            dmg *= this.splashResist;
        }
        this.hp -= dmg;
        this.lastHitTime = now;
        if (this.hp <= 0) {
            this.dead = true;
        }
    }

    update(dt, now, flow) {
        if (this.dead || this.reachedNest) return;

        if (this.slowTimer > 0) {
            this.slowTimer -= dt;
            if (this.slowTimer <= 0) {
                this.slowMult = 1;
                this.slowTimer = 0;
            }
        }

        if (
            this.regen > 0 &&
            now - this.lastHitTime > 0.5 &&
            this.hp < this.maxHp
        ) {
            this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);
        }

        const sample = flow
            ? flow.sampleFlow(this.x, this.y)
            : { vx: 1, vy: 0, dist: 1 };

        const maxD = flow ? flow.maxDist : 1;
        this.pathProgress = 1 - Math.min(1, sample.dist / maxD);

        let vx = sample.vx + this.sepX * SEP_STRENGTH;
        let vy = sample.vy + this.sepY * SEP_STRENGTH;
        const len = Math.sqrt(vx * vx + vy * vy) || 1;
        vx /= len;
        vy /= len;

        const moveSpeed = this.speed * this.slowMult * dt;
        let nx = this.x + vx * moveSpeed;
        let ny = this.y + vy * moveSpeed;

        if (flow && flow.map) {
            const cell = flow.map.worldToCell(nx, ny);
            if (!flow.map.isWalkable(cell.c, cell.r)) {
                const tryX = this.x + vx * moveSpeed;
                const tryY = this.y;
                const cellX = flow.map.worldToCell(tryX, tryY);
                if (flow.map.isWalkable(cellX.c, cellX.r)) {
                    nx = tryX;
                    ny = tryY;
                } else {
                    const tryY2 = this.y + vy * moveSpeed;
                    const cellY = flow.map.worldToCell(this.x, tryY2);
                    if (flow.map.isWalkable(cellY.c, cellY.r)) {
                        nx = this.x;
                        ny = tryY2;
                    } else {
                        nx = this.x;
                        ny = this.y;
                    }
                }
            }
        }

        this.x = Math.max(4, Math.min(CANVAS_W - 4, nx));
        this.y = Math.max(4, Math.min(CANVAS_H - 4, ny));

        const nestX = (NEST_COL + 0.5) * TILE_SIZE;
        const nestY = (NEST_ROW + 0.5) * TILE_SIZE;
        const ndx = this.x - nestX;
        const ndy = this.y - nestY;
        if (ndx * ndx + ndy * ndy < NEST_REACH_DIST * NEST_REACH_DIST) {
            this.reachedNest = true;
        }
    }
}
