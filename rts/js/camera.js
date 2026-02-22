"use strict";

// ============================================================
// CAMERA
// Depends on: constants.js (MAP_W, MAP_H, TILE_SIZE), utils.js (clamp)
// ============================================================
class Camera {
    constructor(w, h) {
        this.x = 0;
        this.y = 0;
        this.zoom = 1.0;
        this.w = w;
        this.h = h;
    }

    worldToScreen(wx, wy) {
        return {
            x: (wx - this.x) * this.zoom,
            y: (wy - this.y) * this.zoom,
        };
    }

    screenToWorld(sx, sy) {
        return {
            x: sx / this.zoom + this.x,
            y: sy / this.zoom + this.y,
        };
    }

    clamp() {
        const maxX =
            MAP_W * TILE_SIZE - this.w / this.zoom;
        const maxY =
            MAP_H * TILE_SIZE - this.h / this.zoom;
        this.x = clamp(this.x, 0, Math.max(0, maxX));
        this.y = clamp(this.y, 0, Math.max(0, maxY));
    }

    pan(dx, dy) {
        this.x += dx / this.zoom;
        this.y += dy / this.zoom;
        this.clamp();
    }

    zoomAt(sx, sy, delta) {
        const wb = this.screenToWorld(sx, sy);
        this.zoom = clamp(
            this.zoom * (1 - delta * 0.001),
            0.4,
            2.5
        );
        const wa = this.screenToWorld(sx, sy);
        this.x += wb.x - wa.x;
        this.y += wb.y - wa.y;
        this.clamp();
    }
}
