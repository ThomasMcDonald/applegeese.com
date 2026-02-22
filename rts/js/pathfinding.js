"use strict";

// ============================================================
// A* PATHFINDING
// Depends on: constants.js (TILE_SIZE, MAX_PATH_ITERS)
// ============================================================
function aStar(map, x0, y0, x1, y1) {
    if (!map.isWalkable(x1, y1)) return [];
    if (x0 === x1 && y0 === y1) return [];

    const key = (x, y) => x + y * map.w;
    const heur = (x, y) =>
        Math.abs(x - x1) + Math.abs(y - y1);

    // open: Map<key, {x,y,f}>
    const open = new Map();
    const closed = new Set();
    const parent = new Map(); // child_key -> parent {x,y}
    const gCost = new Map();

    const sk = key(x0, y0);
    open.set(sk, { x: x0, y: y0, f: heur(x0, y0) });
    gCost.set(sk, 0);

    const DIRS = [
        [-1, 0, 1],
        [1, 0, 1],
        [0, -1, 1],
        [0, 1, 1],
        [-1, -1, 1.4],
        [1, -1, 1.4],
        [-1, 1, 1.4],
        [1, 1, 1.4],
    ];

    let iters = 0;
    while (open.size > 0 && iters++ < MAX_PATH_ITERS) {
        // Find lowest-f node
        let curKey = null,
            curF = Infinity;
        for (const [k, v] of open) {
            if (v.f < curF) {
                curF = v.f;
                curKey = k;
            }
        }
        const cur = open.get(curKey);
        open.delete(curKey);
        closed.add(curKey);

        if (cur.x === x1 && cur.y === y1) {
            // Reconstruct — walk parent chain from goal to start
            const path = [];
            let ck = curKey;
            while (parent.has(ck)) {
                const p = parent.get(ck);
                path.unshift({
                    x: (p.x + 0.5) * TILE_SIZE,
                    y: (p.y + 0.5) * TILE_SIZE,
                });
                ck = key(p.x, p.y);
            }
            path.push({
                x: (x1 + 0.5) * TILE_SIZE,
                y: (y1 + 0.5) * TILE_SIZE,
            });
            // Drop first waypoint (unit already at start tile)
            if (path.length > 1) path.shift();
            return path;
        }

        for (const [dx, dy, cost] of DIRS) {
            const nx = cur.x + dx,
                ny = cur.y + dy;
            if (!map.isWalkable(nx, ny)) continue;
            const nk = key(nx, ny);
            if (closed.has(nk)) continue;
            const ng = (gCost.get(curKey) || 0) + cost;
            if (!open.has(nk) || ng < (gCost.get(nk) || Infinity)) {
                gCost.set(nk, ng);
                parent.set(nk, cur);
                open.set(nk, {
                    x: nx,
                    y: ny,
                    f: ng + heur(nx, ny),
                });
            }
        }
    }
    return [];
}
