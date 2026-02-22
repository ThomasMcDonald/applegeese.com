"use strict";

// ============================================================
// CONSTANTS
// ============================================================
const TILE_SIZE = 32;
const MAP_W = 64;
const MAP_H = 44;
const HUD_H = 44;

const TILE = Object.freeze({ GRASS: 0, DIRT: 1, WATER: 2 });

const TILE_COLOR = Object.freeze({
    0: "#4a8c5e",
    1: "#b07840",
    2: "#3a7bd5",
});

const TILE_BORDER = Object.freeze({
    0: "rgba(0,0,0,0.06)",
    1: "rgba(0,0,0,0.10)",
    2: "rgba(0,0,80,0.12)",
});

const UNIT_SPEED = 72; // px/s
const GATHER_TICK = 1.0; // seconds per gather pulse
const GATHER_AMOUNT = 5; // apples per pulse
const MAX_CARRY = 10; // apples per goose
const TRAIN_TIME = 10; // seconds to train a goose
const TRAIN_COST = 20; // apples to train

// Player unit type definitions
const UNIT_DEFS = Object.freeze({
    WORKER:    { name: "Worker Goose",   color: "#f1c40f", radius: 9,  hp: 80,  speed: UNIT_SPEED,        canGather: true,  fontSize: 0.60 },
    GUARD:     { name: "Guard Goose",    color: "#3498db", radius: 10, hp: 100, speed: UNIT_SPEED,        canGather: false, fontSize: 0.72 },
    BRAWLER:   { name: "Brawler Goose",  color: "#e74c3c", radius: 13, hp: 180, speed: UNIT_SPEED * 0.75, canGather: false, fontSize: 0.88 },
    SCREECHER: { name: "Honk Screecher", color: "#e67e22", radius: 10, hp: 90,  speed: UNIT_SPEED * 1.1,  canGather: false, fontSize: 0.70 },
    ALPHA:     { name: "Alpha Goose",    color: "#9b59b6", radius: 11, hp: 130, speed: UNIT_SPEED * 0.9,  canGather: false, fontSize: 0.78 },
});

// Building type definitions
const BUILDING_DEFS = {
    NEST:     { name: "Goose Nest",  emoji: "🏠", maxHp: 200, buildCost: 0,  trainTime: TRAIN_TIME, canTrain: true, trainsUnit: "WORKER", desc: "The heart of your flock" },
    GRANARY:  { name: "Granary",     emoji: "🌾", maxHp: 150, buildCost: 40, incomeRate: 2,                                               desc: "Generates +2 🍎 per second" },
    BARRACKS: { name: "Barracks",    emoji: "⛺", maxHp: 180, buildCost: 50, trainTime: 5,  canTrain: true, trainsUnit: "GUARD",           desc: "Trains geese in 5s" },
    TOWER:    { name: "Watchtower",  emoji: "🗼", maxHp: 120, buildCost: 30,                                                               desc: "Surveys the orchard" },
};
// Building types the player can construct
const BUILDABLE = ["GRANARY", "BARRACKS", "TOWER"];

// Prevents the game loop from spiral-of-death when the tab is
// backgrounded or the device stalls — caps one logical step to 100ms.
const MAX_FRAME_DT = 0.1;

// A* hard iteration cap — keeps pathfinding O(bounded) for large
// or impossible routes on the 64×44 grid.
const MAX_PATH_ITERS = 2000;

// Camera edge-scroll constants
const EDGE_SCROLL_ZONE = 20; // px from canvas edge that triggers scroll
const EDGE_SCROLL_SPEED = 220; // world-px per second during edge scroll

// Enemy system constants
const ENEMY_WORKER_COST = 20;
const ENEMY_UNIT_COST = 25;
const ENEMY_DECISION_INTERVAL = 3.0; // seconds between AI decisions
const COMBAT_RANGE_SQ = (TILE_SIZE * 1.8) * (TILE_SIZE * 1.8);
const ENEMY_ATTACK_DAMAGE = 15; // damage per attack hit (once per second)
const PLAYER_ATTACK_DAMAGE = 10; // damage per attack hit (once per second)

// AI difficulty configurations
const AI_DIFFICULTY_CONFIG = {
    easy:   { gatherMultiplier: 0.8, decisionInterval: 5.0, armyMultiplier: 0.7,  attackThresholdModifier: 1.3 },
    normal: { gatherMultiplier: 1.0, decisionInterval: 3.0, armyMultiplier: 1.0,  attackThresholdModifier: 1.0 },
    hard:   { gatherMultiplier: 1.2, decisionInterval: 2.0, armyMultiplier: 1.4,  attackThresholdModifier: 0.75 },
};

// Fog of war vision radii (in tiles)
const UNIT_VISION_RADIUS = 5;
const BUILDING_VISION_RADIUS = 4;

// Mini-map dimensions (shared by renderer and input handler)
const MM_W = 120;
const MM_H = 82;
const MM_MARGIN = 8;
const MINIMAP_SHROUD_COLOR = "rgba(30,30,30,0.9)";
