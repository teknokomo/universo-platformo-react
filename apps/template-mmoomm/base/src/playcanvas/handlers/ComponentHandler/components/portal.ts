export default function portal(id: string, props: any): string {
    return `
    // Portal component for gates
    const portalComponent = {
        targetWorld: '${props.targetWorld || 'konkordo'}',
        isActive: ${props.isActive !== false},
        cooldownTime: ${props.cooldownTime || 2000},
        lastUsed: 0,

        setTarget(worldName) {
            this.targetWorld = worldName;
            console.log('[Portal] Target set to:', worldName);
        },

        canUse() {
            const now = Date.now();
            return this.isActive && (now - this.lastUsed >= this.cooldownTime);
        },

        transport(ship) {
            if (!this.canUse()) {
                console.log('[Portal] Portal on cooldown');
                return false;
            }

            this.lastUsed = Date.now();

            console.log('[Portal] Transporting ship to', this.targetWorld);

            // Trigger world change event
            if (window.MMOEvents) {
                window.MMOEvents.emit('world_change', {
                    shipId: ship.name,
                    fromWorld: window.currentWorld || 'kubio',
                    toWorld: this.targetWorld,
                    portalId: '${id}'
                });
            }

            this.flashPortal();
            return true;
        },

        flashPortal() {
            const material = entity.model.material;
            if (material) {
                const originalColor = material.diffuse.clone();
                material.diffuse.set(0, 1, 1);
                material.update();

                setTimeout(() => {
                    material.diffuse.copy(originalColor);
                    material.update();
                }, 500);
            }
        },

        getPortalInfo() {
            return {
                targetWorld: this.targetWorld,
                isActive: this.isActive,
                cooldownRemaining: Math.max(0, this.cooldownTime - (Date.now() - this.lastUsed))
            };
        }
    };

    if (window && window.DEBUG_MULTIPLAYER) console.log('[MMO Component] Portal component ${id} ready');
    `
}
