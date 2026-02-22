"use strict";

// ============================================================
// RENDERER
// Depends on: constants.js, game.js (game),
//             entities.js (Building, Unit, ResourceNode)
// ============================================================
class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
    }

    render(sel, moveIndicators) {
        const { ctx, canvas } = this;
        const cam = game.camera;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!game.map || !cam) return;

        ctx.save();
        ctx.scale(cam.zoom, cam.zoom);
        ctx.translate(-cam.x, -cam.y);

        this._tiles(game.map, cam);
        this._resourceNodes(game.map.resourceNodes);
        this._buildings(game.buildings);
        if (game.enemy) {
            this._enemyBuildings(game.enemy.buildings);
        }
        this._units(game.units);
        if (game.enemy) {
            this._enemyUnits(
                game.enemy.workers, game.enemy.combatUnits
            );
        }
        if (game.placingType) this._placementGhost();

        ctx.restore();

        // Screen-space overlays
        if (sel.active) this._selectionBox(sel);
        this._moveIndicators(moveIndicators);
        this._minimap();
    }

    _tiles(map, cam) {
        const { ctx } = this;
        const ts = TILE_SIZE;
        const startX = Math.max(0, Math.floor(cam.x / ts));
        const startY = Math.max(0, Math.floor(cam.y / ts));
        const endX = Math.min(
            map.w,
            Math.ceil(
                (cam.x + this.canvas.width / cam.zoom) / ts
            )
        );
        const endY = Math.min(
            map.h,
            Math.ceil(
                (cam.y + this.canvas.height / cam.zoom) / ts
            )
        );

        for (let ty = startY; ty < endY; ty++) {
            for (let tx = startX; tx < endX; tx++) {
                const t = map.getTile(tx, ty);
                ctx.fillStyle = TILE_COLOR[t];
                ctx.fillRect(
                    tx * ts,
                    ty * ts,
                    ts,
                    ts
                );
                ctx.strokeStyle = TILE_BORDER[t];
                ctx.lineWidth = 0.5;
                ctx.strokeRect(tx * ts, ty * ts, ts, ts);
            }
        }
    }

    _resourceNodes(nodes) {
        const { ctx } = this;
        const ts = TILE_SIZE;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `${ts * 0.78}px serif`;

        for (const node of nodes) {
            if (node.apples <= 0) continue;
            const frac = node.apples / node.maxApples;
            ctx.globalAlpha = 0.35 + 0.65 * frac;
            ctx.fillText("🌳", node.x, node.y);
            ctx.globalAlpha = 1;
            // Apple count badge
            ctx.font = "9px Arial";
            ctx.fillStyle = "#fff";
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 2;
            ctx.strokeText(node.apples, node.x, node.y + 16);
            ctx.fillText(node.apples, node.x, node.y + 16);
            ctx.font = `${ts * 0.78}px serif`;
        }
        ctx.globalAlpha = 1;
    }

    _buildings(buildings) {
        const { ctx } = this;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `${TILE_SIZE}px serif`;

        for (const b of buildings) {
            if (b.selected) {
                ctx.strokeStyle = "#4caf50";
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.arc(
                    b.x,
                    b.y,
                    b.radius + 5,
                    0,
                    Math.PI * 2
                );
                ctx.stroke();
            }
            ctx.fillText(BUILDING_DEFS[b.type].emoji, b.x, b.y);

            // HP bar
            this._hpBar(b.x, b.y + b.radius + 4, b.hp, b.maxHp);

            // Train progress bar
            if (b.training) {
                const def = BUILDING_DEFS[b.type];
                const tt = def.trainTime || TRAIN_TIME;
                const prog = b.trainTimer / tt;
                ctx.fillStyle = "rgba(0,0,0,0.55)";
                ctx.fillRect(b.x - 18, b.y + b.radius + 10, 36, 4);
                ctx.fillStyle = "#4caf50";
                ctx.fillRect(
                    b.x - 18,
                    b.y + b.radius + 10,
                    36 * prog,
                    4
                );
            }
        }
    }

    _units(units) {
        const { ctx } = this;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        for (const u of units) {
            const def = UNIT_DEFS[u.unitType] || UNIT_DEFS.WORKER;
            // Coloured background circle
            ctx.beginPath();
            ctx.arc(u.x, u.y, u.radius, 0, Math.PI * 2);
            ctx.fillStyle = def.color;
            ctx.globalAlpha = 0.55;
            ctx.fill();
            ctx.globalAlpha = 1;

            if (u.selected) {
                ctx.strokeStyle = "#4caf50";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(u.x, u.y, u.radius + 3, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.font = `${TILE_SIZE * def.fontSize}px serif`;
            ctx.fillText("🪿", u.x, u.y);
            this._hpBar(u.x, u.y - u.radius - 5, u.hp, u.maxHp);

            // Carry indicator
            if (u.carriedApples > 0) {
                ctx.font = "9px Arial";
                ctx.fillStyle = "#FFD700";
                ctx.strokeStyle = "#000";
                ctx.lineWidth = 2;
                const lbl = `🍎${u.carriedApples}`;
                ctx.strokeText(lbl, u.x + 10, u.y - 14);
                ctx.fillText(lbl, u.x + 10, u.y - 14);
            }
        }
    }

    _hpBar(cx, cy, hp, maxHp) {
        const { ctx } = this;
        const w = 24,
            h = 3;
        const frac = hp / maxHp;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(cx - w / 2, cy, w, h);
        ctx.fillStyle =
            frac > 0.6
                ? "#4caf50"
                : frac > 0.3
                ? "#ffc107"
                : "#f44336";
        ctx.fillRect(cx - w / 2, cy, w * frac, h);
    }

    _selectionBox(sel) {
        const { ctx } = this;
        const rx = Math.min(sel.x1, sel.x2),
            ry = Math.min(sel.y1, sel.y2);
        const rw = Math.abs(sel.x2 - sel.x1),
            rh = Math.abs(sel.y2 - sel.y1);
        ctx.fillStyle = "rgba(76,175,80,0.08)";
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeStyle = "#4caf50";
        ctx.lineWidth = 1;
        ctx.strokeRect(rx, ry, rw, rh);
    }

    _placementGhost() {
        const { ctx } = this;
        const def = BUILDING_DEFS[game.placingType];
        const tx = Math.floor(game.mouseWorld.x / TILE_SIZE);
        const ty = Math.floor(game.mouseWorld.y / TILE_SIZE);
        const valid = game.canPlaceBuilding(tx, ty, game.placingType);
        // Tile highlight
        ctx.fillStyle = valid
            ? "rgba(76,175,80,0.25)"
            : "rgba(244,67,54,0.30)";
        ctx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        // Ghost emoji
        ctx.globalAlpha = 0.65;
        ctx.font = `${TILE_SIZE}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(def.emoji, (tx + 0.5) * TILE_SIZE, (ty + 0.5) * TILE_SIZE);
        ctx.globalAlpha = 1;
    }

    _moveIndicators(indicators) {
        const { ctx } = this;
        for (const m of indicators) {
            const alpha = 1 - m.t / m.dur;
            const r = m.t * 40 + 4;
            ctx.strokeStyle = `rgba(76,175,80,${alpha})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    _minimap() {
        const { ctx, canvas } = this;
        const MM_W = 120,
            MM_H = 82;
        const mx = canvas.width - MM_W - 8;
        const my = canvas.height - MM_H - 8;
        const sx = MM_W / MAP_W,
            sy = MM_H / MAP_H;

        // Border
        ctx.fillStyle = "rgba(0,0,0,0.75)";
        ctx.fillRect(mx - 2, my - 2, MM_W + 4, MM_H + 4);

        // Tiles
        for (let ty = 0; ty < MAP_H; ty++) {
            for (let tx = 0; tx < MAP_W; tx++) {
                const t = game.map.getTile(tx, ty);
                ctx.fillStyle = TILE_COLOR[t];
                ctx.fillRect(
                    mx + tx * sx,
                    my + ty * sy,
                    sx + 0.5,
                    sy + 0.5
                );
            }
        }

        // Resource nodes
        ctx.fillStyle = "#27ae60";
        for (const n of game.map.resourceNodes) {
            if (n.apples > 0) {
                ctx.fillRect(
                    mx + n.tx * sx - 1,
                    my + n.ty * sy - 1,
                    2,
                    2
                );
            }
        }

        // Buildings
        ctx.fillStyle = "#e67e22";
        for (const b of game.buildings) {
            ctx.fillRect(
                mx + (b.x / TILE_SIZE) * sx - 2,
                my + (b.y / TILE_SIZE) * sy - 2,
                4,
                4
            );
        }

        // Units
        ctx.fillStyle = "#f1c40f";
        for (const u of game.units) {
            ctx.fillRect(
                mx + (u.x / TILE_SIZE) * sx - 1,
                my + (u.y / TILE_SIZE) * sy - 1,
                2,
                2
            );
        }

        // Enemy buildings
        if (game.enemy) {
            ctx.fillStyle = "#c0392b";
            for (const b of game.enemy.buildings) {
                ctx.fillRect(
                    mx + (b.x / TILE_SIZE) * sx - 2,
                    my + (b.y / TILE_SIZE) * sy - 2,
                    4,
                    4
                );
            }
            // Enemy workers & combat units
            ctx.fillStyle = "#e74c3c";
            for (const w of game.enemy.workers) {
                ctx.fillRect(
                    mx + (w.x / TILE_SIZE) * sx - 1,
                    my + (w.y / TILE_SIZE) * sy - 1,
                    2,
                    2
                );
            }
            for (const u of game.enemy.combatUnits) {
                ctx.fillRect(
                    mx + (u.x / TILE_SIZE) * sx - 1,
                    my + (u.y / TILE_SIZE) * sy - 1,
                    2,
                    2
                );
            }
        }

        // Viewport rect
        const cam = game.camera;
        const vpX = mx + (cam.x / TILE_SIZE) * sx;
        const vpY = my + (cam.y / TILE_SIZE) * sy;
        const vpW = (canvas.width / cam.zoom / TILE_SIZE) * sx;
        const vpH = (canvas.height / cam.zoom / TILE_SIZE) * sy;
        ctx.strokeStyle = "rgba(255,255,255,0.7)";
        ctx.lineWidth = 1;
        ctx.strokeRect(vpX, vpY, vpW, vpH);

        // Label
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.font = "9px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText("MAP", mx + 3, my + 3);
    }

    _enemyBuildings(buildings) {
        const { ctx } = this;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `${TILE_SIZE}px serif`;
        for (const b of buildings) {
            ctx.fillText("🪺", b.x, b.y);
            this._hpBar(b.x, b.y + b.radius + 4, b.hp, b.maxHp);
            if (b.training) {
                const tt = b.queuedUnit === "worker" ? TRAIN_TIME : 8;
                const prog = b.trainTimer / tt;
                ctx.fillStyle = "rgba(0,0,0,0.55)";
                ctx.fillRect(b.x - 18, b.y + b.radius + 10, 36, 4);
                ctx.fillStyle = "#e74c3c";
                ctx.fillRect(
                    b.x - 18,
                    b.y + b.radius + 10,
                    36 * prog,
                    4
                );
            }
        }
    }

    _enemyUnits(workers, combatUnits) {
        const { ctx } = this;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `${TILE_SIZE * 0.72}px serif`;
        // Fox workers
        for (const w of workers) {
            ctx.fillText("🦊", w.x, w.y);
            this._hpBar(w.x, w.y - w.radius - 5, w.hp, w.maxHp);
            if (w.carriedApples > 0) {
                ctx.font = "9px Arial";
                ctx.fillStyle = "#FFD700";
                ctx.strokeStyle = "#000";
                ctx.lineWidth = 2;
                const lbl = `🍎${w.carriedApples}`;
                ctx.strokeText(lbl, w.x + 10, w.y - 14);
                ctx.fillText(lbl, w.x + 10, w.y - 14);
                ctx.font = `${TILE_SIZE * 0.72}px serif`;
            }
        }
        // Wolf combat units
        for (const u of combatUnits) {
            ctx.font = `${TILE_SIZE * 0.72}px serif`;
            ctx.fillText("🐺", u.x, u.y);
            this._hpBar(u.x, u.y - u.radius - 5, u.hp, u.maxHp);
        }
    }
}
