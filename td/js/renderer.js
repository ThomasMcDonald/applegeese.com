"use strict";

class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.resize();
    }

    resize() {
        const bar = document.getElementById("mobile-bar");
        const barVisible = bar && bar.style.display !== "none";
        const bottomInset = barVisible ? MOBILE_BAR_H : 0;
        const availW = window.innerWidth;
        const availH = window.innerHeight - HUD_H - bottomInset;

        this.scale = Math.min(availW / CANVAS_W, availH / CANVAS_H);
        const drawW = Math.floor(CANVAS_W * this.scale);
        const drawH = Math.floor(CANVAS_H * this.scale);

        this.canvas.width = drawW;
        this.canvas.height = drawH;
        this.canvas.style.width = `${drawW}px`;
        this.canvas.style.height = `${drawH}px`;
        this.offsetX = Math.floor((availW - drawW) / 2);
        this.offsetY = HUD_H + Math.floor((availH - drawH) / 2);
        this.canvas.style.left = `${this.offsetX}px`;
        this.canvas.style.top = `${this.offsetY}px`;
    }

    screenToWorld(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (clientX - rect.left) / this.scale;
        const y = (clientY - rect.top) / this.scale;
        return { x, y };
    }

    render() {
        const ctx = this.ctx;
        ctx.save();
        ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

        this.drawMap(ctx);
        this.drawBuildHighlights(ctx);
        this.drawTowers(ctx);
        this.drawEnemies(ctx);
        this.drawProjectiles(ctx);
        this.drawParticles(ctx);
        this.drawNest(ctx);

        if (game.messageTimer > 0 && game.message) {
            ctx.fillStyle = "rgba(0,0,0,0.65)";
            ctx.fillRect(CANVAS_W / 2 - 180, 12, 360, 32);
            ctx.fillStyle = "#fff";
            ctx.font = "bold 13px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(game.message, CANVAS_W / 2, 28);
        }

        ctx.restore();
    }

    drawMap(ctx) {
        if (!game.map) return;
        for (let r = 0; r < MAP_ROWS; r++) {
            for (let c = 0; c < MAP_COLS; c++) {
                const type = game.map.grid[r][c];
                const x = c * TILE_SIZE;
                const y = r * TILE_SIZE;
                ctx.fillStyle = TILE_COLOR[type];
                ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

                if (type === TILE.GRASS) {
                    ctx.strokeStyle = "rgba(0,0,0,0.06)";
                    ctx.strokeRect(
                        x + 0.5,
                        y + 0.5,
                        TILE_SIZE - 1,
                        TILE_SIZE - 1,
                    );
                }
                if (type === TILE.WALL) {
                    ctx.fillStyle = "rgba(0,0,0,0.2)";
                    ctx.fillRect(x + 6, y + 6, TILE_SIZE - 12, TILE_SIZE - 12);
                    ctx.strokeStyle = "rgba(0,0,0,0.35)";
                    ctx.strokeRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8);
                }
                if (type === TILE.WATER) {
                    ctx.fillStyle = "rgba(255,255,255,0.15)";
                    ctx.fillRect(x + 8, y + 10, 10, 3);
                    ctx.fillRect(x + 18, y + 22, 12, 3);
                }
            }
        }
    }

    drawBuildHighlights(ctx) {
        if (!game.map || !game.playing) return;
        if (!game.selectedTowerType) return;
        const def = TOWER_DEFS[game.selectedTowerType];
        if (!def) return;

        // Only highlight hover — full grass glow is too noisy on open maps
        if (game.hoverCell) {
            const { c, r } = game.hoverCell;
            const can =
                game.map.canBuild(c, r) &&
                !game.towerAt(c, r) &&
                def &&
                game.apples >= def.cost;
            ctx.fillStyle = can
                ? "rgba(46, 204, 113, 0.35)"
                : "rgba(231, 76, 60, 0.35)";
            ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);

            if (can && def) {
                const cx = (c + 0.5) * TILE_SIZE;
                const cy = (r + 0.5) * TILE_SIZE;
                const rangeBonus =
                    typeof meta !== "undefined" ? meta.bonuses().rangeBonus : 0;
                ctx.beginPath();
                ctx.arc(
                    cx,
                    cy,
                    (def.range + rangeBonus) * TILE_SIZE,
                    0,
                    Math.PI * 2,
                );
                ctx.strokeStyle = "rgba(255,255,255,0.35)";
                ctx.lineWidth = 1.5;
                ctx.stroke();

                ctx.font = `${TILE_SIZE * 0.7}px Arial`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.globalAlpha = 0.7;
                ctx.fillStyle = "#fff";
                ctx.fillText(def.emoji, cx, cy);
                ctx.globalAlpha = 1;
            }
        }
    }

    drawTowers(ctx) {
        for (const tower of game.towers) {
            const selected = game.selectedTower === tower;
            if (selected) {
                ctx.beginPath();
                ctx.arc(tower.x, tower.y, tower.rangePx, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(255,255,255,0.08)";
                ctx.fill();
                ctx.strokeStyle = "rgba(255,255,255,0.4)";
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }

            ctx.beginPath();
            ctx.arc(tower.x, tower.y, TILE_SIZE * 0.38, 0, Math.PI * 2);
            ctx.fillStyle = tower.def.color;
            ctx.fill();
            ctx.strokeStyle = selected ? "#fff" : "rgba(0,0,0,0.35)";
            ctx.lineWidth = selected ? 2.5 : 1.5;
            ctx.stroke();

            ctx.font = `${TILE_SIZE * 0.55}px Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "#fff";
            ctx.fillText(tower.def.emoji, tower.x, tower.y + 1);
        }
    }

    drawEnemies(ctx) {
        const count = game.enemies.length;
        const showBars = count < 80;

        for (const enemy of game.enemies) {
            if (enemy.dead) continue;

            const r = enemy.radius;
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, r, 0, Math.PI * 2);
            ctx.fillStyle = enemy.color;
            ctx.fill();

            if (enemy.type === "ALPHA" || count < 60) {
                ctx.font = `${r * 1.8}px Arial`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(enemy.emoji, enemy.x, enemy.y);
            }

            if (enemy.slowTimer > 0) {
                ctx.beginPath();
                ctx.arc(enemy.x, enemy.y, r + 3, 0, Math.PI * 2);
                ctx.strokeStyle = "rgba(52, 152, 219, 0.7)";
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }

            if (showBars || enemy.type === "ALPHA") {
                const barW = Math.max(12, r * 2);
                const barH = 3;
                const hpFrac = Math.max(0, enemy.hp / enemy.maxHp);
                ctx.fillStyle = "rgba(0,0,0,0.5)";
                ctx.fillRect(enemy.x - barW / 2, enemy.y - r - 6, barW, barH);
                ctx.fillStyle =
                    hpFrac > 0.5
                        ? "#2ecc71"
                        : hpFrac > 0.25
                          ? "#f1c40f"
                          : "#e74c3c";
                ctx.fillRect(
                    enemy.x - barW / 2,
                    enemy.y - r - 6,
                    barW * hpFrac,
                    barH,
                );
            }
        }
    }

    drawProjectiles(ctx) {
        for (const p of game.projectiles) {
            if (!p.alive && !p.hit) continue;
            const y = p.drawY;

            if (p.emoji) {
                ctx.font = `${p.radius * 2.4}px Arial`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(p.emoji, p.x, y);
            } else if (p.ring) {
                // Honk: expanding sound pulse trailing toward target
                ctx.beginPath();
                ctx.arc(p.x, y, p.radius + 2, 0, Math.PI * 2);
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 2.5;
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(p.x, y, p.radius * 0.5, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.fill();
            } else {
                // Peck: elongated bolt
                ctx.save();
                ctx.translate(p.x, y);
                ctx.rotate(p.angle);
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.ellipse(0, 0, p.radius * 2.2, p.radius * 0.85, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = "#fff8dc";
                ctx.beginPath();
                ctx.ellipse(p.radius * 0.6, 0, p.radius * 0.7, p.radius * 0.4, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            // Soft shadow under arcing apples
            if (p.arc) {
                ctx.beginPath();
                ctx.ellipse(p.x, p.y + 2, 5, 2, 0, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(0,0,0,0.25)";
                ctx.fill();
            }
        }
    }

    drawNest(ctx) {
        const x = (NEST_COL + 0.5) * TILE_SIZE;
        const y = (NEST_ROW + 0.5) * TILE_SIZE;
        ctx.font = `${TILE_SIZE * 0.85}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🏠", x, y);

        ctx.font = "10px Arial";
        ctx.fillStyle = "#fff";
        ctx.fillText(`${game.nestHp}/${game.nestMaxHp || NEST_MAX_HP}`, x, y + 18);
    }

    drawParticles(ctx) {
        for (const p of game.particles) {
            const alpha = Math.max(0, p.life / p.maxLife);
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius * (1.2 - alpha * 0.4), 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = alpha * 0.45;
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }
}
