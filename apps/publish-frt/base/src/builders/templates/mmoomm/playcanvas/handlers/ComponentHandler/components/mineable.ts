export default function mineable(id: string, props: any): string {
    return `
    // Enhanced mineable component for asteroids with material density support
    const mineableComponent = {
        resourceType: '${props.resourceType || 'asteroidMass'}',
        maxYield: ${props.maxYield || 2}, // tons
        currentYield: ${props.currentYield || props.maxYield || 2}, // tons
        asteroidVolume: ${props.asteroidVolume || 5}, // m³
        hardness: ${props.hardness || 1}, // Mining difficulty (1-5)
        isDestroyed: false,

        // Material density data (embedded for runtime use)
        materialDensities: {
            asteroidMass: { density: 2.5, name: 'Asteroid Mass', baseValue: 10 },
            iron: { density: 7.9, name: 'Iron', baseValue: 50 },
            nickel: { density: 8.9, name: 'Nickel', baseValue: 80 },
            gold: { density: 19.3, name: 'Gold', baseValue: 2000 },
            platinum: { density: 21.5, name: 'Platinum', baseValue: 3000 }
        },

        getMaterialDensity() {
            return this.materialDensities[this.resourceType] || this.materialDensities.asteroidMass;
        },

        getVolumeFromWeight(weightInTons) {
            const density = this.getMaterialDensity().density;
            return weightInTons / density; // m³
        },

        getWeightFromVolume(volumeInM3) {
            const density = this.getMaterialDensity().density;
            return volumeInM3 * density; // tons
        },

        onHit(damage = 1) {
            if (this.isDestroyed) return false;

            // Apply hardness resistance to damage
            const actualDamage = damage / this.hardness;
            this.currentYield -= actualDamage;

            const material = this.getMaterialDensity();
            const remainingVolume = this.getVolumeFromWeight(this.currentYield);

            console.log('[Enhanced Mineable] Hit for', actualDamage, 'damage.');
            console.log('[Enhanced Mineable] Remaining:', this.currentYield, 'tons (' + remainingVolume.toFixed(2) + ' m³) of', material.name);

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

            const material = this.getMaterialDensity();
            const pickupVolume = this.getVolumeFromWeight(this.maxYield);

            // Create resource pickup with size based on material density
            const pickup = new pc.Entity('pickup_' + Date.now());
            pickup.addComponent('model', { type: 'sphere' });
            pickup.addComponent('collision', {
                type: 'sphere',
                radius: Math.min(0.5, Math.max(0.2, pickupVolume * 0.1)) // Size based on volume
            });

            // Scale pickup based on material density (denser = smaller visual size)
            const visualScale = Math.min(0.5, Math.max(0.2, pickupVolume * 0.08));
            pickup.setLocalScale(visualScale, visualScale, visualScale);
            pickup.setPosition(entity.getPosition());

            pickup.resourcePickup = {
                resourceType: this.resourceType,
                weightInTons: this.maxYield,
                volumeInM3: pickupVolume,
                materialName: material.name,
                density: material.density,

                collect(ship) {
                    // Try to add by weight (tons) - inventory will handle volume conversion
                    if (ship.inventory && ship.inventory.addItem) {
                        // Check if enhanced inventory (supports material density)
                        if (ship.inventory.addItem(this.resourceType, this.weightInTons, 'tons')) {
                            console.log('[Enhanced Pickup] Collected', this.weightInTons, 'tons (' + this.volumeInM3.toFixed(2) + ' m³) of', this.materialName);
                            pickup.destroy();
                            return true;
                        }
                        // Fallback to simple inventory (volume-based)
                        else if (ship.inventory.addItem(this.resourceType, this.volumeInM3)) {
                            console.log('[Simple Pickup] Collected', this.volumeInM3.toFixed(2), 'm³ of', this.materialName);
                            pickup.destroy();
                            return true;
                        }
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
