const NAV_REVEAL_DELAY_MS = 15000;
const WIGGLE_INTERVAL_MS = 2000;
const WIGGLE_DURATION_MS = 600;

const darkSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");

function applyTheme() {
    document.body.classList.toggle("dark-mode", darkSchemeQuery.matches);
    document.body.classList.toggle("light-mode", !darkSchemeQuery.matches);
}

function revealGameNav() {
    const gameNav = document.getElementById("gameNav");
    if (!gameNav) {
        return;
    }

    gameNav.classList.add("visible");
}

function wigglePlayableGoose() {
    const gooseLink = document.getElementById("playableGoose");
    const gooseEmoji = document.getElementById("wiggleGoose");
    if (!gooseLink || !gooseEmoji || gooseLink.matches(":hover")) {
        return;
    }

    gooseEmoji.classList.add("wiggle-animation");
    setTimeout(() => {
        gooseEmoji.classList.remove("wiggle-animation");
    }, WIGGLE_DURATION_MS);
}

applyTheme();
darkSchemeQuery.addEventListener("change", applyTheme);
setTimeout(revealGameNav, NAV_REVEAL_DELAY_MS);
setInterval(wigglePlayableGoose, WIGGLE_INTERVAL_MS);
