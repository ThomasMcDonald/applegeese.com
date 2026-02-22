"use strict";

// ============================================================
// GAME MAP
// Depends on: constants.js (TILE, TILE_SIZE, MAP_W, MAP_H),
//             utils.js (dist2), entities.js (ResourceNode)
// ============================================================
class GameMap {
    constructor(w, h) {
        this.w = w;
        this.h = h;
        this.tiles = this._generate();
        this.resourceNodes = [];
        this._placeResources();
    }

    _generate() {
        const tiles = new Uint8Array(this.w * this.h).fill(
            TILE.GRASS
        );

        // Guarantee walkable start zone (tiles 1–10 in each axis)
        for (let ty = 1; ty < 10; ty++) {
            for (let tx = 1; tx < 10; tx++) {
                tiles[ty * this.w + tx] = TILE.GRASS;
            }
        }

        // Scatter water lakes
        for (let l = 0; l < 4; l++) {
            const cx =
                12 +
                Math.floor(Math.random() * (this.w - 24));
            const cy =
                8 + Math.floor(Math.random() * (this.h - 16));
            const r = 2 + Math.floor(Math.random() * 3);
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (dx * dx + dy * dy <= r * r) {
                        const tx = cx + dx,
                            ty = cy + dy;
                        if (
                            tx >= 0 &&
                            tx < this.w &&
                            ty >= 0 &&
                            ty < this.h
                        ) {
                            tiles[ty * this.w + tx] = TILE.WATER;
                        }
                    }
                }
            }
        }

        // Scatter dirt paths
        for (let p = 0; p < 5; p++) {
            let x = Math.floor(Math.random() * this.w);
            let y = Math.floor(Math.random() * this.h);
            const len = 10 + Math.floor(Math.random() * 14);
            for (let i = 0; i < len; i++) {
                if (
                    x >= 0 &&
                    x < this.w &&
                    y >= 0 &&
                    y < this.h &&
                    tiles[y * this.w + x] === TILE.GRASS
                ) {
                    tiles[y * this.w + x] = TILE.DIRT;
                }
                x += Math.floor(Math.random() * 3) - 1;
                y += Math.floor(Math.random() * 3) - 1;
            }
        }

        // Restore start zone walkability after path placement
        for (let ty = 1; ty < 10; ty++) {
            for (let tx = 1; tx < 10; tx++) {
                if (tiles[ty * this.w + tx] === TILE.WATER) {
                    tiles[ty * this.w + tx] = TILE.GRASS;
                }
            }
        }

        // Restore enemy start zone walkability (bottom-right)
        for (let ty = this.h - 10; ty < this.h; ty++) {
            for (let tx = this.w - 10; tx < this.w; tx++) {
                if (tiles[ty * this.w + tx] === TILE.WATER) {
                    tiles[ty * this.w + tx] = TILE.GRASS;
                }
            }
        }

        return tiles;
    }

    _placeResources() {
        let placed = 0;
        let attempts = 0;
        while (placed < 18 && attempts < 1000) {
            attempts++;
            const x =
                3 + Math.floor(Math.random() * (this.w - 6));
            const y =
                3 + Math.floor(Math.random() * (this.h - 6));
            if (this.tiles[y * this.w + x] !== TILE.GRASS)
                continue;
            // Keep clear of start zone
            if (x < 10 && y < 10) continue;
            // Keep clear of enemy start zone
            if (x >= this.w - 10 && y >= this.h - 10) continue;
            let tooClose = false;
            for (const t of this.resourceNodes) {
                if (dist2(x, y, t.tx, t.ty) < 16) {
                    tooClose = true;
                    break;
                }
            }
            if (!tooClose) {
                this.resourceNodes.push(new ResourceNode(x, y));
                placed++;
            }
        }
    }

    isWalkable(tx, ty) {
        if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h)
            return false;
        return this.tiles[ty * this.w + tx] !== TILE.WATER;
    }

    getTile(tx, ty) {
        if (tx < 0 || ty < 0 || tx >= this.w || ty >= this.h)
            return TILE.GRASS;
        return this.tiles[ty * this.w + tx];
    }
}
