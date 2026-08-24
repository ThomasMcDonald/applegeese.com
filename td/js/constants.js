"use strict";

const TILE_SIZE = 40;
const MAP_COLS = 20;
const MAP_ROWS = 14;
const CANVAS_W = MAP_COLS * TILE_SIZE;
const CANVAS_H = MAP_ROWS * TILE_SIZE;
const HUD_H = 44;
const MOBILE_BAR_H = 56;
const MAX_FRAME_DT = 0.1;
const MAX_TOWERS = 24;
const STARTING_APPLES = 120;
const NEST_MAX_HP = 50;
const TOTAL_WAVES = 10;
const SEP_RADIUS = 14;
const SEP_STRENGTH = 0.45;
const NEST_REACH_DIST = TILE_SIZE * 0.6;

const TILE = Object.freeze({
    GRASS: 0,
    WALL: 1,
    WATER: 2,
    NEST: 3,
});

const TILE_COLOR = Object.freeze({
    0: "#4a8c5e",
    1: "#5d4e37",
    2: "#3a7bd5",
    3: "#8d6e63",
});

const DIFFICULTY = Object.freeze({
    easy: {
        towerDamageMult: 1.45,
        enemySpeedMult: 0.8,
        enemyHpMult: 0.85,
        sellRefund: 0.75,
    },
    normal: {
        towerDamageMult: 1.1,
        enemySpeedMult: 0.92,
        enemyHpMult: 0.9,
        sellRefund: 0.7,
    },
    hard: {
        towerDamageMult: 1.0,
        enemySpeedMult: 1.0,
        enemyHpMult: 1.15,
        sellRefund: 0.55,
    },
});

const TOWER_DEFS = Object.freeze({
    PECK: {
        id: "PECK",
        name: "Peck Nest",
        emoji: "🪿",
        cost: 25,
        range: 2.5,
        damage: 12,
        fireRate: 1.0,
        color: "#f1c40f",
        desc: "Steady single-target damage",
        tooltip:
            "Single-target DPS. Reliable beaks for picking off foxes one at a time. 12 dmg · 2.5 range · 1.0/s",
    },
    HONK: {
        id: "HONK",
        name: "Honk Tower",
        emoji: "📯",
        cost: 40,
        range: 3.0,
        damage: 6,
        fireRate: 0.8,
        slow: 0.4,
        slowDuration: 2.0,
        color: "#e67e22",
        desc: "Slows foxes with loud honks",
        tooltip:
            "Slows packs so other towers can finish them. Light damage + 40% slow for 2s. 6 dmg · 3.0 range",
    },
    CATAPULT: {
        id: "CATAPULT",
        name: "Apple Catapult",
        emoji: "🍎",
        cost: 55,
        range: 3.5,
        damage: 20,
        fireRate: 0.5,
        splash: 1.2,
        color: "#e74c3c",
        desc: "Splash damage in a small area",
        tooltip:
            "Lobs apples that splash nearby foxes — great vs dense swarms. 20 dmg · splash · 3.5 range · slow fire",
    },
    POND: {
        id: "POND",
        name: "Pond Buff",
        emoji: "💧",
        cost: 35,
        range: 2.0,
        buffRadius: 2.0,
        buffMult: 1.25,
        color: "#3498db",
        desc: "Boosts nearby tower attack speed",
        tooltip:
            "Does not attack. Speeds up nearby towers by 25%. Place in the middle of a kill zone.",
        noAttack: true,
    },
});

const TOWER_TYPES = ["PECK", "HONK", "CATAPULT", "POND"];

const ENEMY_DEFS = Object.freeze({
    SCOUT: {
        id: "SCOUT",
        name: "Scout Fox",
        emoji: "🦊",
        hp: 14,
        speed: 70,
        reward: 1,
        splashResist: 1.0,
        radius: 7,
        color: "#e67e22",
    },
    BURROW: {
        id: "BURROW",
        name: "Burrow Fox",
        emoji: "🦊",
        hp: 36,
        speed: 48,
        reward: 2,
        splashResist: 0.5,
        radius: 9,
        color: "#c0392b",
    },
    ALPHA: {
        id: "ALPHA",
        name: "Alpha Fox",
        emoji: "🐺",
        hp: 72,
        speed: 58,
        reward: 5,
        splashResist: 1.0,
        regen: 1.2,
        radius: 11,
        color: "#7f8c8d",
    },
});

const WAVES = [
    { scouts: 24 },
    { scouts: 36 },
    { scouts: 30, burrow: 8 },
    { scouts: 40, burrow: 14 },
    { scouts: 55 },
    { scouts: 35, burrow: 22 },
    { scouts: 45, alpha: 5 },
    { burrow: 50 },
    { burrow: 35, alpha: 10 },
    { scouts: 55, burrow: 30, alpha: 12 },
];

const NEST_COL = 19;
const NEST_ROW = 7;
