export function generateShipLogic(id: string): string {
    return `
    // Space ship entity setup
    entity.addComponent('model', { type: 'box' });

    // IMPORTANT: Add collision component first
    entity.addComponent('collision', {
        type: 'box',
        halfExtents: new pc.Vec3(1, 0.5, 2)
    });

    // Add rigidbody component after collision
    entity.addComponent('rigidbody', {
        type: pc.BODYTYPE_DYNAMIC,
        mass: 100,
        linearDamping: 0.1,
        angularDamping: 0.1,
        enabled: false  // Start disabled, will be enabled after entity is in scene
    });

    // Add ship material for visibility
    const shipMaterial = new pc.StandardMaterial();
    shipMaterial.diffuse.set(0.2, 0.8, 0.2); // Green for player ship
    shipMaterial.update();
    entity.model.material = shipMaterial;

    // Ship controller for space movement
    entity.shipController = {
        speed: 10,
        rotationSpeed: 50,
        thrustForce: 500,
        isThrusting: false,
        physicsInitialized: false,
        initializationAttempted: false,
        fallbackWarningShown: false,

        // Movement controls
        thrust(direction) {
            if (!entity.rigidbody) {
                if (!this.initializationAttempted) {
                    console.error('[ShipController] No rigidbody found on entity!');
                    this.initializationAttempted = true;
                }
                return;
            }

            // Try to initialize physics body if not already done
            if (!this.physicsInitialized && !this.initializationAttempted && !entity.rigidbody.body) {
                this.physicsInitialized = this.initializePhysics();
                this.initializationAttempted = true; // Mark as attempted regardless of success

                if (!this.physicsInitialized && !this.fallbackWarningShown) {
                    console.warn('[ShipController] Physics initialization failed, using direct movement fallback');
                    this.fallbackWarningShown = true;
                }
            }

            if (entity.rigidbody.body) {
                const force = direction.clone().scale(this.thrustForce);
                entity.rigidbody.applyForce(force);
            } else {
                // Fallback: direct position movement if physics doesn't work
                this.moveDirectly(direction);
            }

            this.isThrusting = true;
        },

        // Fallback movement method
        moveDirectly(direction) {
            const moveSpeed = this.speed * 0.016; // Approximate frame time
            const currentPos = entity.getPosition();
            const movement = direction.clone().scale(moveSpeed);
            entity.setPosition(currentPos.add(movement));
        },

        // Initialize physics body properly
        initializePhysics() {
            if (!entity.rigidbody) {
                console.error('[ShipController] No rigidbody component found');
                return false;
            }

            if (entity.rigidbody.body) {
                return true; // Already initialized
            }

            // Ensure entity is in scene hierarchy
            if (!entity.parent) {
                console.error('[ShipController] Entity not in scene hierarchy, cannot initialize physics');
                return false;
            }

            // Ensure collision component exists
            if (!entity.collision) {
                console.error('[ShipController] No collision component found, required for rigidbody');
                return false;
            }

            try {
                // Enable rigidbody component
                entity.rigidbody.enabled = true;

                // Try manual body creation if method exists
                if (!entity.rigidbody.body && typeof entity.rigidbody._createBody === 'function') {
                    entity.rigidbody._createBody();
                }

                // Check if body was created
                const success = !!entity.rigidbody.body;
                if (success) {
                    console.log('[ShipController] Physics body successfully initialized');
                }
                // Note: Failure message is handled in the calling method to avoid spam

                return success;
            } catch (error) {
                console.error('[ShipController] Error initializing physics:', error);
                return false;
            }
        },

        rotate(axis, angle) {
            if (entity.rigidbody && entity.rigidbody.body) {
                const torque = axis.clone().scale(angle * this.rotationSpeed);
                entity.rigidbody.applyTorque(torque);
            }
        },

        stopThrust() {
            this.isThrusting = false;
        }
    };

    // Ship inventory system
    entity.inventory = {
        maxCapacity: 20, // m³
        currentLoad: 0,
        items: {},

        addItem(itemType, amount) {
            if (this.currentLoad + amount <= this.maxCapacity) {
                this.items[itemType] = (this.items[itemType] || 0) + amount;
                this.currentLoad += amount;
                return true;
            }
            return false;
        },

        removeItem(itemType, amount) {
            if (this.items[itemType] && this.items[itemType] >= amount) {
                this.items[itemType] -= amount;
                this.currentLoad -= amount;
                if (this.items[itemType] === 0) delete this.items[itemType];
                return true;
            }
            return false;
        },

        getCapacityInfo() {
            return {
                current: this.currentLoad,
                max: this.maxCapacity,
                free: this.maxCapacity - this.currentLoad,
                percentage: (this.currentLoad / this.maxCapacity) * 100
            };
        }
    };

    // Ship weapon system
    entity.weaponSystem = {
        canFire: true,
        fireRate: 2, // shots per second
        lastFireTime: 0,

        fire(direction) {
            const now = Date.now();
            if (this.canFire && now - this.lastFireTime >= 1000 / this.fireRate) {
                this.createProjectile(direction);
                this.lastFireTime = now;
                return true;
            }
            return false;
        },

        createProjectile(direction) {
            // Create projectile entity
            const projectile = new pc.Entity('projectile_' + Date.now());
            projectile.addComponent('model', { type: 'sphere' });
            projectile.addComponent('rigidbody', {
                type: pc.BODYTYPE_DYNAMIC,
                mass: 0.1
            });
            projectile.addComponent('collision', {
                type: 'sphere',
                radius: 0.1
            });

            // Position projectile at ship's front
            const shipPos = entity.getPosition();
            const shipForward = entity.forward.clone();
            projectile.setPosition(shipPos.add(shipForward.scale(3)));

            // Apply velocity
            const velocity = direction.clone().scale(50);
            projectile.rigidbody.linearVelocity = velocity;

            // Add to scene
            app.root.addChild(projectile);

            // Auto-destroy after 5 seconds
            setTimeout(() => {
                if (projectile.parent) {
                    projectile.destroy();
                }
            }, 5000);

            console.log('[Ship] Projectile fired from', '${id}');
        }
    };
`;
}
