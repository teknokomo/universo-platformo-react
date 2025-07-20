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
        enabled: true  // FIXED: Start enabled for immediate physics
    });

    // IMPROVED: Enhanced ship material for better visibility
    const shipMaterial = new pc.StandardMaterial();
    shipMaterial.diffuse.set(0.2, 0.8, 0.2); // Green for player ship
    shipMaterial.emissive.set(0.1, 0.4, 0.1); // Slight glow
    shipMaterial.shininess = 40;
    shipMaterial.metalness = 0.3;
    shipMaterial.update();
    entity.model.material = shipMaterial;

    // ADDED: Ensure entity is visible and properly scaled
    entity.enabled = true;
    entity.setLocalScale(2, 1, 3); // Make ship more visible (wider and longer)

    // CRITICAL FIX: Keep ship in default orientation (nose pointing forward in +Z direction)
    // Camera will be positioned behind the ship instead
    entity.setLocalEulerAngles(0, 0, 0);

    // ADDED: Debug ship creation
    console.log('[Ship] Created ship entity with position:', entity.getPosition().toString());
    console.log('[Ship] Initial rotation set to:', entity.getLocalEulerAngles().toString());

    // IMPROVED: Ship controller for rotation-based space movement
    entity.shipController = {
        speed: 10,
        rotationSpeed: 60,                // Degrees per second for ship rotation
        thrustForce: 500,                 // Forward/backward thrust force
        backwardThrustRatio: 0.7,         // Backward thrust is weaker
        isThrusting: false,
        physicsInitialized: false,
        initializationAttempted: false,
        fallbackWarningShown: false,

        // NEW: Configurable rotation parameters for gimbal lock prevention
        maxPitchAngle: 85,                // Maximum pitch angle (degrees) - prevents gimbal lock
        rotationSmoothing: 5,             // Speed of rotation smoothing
        enableGimbalProtection: true,     // Enable gimbal lock protection
        maxRotationPerFrame: 180,         // Maximum rotation per frame (degrees)
        debugRotation: false,             // Disable debug logging for clean testing

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

        // ADDED: Stop thrust method
        stopThrust() {
            this.isThrusting = false;
            // Optional: Apply slight damping to reduce drift
            if (entity.rigidbody && entity.rigidbody.body) {
                const currentVelocity = entity.rigidbody.linearVelocity;
                const dampedVelocity = currentVelocity.clone().scale(0.98); // 2% damping
                entity.rigidbody.linearVelocity = dampedVelocity;
            }
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

        // IMPROVED: Rotation with both physics and fallback
        rotate(rotationVector, dt) {
            if (entity.rigidbody && entity.rigidbody.body) {
                // Physics-based rotation using torque
                const torque = rotationVector.clone().scale(this.rotationSpeed * 10); // Scale for torque
                entity.rigidbody.applyTorque(torque);
            } else {
                // Fallback: Direct rotation for immediate response
                this.rotateDirectly(rotationVector, dt);
            }
        },

        // IMPROVED: Direct rotation using quaternions to prevent gimbal lock
        rotateDirectly(rotationVector, dt) {
            // Validation of input parameters
            if (!rotationVector || isNaN(dt) || dt <= 0) {
                if (this.debugRotation) {
                    console.warn('[Ship] Invalid rotation parameters');
                }
                return;
            }

            const rotationAmount = this.rotationSpeed * dt;

            // Protection against extreme values on each axis
            const maxRotation = this.maxRotationPerFrame || 180;
            const clampedX = pc.math.clamp(rotationVector.x * rotationAmount, -maxRotation, maxRotation);
            const clampedY = pc.math.clamp(rotationVector.y * rotationAmount, -maxRotation, maxRotation);
            const clampedZ = pc.math.clamp(rotationVector.z * rotationAmount, -maxRotation, maxRotation);

            // REVISED: Build quaternions around SHIP-LOCAL axes so inputs stay consistent even after rolls
            const right   = entity.right.clone().normalize();    // Local X (wing direction)
            const up      = entity.up.clone().normalize();       // Local Y (top of ship)
            const forward = entity.forward.clone().normalize();  // Local Z (nose direction)

            const qPitch = new pc.Quat().setFromAxisAngle(right,   clampedX); // pitch around local X
            const qYaw   = new pc.Quat().setFromAxisAngle(up,      clampedY); // yaw   around local Y
            const qRoll  = new pc.Quat().setFromAxisAngle(forward, clampedZ); // roll  around local Z

            // Compose: yaw · pitch · roll  (common flight order)
            const qDelta = new pc.Quat();
            qDelta.mul2(qYaw, qPitch); // yaw * pitch
            qDelta.mul(qRoll);         // * roll

            // Apply delta to current orientation
            const currentQuat = entity.getRotation().clone();
            currentQuat.mul2(qDelta, currentQuat);
            currentQuat.normalize();   // safety renormalize
            entity.setRotation(currentQuat);

            // Optional debug output
            if (this.debugRotation && Math.random() < 0.005) {
                console.log('[Ship] Quaternion rotation:', currentQuat.toString());
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

    // ADDED: Camera controller for ship following
    entity.cameraController = {
        target: entity,                    // The ship entity
        offset: new pc.Vec3(0, 8, -18),   // Camera slightly lower
        distance: 15,                     // Current distance from ship
        offsetRot: new pc.Quat().setFromEulerAngles(-5, 180, 0), // Camera pitched down 5°
        minDistance: 5,                   // Minimum zoom distance
        maxDistance: 50,                  // Maximum zoom distance

        // Camera smoothing settings
        followSpeed: 4.0,                 // How fast camera follows ship (increased)
        lookSpeed: 3.0,                   // How fast camera rotates to look at ship (increased)

        // NEW: Configurable camera parameters for stability
        maxPitch: 80,                     // Maximum pitch angle for camera stability
        rotationSmoothing: 5,             // Speed of rotation smoothing
        enableSmoothLimits: true,         // Enable smooth angle limits
        debugCamera: false,               // Enable camera debug logging

        // Get the camera entity
        getCamera() {
            return window.spaceCamera;
        },

        // IMPROVED: Update camera position with ship rotation tracking and stabilization
        update(dt) {
            const camera = this.getCamera();
            if (!camera || !this.target) return;

            // DISABLED: Remove pitch limiting that was causing rotation blocks
            // The gimbal lock protection is now handled in rotateDirectly() method
            // Camera will follow ship rotation naturally without artificial limits
            if (this.debugCamera && this.enableSmoothLimits) {
                const shipEuler = this.target.getLocalEulerAngles();
                const maxPitch = this.maxPitch || 80;

                // Only warn about extreme angles, don't limit them
                if (Math.abs(shipEuler.x) > maxPitch && Math.random() < 0.1) {
                    console.warn('[Camera] Ship at extreme pitch angle:', shipEuler.x);
                }
            }

            // Get ship position and rotation
            const shipPos = this.target.getPosition();
            const shipRotation = this.target.getRotation();

            // CRITICAL FIX: Transform camera offset by ship rotation
            // This makes camera rigidly attached behind the ship
            const rotatedOffset = shipRotation.transformVector(this.offset.clone());
            const scaledOffset = rotatedOffset.scale(this.distance / 15);
            const targetPos = shipPos.clone().add(scaledOffset);

            // FIXED: Safe camera movement with validation
            const currentPos = camera.getPosition();

            // Validate current position
            if (isNaN(currentPos.x) || isNaN(currentPos.y) || isNaN(currentPos.z)) {
                // Reset camera to safe position if NaN detected
                camera.setPosition(targetPos);
                console.warn('[Camera] Reset camera position due to NaN values');
                return;
            }

            // Smooth camera movement with safe lerp
            const lerpFactor = Math.min(this.followSpeed * dt, 1);
            const newPos = new pc.Vec3(
                currentPos.x + (targetPos.x - currentPos.x) * lerpFactor,
                currentPos.y + (targetPos.y - currentPos.y) * lerpFactor,
                currentPos.z + (targetPos.z - currentPos.z) * lerpFactor
            );

            camera.setPosition(newPos);
            const desiredRot = shipRotation.clone().mul(this.offsetRot);
            camera.setRotation(desiredRot);

            // IMPROVED: Debug camera with configurable logging
            if (this.debugCamera && Math.random() < 0.001) {
                console.log('[Camera] Following ship at:', shipPos.toString(), 'camera at:', newPos.toString());
            }
        },

        // Handle zoom input (will be used later)
        zoom(delta) {
            this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance + delta));
        },

        // IMPROVED: Initialize camera with ship rotation awareness
        initializeCamera() {
            const camera = this.getCamera();
            if (camera && this.target) {
                // Set initial camera position relative to ship with rotation
                const shipPos = this.target.getPosition();
                const shipRotation = this.target.getRotation();

                // Transform offset by ship rotation for proper initial positioning
                const rotatedOffset = shipRotation.transformVector(this.offset.clone());
                const scaledOffset = rotatedOffset.scale(this.distance / 15);
                const initialPos = shipPos.clone().add(scaledOffset);

                camera.setPosition(initialPos);
                const desiredRot = shipRotation.clone().mul(this.offsetRot);
                camera.setRotation(desiredRot);
                console.log('[Camera] Initialized at position:', initialPos.toString());
            }
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
            // IMPROVED: Memory-managed projectile creation
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

            // ADDED: Track projectiles for cleanup
            if (!window.activeProjectiles) window.activeProjectiles = new Set();
            window.activeProjectiles.add(projectile);

            // Position projectile at ship's front
            const shipPos = entity.getPosition();
            const shipForward = entity.forward.clone();
            projectile.setPosition(shipPos.add(shipForward.scale(3)));

            // Apply velocity
            const velocity = direction.clone().scale(50);
            projectile.rigidbody.linearVelocity = velocity;

            // Add to scene
            app.root.addChild(projectile);

            // IMPROVED: Auto-destroy with cleanup after 5 seconds
            setTimeout(() => {
                if (projectile.parent) {
                    if (window.activeProjectiles) {
                        window.activeProjectiles.delete(projectile);
                    }
                    projectile.destroy();
                }
            }, 5000);

            console.log('[Ship] Projectile fired from', '${id}');
        }
    };

    // ADDED: Initialize camera to follow this ship
    if (window.spaceCamera) {
        entity.cameraController.target = entity;
        entity.cameraController.initializeCamera();
        console.log('[Ship] Camera controller initialized for ship');
    }
`;
}
