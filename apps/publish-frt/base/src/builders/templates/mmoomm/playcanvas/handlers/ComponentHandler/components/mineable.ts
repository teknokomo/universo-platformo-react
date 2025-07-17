export default function mineable(id: string, props: any): string {
    return `
    // Mineable component for asteroids
    const mineableComponent = {
        resourceType: '${props.resourceType || 'asteroidMass'}',
        maxYield: ${props.maxYield || 2},
        currentYield: ${props.currentYield || 2},
        hardness: ${props.hardness || 1}, // Damage resistance
        isDestroyed: false,

        onHit(damage = 1) {
            if (this.isDestroyed) return false;

            const actualDamage = damage / this.hardness;
            this.currentYield -= actualDamage;

            console.log('[Mineable] Hit for', actualDamage, 'damage. Remaining:', this.currentYield);

            if (this.currentYield <= 0) {
                this.destroy();
                return true; // Destroyed
            } else {
                this.flashDamage();
                return false; // Still alive
            }
        },

        destroy() {
            this.isDestroyed = true;

            // Create resource pickup
            const pickup = new pc.Entity('pickup_' + Date.now());
            pickup.addComponent('model', { type: 'sphere' });
            pickup.addComponent('collision', {
                type: 'sphere',
                radius: 0.3
            });
            pickup.setLocalScale(0.3, 0.3, 0.3);
            pickup.setPosition(entity.getPosition());

            pickup.resourcePickup = {
                resourceType: this.resourceType,
                amount: this.maxYield,

                collect(ship) {
                    if (ship.inventory && ship.inventory.addItem(this.resourceType, this.amount)) {
                        console.log('[Pickup] Collected', this.amount, this.resourceType);
                        pickup.destroy();
                        return true;
                    }
                    return false;
                }
            };

            // Auto-collect on collision
            pickup.collision.on('triggerenter', (otherEntity) => {
                if (otherEntity.shipController) {
                    pickup.resourcePickup.collect(otherEntity);
                }
            });

            app.root.addChild(pickup);

            // Auto-destroy pickup after 30 seconds
            setTimeout(() => {
                if (pickup.parent) pickup.destroy();
            }, 30000);

            // Destroy original entity
            entity.destroy();

            console.log('[Mineable] Destroyed, created pickup');
        },

        flashDamage() {
            const material = entity.model.material;
            if (material) {
                const originalColor = material.diffuse.clone();
                material.diffuse.set(1, 0, 0);
                material.update();

                setTimeout(() => {
                    material.diffuse.copy(originalColor);
                    material.update();
                }, 200);
            }
        }
    };

    console.log('[MMO Component] Mineable component ${id} ready');
    `
}
