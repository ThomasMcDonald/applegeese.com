"use strict";

// ============================================================
// ENEMY SYSTEM
// Depends on: constants.js, utils.js (dist2),
//             entities.js (Entity), pathfinding.js (aStar)
// ============================================================
class EnemyBuilding extends Entity {
    constructor(tx, ty, type = "DEN") {
        super((tx + 0.5) * TILE_SIZE, (ty + 0.5) * TILE_SIZE);
        this.tx = tx;
        this.ty = ty;
        this.type = type;
        this.hp = type === "DEN" ? 300 : 180;
        this.maxHp = this.hp;
        this.radius = 16;
        this.training = false;
        this.trainTimer = 0;
        this.queuedUnit = null; // "worker" | "combat"
    }

    startTraining(unitType) {
        if (!this.training) {
            this.training = true;
            this.trainTimer = 0;
            this.queuedUnit = unitType;
            return true;
        }
        return false;
    }

    update(dt) {
        if (this.training) {
            this.trainTimer += dt;
            const tt = this.queuedUnit === "worker" ? TRAIN_TIME : 8;
            if (this.trainTimer >= tt) {
                this.training = false;
                this.trainTimer = 0;
                const done = this.queuedUnit;
                this.queuedUnit = null;
                return done;
            }
        }
        return null;
    }
}

class EnemyWorker extends Entity {
    constructor(x, y, homeBase, resources, gatherMultiplier = 1.0) {
        super(x, y);
        this.hp = 60;
        this.maxHp = 60;
        this.radius = 9;
        // IDLE | MOVE_TO_RESOURCE | HARVEST | RETURN_TO_BASE | DEPOSIT
        this.state = "IDLE";
        this.path = [];
        this.targetNode = null;
        this.carriedApples = 0;
        this.gatherTimer = 0;
        this.homeBase = homeBase;
        this.resources = resources;
        this.idleTimer = 0;
        this.gatherMultiplier = gatherMultiplier;
    }

    update(dt, map, resourceNodes) {
        switch (this.state) {
            case "IDLE":
                this.idleTimer += dt;
                if (this.idleTimer >= 1.0) {
                    this.idleTimer = 0;
                    this._findResource(map, resourceNodes);
                }
                break;
            case "MOVE_TO_RESOURCE":
            case "RETURN_TO_BASE":
                this._walk(dt);
                break;
            case "HARVEST":
                this._harvest(dt, map);
                break;
            case "DEPOSIT":
                this.resources.apples += this.carriedApples;
                this.carriedApples = 0;
                if (this.targetNode && this.targetNode.apples > 0) {
                    this._goToNode(this.targetNode, map);
                } else {
                    this.targetNode = null;
                    this.state = "IDLE";
                    this.idleTimer = 0;
                }
                break;
        }
    }

    _walk(dt) {
        if (this.path.length === 0) {
            if (this.state === "RETURN_TO_BASE") {
                this.state = "DEPOSIT";
            } else if (this.state === "MOVE_TO_RESOURCE") {
                this.state = "HARVEST";
                this.gatherTimer = 0;
            }
            return;
        }
        const wp = this.path[0];
        const dx = wp.x - this.x, dy = wp.y - this.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 2) {
            this.x = wp.x;
            this.y = wp.y;
            this.path.shift();
            if (this.path.length === 0) {
                if (this.state === "RETURN_TO_BASE") {
                    this.state = "DEPOSIT";
                } else if (this.state === "MOVE_TO_RESOURCE") {
                    this.state = "HARVEST";
                    this.gatherTimer = 0;
                }
            }
        } else {
            this.x += (dx / d) * UNIT_SPEED * dt;
            this.y += (dy / d) * UNIT_SPEED * dt;
        }
    }

    _harvest(dt, map) {
        if (!this.targetNode || this.targetNode.apples <= 0) {
            if (this.carriedApples > 0) {
                this._returnToBase(map);
            } else {
                this.targetNode = null;
                this.state = "IDLE";
                this.idleTimer = 0;
            }
            return;
        }
        this.gatherTimer += dt;
        if (this.gatherTimer >= GATHER_TICK) {
            this.gatherTimer = 0;
            const amt = Math.min(
                Math.max(1, Math.round(GATHER_AMOUNT * this.gatherMultiplier)),
                this.targetNode.apples,
                MAX_CARRY - this.carriedApples
            );
            this.carriedApples += amt;
            this.targetNode.apples -= amt;
            if (
                this.carriedApples >= MAX_CARRY ||
                this.targetNode.apples <= 0
            ) {
                this._returnToBase(map);
            }
        }
    }

    _findResource(map, nodes) {
        let best = null, bestD = Infinity;
        for (const n of nodes) {
            if (n.apples <= 0) continue;
            const d = dist2(this.x, this.y, n.x, n.y);
            if (d < bestD) { bestD = d; best = n; }
        }
        if (best) this._goToNode(best, map);
    }

    _goToNode(node, map) {
        this.targetNode = node;
        const path = aStar(
            map,
            Math.floor(this.x / TILE_SIZE),
            Math.floor(this.y / TILE_SIZE),
            node.tx, node.ty
        );
        if (path.length > 0) {
            this.path = path;
            this.state = "MOVE_TO_RESOURCE";
        } else {
            this.state = "HARVEST";
            this.gatherTimer = 0;
        }
    }

    _returnToBase(map) {
        const tx = Math.floor(this.homeBase.x / TILE_SIZE);
        const ty = Math.floor(this.homeBase.y / TILE_SIZE);
        const path = aStar(
            map,
            Math.floor(this.x / TILE_SIZE),
            Math.floor(this.y / TILE_SIZE),
            tx, ty
        );
        if (path.length > 0) {
            this.path = path;
            this.state = "RETURN_TO_BASE";
        } else {
            this.state = "DEPOSIT";
        }
    }
}

class EnemyCombatUnit extends Entity {
    constructor(x, y, homeBase) {
        super(x, y);
        this.hp = 80;
        this.maxHp = 80;
        this.radius = 10;
        // IDLE | MOVING | FIGHTING | RETURNING
        this.state = "IDLE";
        this.path = [];
        this.homeBase = homeBase;
        this.attackTimer = 0;
        this.repathTimer = 0;
    }

    launchAttack(playerBase, map) {
        const tx = Math.floor(playerBase.x / TILE_SIZE);
        const ty = Math.floor(playerBase.y / TILE_SIZE);
        const path = aStar(
            map,
            Math.floor(this.x / TILE_SIZE),
            Math.floor(this.y / TILE_SIZE),
            tx, ty
        );
        if (path.length > 0) {
            this.path = path;
            this.state = "MOVING";
        }
    }

    returnToBase(map) {
        const tx = Math.floor(this.homeBase.x / TILE_SIZE);
        const ty = Math.floor(this.homeBase.y / TILE_SIZE);
        const path = aStar(
            map,
            Math.floor(this.x / TILE_SIZE),
            Math.floor(this.y / TILE_SIZE),
            tx, ty
        );
        if (path.length > 0) {
            this.path = path;
            this.state = "RETURNING";
        } else {
            this.state = "IDLE";
        }
    }

    update(dt, map, playerUnits, playerBuildings) {
        if (this.state === "MOVING" || this.state === "RETURNING") {
            // Attack-of-opportunity while moving toward player base
            if (this.state === "MOVING") {
                const near = this._findNearest(
                    playerUnits, playerBuildings
                );
                if (
                    near &&
                    dist2(this.x, this.y, near.x, near.y) <=
                        COMBAT_RANGE_SQ
                ) {
                    this.state = "FIGHTING";
                    this.attackTimer = 0;
                    return;
                }
            }
            this._stepPath(dt);
            if (this.path.length === 0) {
                this.state =
                    this.state === "RETURNING" ? "IDLE" : "FIGHTING";
                this.attackTimer = 0;
            }
        } else if (this.state === "FIGHTING") {
            const near = this._findNearest(playerUnits, playerBuildings);
            if (!near) {
                this.returnToBase(map);
                return;
            }
            const d = dist2(this.x, this.y, near.x, near.y);
            if (d <= COMBAT_RANGE_SQ) {
                this.attackTimer += dt;
                if (this.attackTimer >= 1.0) {
                    this.attackTimer = 0;
                    near.hp -= ENEMY_ATTACK_DAMAGE;
                }
            } else {
                // Chase target, repath periodically
                this.repathTimer += dt;
                if (this.repathTimer >= 2.0) {
                    this.repathTimer = 0;
                    const tx = Math.floor(near.x / TILE_SIZE);
                    const ty = Math.floor(near.y / TILE_SIZE);
                    const path = aStar(
                        map,
                        Math.floor(this.x / TILE_SIZE),
                        Math.floor(this.y / TILE_SIZE),
                        tx, ty
                    );
                    if (path.length > 0) this.path = path;
                }
                this._stepPath(dt);
            }
        }
    }

    _findNearest(playerUnits, playerBuildings) {
        let best = null, bestD = Infinity;
        for (const u of playerUnits) {
            if (u.hp <= 0) continue;
            const d = dist2(this.x, this.y, u.x, u.y);
            if (d < bestD) { bestD = d; best = u; }
        }
        for (const b of playerBuildings) {
            if (b.hp <= 0) continue;
            const d = dist2(this.x, this.y, b.x, b.y);
            if (d < bestD) { bestD = d; best = b; }
        }
        return best;
    }

    _stepPath(dt) {
        if (this.path.length === 0) return;
        const wp = this.path[0];
        const dx = wp.x - this.x, dy = wp.y - this.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 2) {
            this.x = wp.x;
            this.y = wp.y;
            this.path.shift();
        } else {
            this.x += (dx / d) * UNIT_SPEED * dt;
            this.y += (dy / d) * UNIT_SPEED * dt;
        }
    }
}

class EnemyAI {
    constructor(config = AI_DIFFICULTY_CONFIG.normal) {
        this.config = config;
        this.resources = { apples: 0 };
        this.workers = [];
        this.combatUnits = [];
        this.buildings = [];
        this.den = null;
        this.decisionTimer = 0;
        this.gameTime = 0;
    }

    get desiredWorkers() {
        return Math.min(8, 3 + Math.floor(this.gameTime / 60));
    }

    get desiredArmy() {
        return Math.min(
            Math.round(10 * this.config.armyMultiplier),
            Math.round((3 + Math.floor(this.gameTime / 45)) * this.config.armyMultiplier)
        );
    }

    init(map) {
        // Place enemy den near bottom-right corner
        const cx = MAP_W - 8, cy = MAP_H - 8;
        let denTx = cx, denTy = cy;
        outer:
        for (let r = 0; r <= 6; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    const nx = cx + dx, ny = cy + dy;
                    if (map.isWalkable(nx, ny)) {
                        denTx = nx;
                        denTy = ny;
                        break outer;
                    }
                }
            }
        }
        this.den = new EnemyBuilding(denTx, denTy, "DEN");
        this.buildings.push(this.den);
        // Spawn 3 initial fox workers
        for (let i = 0; i < 3; i++) {
            this._spawnWorker();
        }
    }

    _spawnWorker() {
        if (!this.den) return;
        const angle = Math.random() * Math.PI * 2;
        const off = TILE_SIZE * 1.8;
        this.workers.push(new EnemyWorker(
            this.den.x + Math.cos(angle) * off,
            this.den.y + Math.sin(angle) * off,
            this.den,
            this.resources,
            this.config.gatherMultiplier
        ));
    }

    _spawnCombat() {
        if (!this.den) return;
        const angle = Math.random() * Math.PI * 2;
        const off = TILE_SIZE * 1.8;
        this.combatUnits.push(new EnemyCombatUnit(
            this.den.x + Math.cos(angle) * off,
            this.den.y + Math.sin(angle) * off,
            this.den
        ));
    }

    update(dt, map, playerUnits, playerBuildings) {
        this.gameTime += dt;
        // Update buildings
        for (const b of this.buildings) {
            const done = b.update(dt);
            if (done === "worker") this._spawnWorker();
            else if (done === "combat") this._spawnCombat();
        }
        // Update workers
        for (const w of this.workers) {
            w.update(dt, map, map.resourceNodes);
        }
        // Update combat units
        for (const u of this.combatUnits) {
            u.update(dt, map, playerUnits, playerBuildings);
        }
        // Decision loop
        this.decisionTimer += dt;
        if (this.decisionTimer >= this.config.decisionInterval) {
            this.decisionTimer = 0;
            this._decide(map, playerBuildings);
        }
    }

    _decide(map, playerBuildings) {
        const idleBuilding = this.buildings.find(b => !b.training);
        // 1. Maintain workers
        if (
            this.workers.length < this.desiredWorkers &&
            this.resources.apples >= ENEMY_WORKER_COST &&
            idleBuilding
        ) {
            idleBuilding.startTraining("worker");
            this.resources.apples -= ENEMY_WORKER_COST;
            return;
        }
        // 2. Build army
        if (
            this.combatUnits.length < this.desiredArmy &&
            this.resources.apples >= ENEMY_UNIT_COST &&
            idleBuilding
        ) {
            idleBuilding.startTraining("combat");
            this.resources.apples -= ENEMY_UNIT_COST;
        }
        // 3. Attack when army threshold reached
        const idleArmy = this.combatUnits.filter(
            u => u.state === "IDLE"
        );
        const attackThreshold = Math.max(
            1, Math.ceil(this.desiredArmy * this.config.attackThresholdModifier)
        );
        if (
            idleArmy.length >= attackThreshold &&
            playerBuildings.length > 0
        ) {
            const target = playerBuildings[0];
            for (const u of idleArmy) {
                u.launchAttack(target, map);
            }
        }
    }
}
