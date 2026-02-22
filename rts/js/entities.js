"use strict";

// ============================================================
// ENTITIES
// Depends on: constants.js, utils.js, pathfinding.js (aStar)
// ============================================================
let _nextId = 1;

class Entity {
    constructor(x, y) {
        this.id = _nextId++;
        this.x = x;
        this.y = y;
    }
}

class ResourceNode extends Entity {
    constructor(tx, ty) {
        super((tx + 0.5) * TILE_SIZE, (ty + 0.5) * TILE_SIZE);
        this.tx = tx;
        this.ty = ty;
        this.apples = 40 + Math.floor(Math.random() * 40);
        this.maxApples = this.apples;
        this.radius = 12;
    }
}

class Unit extends Entity {
    constructor(x, y, unitType = "WORKER") {
        super(x, y);
        const def = UNIT_DEFS[unitType] || UNIT_DEFS.WORKER;
        this.unitType = unitType;
        this.hp = def.hp;
        this.maxHp = def.hp;
        this.selected = false;
        this.state = "IDLE"; // IDLE | MOVING | GATHERING | FIGHTING
        this.path = [];
        this.targetNode = null;
        this.gatherTimer = 0;
        this.carriedApples = 0;
        this.attackTimer = 0;
        this.radius = def.radius;
    }

    update(dt, map, resources) {
        if (
            this.state === "MOVING" &&
            this.path.length > 0
        ) {
            const wp = this.path[0];
            const dx = wp.x - this.x,
                dy = wp.y - this.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < 2) {
                this.x = wp.x;
                this.y = wp.y;
                this.path.shift();
                if (this.path.length === 0) {
                    this.state = this.targetNode
                        ? "GATHERING"
                        : "IDLE";
                    this.gatherTimer = 0;
                }
            } else {
                const spd = UNIT_DEFS[this.unitType].speed * dt;
                this.x += (dx / d) * spd;
                this.y += (dy / d) * spd;
            }
        } else if (
            this.state === "GATHERING" &&
            this.targetNode &&
            UNIT_DEFS[this.unitType].canGather
        ) {
            this.gatherTimer += dt;
            if (this.gatherTimer >= GATHER_TICK) {
                this.gatherTimer = 0;
                const amt = Math.min(
                    GATHER_AMOUNT,
                    this.targetNode.apples,
                    MAX_CARRY - this.carriedApples
                );
                this.carriedApples += amt;
                this.targetNode.apples -= amt;
                if (
                    this.carriedApples >= MAX_CARRY ||
                    this.targetNode.apples <= 0
                ) {
                    resources.apples += this.carriedApples;
                    this.carriedApples = 0;
                    this.targetNode = null;
                    this.state = "IDLE";
                }
            }
        }
    }

    sendTo(tx, ty, map) {
        this.targetNode = null;
        const path = aStar(
            map,
            Math.floor(this.x / TILE_SIZE),
            Math.floor(this.y / TILE_SIZE),
            tx,
            ty
        );
        if (path.length > 0) {
            this.path = path;
            this.state = "MOVING";
        }
    }

    gatherFrom(node, map) {
        if (!UNIT_DEFS[this.unitType].canGather) return;
        this.targetNode = node;
        const path = aStar(
            map,
            Math.floor(this.x / TILE_SIZE),
            Math.floor(this.y / TILE_SIZE),
            node.tx,
            node.ty
        );
        if (path.length > 0) {
            this.path = path;
            this.state = "MOVING";
        } else {
            // Already adjacent — gather immediately
            this.path = [];
            this.state = "GATHERING";
            this.gatherTimer = 0;
        }
    }
}

class Building extends Entity {
    constructor(tx, ty, type = "NEST") {
        super((tx + 0.5) * TILE_SIZE, (ty + 0.5) * TILE_SIZE);
        this.tx = tx;
        this.ty = ty;
        this.type = type;
        const def = BUILDING_DEFS[type];
        this.hp = def.maxHp;
        this.maxHp = def.maxHp;
        this.selected = false;
        this.radius = 16;
        this.training = false;
        this.trainTimer = 0;
        this.incomeTimer = 0;
    }

    startTraining(resources) {
        const def = BUILDING_DEFS[this.type];
        if (!def.canTrain) return false;
        if (!this.training && resources.apples >= TRAIN_COST) {
            resources.apples -= TRAIN_COST;
            this.training = true;
            this.trainTimer = 0;
            return true;
        }
        return false;
    }

    update(dt, resources) {
        const def = BUILDING_DEFS[this.type];
        // Passive apple income (e.g. Granary)
        if (def.incomeRate != null) {
            this.incomeTimer += dt;
            if (this.incomeTimer >= 1.0) {
                this.incomeTimer -= 1.0;
                resources.apples += def.incomeRate;
            }
        }
        if (this.training) {
            this.trainTimer += dt;
            const tt = def.trainTime || TRAIN_TIME;
            if (this.trainTimer >= tt) {
                this.training = false;
                this.trainTimer = 0;
                return true; // signal: spawn unit
            }
        }
        return false;
    }
}
