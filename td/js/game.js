"use strict";

const game = {
    map: null,
    flow: null,
    towers: [],
    enemies: [],
    projectiles: [],
    particles: [],
    apples: STARTING_APPLES,
    nestHp: NEST_MAX_HP,
    difficultyKey: "normal",
    difficulty: DIFFICULTY.normal,
    waves: null,
    selectedTowerType: "PECK",
    selectedTower: null,
    hoverCell: null,
    time: 0,
    paused: false,
    gameOver: false,
    victory: false,
    playing: false,
    isTutorial: false,
    tutorialStep: 0,
    kills: 0,
    message: "",
    messageTimer: 0,
    _saveAcc: 0,

    init(difficultyKey = "normal") {
        const bonuses = meta.bonuses();
        this.map = new GameMap();
        this.flow = new FlowField(this.map);
        this.towers = [];
        this.enemies = [];
        this.projectiles = [];
        this.particles = [];
        this.apples = STARTING_APPLES + bonuses.startApplesBonus;
        this.nestHp = NEST_MAX_HP + bonuses.nestHpBonus;
        this.nestMaxHp = this.nestHp;
        this.killRewardBonus = bonuses.killRewardBonus;
        this.difficultyKey = difficultyKey;
        this.difficulty = DIFFICULTY[difficultyKey] || DIFFICULTY.normal;
        this.waves = new WaveManager();
        this.selectedTowerType = "PECK";
        this.selectedTower = null;
        this.hoverCell = null;
        this.time = 0;
        this.paused = false;
        this.gameOver = false;
        this.victory = false;
        this.playing = true;
        this.kills = 0;
        this.lastFeathersGained = 0;
        this._saveAcc = 0;
        this.message = "Place towers — foxes will swarm around walls!";
        this.messageTimer = 3;

        this._placeFreePecks(bonuses.freePecks);
        this.persistRun();
    },

    restoreFromSave(data) {
        if (!data || data.version !== 1) return false;
        const bonuses = meta.bonuses();
        this.map = new GameMap();
        this.flow = new FlowField(this.map);
        this.projectiles = [];
        this.particles = [];
        this.difficultyKey = data.difficultyKey || "normal";
        this.difficulty = DIFFICULTY[this.difficultyKey] || DIFFICULTY.normal;
        this.killRewardBonus = bonuses.killRewardBonus;
        this.apples = data.apples ?? STARTING_APPLES;
        this.nestHp = data.nestHp ?? NEST_MAX_HP;
        this.nestMaxHp =
            data.nestMaxHp ?? NEST_MAX_HP + bonuses.nestHpBonus;
        this.kills = data.kills || 0;
        this.time = data.time || 0;
        this.isTutorial = !!data.isTutorial;
        this.tutorialStep = data.tutorialStep || 0;
        this.selectedTowerType = data.selectedTowerType || "PECK";
        this.selectedTower = null;
        this.hoverCell = null;
        this.paused = false;
        this.gameOver = false;
        this.victory = false;
        this.playing = true;
        this.lastFeathersGained = 0;
        this._saveAcc = 0;
        this.message = "Welcome back — run restored!";
        this.messageTimer = 2.5;

        this.towers = (data.towers || []).map(
            (t) => new Tower(t.c, t.r, t.type, t.tier || 1),
        );
        this.enemies = (data.enemies || []).map((e) =>
            Enemy.fromSave(e, this.difficulty),
        );
        this.waves = new WaveManager();
        this.waves.loadState(data.waves);
        return true;
    },

    serializeRun() {
        return {
            version: 1,
            difficultyKey: this.difficultyKey,
            apples: this.apples,
            nestHp: this.nestHp,
            nestMaxHp: this.nestMaxHp,
            kills: this.kills,
            time: this.time,
            isTutorial: this.isTutorial,
            tutorialStep: this.tutorialStep,
            selectedTowerType: this.selectedTowerType,
            towers: this.towers.map((t) => ({
                c: t.c,
                r: t.r,
                type: t.type,
                tier: t.tier || 1,
            })),
            enemies: this.enemies
                .filter((e) => !e.dead && !e.reachedNest)
                .map((e) => e.serialize()),
            waves: this.waves ? this.waves.serialize() : null,
            savedAt: Date.now(),
        };
    },

    persistRun() {
        if (!this.playing || this.gameOver || this.victory) return;
        meta.saveActiveRun(this.serializeRun());
    },

    clearPersistedRun() {
        meta.clearActiveRun();
    },

    _placeFreePecks(count) {
        if (!count) return;
        // Prefer tiles near mid-left choke, walkable grass
        const candidates = [
            [3, 6],
            [3, 8],
            [2, 7],
            [7, 4],
            [7, 9],
            [8, 3],
            [8, 10],
            [12, 6],
            [12, 8],
        ];
        let placed = 0;
        for (const [c, r] of candidates) {
            if (placed >= count) break;
            if (!this.map.canBuild(c, r) || this.towerAt(c, r)) continue;
            this.towers.push(new Tower(c, r, "PECK"));
            placed++;
        }
        // Fallback: any buildable
        if (placed < count) {
            for (const key of this.map.buildable) {
                if (placed >= count) break;
                const [cs, rs] = key.split(",");
                const c = +cs;
                const r = +rs;
                if (this.towerAt(c, r)) continue;
                this.towers.push(new Tower(c, r, "PECK"));
                placed++;
            }
        }
    },

    showMessage(text, duration = 2) {
        this.message = text;
        this.messageTimer = duration;
    },

    towerAt(c, r) {
        return this.towers.find((t) => t.c === c && t.r === r) || null;
    },

    pondBuffFor(tower) {
        let mult = 1;
        for (const other of this.towers) {
            if (other.type !== "POND" || other === tower) continue;
            const dx = other.x - tower.x;
            const dy = other.y - tower.y;
            const stats = other.stats;
            const r = (stats.buffRadius || 2) * TILE_SIZE;
            if (dx * dx + dy * dy <= r * r) {
                mult = Math.max(mult, stats.buffMult || 1.25);
            }
        }
        return mult;
    },

    upgradeSelectedTower() {
        const tower = this.selectedTower;
        if (!tower || !this.playing || this.gameOver || this.victory) {
            return false;
        }
        if (!tower.canUpgrade) {
            this.showMessage("Already max tier!", 1.2);
            return false;
        }
        const cost = tower.upgradeCost;
        if (this.apples < cost) {
            this.showMessage("Not enough apples!", 1.2);
            return false;
        }
        this.apples -= cost;
        tower.upgrade();
        this.showMessage(`${tower.def.name} → T${tower.tier}`, 1.2);
        this.persistRun();
        return true;
    },

    placeTower(c, r) {
        if (!this.playing || this.gameOver || this.victory) return false;
        if (!this.map.canBuild(c, r)) {
            this.showMessage("Can't build there!", 1.2);
            return false;
        }
        if (this.towerAt(c, r)) {
            this.showMessage("Tile occupied!", 1.2);
            return false;
        }
        if (this.towers.length >= MAX_TOWERS) {
            this.showMessage("Tower limit reached!", 1.5);
            return false;
        }

        const type = this.selectedTowerType;
        const def = TOWER_DEFS[type];
        if (!def) return false;
        if (this.apples < def.cost) {
            this.showMessage("Not enough apples!", 1.2);
            return false;
        }

        this.apples -= def.cost;
        this.towers.push(new Tower(c, r, type));
        this.showMessage(`Built ${def.name}`, 1);
        this.advanceTutorial(1);
        this.persistRun();
        return true;
    },

    sellTower(tower) {
        if (!tower) return;
        const refund = tower.sellValue(this.difficulty.sellRefund);
        this.apples += refund;
        this.towers = this.towers.filter((t) => t !== tower);
        if (this.selectedTower === tower) this.selectedTower = null;
        this.showMessage(`Sold for ${refund} 🍎`, 1.2);
        this.persistRun();
    },

    startWave() {
        if (!this.waves.canStartWave()) return;
        if (this.waves.startNextWave()) {
            this.showMessage(`Wave ${this.waves.currentWave} starting!`, 1.5);
            this.advanceTutorial(2);
            this.persistRun();
        }
    },

    advanceTutorial(step) {
        if (!this.isTutorial) return;
        if (this.tutorialStep === step - 1) {
            this.tutorialStep = step;
            updateTutorialPanel();
        }
    },

    update(dt) {
        if (!this.playing || this.paused || this.gameOver || this.victory) return;

        this.time += dt;
        if (this.messageTimer > 0) this.messageTimer -= dt;

        this.waves.update(dt, this);

        // Separation for dense swarm packing
        if (this.flow && this.enemies.length > 0) {
            const sep = this.flow.computeSeparation(this.enemies, SEP_RADIUS);
            for (const enemy of this.enemies) {
                const s = sep.get(enemy);
                enemy.sepX = s ? s.sx : 0;
                enemy.sepY = s ? s.sy : 0;
            }
        }

        for (const enemy of this.enemies) {
            enemy.update(dt, this.time, this.flow);
            if (enemy.reachedNest && !enemy.dead) {
                enemy.dead = true;
                this.nestHp -= 1;
                this.particles.push({
                    x: (NEST_COL + 0.5) * TILE_SIZE,
                    y: (NEST_ROW + 0.5) * TILE_SIZE,
                    life: 0.4,
                    maxLife: 0.4,
                    color: "#e74c3c",
                    radius: 18,
                });
                this.showMessage("Fox reached the nest!", 1.2);
            }
        }

        // Combat — spawn projectiles
        for (const tower of this.towers) {
            const buff = this.pondBuffFor(tower);
            const shot = tower.update(dt, this.enemies, this.difficulty, buff);
            if (!shot) continue;
            for (const target of shot.targets) {
                this.projectiles.push(
                    new Projectile(shot.tower, target, shot.damage),
                );
            }
        }

        // Update projectiles and resolve hits
        for (const p of this.projectiles) {
            p.update(dt);
            if (!p.hit) continue;

            if (p.towerType === "CATAPULT") {
                const splashSq = p.splash * p.splash;
                for (const enemy of this.enemies) {
                    if (enemy.dead || enemy.reachedNest) continue;
                    const dx = enemy.x - p.x;
                    const dy = enemy.y - p.y;
                    if (dx * dx + dy * dy <= splashSq) {
                        enemy.takeDamage(p.damage, "splash", this.time);
                    }
                }
                this.particles.push({
                    x: p.x,
                    y: p.y,
                    life: 0.3,
                    maxLife: 0.3,
                    color: "#e74c3c",
                    radius: p.splash * 0.55,
                });
            } else if (p.target && !p.target.dead && !p.target.reachedNest) {
                p.target.takeDamage(p.damage, "normal", this.time);
                if (p.slow) {
                    p.target.applySlow(p.slow, p.slowDuration);
                }
                this.particles.push({
                    x: p.x,
                    y: p.y,
                    life: 0.18,
                    maxLife: 0.18,
                    color: p.color,
                    radius: 7,
                });
            } else {
                // Target died mid-flight — splash tiny impact at landing
                this.particles.push({
                    x: p.x,
                    y: p.y,
                    life: 0.12,
                    maxLife: 0.12,
                    color: p.color,
                    radius: 5,
                });
            }
        }
        this.projectiles = this.projectiles.filter((p) => p.alive);

        // Rewards for kills
        for (const enemy of this.enemies) {
            if (enemy.dead && !enemy._rewarded && !enemy.reachedNest) {
                enemy._rewarded = true;
                this.apples += enemy.reward + (this.killRewardBonus || 0);
                this.kills++;
            }
            if (enemy.reachedNest) enemy._rewarded = true;
        }

        this.enemies = this.enemies.filter((e) => {
            if (e.dead || e.reachedNest) {
                // Keep briefly for death? No — remove immediately
                return false;
            }
            return true;
        });

        // Particles
        for (const p of this.particles) p.life -= dt;
        this.particles = this.particles.filter((p) => p.life > 0);

        if (this.waves.justCleared) {
            if (this.waves.currentWave < TOTAL_WAVES) {
                const bonus = 15 + this.waves.currentWave * 5;
                this.apples += bonus;
                this.showMessage(`Wave cleared! +${bonus} 🍎`, 2);
                this.advanceTutorial(3);
            } else {
                this.victory = true;
                this.playing = false;
                this.onVictory();
            }
        }

        if (this.nestHp <= 0) {
            this.nestHp = 0;
            this.gameOver = true;
            this.playing = false;
            this.onDefeat();
        }

        this._saveAcc += dt;
        if (this._saveAcc >= 1.5) {
            this._saveAcc = 0;
            this.persistRun();
        }

        updateHud();
        if (this.selectedTower) updateSellPanel();
    },

    onVictory() {
        this.clearPersistedRun();
        this.lastFeathersGained = meta.awardRun({
            won: true,
            wave: this.waves.currentWave,
            kills: this.kills,
            difficultyKey: this.difficultyKey,
        });
        showEndScreen(true);
    },

    onDefeat() {
        this.clearPersistedRun();
        this.lastFeathersGained = meta.awardRun({
            won: false,
            wave: this.waves.currentWave,
            kills: this.kills,
            difficultyKey: this.difficultyKey,
        });
        showEndScreen(false);
    },
};

function loadHighWave() {
    return meta.highWave || 0;
}
