"use strict";

// ============================================================
// UTILITY
// ============================================================
function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
}

function dist2(ax, ay, bx, by) {
    const dx = ax - bx,
        dy = ay - by;
    return dx * dx + dy * dy;
}
