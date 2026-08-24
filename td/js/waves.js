"use strict";

class WaveManager {
    constructor() {
        this.currentWave = 0;
        this.active = false;
        this.spawnQueue = [];
        this.spawnTimer = 0;
        this.spawnInterval = 0.12;
        this.batchSize = 4;
        this.justCleared = false;
    }

    reset() {
        this.currentWave = 0;
        this.active = false;
        this.spawnQueue = [];
        this.spawnTimer = 0;
        this.justCleared = false;
    }

    canStartWave() {
        return (
            !this.active &&
            this.currentWave < TOTAL_WAVES &&
            this.spawnQueue.length === 0
        );
    }

    allWavesDone() {
        return (
            this.currentWave >= TOTAL_WAVES &&
            !this.active &&
            this.spawnQueue.length === 0
        );
    }

    startNextWave() {
        if (!this.canStartWave()) return false;

        const waveDef = WAVES[this.currentWave];
        this.spawnQueue = [];

        const addEnemies = (type, count) => {
            for (let i = 0; i < (count || 0); i++) {
                this.spawnQueue.push(type);
            }
        };

        addEnemies("SCOUT", waveDef.scouts);
        addEnemies("BURROW", waveDef.burrow);
        addEnemies("ALPHA", waveDef.alpha);

        for (let i = this.spawnQueue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = this.spawnQueue[i];
            this.spawnQueue[i] = this.spawnQueue[j];
            this.spawnQueue[j] = tmp;
        }

        this.active = true;
        this.justCleared = false;
        this.spawnTimer = 0.05;
        this.currentWave++;
        return true;
    }

    update(dt, gameState) {
        this.justCleared = false;
        if (!this.active) return;

        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && this.spawnQueue.length > 0) {
            const batch = Math.min(this.batchSize, this.spawnQueue.length);
            for (let i = 0; i < batch; i++) {
                const type = this.spawnQueue.shift();
                const pos = pickSpawnPosition(gameState.map);
                gameState.enemies.push(
                    new Enemy(type, gameState.difficulty, pos),
                );
            }
            this.spawnTimer = this.spawnInterval;
        }

        const living = gameState.enemies.some(
            (e) => !e.dead && !e.reachedNest,
        );
        if (this.spawnQueue.length === 0 && !living) {
            this.active = false;
            this.justCleared = true;
        }
    }

    serialize() {
        return {
            currentWave: this.currentWave,
            active: this.active,
            spawnQueue: this.spawnQueue.slice(),
            spawnTimer: this.spawnTimer,
        };
    }

    loadState(data) {
        if (!data) return;
        this.currentWave = data.currentWave || 0;
        this.active = !!data.active;
        this.spawnQueue = Array.isArray(data.spawnQueue)
            ? data.spawnQueue.slice()
            : [];
        this.spawnTimer = data.spawnTimer || 0;
        this.justCleared = false;
    }

    previewText() {
        if (this.currentWave >= TOTAL_WAVES) return "All waves cleared!";
        const w = WAVES[this.currentWave];
        const parts = [];
        if (w.scouts) parts.push(`${w.scouts} scout`);
        if (w.burrow) parts.push(`${w.burrow} burrow`);
        if (w.alpha) parts.push(`${w.alpha} alpha`);
        return `Next: ${parts.join(", ")}`;
    }
}
