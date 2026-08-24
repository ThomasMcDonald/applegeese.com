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

function towerStatsText(stats, extras) {
    if (!stats) return "";
    if (extras && extras.noAttack) {
        return `Buff: +${Math.round((stats.buffMult - 1) * 100)}% attack speed · radius ${stats.buffRadius}`;
    }
    const parts = [
        `${stats.damage} dmg`,
        `${stats.range} range`,
        `${stats.fireRate}/s`,
    ];
    if (stats.slow) parts.push(`${Math.round(stats.slow * 100)}% slow`);
    if (stats.slowDuration) parts.push(`${stats.slowDuration}s`);
    if (stats.splash) parts.push(`splash ${stats.splash}`);
    if (stats.multiShot) parts.push(`×${stats.multiShot} targets`);
    return parts.join(" · ");
}

function towerNextTierPreview(tower) {
    if (!tower.canUpgrade) return "Max tier";
    const next = tower.def.tiers[tower.tier];
    if (!next) return "";
    const bits = [];
    if (next.damage != null && next.damage !== tower.stats.damage) {
        bits.push(`${next.damage} dmg`);
    }
    if (next.range != null && next.range !== tower.stats.range) {
        bits.push(`${next.range} rng`);
    }
    if (next.fireRate != null && next.fireRate !== tower.stats.fireRate) {
        bits.push(`${next.fireRate}/s`);
    }
    if (next.slow != null) {
        bits.push(`${Math.round(next.slow * 100)}% slow`);
    }
    if (next.splash != null) bits.push(`splash ${next.splash}`);
    if (next.multiShot) bits.push(`×${next.multiShot}`);
    return bits.length ? `Next: ${bits.join(" · ")}` : "Upgrade available";
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
            "Pick a tower to place, or click a placed tower to inspect / upgrade. Esc to deselect.";
        return;
    }

    const def = TOWER_DEFS[type];
    emoji.textContent = def.emoji;
    name.textContent = def.name;
    const t1 = def.tiers[0];
    const stats = towerStatsText(t1, def);
    const tierNote =
        def.maxTier > 1 ? ` · upgrades to T${def.maxTier}` : "";
    desc.textContent = `${def.tooltip || def.desc} (${stats}${tierNote})`;
}
