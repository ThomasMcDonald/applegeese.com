"use strict";

// ============================================================
// GAME STATE
// Depends on: constants.js, utils.js (dist2),
//             entities.js (Unit, Building, ResourceNode),
//             map.js (GameMap), enemy.js (EnemyAI),
//             camera.js (Camera), ui.js (checkTutorialProgress)
// ============================================================
const game = {
    map: null,
    units: [],
    buildings: [],
    resources: { apples: 50 },
    selectedUnits: [],
    selectedBuilding: null,
    camera: null,
    placingType: null,
    mouseWorld: { x: 0, y: 0 },
    enemy: null,
    gameOver: false,
    paused: false,
    isTutorial: false,
    tutorialStep: 0,
    difficultyKey: "normal",

    init(canvasW, canvasH, difficulty = "normal") {
        this.units = [];
        this.buildings = [];
        this.resources = { apples: 50 };
        this.selectedUnits = [];
        this.selectedBuilding = null;
        this.placingType = null;
        this.gameOver = false;
        this.map = new GameMap(MAP_W, MAP_H);
        this.camera = new Camera(canvasW, canvasH);

        // Starting geese
        for (let i = 0; i < 3; i++) {
            this.units.push(
                new Unit(
                    (5 + i * 2 + 0.5) * TILE_SIZE,
                    (5 + 0.5) * TILE_SIZE,
                    "WORKER"
                )
            );
        }
        // Starting nest
        this.buildings.push(new Building(4, 4));

        // Focus camera on start
        this.camera.x = 2 * TILE_SIZE;
        this.camera.y = 2 * TILE_SIZE;

        // Initialise enemy AI
        this.enemy = new EnemyAI(AI_DIFFICULTY_CONFIG[difficulty] || AI_DIFFICULTY_CONFIG.normal);
        this.enemy.init(this.map);

        // Reveal starting area
        this.map.updateFog(this.units, this.buildings);
    },

    update(dt) {
        if (!this.map) return;
        for (const unit of this.units) {
            unit.update(dt, this.map, this.resources, this.buildings);
        }
        for (const building of this.buildings) {
            const spawned = building.update(dt, this.resources);
            if (spawned) {
                const angle = Math.random() * Math.PI * 2;
                const off = TILE_SIZE * 1.8;
                const unitType = BUILDING_DEFS[building.type].trainsUnit || "WORKER";
                this.units.push(
                    new Unit(
                        building.x + Math.cos(angle) * off,
                        building.y + Math.sin(angle) * off,
                        unitType
                    )
                );
            }
        }
        // Remove exhausted resource nodes from selectedUnits targets
        for (const unit of this.units) {
            if (
                unit.targetNode &&
                unit.targetNode.apples <= 0
            ) {
                unit.targetNode = null;
                unit.state = "IDLE";
            }
            if (unit.returnNode && unit.returnNode.apples <= 0) {
                unit.returnNode = null;
            }
        }

        // Update enemy AI (freeze during tutorial steps 0 and 1)
        if (!this.isTutorial || this.tutorialStep >= 2) {
            this.enemy.update(
                dt, this.map, this.units, this.buildings
            );
        }

        // Player auto-attack: geese fight back against nearby
        // enemy entities when idle or already fighting
        for (const unit of this.units) {
            if (
                unit.state !== "IDLE" &&
                unit.state !== "FIGHTING"
            ) continue;
            let nearestEnemy = null, nearestD = Infinity;
            for (const en of [
                ...this.enemy.combatUnits,
                ...this.enemy.workers,
            ]) {
                if (en.hp <= 0) continue;
                const d = dist2(unit.x, unit.y, en.x, en.y);
                if (d < nearestD) { nearestD = d; nearestEnemy = en; }
            }
            for (const eb of this.enemy.buildings) {
                if (eb.hp <= 0) continue;
                const d = dist2(unit.x, unit.y, eb.x, eb.y);
                if (d < nearestD) { nearestD = d; nearestEnemy = eb; }
            }
            if (nearestEnemy && nearestD <= COMBAT_RANGE_SQ) {
                unit.state = "FIGHTING";
                unit.attackTimer += dt;
                if (unit.attackTimer >= 1.0) {
                    unit.attackTimer = 0;
                    nearestEnemy.hp -= PLAYER_ATTACK_DAMAGE;
                }
            } else if (unit.state === "FIGHTING") {
                unit.state = "IDLE";
                unit.attackTimer = 0;
            }
        }

        // Clean up dead entities
        this.units = this.units.filter(u => u.hp > 0);
        this.selectedUnits = this.selectedUnits.filter(
            u => u.hp > 0
        );
        this.enemy.workers = this.enemy.workers.filter(
            w => w.hp > 0
        );
        this.enemy.combatUnits = this.enemy.combatUnits.filter(
            u => u.hp > 0
        );

        // Check game-over conditions
        if (!this.gameOver) {
            const nestAlive = this.buildings.some(
                b => b.type === "NEST" && b.hp > 0
            );
            if (!nestAlive) {
                this._endGame(false);
            } else if (
                this.enemy.den &&
                this.enemy.den.hp <= 0
            ) {
                this._endGame(true);
            }
        }

        // Remove destroyed enemy buildings
        this.enemy.buildings = this.enemy.buildings.filter(
            b => b.hp > 0
        );

        // Update fog of war
        this.map.updateFog(this.units, this.buildings);

        // Check tutorial progress
        if (this.isTutorial) checkTutorialProgress();
    },

    _endGame(won) {
        this.gameOver = true;
        const overlay = document.getElementById("game-over");
        document.getElementById("game-over-title").textContent =
            won ? "Victory! 🎉" : "Defeat! 😢";
        document.getElementById("game-over-msg").textContent = won
            ? "You destroyed the enemy den!"
            : "Your nest has been destroyed!";
        overlay.style.display = "flex";
    },

    entityAt(wx, wy, hitRadius = 16) {
        for (const u of this.units) {
            if (dist2(u.x, u.y, wx, wy) <= hitRadius * hitRadius)
                return u;
        }
        for (const b of this.buildings) {
            if (dist2(b.x, b.y, wx, wy) <= hitRadius * hitRadius)
                return b;
        }
        for (const n of this.map.resourceNodes) {
            if (
                n.apples > 0 &&
                dist2(n.x, n.y, wx, wy) <= hitRadius * hitRadius
            )
                return n;
        }
        return null;
    },

    clearSelection() {
        for (const u of this.units) u.selected = false;
        for (const b of this.buildings) b.selected = false;
        this.selectedUnits = [];
        this.selectedBuilding = null;
    },

    canPlaceBuilding(tx, ty, type) {
        const def = BUILDING_DEFS[type];
        return (
            this.map.isWalkable(tx, ty) &&
            !this.buildings.some(b => b.tx === tx && b.ty === ty) &&
            this.resources.apples >= def.buildCost
        );
    },
};
