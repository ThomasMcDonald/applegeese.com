"use strict";

function cellKey(c, r) {
    return `${c},${r}`;
}

class GameMap {
    constructor() {
        this.cols = MAP_COLS;
        this.rows = MAP_ROWS;
        this.grid = [];
        this.spawnBand = [];
        this.buildable = new Set();

        for (let r = 0; r < this.rows; r++) {
            const row = [];
            for (let c = 0; c < this.cols; c++) {
                row.push(TILE.GRASS);
            }
            this.grid.push(row);
        }

        // Nest
        this.grid[NEST_ROW][NEST_COL] = TILE.NEST;

        // Obstacle clusters — create channels / bottlenecks
        this._fillRect(4, 2, 6, 4, TILE.WALL);
        this._fillRect(4, 9, 6, 11, TILE.WALL);
        this._fillRect(9, 5, 11, 8, TILE.WATER);
        this._fillRect(13, 1, 15, 3, TILE.WALL);
        this._fillRect(13, 10, 15, 12, TILE.WATER);
        this._fillRect(16, 5, 17, 6, TILE.WALL);
        this._fillRect(16, 8, 17, 9, TILE.WALL);
        // Leave a gap at mid-left so spawn can enter
        this.grid[6][4] = TILE.GRASS;
        this.grid[7][4] = TILE.GRASS;
        this.grid[8][4] = TILE.GRASS;

        // Restore nest in case overwritten
        this.grid[NEST_ROW][NEST_COL] = TILE.NEST;

        this._computeBuildable();
        this._computeSpawnBand();
    }

    _fillRect(c0, r0, c1, r1, type) {
        for (let r = r0; r <= r1; r++) {
            for (let c = c0; c <= c1; c++) {
                if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) continue;
                if (c === NEST_COL && r === NEST_ROW) continue;
                this.grid[r][c] = type;
            }
        }
    }

    isWalkable(c, r) {
        if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return false;
        const t = this.grid[r][c];
        return t === TILE.GRASS || t === TILE.NEST;
    }

    _computeBuildable() {
        this.buildable.clear();
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c] === TILE.GRASS) {
                    // Keep spawn edge mostly clear of builds for readability
                    if (c === 0) continue;
                    this.buildable.add(cellKey(c, r));
                }
            }
        }
    }

    _computeSpawnBand() {
        this.spawnBand = [];
        for (let r = 0; r < this.rows; r++) {
            if (this.isWalkable(0, r)) {
                this.spawnBand.push({ c: 0, r });
            }
            if (this.isWalkable(1, r)) {
                this.spawnBand.push({ c: 1, r });
            }
        }
        // Fallback if obstacles block left edge
        if (this.spawnBand.length === 0) {
            for (let r = 0; r < this.rows; r++) {
                this.grid[r][0] = TILE.GRASS;
                this.spawnBand.push({ c: 0, r });
            }
            this._computeBuildable();
        }
    }

    canBuild(c, r) {
        if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return false;
        return this.buildable.has(cellKey(c, r));
    }

    tileAt(c, r) {
        if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return null;
        return this.grid[r][c];
    }

    worldToCell(wx, wy) {
        return {
            c: Math.floor(wx / TILE_SIZE),
            r: Math.floor(wy / TILE_SIZE),
        };
    }
}
