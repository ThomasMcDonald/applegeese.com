"use strict";

class InputHandler {
    constructor(canvas, renderer) {
        this.canvas = canvas;
        this.renderer = renderer;
        this.isTouchDevice =
            "ontouchstart" in window || navigator.maxTouchPoints > 0;

        canvas.addEventListener("mousemove", (e) => this.onMove(e));
        canvas.addEventListener("mouseleave", () => {
            game.hoverCell = null;
        });
        canvas.addEventListener("click", (e) => this.onClick(e));
        canvas.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            this.onRightClick(e);
        });

        // Touch
        canvas.addEventListener(
            "touchstart",
            (e) => {
                if (e.touches.length !== 1) return;
                e.preventDefault();
                const t = e.touches[0];
                this._touchStart = { x: t.clientX, y: t.clientY, time: Date.now() };
            },
            { passive: false },
        );
        canvas.addEventListener(
            "touchend",
            (e) => {
                if (!this._touchStart) return;
                e.preventDefault();
                const t = e.changedTouches[0];
                const dx = t.clientX - this._touchStart.x;
                const dy = t.clientY - this._touchStart.y;
                const held = Date.now() - this._touchStart.time;
                if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
                    if (held > 450) {
                        this.handleRightAt(t.clientX, t.clientY);
                    } else {
                        this.handleClickAt(t.clientX, t.clientY);
                    }
                }
                this._touchStart = null;
            },
            { passive: false },
        );

        window.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                if (game.paused) {
                    resumeGame();
                    return;
                }
                if (game.playing && clearTowerSelection()) {
                    return;
                }
                if (game.playing) pauseGame();
            }
            if (e.key === " " && game.playing && !game.paused) {
                e.preventDefault();
                game.startWave();
                updateHud();
            }
            const num = parseInt(e.key, 10);
            if (num >= 1 && num <= 4) {
                selectTowerType(TOWER_TYPES[num - 1]);
            }
        });
    }

    cellFromEvent(clientX, clientY) {
        const world = this.renderer.screenToWorld(clientX, clientY);
        return game.map
            ? game.map.worldToCell(world.x, world.y)
            : { c: -1, r: -1 };
    }

    onMove(e) {
        if (!game.map || !game.playing) return;
        game.hoverCell = this.cellFromEvent(e.clientX, e.clientY);
    }

    onClick(e) {
        this.handleClickAt(e.clientX, e.clientY);
    }

    onRightClick(e) {
        this.handleRightAt(e.clientX, e.clientY);
    }

    handleClickAt(clientX, clientY) {
        if (!game.map || !game.playing || game.paused) return;
        const { c, r } = this.cellFromEvent(clientX, clientY);
        const existing = game.towerAt(c, r);

        if (existing) {
            // Toggle: click same tower again to deselect
            if (game.selectedTower === existing) {
                game.selectedTower = null;
            } else {
                game.selectedTower = existing;
            }
            updateSellPanel();
            return;
        }

        // Empty cell — clear placed-tower selection
        if (game.selectedTower) {
            game.selectedTower = null;
            updateSellPanel();
        }

        // Only place if a shop tower type is selected
        if (!game.selectedTowerType) return;

        if (!game.map.canBuild(c, r)) return;

        game.placeTower(c, r);
        updateHud();
    }

    handleRightAt(clientX, clientY) {
        if (!game.map || !game.playing || game.paused) return;
        const { c, r } = this.cellFromEvent(clientX, clientY);
        const existing = game.towerAt(c, r);
        if (existing) {
            game.sellTower(existing);
            updateSellPanel();
            updateHud();
        } else if (game.selectedTower || game.selectedTowerType) {
            clearTowerSelection();
        }
    }
}

/** Clears placed-tower selection and/or shop type. Returns true if anything cleared. */
function clearTowerSelection() {
    let cleared = false;
    if (game.selectedTower) {
        game.selectedTower = null;
        updateSellPanel();
        cleared = true;
    }
    if (game.selectedTowerType) {
        clearTowerType();
        cleared = true;
    }
    return cleared;
}

function clearTowerType() {
    game.selectedTowerType = null;
    document.querySelectorAll(".tower-btn").forEach((btn) => {
        btn.classList.remove("active");
    });
    document.querySelectorAll(".mobile-tower-btn").forEach((btn) => {
        btn.classList.remove("active");
    });
    updateTowerInfo(null);
}

function selectTowerType(type) {
    if (!TOWER_DEFS[type]) return;

    // Clicking the active type again deselects placement mode
    if (game.selectedTowerType === type) {
        game.selectedTower = null;
        updateSellPanel();
        clearTowerType();
        return;
    }

    game.selectedTowerType = type;
    game.selectedTower = null;
    updateSellPanel();
    updateTowerInfo(type);
    document.querySelectorAll(".tower-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.type === type);
    });
    document.querySelectorAll(".mobile-tower-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.type === type);
    });
}

function towerStatsText(def) {
    if (!def) return "";
    if (def.noAttack) {
        return `Buff: +${Math.round((def.buffMult - 1) * 100)}% attack speed · radius ${def.buffRadius}`;
    }
    const parts = [
        `${def.damage} dmg`,
        `${def.range} range`,
        `${def.fireRate}/s`,
    ];
    if (def.slow) parts.push(`${Math.round(def.slow * 100)}% slow`);
    if (def.splash) parts.push(`splash ${def.splash}`);
    return parts.join(" · ");
}

function updateTowerInfo(type) {
    const emoji = document.getElementById("tower-info-emoji");
    const name = document.getElementById("tower-info-name");
    const desc = document.getElementById("tower-info-desc");
    if (!emoji || !name || !desc) return;

    if (!type || !TOWER_DEFS[type]) {
        emoji.textContent = "👆";
        name.textContent = "No tower selected";
        desc.textContent =
            "Pick a tower to place, or click a placed tower to inspect. Esc to deselect.";
        return;
    }

    const def = TOWER_DEFS[type];
    emoji.textContent = def.emoji;
    name.textContent = def.name;
    desc.textContent = def.tooltip || def.desc;
}
