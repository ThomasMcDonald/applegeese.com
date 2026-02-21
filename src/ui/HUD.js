class HUD {
    constructor(engine) {
        this.engine = engine;
    }

    update() {
        if (this.engine.frame % 10 === 0) {
            const appleEl = document.getElementById('apple-count');
            if (appleEl) {
                appleEl.textContent = this.engine.resources.apples;
            }
            const unitEl = document.getElementById('unit-count');
            if (unitEl) {
                unitEl.textContent = this.engine.units.length;
            }
        }
    }

    bindSpawnButton(buttonId) {
        const btn = document.getElementById(buttonId);
        if (!btn) return;
        const cost = this.engine.unitCost;
        btn.textContent = `Spawn Unit (${cost} 🍎)`;
        btn.addEventListener('click', () => {
            if (this.engine.resources.apples >= cost) {
                this.engine.spawnUnit();
            }
        });
    }
}
