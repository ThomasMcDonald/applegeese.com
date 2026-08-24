"use strict";

const META_SAVE_KEY = "honkDefenseSave";

const META_UPGRADES = [
    {
        id: "nest_hp",
        name: "Sturdier Nest",
        emoji: "❤️",
        desc: "+8 nest HP per level",
        maxLevel: 5,
        baseCost: 8,
        costScale: 1.55,
    },
    {
        id: "start_apples",
        name: "Orchard Stash",
        emoji: "🍎",
        desc: "+30 starting apples per level",
        maxLevel: 6,
        baseCost: 6,
        costScale: 1.5,
    },
    {
        id: "tower_damage",
        name: "Sharper Beaks",
        emoji: "🗡️",
        desc: "+12% tower damage per level",
        maxLevel: 8,
        baseCost: 10,
        costScale: 1.6,
    },
    {
        id: "tower_range",
        name: "Keen Eyes",
        emoji: "👀",
        desc: "+0.2 tower range per level",
        maxLevel: 5,
        baseCost: 12,
        costScale: 1.65,
    },
    {
        id: "fire_rate",
        name: "Faster Honks",
        emoji: "⚡",
        desc: "+8% attack speed per level",
        maxLevel: 6,
        baseCost: 10,
        costScale: 1.55,
    },
    {
        id: "kill_reward",
        name: "Spoils of War",
        emoji: "🪙",
        desc: "+1 apple per kill per level",
        maxLevel: 4,
        baseCost: 14,
        costScale: 1.7,
    },
    {
        id: "free_peck",
        name: "Starter Flock",
        emoji: "🪿",
        desc: "Start with +1 free Peck Nest (max 2)",
        maxLevel: 2,
        baseCost: 20,
        costScale: 2.2,
    },
];

const meta = {
    feathers: 0,
    highWave: 0,
    upgrades: {},
    activeRun: null,

    load() {
        try {
            const raw = localStorage.getItem(META_SAVE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            this.feathers = data.feathers || 0;
            this.highWave = data.highWave || 0;
            this.upgrades = data.upgrades || {};
            this.activeRun = data.activeRun || null;
        } catch (_e) {
            // ignore
        }
    },

    save() {
        try {
            const raw = localStorage.getItem(META_SAVE_KEY);
            const data = raw ? JSON.parse(raw) : {};
            data.feathers = this.feathers;
            data.highWave = this.highWave;
            data.upgrades = this.upgrades;
            data.activeRun = this.activeRun;
            data.lastPlayed = Date.now();
            localStorage.setItem(META_SAVE_KEY, JSON.stringify(data));
        } catch (_e) {
            // ignore
        }
    },

    hasActiveRun() {
        return !!(this.activeRun && this.activeRun.version === 1);
    },

    saveActiveRun(runData) {
        this.activeRun = runData;
        this.save();
    },

    clearActiveRun() {
        this.activeRun = null;
        this.save();
    },

    level(id) {
        return this.upgrades[id] || 0;
    },

    def(id) {
        return META_UPGRADES.find((u) => u.id === id);
    },

    costFor(id) {
        const u = this.def(id);
        if (!u) return Infinity;
        const lvl = this.level(id);
        if (lvl >= u.maxLevel) return Infinity;
        return Math.floor(u.baseCost * Math.pow(u.costScale, lvl));
    },

    canBuy(id) {
        const u = this.def(id);
        if (!u) return false;
        if (this.level(id) >= u.maxLevel) return false;
        return this.feathers >= this.costFor(id);
    },

    buy(id) {
        if (!this.canBuy(id)) return false;
        const cost = this.costFor(id);
        this.feathers -= cost;
        this.upgrades[id] = this.level(id) + 1;
        this.save();
        return true;
    },

    /** Bonuses applied at run start / combat */
    bonuses() {
        return {
            nestHpBonus: this.level("nest_hp") * 8,
            startApplesBonus: this.level("start_apples") * 30,
            damageMult: 1 + this.level("tower_damage") * 0.12,
            rangeBonus: this.level("tower_range") * 0.2,
            fireRateMult: 1 + this.level("fire_rate") * 0.08,
            killRewardBonus: this.level("kill_reward"),
            freePecks: this.level("free_peck"),
        };
    },

    /**
     * Feathers from a finished run. Losing still pays out.
     * difficultyKey: easy/normal/hard
     */
    awardRun({ won, wave, kills, difficultyKey }) {
        const diffMult =
            difficultyKey === "hard" ? 1.4 : difficultyKey === "easy" ? 0.75 : 1;
        let gained = 4 + wave * 3 + Math.floor(kills / 8);
        if (won) gained += 25;
        gained = Math.max(3, Math.floor(gained * diffMult));
        this.feathers += gained;
        if (wave > this.highWave) this.highWave = wave;
        this.activeRun = null;
        this.save();
        return gained;
    },
};

meta.load();
