"use strict";

// ============================================================
// MAIN LOOP & BOOT
// Depends on: all other modules
// ============================================================
let renderer, input;
let lastTs = 0;
let infoPanelTick = 0;

function loop(ts) {
    const dt = Math.min((ts - lastTs) / 1000, MAX_FRAME_DT);
    lastTs = ts;

    input.update(dt);
    if (!game.gameOver && !game.paused) {
        game.update(dt);
    }
    renderer.render(input.sel, input.moveIndicators);

    // Update HUD counters
    document.getElementById("apple-count").textContent =
        Math.floor(game.resources.apples);
    document.getElementById("unit-count").textContent =
        game.units.length;
    document.getElementById("enemy-unit-count").textContent =
        game.enemy ? game.enemy.combatUnits.length : 0;

    // Refresh info panel periodically (catches training timer)
    infoPanelTick += dt;
    if (infoPanelTick >= 0.5) {
        infoPanelTick = 0;
        if (
            game.selectedBuilding ||
            game.selectedUnits.length > 0
        )
            updateInfoPanel();
    }

    requestAnimationFrame(loop);
}

window.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("gameCanvas");

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight - HUD_H;
        if (game.camera) {
            game.camera.w = canvas.width;
            game.camera.h = canvas.height;
            game.camera.clamp();
        }
    }

    resize();
    window.addEventListener("resize", resize);

    renderer = new Renderer(canvas);
    input = new InputHandler(canvas);

    // Show first-time welcome or main menu
    try {
        if (!localStorage.getItem("seenTutorial")) {
            document.getElementById("welcome-screen").style.display = "flex";
            document.getElementById("main-menu").style.display = "none";
        }
    } catch (_e) {
        // localStorage unavailable (e.g. private browsing) — skip welcome
    }

    requestAnimationFrame(loop);

    // Welcome screen buttons
    document.getElementById("btn-welcome-tutorial").addEventListener("click", () => {
        try { localStorage.setItem("seenTutorial", "true"); } catch (_e) {}
        startGame("normal", true);
    });
    document.getElementById("btn-welcome-skip").addEventListener("click", () => {
        try { localStorage.setItem("seenTutorial", "true"); } catch (_e) {}
        document.getElementById("welcome-screen").style.display = "none";
        document.getElementById("main-menu").style.display = "flex";
    });

    // Main menu buttons
    document.getElementById("btn-play").addEventListener("click", () => {
        document.getElementById("main-menu").style.display = "none";
        document.getElementById("game-setup").style.display = "flex";
    });
    document.getElementById("btn-tutorial-menu").addEventListener("click", () => {
        startGame("normal", true);
    });

    // Game setup buttons
    document.getElementById("btn-start-game").addEventListener("click", () => {
        const checked = document.querySelector('input[name="difficulty"]:checked');
        const difficulty = checked ? checked.value : "normal";
        startGame(difficulty, false);
    });
    document.getElementById("btn-setup-back").addEventListener("click", () => {
        document.getElementById("game-setup").style.display = "none";
        document.getElementById("main-menu").style.display = "flex";
    });

    // Pause menu buttons
    document.getElementById("btn-resume").addEventListener("click", resumeGame);
    document.getElementById("btn-restart").addEventListener("click", () => {
        startGame(game.difficultyKey, game.isTutorial);
    });
    document.getElementById("btn-main-menu-pause").addEventListener("click", returnToMainMenu);

    // Tutorial skip button
    document.getElementById("btn-skip-tutorial").addEventListener("click", () => {
        game.isTutorial = false;
        document.getElementById("tutorial-panel").style.display = "none";
    });
});
