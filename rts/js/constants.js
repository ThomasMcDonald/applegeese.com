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

// Building type definitions
const BUILDING_DEFS = {
    NEST:     { name: "Goose Nest",  emoji: "🏠", maxHp: 200, buildCost: 0,  trainTime: TRAIN_TIME, canTrain: true, desc: "The heart of your flock" },
    GRANARY:  { name: "Granary",     emoji: "🌾", maxHp: 150, buildCost: 40, incomeRate: 2,                         desc: "Generates +2 🍎 per second" },
    BARRACKS: { name: "Barracks",    emoji: "⛺", maxHp: 180, buildCost: 50, trainTime: 5,  canTrain: true,          desc: "Trains geese in 5s" },
    TOWER:    { name: "Watchtower",  emoji: "🗼", maxHp: 120, buildCost: 30,                                         desc: "Surveys the orchard" },
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
