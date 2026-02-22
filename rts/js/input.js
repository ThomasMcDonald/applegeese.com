"use strict";

// ============================================================
// INPUT HANDLER
// Depends on: constants.js, utils.js (clamp),
//             entities.js (Unit, Building, ResourceNode),
//             game.js (game), ui.js (updateInfoPanel, showPauseMenu, resumeGame)
// ============================================================
class InputHandler {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = {};
        this.mouse = { x: 0, y: 0 };
        this.dragStart = { x: 0, y: 0 };
        this.dragging = false;
        this.panning = false;
        this.panStart = { x: 0, y: 0, cx: 0, cy: 0 };
        this.minimapDragging = false;

        this.sel = {
            active: false,
            x1: 0,
            y1: 0,
            x2: 0,
            y2: 0,
        };
        this.moveIndicators = [];

        this._bind();
    }

    _pos(e) {
        const r = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - r.left,
            y: e.clientY - r.top,
        };
    }

    _minimapBounds() {
        return {
            mx: this.canvas.width - MM_W - MM_MARGIN,
            my: this.canvas.height - MM_H - MM_MARGIN,
        };
    }

    _minimapPanTo(p) {
        const { mx, my } = this._minimapBounds();
        const relX = (p.x - mx) / MM_W;
        const relY = (p.y - my) / MM_H;
        const cam = game.camera;
        cam.x = relX * MAP_W * TILE_SIZE - (this.canvas.width / cam.zoom) / 2;
        cam.y = relY * MAP_H * TILE_SIZE - (this.canvas.height / cam.zoom) / 2;
        cam.clamp();
    }

    _bind() {
        const c = this.canvas;
        c.addEventListener("mousedown", (e) =>
            this._down(e)
        );
        c.addEventListener("mousemove", (e) =>
            this._move(e)
        );
        c.addEventListener("mouseup", (e) => this._up(e));
        c.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            this._rightClick(e);
        });
        c.addEventListener(
            "wheel",
            (e) => {
                e.preventDefault();
                const p = this._pos(e);
                game.camera.zoomAt(p.x, p.y, e.deltaY);
            },
            { passive: false }
        );
        window.addEventListener("keydown", (e) =>
            this._keydown(e)
        );
        window.addEventListener("keyup", (e) => {
            this.keys[e.code] = false;
        });
    }

    _down(e) {
        const p = this._pos(e);

        // Minimap left-click navigation
        if (e.button === 0 && game.map) {
            const { mx, my } = this._minimapBounds();
            if (p.x >= mx && p.x <= mx + MM_W &&
                p.y >= my && p.y <= my + MM_H) {
                this.minimapDragging = true;
                this._minimapPanTo(p);
                this.mouse = p;
                return;
            }
        }

        if (e.button === 0) {
            this.dragStart = p;
            this.dragging = false;
            this.sel = {
                active: false,
                x1: p.x,
                y1: p.y,
                x2: p.x,
                y2: p.y,
            };
        } else if (e.button === 1) {
            this.panning = true;
            this.panStart = {
                x: p.x,
                y: p.y,
                cx: game.camera.x,
                cy: game.camera.y,
            };
        }
        this.mouse = p;
    }

    _move(e) {
        const p = this._pos(e);
        game.mouseWorld = game.camera.screenToWorld(p.x, p.y);

        // Minimap drag-to-pan
        if (this.minimapDragging) {
            this._minimapPanTo(p);
            this.mouse = p;
            return;
        }

        if (this.panning) {
            const dx = p.x - this.panStart.x;
            const dy = p.y - this.panStart.y;
            game.camera.x =
                this.panStart.cx - dx / game.camera.zoom;
            game.camera.y =
                this.panStart.cy - dy / game.camera.zoom;
            game.camera.clamp();
        }
        if (e.buttons === 1) {
            const dx = p.x - this.dragStart.x;
            const dy = p.y - this.dragStart.y;
            if (
                !this.dragging &&
                (Math.abs(dx) > 4 || Math.abs(dy) > 4)
            ) {
                this.dragging = true;
                this.sel.active = true;
            }
            if (this.dragging) {
                this.sel.x2 = p.x;
                this.sel.y2 = p.y;
            }
        }
        this.mouse = p;
    }

    _up(e) {
        const p = this._pos(e);
        const cam = game.camera;

        if (e.button === 0 && this.minimapDragging) {
            this.minimapDragging = false;
            this.mouse = p;
            return;
        }

        if (e.button === 0) {
            if (game.placingType) {
                // Placement mode: click to place building
                if (!this.dragging) {
                    const w = cam.screenToWorld(p.x, p.y);
                    const tx = Math.floor(w.x / TILE_SIZE);
                    const ty = Math.floor(w.y / TILE_SIZE);
                    const def = BUILDING_DEFS[game.placingType];
                    if (game.canPlaceBuilding(tx, ty, game.placingType)) {
                        game.resources.apples -= def.buildCost;
                        game.buildings.push(
                            new Building(tx, ty, game.placingType)
                        );
                        game.placingType = null;
                    }
                }
                this.dragging = false;
                this.sel.active = false;
                updateInfoPanel();
                this.mouse = p;
                return;
            }
            if (this.dragging) {
                // Box select
                const w1 = cam.screenToWorld(
                    Math.min(this.sel.x1, this.sel.x2),
                    Math.min(this.sel.y1, this.sel.y2)
                );
                const w2 = cam.screenToWorld(
                    Math.max(this.sel.x1, this.sel.x2),
                    Math.max(this.sel.y1, this.sel.y2)
                );
                if (!e.shiftKey) game.clearSelection();
                for (const u of game.units) {
                    if (
                        u.x >= w1.x &&
                        u.x <= w2.x &&
                        u.y >= w1.y &&
                        u.y <= w2.y
                    ) {
                        u.selected = true;
                        if (!game.selectedUnits.includes(u))
                            game.selectedUnits.push(u);
                    }
                }
                this.dragging = false;
                this.sel.active = false;
            } else {
                // Single click
                const w = cam.screenToWorld(p.x, p.y);
                const ent = game.entityAt(w.x, w.y);
                if (!e.shiftKey) game.clearSelection();
                if (ent instanceof Unit) {
                    ent.selected = true;
                    game.selectedUnits.push(ent);
                } else if (ent instanceof Building) {
                    ent.selected = true;
                    game.selectedBuilding = ent;
                }
            }
            updateInfoPanel();
        } else if (e.button === 1) {
            this.panning = false;
        }
        this.mouse = p;
    }

    _rightClick(e) {
        if (game.placingType) {
            game.placingType = null;
            updateInfoPanel();
            return;
        }
        if (game.selectedUnits.length === 0) return;
        const p = this._pos(e);
        const w = game.camera.screenToWorld(p.x, p.y);
        const tx = Math.floor(w.x / TILE_SIZE);
        const ty = Math.floor(w.y / TILE_SIZE);
        const ent = game.entityAt(w.x, w.y);

        if (
            ent instanceof ResourceNode &&
            ent.apples > 0
        ) {
            for (const u of game.selectedUnits)
                u.gatherFrom(ent, game.map);
        } else if (game.map.isWalkable(tx, ty)) {
            const n = game.selectedUnits.length;
            const cols = Math.ceil(Math.sqrt(n));
            game.selectedUnits.forEach((u, i) => {
                const ox = (i % cols) - Math.floor(cols / 2);
                const oy =
                    Math.floor(i / cols) -
                    Math.floor(cols / 2);
                const dtx = clamp(tx + ox, 0, MAP_W - 1);
                const dty = clamp(ty + oy, 0, MAP_H - 1);
                const dest = game.map.isWalkable(dtx, dty)
                    ? { tx: dtx, ty: dty }
                    : { tx, ty };
                u.sendTo(dest.tx, dest.ty, game.map);
            });
            this.moveIndicators.push({
                x: p.x,
                y: p.y,
                t: 0,
                dur: 0.55,
            });
        }
    }

    _keydown(e) {
        this.keys[e.code] = true;

        if (e.code === "KeyT" && game.selectedBuilding) {
            game.selectedBuilding.startTraining(
                game.resources
            );
            updateInfoPanel();
        }

        if (
            (e.code === "KeyA" && e.ctrlKey) ||
            (e.code === "KeyA" && e.metaKey)
        ) {
            e.preventDefault();
            game.clearSelection();
            for (const u of game.units) {
                u.selected = true;
                game.selectedUnits.push(u);
            }
            updateInfoPanel();
        }

        if (e.code === "Escape") {
            if (game.placingType) {
                game.placingType = null;
                updateInfoPanel();
                return;
            }
            if (!game.map || game.gameOver) return;
            const pauseMenu = document.getElementById("pause-menu");
            if (pauseMenu.style.display !== "none") {
                resumeGame();
                return;
            }
            if (game.selectedUnits.length > 0 || game.selectedBuilding) {
                game.clearSelection();
                updateInfoPanel();
                return;
            }
            showPauseMenu();
        }
    }

    update(dt) {
        if (!game.camera) return;
        // WASD / Arrow camera pan
        const spd = 280 * dt;
        if (this.keys["KeyW"] || this.keys["ArrowUp"])
            game.camera.y -= spd;
        if (this.keys["KeyS"] || this.keys["ArrowDown"])
            game.camera.y += spd;
        if (this.keys["KeyA"] || this.keys["ArrowLeft"])
            game.camera.x -= spd;
        if (this.keys["KeyD"] || this.keys["ArrowRight"])
            game.camera.x += spd;
        game.camera.clamp();

        // Edge scroll
        const edge = EDGE_SCROLL_ZONE,
            esc = EDGE_SCROLL_SPEED * dt;
        const cw = this.canvas.width,
            ch = this.canvas.height;
        if (this.mouse.x < edge) game.camera.x -= esc;
        if (this.mouse.x > cw - edge) game.camera.x += esc;
        if (this.mouse.y < edge) game.camera.y -= esc;
        if (this.mouse.y > ch - edge) game.camera.y += esc;
        game.camera.clamp();

        // Update cursor for placement mode
        this.canvas.style.cursor = game.placingType ? "crosshair" : "default";

        // Advance move indicators
        this.moveIndicators = this.moveIndicators.filter(
            (m) => {
                m.t += dt;
                return m.t < m.dur;
            }
        );
    }
}
