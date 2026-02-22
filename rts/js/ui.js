"use strict";

// ============================================================
// UI — Info panel, screen management, tutorial
// Depends on: constants.js, game.js (game), entities.js
// ============================================================

// ── Info panel ───────────────────────────────────────────────
function updateInfoPanel() {
    const panel = document.getElementById("info-panel");
    const content = document.getElementById("info-content");

    if (game.placingType) {
        const def = BUILDING_DEFS[game.placingType];
        let html = `<div class="info-name">Placing ${def.emoji} ${def.name}</div>`;
        html += `<div class="info-hint">Click on the map to place<br>Right-click or Esc to cancel</div>`;
        content.innerHTML = html;
        panel.style.display = "block";
    } else if (game.selectedBuilding) {
        const b = game.selectedBuilding;
        const def = BUILDING_DEFS[b.type];
        let html = `<div class="info-name">${def.emoji} ${def.name}</div>`;
        html += `<div class="info-stat">HP: ${b.hp} / ${b.maxHp}</div>`;
        if (def.incomeRate) {
            html += `<div class="info-stat">Income: +${def.incomeRate} 🍎/s</div>`;
        }
        if (def.canTrain) {
            const trainsUnit = def.trainsUnit || "WORKER";
            const trainsName = (UNIT_DEFS[trainsUnit] || UNIT_DEFS.WORKER).name;
            const canAfford = game.resources.apples >= TRAIN_COST;
            if (b.training) {
                const tt = def.trainTime || TRAIN_TIME;
                const rem = Math.ceil(tt - b.trainTimer);
                html += `<div class="info-stat">Training… ${rem}s</div>`;
            } else {
                html += `<button class="info-train-btn" onclick="onTrainClick()" ${canAfford ? "" : "disabled"}>
                    Train ${trainsName} 🪿 (${TRAIN_COST} 🍎)
                </button>`;
            }
            html += `<div class="info-hint">Press T to train</div>`;
        }
        // Build menu: only the Goose Nest shows new building options
        if (b.type === "NEST") {
            html += `<div class="info-hint" style="margin-top:10px;color:rgba(255,255,255,0.7);font-size:12px">🔨 Construct building:</div>`;
            for (const type of BUILDABLE) {
                const bdef = BUILDING_DEFS[type];
                const canAfford = game.resources.apples >= bdef.buildCost;
                html += `<button class="info-train-btn info-build-btn"
                        onclick="onBuildClick('${type}')" ${canAfford ? "" : "disabled"}>
                        ${bdef.emoji} ${bdef.name} — ${bdef.buildCost} 🍎<br>
                        <span style="font-size:10px;font-weight:400;opacity:0.8">${bdef.desc}</span>
                    </button>`;
            }
        }
        content.innerHTML = html;
        panel.style.display = "block";
    } else if (game.selectedUnits.length > 0) {
        const count = game.selectedUnits.length;
        let html;
        if (count === 1) {
            const u = game.selectedUnits[0];
            const udef = UNIT_DEFS[u.unitType] || UNIT_DEFS.WORKER;
            html = `<div class="info-name">🪿 ${udef.name}</div>`;
            html += `<div class="info-stat">HP: ${u.hp} / ${u.maxHp}</div>`;
            html += `<div class="info-stat">State: ${u.state}</div>`;
            if (u.carriedApples > 0)
                html += `<div class="info-stat">Carrying: ${u.carriedApples} 🍎</div>`;
        } else {
            html = `<div class="info-name">${count}× 🪿 Geese</div>`;
        }
        const canGather = game.selectedUnits.some(u => UNIT_DEFS[u.unitType]?.canGather);
        const gatherHint = canGather ? "<br>Right-click 🌳 to gather apples" : "";
        html += `<div class="info-hint">Right-click to move${gatherHint}</div>`;
        content.innerHTML = html;
        panel.style.display = "block";
    } else {
        panel.style.display = "none";
    }
}

function onTrainClick() {
    if (game.selectedBuilding) {
        game.selectedBuilding.startTraining(game.resources);
        updateInfoPanel();
    }
}

function onBuildClick(type) {
    game.clearSelection();
    game.placingType = type;
    updateInfoPanel();
}

// ── Screen management ─────────────────────────────────────────
function startGame(difficultyKey, isTutorial) {
    _nextId = 1;
    game.paused = false;
    game.isTutorial = isTutorial || false;
    game.tutorialStep = 0;
    game.difficultyKey = difficultyKey || "normal";

    const canvas = document.getElementById("gameCanvas");
    game.init(canvas.width, canvas.height, game.difficultyKey);

    // Hide all overlays, show HUD
    ["main-menu", "welcome-screen", "game-setup", "pause-menu"].forEach(id => {
        document.getElementById(id).style.display = "none";
    });
    document.getElementById("game-over").style.display = "none";
    document.getElementById("hud").style.display = "flex";

    if (game.isTutorial) {
        showTutorialStep(0);
    } else {
        document.getElementById("tutorial-panel").style.display = "none";
    }

    updateInfoPanel();
}

function showPauseMenu() {
    game.paused = true;
    document.getElementById("pause-menu").style.display = "flex";
}

function resumeGame() {
    game.paused = false;
    document.getElementById("pause-menu").style.display = "none";
}

function returnToMainMenu() {
    game.paused = false;
    game.gameOver = true;
    game.map = null;
    ["pause-menu", "game-over"].forEach(id => {
        document.getElementById(id).style.display = "none";
    });
    document.getElementById("tutorial-panel").style.display = "none";
    document.getElementById("hud").style.display = "none";
    document.getElementById("main-menu").style.display = "flex";
}

// ── Tutorial ──────────────────────────────────────────────────
const TUTORIAL_STEPS = [
    { label: "Step 1 of 3", message: "👆 Select your geese by clicking or dragging over them." },
    { label: "Step 2 of 3", message: "🌳 Right-click an apple tree to send your geese to gather resources." },
    { label: "Step 3 of 3", message: "⚔️ Build your army and defeat the fox den! Select geese and right-click enemies to attack." },
];

function showTutorialStep(step) {
    const panel = document.getElementById("tutorial-panel");
    if (step >= TUTORIAL_STEPS.length) {
        panel.style.display = "none";
        return;
    }
    const s = TUTORIAL_STEPS[step];
    document.getElementById("tutorial-step-label").textContent = s.label;
    document.getElementById("tutorial-message").textContent = s.message;
    panel.style.display = "block";
    game.tutorialStep = step;
}

function checkTutorialProgress() {
    if (!game.isTutorial || game.tutorialStep >= TUTORIAL_STEPS.length) return;
    switch (game.tutorialStep) {
        case 0:
            if (game.selectedUnits.length >= 1) {
                showTutorialStep(1);
            }
            break;
        case 1:
            if (game.units.some(u => u.state === "GATHERING" ||
                (u.state === "MOVING" && u.targetNode))) {
                showTutorialStep(2);
            }
            break;
        // Step 2 completes via the victory condition in _endGame
    }
}
