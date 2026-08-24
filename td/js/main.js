"use strict";

let tdRenderer;
let tdInput;
let lastTs = 0;

function loop(ts) {
    const dt = Math.min((ts - lastTs) / 1000, MAX_FRAME_DT);
    lastTs = ts;

    if (game.playing) {
        game.update(dt);
    }
    if (tdRenderer) tdRenderer.render();

    requestAnimationFrame(loop);
}

window.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("gameCanvas");
    tdRenderer = new Renderer(canvas);
    window.tdRenderer = tdRenderer;
    tdInput = new InputHandler(canvas, tdRenderer);

    window.addEventListener("resize", () => {
        tdRenderer.resize();
        updateMobileBarVisibility();
    });

    // High score + feathers on menu
    refreshMetaMenuStats();
    updateContinueButton();

    // First-time welcome (only if no run to resume)
    try {
        if (
            !localStorage.getItem("honkDefenseSeenTutorial") &&
            !meta.hasActiveRun()
        ) {
            document.getElementById("welcome-screen").style.display = "flex";
            document.getElementById("main-menu").style.display = "none";
        } else if (meta.hasActiveRun()) {
            continueGame();
        }
    } catch (_e) {
        if (meta.hasActiveRun()) continueGame();
    }

    window.addEventListener("beforeunload", () => {
        if (game.playing && !game.gameOver && !game.victory) {
            game.persistRun();
        }
    });
    document.addEventListener("visibilitychange", () => {
        if (
            document.visibilityState === "hidden" &&
            game.playing &&
            !game.gameOver &&
            !game.victory
        ) {
            game.persistRun();
        }
    });

    document.getElementById("btn-welcome-tutorial").addEventListener("click", () => {
        try {
            localStorage.setItem("honkDefenseSeenTutorial", "true");
        } catch (_e) {}
        startGame("easy", true);
    });
    document.getElementById("btn-welcome-skip").addEventListener("click", () => {
        try {
            localStorage.setItem("honkDefenseSeenTutorial", "true");
        } catch (_e) {}
        document.getElementById("welcome-screen").style.display = "none";
        document.getElementById("main-menu").style.display = "flex";
        refreshMetaMenuStats();
        updateContinueButton();
    });

    document.getElementById("btn-continue").addEventListener("click", () => {
        continueGame();
    });
    document.getElementById("btn-play").addEventListener("click", () => {
        document.getElementById("main-menu").style.display = "none";
        document.getElementById("game-setup").style.display = "flex";
    });
    document.getElementById("btn-meta-shop").addEventListener("click", () => {
        openMetaShop("menu");
    });
    document.getElementById("btn-meta-back").addEventListener("click", closeMetaShop);
    document.getElementById("btn-tutorial-menu").addEventListener("click", () => {
        startGame("easy", true);
    });

    document.getElementById("btn-start-game").addEventListener("click", () => {
        const checked = document.querySelector(
            'input[name="difficulty"]:checked',
        );
        startGame(checked ? checked.value : "normal", false);
    });
    document.getElementById("btn-setup-back").addEventListener("click", () => {
        document.getElementById("game-setup").style.display = "none";
        document.getElementById("main-menu").style.display = "flex";
        refreshMetaMenuStats();
        updateContinueButton();
    });

    document.getElementById("btn-resume").addEventListener("click", resumeGame);
    document.getElementById("btn-restart").addEventListener("click", () => {
        meta.clearActiveRun();
        startGame(game.difficultyKey, game.isTutorial);
    });
    document
        .getElementById("btn-main-menu-pause")
        .addEventListener("click", returnToMainMenu);

    document.getElementById("btn-skip-tutorial").addEventListener("click", () => {
        game.isTutorial = false;
        document.getElementById("tutorial-panel").style.display = "none";
    });

    document.getElementById("btn-start-wave").addEventListener("click", () => {
        game.startWave();
        updateHud();
    });

    document.getElementById("btn-pause").addEventListener("click", pauseGame);

    document.getElementById("btn-play-again").addEventListener("click", () => {
        startGame(game.difficultyKey, false);
    });
    document.getElementById("btn-end-upgrades").addEventListener("click", () => {
        openMetaShop("end");
    });
    document.getElementById("btn-end-menu").addEventListener("click", returnToMainMenu);

    document.getElementById("btn-sell").addEventListener("click", () => {
        if (game.selectedTower) {
            game.sellTower(game.selectedTower);
            updateSellPanel();
            updateHud();
        }
    });

    document.querySelectorAll(".tower-btn").forEach((btn) => {
        btn.addEventListener("click", () => selectTowerType(btn.dataset.type));
    });

    requestAnimationFrame((ts) => {
        lastTs = ts;
        requestAnimationFrame(loop);
    });
});
