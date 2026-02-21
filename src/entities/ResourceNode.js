/**
 * ResourceNode.js — Orchard Warfare RTS Engine
 * Represents an Apple Tree resource node on the map.
 *
 * Usage (browser):
 *   <script src="src/entities/ResourceNode.js"></script>
 *   const tree = new Tree(x, y);
 *
 * Usage (Node.js / tests):
 *   const { Tree } = require('./src/entities/ResourceNode');
 */

const TREE_MAX_APPLES = 50;
const TREE_GATHER_INTERVAL = 60; // frames between each gather tick (~1 s at 60 fps)

class Tree {
    /**
     * @param {number} x         - Canvas x position (center of canopy)
     * @param {number} y         - Canvas y position (center of canopy)
     * @param {number} [apples]  - Starting apple quantity (defaults to TREE_MAX_APPLES)
     */
    constructor(x, y, apples = TREE_MAX_APPLES) {
        this.x = x;
        this.y = y;
        this.apples = apples;
        this.maxApples = TREE_MAX_APPLES;
        this.assignedUnits = [];
        this.gatherTimer = 0;
        /** @type {'idle'|'gathering'|'depleted'} */
        this.state = 'idle';
    }

    // ─── Unit assignment ──────────────────────────────────────────────────────

    /**
     * Assign a unit to this tree so it begins gathering.
     * @param {object} unit
     */
    assignUnit(unit) {
        if (!this.assignedUnits.includes(unit) && this.state !== 'depleted') {
            this.assignedUnits.push(unit);
            this.state = 'gathering';
        }
    }

    /**
     * Remove a unit from this tree.
     * @param {object} unit
     */
    removeUnit(unit) {
        this.assignedUnits = this.assignedUnits.filter(u => u !== unit);
        if (this.assignedUnits.length === 0 && this.state === 'gathering') {
            this.state = 'idle';
        }
    }

    // ─── Game loop ────────────────────────────────────────────────────────────

    /**
     * Advance the tree by one frame.
     * When in gathering state, every TREE_GATHER_INTERVAL frames each assigned
     * unit collects one apple and increments gameState.apples.
     *
     * @param {{ apples: number }} gameState - Shared game state object whose
     *   `apples` property is incremented by the amount gathered.
     * @returns {number} Number of apples gathered this frame (0 most frames).
     */
    update(gameState) {
        if (this.state !== 'gathering' || this.apples <= 0) {
            return 0;
        }

        this.gatherTimer++;
        if (this.gatherTimer < TREE_GATHER_INTERVAL) {
            return 0;
        }

        this.gatherTimer = 0;

        // Each assigned unit gathers one apple per tick, capped by available supply
        const gathered = Math.min(this.assignedUnits.length, this.apples);
        this.apples -= gathered;
        gameState.apples += gathered;

        if (this.apples <= 0) {
            this.apples = 0;
            this.state = 'depleted';
            this.assignedUnits = [];
        }

        return gathered;
    }

    // ─── Visual helpers ───────────────────────────────────────────────────────

    /**
     * Canopy radius — shrinks as apples are depleted.
     * @returns {number} Radius in pixels.
     */
    get radius() {
        const ratio = this.apples / this.maxApples;
        return 8 + ratio * 16; // ranges from 24 px (full) down to 8 px (empty)
    }

    /**
     * Canopy color — green when healthy, browns as depleted.
     * @returns {string} CSS color string.
     */
    get color() {
        const ratio = this.apples / this.maxApples;
        if (ratio > 0.6) return '#2d8a2d'; // healthy green
        if (ratio > 0.3) return '#8a8a2d'; // yellowing
        if (ratio > 0)   return '#8a4a2d'; // browning
        return '#5a3a1a';                  // depleted
    }

    /**
     * Draw the tree onto a 2D canvas context.
     * @param {CanvasRenderingContext2D} ctx
     */
    draw(ctx) {
        const ratio = this.apples / this.maxApples;
        const r = this.radius;

        // Gathering highlight ring
        if (this.state === 'gathering') {
            ctx.beginPath();
            ctx.arc(this.x, this.y, r + 5, 0, Math.PI * 2);
            ctx.strokeStyle = '#ffcc00';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Trunk
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(this.x - 4, this.y + Math.floor(r * 0.5), 8, Math.ceil(r * 0.8));

        // Canopy
        ctx.beginPath();
        ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Apple dots (visible while tree has meaningful supply)
        if (ratio > 0.05) {
            const dotCount = Math.max(1, Math.round(ratio * 5));
            ctx.fillStyle = '#e03030';
            for (let i = 0; i < dotCount; i++) {
                const angle = (i / dotCount) * Math.PI * 2 - Math.PI / 2;
                const ax = this.x + Math.cos(angle) * r * 0.5;
                const ay = this.y + Math.sin(angle) * r * 0.5;
                ctx.beginPath();
                ctx.arc(ax, ay, 2.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Apple count label
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = `bold ${Math.max(9, Math.round(r * 0.55))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.apples, this.x, this.y);
    }
}

// ─── Export ───────────────────────────────────────────────────────────────────

// Support both plain browser scripts and CommonJS (e.g. Node.js tests)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Tree, TREE_MAX_APPLES, TREE_GATHER_INTERVAL };
}
