"use strict";

class FlowField {
    constructor(map) {
        this.map = map;
        this.cols = map.cols;
        this.rows = map.rows;
        this.dist = [];
        this.vx = [];
        this.vy = [];
        this.maxDist = 1;
        this.rebuild();
    }

    rebuild() {
        const cols = this.cols;
        const rows = this.rows;
        const INF = 1e9;

        this.dist = Array.from({ length: rows }, () =>
            Array(cols).fill(INF),
        );
        this.vx = Array.from({ length: rows }, () => Array(cols).fill(0));
        this.vy = Array.from({ length: rows }, () => Array(cols).fill(0));

        const nestC = NEST_COL;
        const nestR = NEST_ROW;
        this.dist[nestR][nestC] = 0;

        const queue = [{ c: nestC, r: nestR }];
        // 4-connected BFS for correct uniform-cost distances
        const dirs4 = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
        ];
        const dirs8 = [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
            [1, 1],
            [1, -1],
            [-1, 1],
            [-1, -1],
        ];

        let qi = 0;
        while (qi < queue.length) {
            const { c, r } = queue[qi++];
            const d = this.dist[r][c];
            for (const [dc, dr] of dirs4) {
                const nc = c + dc;
                const nr = r + dr;
                if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
                if (!this.map.isWalkable(nc, nr)) continue;
                const nd = d + 1;
                if (nd < this.dist[nr][nc]) {
                    this.dist[nr][nc] = nd;
                    queue.push({ c: nc, r: nr });
                }
            }
        }

        let maxD = 1;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (this.dist[r][c] < INF && this.dist[r][c] > maxD) {
                    maxD = this.dist[r][c];
                }
            }
        }
        this.maxDist = maxD;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (!this.map.isWalkable(c, r) || this.dist[r][c] >= INF) {
                    this.vx[r][c] = 0;
                    this.vy[r][c] = 0;
                    continue;
                }
                if (c === nestC && r === nestR) {
                    this.vx[r][c] = 0;
                    this.vy[r][c] = 0;
                    continue;
                }

                let bestD = this.dist[r][c];
                let bestDc = 0;
                let bestDr = 0;
                for (const [dc, dr] of dirs8) {
                    const nc = c + dc;
                    const nr = r + dr;
                    if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
                    if (!this.map.isWalkable(nc, nr)) continue;
                    if (this.dist[nr][nc] < bestD) {
                        bestD = this.dist[nr][nc];
                        bestDc = dc;
                        bestDr = dr;
                    }
                }
                const len = Math.sqrt(bestDc * bestDc + bestDr * bestDr) || 1;
                this.vx[r][c] = bestDc / len;
                this.vy[r][c] = bestDr / len;
            }
        }
    }

    sampleFlow(wx, wy) {
        const fx = wx / TILE_SIZE - 0.5;
        const fy = wy / TILE_SIZE - 0.5;
        const c0 = Math.floor(fx);
        const r0 = Math.floor(fy);
        const tx = fx - c0;
        const ty = fy - r0;

        const sample = (c, r) => {
            if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) {
                return { vx: 0, vy: 0, dist: this.maxDist };
            }
            if (!this.map.isWalkable(c, r)) {
                return { vx: 0, vy: 0, dist: this.maxDist };
            }
            return {
                vx: this.vx[r][c],
                vy: this.vy[r][c],
                dist: this.dist[r][c],
            };
        };

        const a = sample(c0, r0);
        const b = sample(c0 + 1, r0);
        const c = sample(c0, r0 + 1);
        const d = sample(c0 + 1, r0 + 1);

        const vx =
            a.vx * (1 - tx) * (1 - ty) +
            b.vx * tx * (1 - ty) +
            c.vx * (1 - tx) * ty +
            d.vx * tx * ty;
        const vy =
            a.vy * (1 - tx) * (1 - ty) +
            b.vy * tx * (1 - ty) +
            c.vy * (1 - tx) * ty +
            d.vy * tx * ty;
        const dist =
            a.dist * (1 - tx) * (1 - ty) +
            b.dist * tx * (1 - ty) +
            c.dist * (1 - tx) * ty +
            d.dist * tx * ty;

        const len = Math.sqrt(vx * vx + vy * vy);
        if (len < 0.01) {
            // Fallback: steer toward nest center
            const nx = (NEST_COL + 0.5) * TILE_SIZE - wx;
            const ny = (NEST_ROW + 0.5) * TILE_SIZE - wy;
            const nlen = Math.sqrt(nx * nx + ny * ny) || 1;
            return { vx: nx / nlen, vy: ny / nlen, dist };
        }
        return { vx: vx / len, vy: vy / len, dist };
    }

    /** Build a spatial hash and apply separation; returns Map of enemy -> {sx, sy} */
    computeSeparation(enemies, radius) {
        const cellSize = radius;
        const buckets = new Map();
        const key = (cx, cy) => `${cx},${cy}`;

        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (e.dead || e.reachedNest) continue;
            const cx = Math.floor(e.x / cellSize);
            const cy = Math.floor(e.y / cellSize);
            const k = key(cx, cy);
            if (!buckets.has(k)) buckets.set(k, []);
            buckets.get(k).push(e);
        }

        const result = new Map();
        const rSq = radius * radius;

        for (const e of enemies) {
            if (e.dead || e.reachedNest) continue;
            let sx = 0;
            let sy = 0;
            let count = 0;
            const cx = Math.floor(e.x / cellSize);
            const cy = Math.floor(e.y / cellSize);

            for (let ox = -1; ox <= 1; ox++) {
                for (let oy = -1; oy <= 1; oy++) {
                    const list = buckets.get(key(cx + ox, cy + oy));
                    if (!list) continue;
                    for (const o of list) {
                        if (o === e) continue;
                        const dx = e.x - o.x;
                        const dy = e.y - o.y;
                        const d2 = dx * dx + dy * dy;
                        if (d2 < rSq && d2 > 0.01) {
                            const d = Math.sqrt(d2);
                            const push = (radius - d) / radius;
                            sx += (dx / d) * push;
                            sy += (dy / d) * push;
                            count++;
                        }
                    }
                }
            }

            if (count > 0) {
                sx /= count;
                sy /= count;
            }
            result.set(e, { sx, sy });
        }
        return result;
    }
}

function pickSpawnPosition(map) {
    const band = map.spawnBand;
    if (!band || band.length === 0) {
        return { x: TILE_SIZE * 0.4, y: CANVAS_H / 2 };
    }
    const cell = band[Math.floor(Math.random() * band.length)];
    return {
        x: (cell.c + 0.15 + Math.random() * 0.5) * TILE_SIZE,
        y: (cell.r + 0.15 + Math.random() * 0.7) * TILE_SIZE,
    };
}
