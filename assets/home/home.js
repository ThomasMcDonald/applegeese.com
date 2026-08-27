const NAV_REVEAL_DELAY_MS = 15000;
const WIGGLE_INTERVAL_MS = 4000;
const WIGGLE_DURATION_MS = 600;
const FEED_RUSH_MS = 450;
const FEED_BITE_MS = 260;
const FEED_RETURN_MS = 420;
const FEED_REGROW_MS = 420;

const darkSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
const emojiRow = document.getElementById("emojiRow");
const appleButton = document.getElementById("appleButton");
const gooseLinks = Array.from(document.querySelectorAll(".goose-link"));

let isFeeding = false;

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
    if (isFeeding || !gooseLink || !gooseEmoji || gooseLink.matches(":hover")) {
        return;
    }

    gooseEmoji.classList.add("wiggle-animation");
    setTimeout(() => {
        gooseEmoji.classList.remove("wiggle-animation");
    }, WIGGLE_DURATION_MS);
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function feedTheGeese() {
    if (isFeeding || !emojiRow || !appleButton) {
        return;
    }

    isFeeding = true;
    revealGameNav();

    const leadGoose = gooseLinks[0];
    emojiRow.classList.add("feeding");
    await wait(FEED_RUSH_MS);

    appleButton.classList.add("eaten");
    if (leadGoose) {
        leadGoose.classList.add("pecking");
    }
    await wait(FEED_BITE_MS);

    if (leadGoose) {
        leadGoose.classList.remove("pecking");
    }
    emojiRow.classList.remove("feeding");
    await wait(FEED_RETURN_MS);

    appleButton.classList.remove("eaten");
    await wait(FEED_REGROW_MS);

    isFeeding = false;
}

applyTheme();
darkSchemeQuery.addEventListener("change", applyTheme);
gooseLinks.forEach((link, index) => link.style.setProperty("--i", index));
setTimeout(revealGameNav, NAV_REVEAL_DELAY_MS);
setInterval(wigglePlayableGoose, WIGGLE_INTERVAL_MS);

if (appleButton) {
    appleButton.addEventListener("click", feedTheGeese);
}
