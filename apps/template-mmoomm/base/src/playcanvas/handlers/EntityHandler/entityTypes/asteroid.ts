export function generateAsteroidLogic(id: string): string {
    return `
    // Asteroid entity setup
    entity.tags.add('asteroid');
    // Only add default model if not already set by Component Render
    if (!entity.model) {
        entity.addComponent('model', { type: 'sphere' });
    }

    // Collision setup (always needed for game mechanics)
    // Use scale from UPDL for collision radius calculation
    const entityScale = entity.getLocalScale();
    const scaleMultiplier = Math.max(entityScale.x, entityScale.y, entityScale.z);
    const collisionRadius = scaleMultiplier > 1 ? scaleMultiplier : (Math.random() * 2 + 1);
    
    entity.addComponent('collision', {
        type: 'sphere',
        radius: collisionRadius
    });
    entity.addComponent('rigidbody', {
        type: pc.BODYTYPE_STATIC,
        mass: 0
    });

    // Scale is always taken from Transform - no random scaling
    // Future: Add separate variability component for random asteroid sizes

    // IMPROVED: Enhanced asteroid material (only if no custom render component applied)
    if (entity.model && !entity.__hasRenderComponent) {
        const asteroidMaterial = new pc.StandardMaterial();
        asteroidMaterial.diffuse.set(0.6, 0.5, 0.4); // Brown/gray for asteroids
        asteroidMaterial.emissive.set(0.2, 0.15, 0.1); // Warm glow
        asteroidMaterial.shininess = 20;
        asteroidMaterial.metalness = 0.1;
        asteroidMaterial.update();
        entity.model.material = asteroidMaterial;
        if (entity.model && entity.model.meshInstances) {
            entity.model.meshInstances.forEach(function(mi){ mi.material = asteroidMaterial; });
        }
    }

    // Asteroid mineable properties
    const mineableScale = entity.getLocalScale();
    const mineableScaleMultiplier = Math.max(mineableScale.x, mineableScale.y, mineableScale.z); // Use largest scale dimension
    entity.mineable = {
        resourceType: 'asteroidMass',
        maxYield: mineableScaleMultiplier * 2, // Larger asteroids yield more
        currentYield: mineableScaleMultiplier * 2,
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

    // NOTE: Projectile collision handling removed - now using laser mining system

    // Slow rotation for visual effect
    entity.rotationSpeed = (Math.random() - 0.5) * 10; // Random rotation speed
    entity.on('update', (dt) => {
        if (!entity.mineable.isDestroyed) {
            entity.rotateLocal(0, entity.rotationSpeed * dt, 0);
        }
    });
`;
}
