export function generateAsteroidLogic(id: string): string {
    return `
    // Asteroid entity setup
    entity.addComponent('model', { type: 'sphere' });
    entity.addComponent('collision', {
        type: 'sphere',
        radius: Math.random() * 2 + 1 // Random size between 1-3
    });
    entity.addComponent('rigidbody', {
        type: pc.BODYTYPE_STATIC,
        mass: 0
    });

    // Random scale for visual variety
    const scale = Math.random() * 2 + 0.5; // 0.5 to 2.5
    entity.setLocalScale(scale, scale, scale);

    // IMPROVED: Enhanced asteroid material for better visibility
    const asteroidMaterial = new pc.StandardMaterial();
    asteroidMaterial.diffuse.set(0.6, 0.5, 0.4); // Brown/gray for asteroids
    asteroidMaterial.emissive.set(0.2, 0.15, 0.1); // Warm glow
    asteroidMaterial.shininess = 20;
    asteroidMaterial.metalness = 0.1;
    asteroidMaterial.update();
    entity.model.material = asteroidMaterial;

    // Asteroid mineable properties
    entity.mineable = {
        resourceType: 'asteroidMass',
        maxYield: scale * 2, // Larger asteroids yield more
        currentYield: scale * 2,
        isDestroyed: false,

        // Handle being hit by projectile
        onHit(projectile) {
            if (this.isDestroyed) return false;

            // Reduce yield
            const damage = 0.5;
            this.currentYield -= damage;

            console.log('[Asteroid] Hit! Remaining yield:', this.currentYield);

            // Create resource pickup
            if (this.currentYield <= 0) {
                this.destroy();
                return true;
            } else {
                // Visual feedback - flash red
                this.flashDamage();
                return false;
            }
        },

        // Destroy asteroid and create resource pickup
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

            // Pickup properties
            pickup.resourcePickup = {
                resourceType: this.resourceType,
                amount: this.maxYield,

                // Collect by ship
                collect(ship) {
                    if (ship.inventory && ship.inventory.addItem(this.resourceType, this.amount)) {
                        console.log('[Pickup] Collected', this.amount, this.resourceType);
                        pickup.destroy();
                        return true;
                    }
                    return false;
                }
            };

            // Auto-collect when ship touches
            pickup.collision.on('triggerenter', (otherEntity) => {
                if (otherEntity.shipController) {
                    pickup.resourcePickup.collect(otherEntity);
                }
            });

            // Add to scene
            app.root.addChild(pickup);

            // Auto-destroy pickup after 30 seconds
            setTimeout(() => {
                if (pickup.parent) {
                    pickup.destroy();
                }
            }, 30000);

            // Destroy asteroid
            entity.destroy();

            console.log('[Asteroid] Destroyed, created resource pickup');
        },

        // Visual damage feedback
        flashDamage() {
            // Simple color flash effect
            const material = entity.model.material;
            if (material) {
                const originalColor = material.diffuse.clone();
                material.diffuse.set(1, 0, 0); // Flash red
                material.update();

                setTimeout(() => {
                    material.diffuse.copy(originalColor);
                    material.update();
                }, 200);
            }
        }
    };

    // OPTIMIZED: Handle collision with projectiles
    entity.collision.on('collisionstart', (result) => {
        const otherEntity = result.other;
        if (otherEntity.name && otherEntity.name.startsWith('projectile_')) {
            entity.mineable.onHit(otherEntity);

            // IMPROVED: Cleanup projectile from tracking
            if (window.activeProjectiles) {
                window.activeProjectiles.delete(otherEntity);
            }
            otherEntity.destroy();
        }
    });

    // Slow rotation for visual effect
    entity.rotationSpeed = (Math.random() - 0.5) * 10; // Random rotation speed
    entity.on('update', (dt) => {
        if (!entity.mineable.isDestroyed) {
            entity.rotateLocal(0, entity.rotationSpeed * dt, 0);
        }
    });
`;
}
