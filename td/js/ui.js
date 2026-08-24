"use strict";

function updateHud() {
    const appleEl = document.getElementById("apple-count");
    const waveEl = document.getElementById("wave-count");
    const nestEl = document.getElementById("nest-hp");
    const previewEl = document.getElementById("wave-preview");
    const startBtn = document.getElementById("btn-start-wave");

    if (appleEl) appleEl.textContent = Math.floor(game.apples);
    if (waveEl) {
        waveEl.textContent = `${Math.min(game.waves ? game.waves.currentWave : 0, TOTAL_WAVES)}/${TOTAL_WAVES}`;
    }
    if (nestEl) nestEl.textContent = game.nestHp;
    if (previewEl && game.waves) {
        previewEl.textContent = game.waves.previewText();
    }
    if (startBtn && game.waves) {
        const can = game.waves.canStartWave() && game.playing && !game.paused;
        startBtn.disabled = !can;
        startBtn.textContent = game.waves.active
            ? "Wave in progress…"
            : game.waves.currentWave >= TOTAL_WAVES
              ? "All waves done"
              : `Start Wave ${game.waves.currentWave + 1}`;
    }

    // Affordability on tower buttons
    document.querySelectorAll(".tower-btn").forEach((btn) => {
        const def = TOWER_DEFS[btn.dataset.type];
        if (!def) return;
        btn.classList.toggle("unaffordable", game.apples < def.cost);
        const costEl = btn.querySelector(".tower-cost");
        if (costEl) costEl.textContent = `${def.cost}🍎`;
    });
}

function updateSellPanel() {
    const panel = document.getElementById("sell-panel");
    if (!panel) return;
    if (!game.selectedTower) {
        panel.style.display = "none";
        return;
    }
    const t = game.selectedTower;
    const refund = t.sellValue(game.difficulty.sellRefund);
    panel.style.display = "block";
    document.getElementById("sell-name").textContent =
        `${t.def.emoji} ${t.def.name}`;
    document.getElementById("sell-desc").textContent =
        t.def.tooltip || t.def.desc;
    const statsEl = document.getElementById("sell-stats");
    if (statsEl) statsEl.textContent = towerStatsText(t.def);
    document.getElementById("sell-refund").textContent = `Sell (+${refund}🍎)`;

    let deselectBtn = document.getElementById("btn-deselect-tower");
    if (!deselectBtn) {
        deselectBtn = document.createElement("button");
        deselectBtn.id = "btn-deselect-tower";
        deselectBtn.className = "btn-deselect-tower";
        deselectBtn.textContent = "Deselect";
        deselectBtn.addEventListener("click", () => {
            game.selectedTower = null;
            updateSellPanel();
        });
        panel.insertBefore(deselectBtn, document.getElementById("btn-sell"));
    }
}

function updateTutorialPanel() {
    const panel = document.getElementById("tutorial-panel");
    if (!panel) return;
    if (!game.isTutorial || game.tutorialStep >= 3) {
        panel.style.display = "none";
        game.isTutorial = false;
        return;
    }
    panel.style.display = "block";
    const steps = [
        {
            label: "Step 1 of 3",
            msg: "Place towers in the orchard — foxes will flow around water and walls toward the nest.",
        },
        {
            label: "Step 2 of 3",
            msg: "Press Start Wave — a dense fox swarm will pour in from the left.",
        },
        {
            label: "Step 3 of 3",
            msg: "Use Honk Towers to slow packs and Catapults for splash. Right-click (or long-press) a tower to sell.",
        },
    ];
    const step = steps[game.tutorialStep];
    document.getElementById("tutorial-step-label").textContent = step.label;
    document.getElementById("tutorial-message").textContent = step.msg;
}

function showEndScreen(won) {
    const overlay = document.getElementById("game-over");
    const title = document.getElementById("game-over-title");
    const msg = document.getElementById("game-over-msg");
    const featherEl = document.getElementById("feathers-gained");
    overlay.style.display = "flex";
    if (won) {
        title.textContent = "Victory! 🪿";
        msg.textContent = `You defended the nest! ${game.kills} foxes stopped.`;
    } else {
        title.textContent = "Defeat! 😢";
        msg.textContent = `The nest fell on wave ${game.waves.currentWave}. ${game.kills} foxes stopped.`;
    }
    if (featherEl) {
        featherEl.textContent = `+${game.lastFeathersGained || 0} 🪶 feathers earned (keep them forever)`;
    }

    const shareBtn = document.getElementById("btn-share");
    if (shareBtn) {
        const text = won
            ? `I defended the orchard in Honk Defense on AppleGeese! 10/10 waves cleared. #HonkDefense #applegeese\n\nhttps://applegeese.com/td/`
            : `I reached wave ${game.waves.currentWave} in Honk Defense! Can you beat it? #HonkDefense #applegeese\n\nhttps://applegeese.com/td/`;
        shareBtn.onclick = () => {
            window.open(
                `https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`,
                "_blank",
            );
        };
    }
}

function hideOverlays() {
    [
        "main-menu",
        "welcome-screen",
        "game-setup",
        "pause-menu",
        "game-over",
        "meta-shop",
        "tutorial-panel",
        "sell-panel",
    ].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = "none";
    });
}

function refreshMetaMenuStats() {
    const high = loadHighWave();
    const highEl = document.getElementById("high-wave");
    if (highEl) {
        const parts = [];
        if (high) parts.push(`Best wave: ${high}`);
        parts.push(`🪶 ${meta.feathers}`);
        highEl.textContent = parts.join(" · ");
    }
    const shopFeathers = document.getElementById("meta-feathers");
    if (shopFeathers) shopFeathers.textContent = String(meta.feathers);
}

function renderMetaShop() {
    const list = document.getElementById("meta-upgrade-list");
    if (!list) return;
    list.innerHTML = "";
    refreshMetaMenuStats();

    for (const u of META_UPGRADES) {
        const lvl = meta.level(u.id);
        const maxed = lvl >= u.maxLevel;
        const cost = meta.costFor(u.id);
        const can = meta.canBuy(u.id);

        const row = document.createElement("div");
        row.className = "meta-upgrade" + (maxed ? " maxed" : "");
        row.innerHTML = `
            <div class="meta-upgrade-icon">${u.emoji}</div>
            <div class="meta-upgrade-info">
                <div class="meta-upgrade-name">${u.name}
                    <span class="meta-lvl">${lvl}/${u.maxLevel}</span>
                </div>
                <div class="meta-upgrade-desc">${u.desc}</div>
            </div>
            <button class="meta-buy-btn" data-id="${u.id}" ${can ? "" : "disabled"}>
                ${maxed ? "MAX" : `${cost} 🪶`}
            </button>
        `;
        list.appendChild(row);
    }

    list.querySelectorAll(".meta-buy-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            if (meta.buy(btn.dataset.id)) {
                renderMetaShop();
            }
        });
    });
}

function openMetaShop(from = "menu") {
    hideOverlays();
    document.getElementById("hud").style.display = "none";
    document.getElementById("shop-bar").style.display = "none";
    document.getElementById("mobile-bar").style.display = "none";
    const shop = document.getElementById("meta-shop");
    shop.style.display = "flex";
    shop.dataset.from = from;
    renderMetaShop();
}

function closeMetaShop() {
    const shop = document.getElementById("meta-shop");
    const from = shop.dataset.from || "menu";
    shop.style.display = "none";
    if (from === "end") {
        document.getElementById("game-over").style.display = "flex";
    } else {
        document.getElementById("main-menu").style.display = "flex";
        refreshMetaMenuStats();
    }
}

function startGame(difficultyKey, isTutorial) {
    hideOverlays();
    document.getElementById("hud").style.display = "flex";
    document.getElementById("shop-bar").style.display = "flex";
    updateMobileBarVisibility();

    game.init(difficultyKey);
    game.isTutorial = !!isTutorial;
    game.tutorialStep = 0;
    if (isTutorial) {
        updateTutorialPanel();
    }
    selectTowerType("PECK");
    updateHud();
    updateSellPanel();
    updateContinueButton();
    if (window.tdRenderer) window.tdRenderer.resize();
}

function continueGame() {
    if (!meta.hasActiveRun()) return;
    hideOverlays();
    document.getElementById("hud").style.display = "flex";
    document.getElementById("shop-bar").style.display = "flex";

    if (!game.restoreFromSave(meta.activeRun)) {
        meta.clearActiveRun();
        document.getElementById("main-menu").style.display = "flex";
        updateContinueButton();
        return;
    }

    updateMobileBarVisibility();
    if (game.isTutorial) updateTutorialPanel();
    if (game.selectedTowerType) selectTowerType(game.selectedTowerType);
    else clearTowerType();
    updateHud();
    updateSellPanel();
    updateContinueButton();
    if (window.tdRenderer) window.tdRenderer.resize();
    game.persistRun();
}

function updateContinueButton() {
    const btn = document.getElementById("btn-continue");
    if (!btn) return;
    const has = meta.hasActiveRun();
    btn.style.display = has ? "inline-block" : "none";
    if (has && meta.activeRun) {
        const w = meta.activeRun.waves
            ? meta.activeRun.waves.currentWave
            : 0;
        const diff = meta.activeRun.difficultyKey || "normal";
        btn.textContent = `▶ Continue (wave ${w}/${TOTAL_WAVES} · ${diff})`;
    }
}

function pauseGame() {
    if (!game.playing || game.gameOver || game.victory) return;
    game.paused = true;
    game.persistRun();
    document.getElementById("pause-menu").style.display = "flex";
}

function resumeGame() {
    game.paused = false;
    document.getElementById("pause-menu").style.display = "none";
}

function returnToMainMenu() {
    if (game.playing && !game.gameOver && !game.victory) {
        game.persistRun();
    }
    game.playing = false;
    game.paused = false;
    hideOverlays();
    document.getElementById("hud").style.display = "none";
    document.getElementById("shop-bar").style.display = "none";
    document.getElementById("mobile-bar").style.display = "none";
    document.getElementById("main-menu").style.display = "flex";
    refreshMetaMenuStats();
    updateContinueButton();
}

function updateMobileBarVisibility() {
    const bar = document.getElementById("mobile-bar");
    const shop = document.getElementById("shop-bar");
    if (!bar) return;
    const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const narrow = window.innerWidth <= 768;
    const show = game.playing && (touch || narrow);
    bar.style.display = show ? "flex" : "none";
    if (shop && game.playing) {
        shop.style.bottom = show ? "64px" : "16px";
    }
}
