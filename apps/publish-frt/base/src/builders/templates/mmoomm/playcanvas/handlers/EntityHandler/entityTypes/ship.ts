export function generateShipLogic(id: string): string {
    return `
    // Space ship entity setup
    // Only add default model if not already set by Component Render
    if (!entity.model) {
        entity.addComponent('model', { type: 'box' });
    }

    // IMPORTANT: Add collision component first (always needed for game mechanics)
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

    // IMPROVED: Enhanced ship material (only if no custom material from Component)
    if (entity.model && !entity.model.material) {
        const shipMaterial = new pc.StandardMaterial();
        shipMaterial.diffuse.set(0.2, 0.8, 0.2); // Green for player ship
        shipMaterial.emissive.set(0.1, 0.4, 0.1); // Slight glow
        shipMaterial.shininess = 40;
        shipMaterial.metalness = 0.3;
        shipMaterial.update();
        entity.model.material = shipMaterial;
    }

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
        },

        getItemList() {
            return Object.keys(this.items).map(itemType => ({
                type: itemType,
                amount: this.items[itemType]
            }));
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

    // Ship laser mining system
    entity.laserSystem = {
        // State management
        state: 'idle', // idle, targeting, mining, collecting
        currentTarget: null,
        miningStartTime: 0,
        cycleProgress: 0,

        // Visual components
        laserBeam: null,

        // Configuration
        config: {
            maxRange: 75, // 50-100 units optimal range
            miningDuration: 3000, // 3 seconds in milliseconds
            resourceYield: 1.5, // 1-2 cubic meters per cycle
            fadeInDuration: 200,
            fadeOutDuration: 300,
        },

        // Debug and visual components
        debugMode: false,
        rangeIndicator: null,

        // Initialize system
        init() {
            console.log('[LaserSystem] Initializing laser system');
            this.state = 'idle';
            this.currentTarget = null;
            this.laserBeam = null;
            this.miningStartTime = 0;
            this.cycleProgress = 0;
            console.log('[LaserSystem] Initialization complete');
        },

        // State transition methods
        setState(newState, reason = '') {
            const oldState = this.state;
            this.state = newState;
            console.log('[LaserSystem] ' + oldState + ' -> ' + newState + (reason ? ' (' + reason + ')' : ''));

            // Handle state entry actions
            this.onStateEnter(newState, oldState);
        },

        onStateEnter(newState, oldState) {
            switch (newState) {
                case 'idle':
                    this.currentTarget = null;
                    this.miningStartTime = 0;
                    this.cycleProgress = 0;
                    this.hideLaser();
                    break;

                case 'targeting':
                    this.findTarget();
                    break;

                case 'mining':
                    this.miningStartTime = Date.now();
                    this.cycleProgress = 0;
                    this.showLaser();
                    break;

                case 'collecting':
                    this.hideLaser();
                    this.collectResources();
                    break;
            }
        },

        // Target finding and validation - simplified version
        findTarget() {
            if (!window.app || !window.playerShip) {
                console.warn('[LaserSystem] Cannot find target - app or playerShip missing');
                this.setState('idle', 'no app or ship');
                return;
            }

            const asteroids = window.app.root.findByTag ? window.app.root.findByTag('asteroid') : [];
            if (!asteroids || asteroids.length === 0) {
                this.setState('idle', 'no asteroids');
                return;
            }

            let closest = null;
            let closestDist = Infinity;
            const shipPos = window.playerShip.getPosition();

            asteroids.forEach((ast) => {
                if (!this.isValidTarget(ast)) return;
                const dist = shipPos.distance(ast.getPosition());
                if (dist < closestDist) {
                    closest = ast;
                    closestDist = dist;
                }
            });

            if (closest) {
                this.currentTarget = closest;
                console.log('[LaserSystem] Target acquired', closest.name || closest.getGuid?.());
                // Immediately proceed to mining state
                this.setState('mining', 'target found');
            } else {
                this.setState('idle', 'no target in range');
            }
        },

        // Validation methods
        isValidTarget(target) {
            if (!target || target.mineable?.isDestroyed) return false;

            const distance = this.getDistanceToTarget(target);
            if (distance > this.config.maxRange) return false;

            // Add line-of-sight check here if needed
            return true;
        },

        getDistanceToTarget(target) {
            if (!target || !window.playerShip) return Infinity;

            const shipPos = window.playerShip.getPosition();
            const targetPos = target.getPosition();
            return shipPos.distance(targetPos);
        },

        hasLineOfSight(from, to) {
            // Enhanced line-of-sight check using raycast
            if (!app.systems.rigidbody) {
                console.warn('[LaserSystem] No rigidbody system available for raycast');
                return true; // Fallback to allow targeting
            }

            // Check if physics world is properly initialized
            if (!app.systems.rigidbody.dynamicsWorld) {
                console.log('[LaserSystem] Physics world not initialized, assuming clear line of sight');
                return true; // Fallback to allow targeting
            }

            const direction = to.clone().sub(from).normalize();
            const distance = from.distance(to);

            // Offset start position slightly to avoid self-collision
            const startPos = from.clone().add(direction.clone().scale(1));

            try {
                const result = app.systems.rigidbody.raycastFirst(startPos, to);

                if (result) {
                    // Check if we hit our intended target
                    if (result.entity === this.currentTarget) {
                        return true; // Clear line of sight to target
                    }

                    // Check if we hit something very close to the target (tolerance for collision shapes)
                    const hitDistance = startPos.distance(result.point);
                    const targetDistance = startPos.distance(to);

                    if (Math.abs(hitDistance - targetDistance) < 2.0) {
                        return true; // Hit is close enough to target
                    }

                    console.log('[LaserSystem] Line of sight blocked by ' + (result.entity.name || 'unknown entity'));
                    return false; // Something is blocking the path
                }

                return true; // No obstacles detected

            } catch (error) {
                console.warn('[LaserSystem] Raycast error:', error);
                return true; // Fallback to allow targeting
            }
        },

        // Laser visual management with animations
        showLaser() {
            if (!this.currentTarget) return;

            // Create laser beam if it doesn't exist
            if (!this.laserBeam) {
                this.createLaserBeam();
            }

            // Update laser position and make visible
            this.updateLaserPosition();
            this.laserBeam.enabled = true;

            // Fade in animation
            this.animateLaserOpacity(0, 0.9, this.config.fadeInDuration);

            console.log('[LaserSystem] Laser beam activated with fade-in');
        },

        hideLaser() {
            if (this.laserBeam && this.laserBeam.enabled) {
                // Instant hide - no fade out animation to prevent visual lag
                this.laserBeam.enabled = false;

                // Reset material opacity for next use
                if (this.laserBeam.model && this.laserBeam.model.material) {
                    this.laserBeam.model.material.opacity = 0.9;
                    this.laserBeam.model.material.update();
                }
            }
        },

        animateLaserOpacity(fromOpacity, toOpacity, duration, onComplete = null) {
            if (!this.laserBeam || !this.laserBeam.model || !this.laserBeam.model.material) return;

            const material = this.laserBeam.model.material;
            const startTime = Date.now();

            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // Smooth easing
                const easedProgress = progress * progress * (3 - 2 * progress);
                const currentOpacity = fromOpacity + (toOpacity - fromOpacity) * easedProgress;

                material.opacity = currentOpacity;
                material.update();

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else if (onComplete) {
                    onComplete();
                }
            };

            animate();
        },

        createLaserBeam() {
            // Create laser beam entity using simple box model (more reliable than lines)
            this.laserBeam = new pc.Entity('laserBeam');

            // Add model component with box geometry
            this.laserBeam.addComponent('model', { type: 'box' });

            // Create red emissive material
            const mat = new pc.StandardMaterial();
            mat.diffuse.set(1, 0, 0);
            mat.emissive.set(1, 0, 0);
            mat.update();

            // Apply material
            this.laserBeam.model.material = mat;

            // Set initial scale (thin beam, Z length will be updated)
            this.laserBeam.setLocalScale(0.05, 0.05, 1);

            // Add to scene
            app.root.addChild(this.laserBeam);

            // Initially hidden
            this.laserBeam.enabled = false;

            console.log('[LaserSystem] Laser beam entity created with box rendering');
        },

        updateLaserPosition() {
            if (!this.laserBeam || !this.currentTarget) return;

            const shipPos = entity.getPosition();
            const targetPos = this.currentTarget.getPosition();

            const dir = new pc.Vec3();
            dir.sub2(targetPos, shipPos);
            const length = dir.length();

            const mid = new pc.Vec3();
            mid.add2(shipPos, dir.clone().scale(0.5));

            this.laserBeam.setPosition(mid);
            this.laserBeam.lookAt(targetPos);
            this.laserBeam.setLocalScale(0.05, 0.05, length);
        },

        // Resource collection
        collectResources() {
            if (!this.currentTarget || !entity.inventory) {
                this.setState('idle', 'collection failed');
                return;
            }

            const resourceAmount = this.config.resourceYield;

            // Check if ship has space
            if (entity.inventory.currentLoad + resourceAmount > entity.inventory.maxCapacity) {
                console.log('[LaserSystem] Cargo hold full, cannot collect resources');
                this.setState('idle', 'cargo hold full');
                return;
            }

            // Add resources to ship inventory
            if (entity.inventory.addItem('asteroidMass', resourceAmount)) {
                console.log('[LaserSystem] Collected ' + resourceAmount + ' asteroidMass');

                // Update HUD if available
                if (window.SpaceHUD) {
                    window.SpaceHUD.updateShipStatus(entity);
                }

                // Damage the asteroid
                if (this.currentTarget.mineable) {
                    this.currentTarget.mineable.onHit({ damage: 1 });
                }

                // Brief delay then return to idle
                setTimeout(() => {
                    this.setState('idle', 'collection complete');
                }, 500);
            } else {
                this.setState('idle', 'failed to add resources');
            }
        },

        // Update method called every frame
        update(deltaTime) {
            switch (this.state) {
                case 'targeting':
                    this.updateTargeting();
                    break;

                case 'mining':
                    this.updateMining(deltaTime);
                    break;

                case 'collecting':
                    this.updateCollecting(deltaTime);
                    break;
            }

            // Update debug indicators if enabled
            this.updateDebugIndicators();
        },

        updateTargeting() {
            // Validate current target is still valid
            if (!this.isValidTarget(this.currentTarget)) {
                this.setState('idle', 'target lost');
                return;
            }

            // Start mining if target is good
            this.setState('mining', 'target acquired');
        },

        updateMining(deltaTime) {
            // Update beam orientation continuously
            this.updateLaserPosition();

            const elapsed = Date.now() - this.miningStartTime;
            this.cycleProgress = elapsed / this.config.miningDuration;

            // Debug logging every 30 frames (about once per second at 30fps)
            if (Math.floor(elapsed / 100) % 10 === 0) {
                console.log('[LaserSystem] Mining progress:', (this.cycleProgress * 100).toFixed(1) + '%', 'elapsed:', elapsed, 'duration:', this.config.miningDuration);
            }

            // Check if target is still valid
            if (!this.isValidTarget(this.currentTarget)) {
                this.setState('idle', 'target lost during mining');
                return;
            }

            // Check if mining cycle is complete
            if (elapsed >= this.config.miningDuration) {
                console.log('[LaserSystem] Mining cycle complete, transitioning to collecting');
                this.setState('collecting', 'mining cycle complete');
            }
        },

        updateCollecting(deltaTime) {
            // Schedule idle transition once
            if (!this._collectTimeout) {
                this._collectTimeout = setTimeout(() => {
                    this.setState('idle', 'collection complete');
                    this._collectTimeout = null;
                }, 500);
            }
        },

        // Validation methods
        isValidTarget(target) {
            if (!target || target.mineable?.isDestroyed) return false;

            const distance = this.getDistanceToTarget(target);
            if (distance > this.config.maxRange) return false;

            return this.hasLineOfSight(entity.getPosition(), target.getPosition());
        },

        getDistanceToTarget(target) {
            if (!target) return Infinity;

            const shipPos = entity.getPosition();
            const targetPos = target.getPosition();
            return shipPos.distance(targetPos);
        },

        // Public interface
        activate() {
            console.log('[LaserSystem] Activation requested, current state: ' + this.state);

            if (this.state === 'idle') {
                this.setState('targeting', 'player activated');
                return true;
            }

            // Enhanced feedback for different states
            const stateMessages = {
                'targeting': 'already searching for target',
                'mining': 'mining in progress (' + (this.cycleProgress * 100).toFixed(0) + '%)',
                'collecting': 'collecting resources'
            };

            const message = stateMessages[this.state] || ('unknown state: ' + this.state);
            console.log('[LaserSystem] Cannot activate - ' + message);

            // Force reset if stuck in targeting state for too long
            if (this.state === 'targeting') {
                console.log('[LaserSystem] Force resetting stuck targeting state');
                this.setState('idle', 'force reset from targeting');
                return this.activate(); // Try again
            }

            return false; // Already active or busy
        },

        canActivate() {
            return this.state === 'idle';
        },

        getStatus() {
            return {
                state: this.state,
                progress: this.cycleProgress,
                hasTarget: !!this.currentTarget,
                targetDistance: this.currentTarget ? this.getDistanceToTarget(this.currentTarget) : null
            };
        },

        // Debug mode functionality
        enableDebugMode() {
            this.debugMode = true;
            this.createRangeIndicator();
            console.log('[LaserSystem] Debug mode enabled');
        },

        disableDebugMode() {
            this.debugMode = false;
            this.removeRangeIndicator();
            console.log('[LaserSystem] Debug mode disabled');
        },

        createRangeIndicator() {
            if (this.rangeIndicator) return;

            // Create a wireframe sphere to show laser range
            this.rangeIndicator = new pc.Entity('laser_range_indicator');

            // Create wireframe sphere geometry
            const material = new pc.StandardMaterial();
            material.diffuse = new pc.Color(0, 1, 0); // Green
            material.opacity = 0.3;
            material.blendType = pc.BLEND_NORMAL;
            material.cull = pc.CULLFACE_NONE;
            material.update();

            this.rangeIndicator.addComponent('render', {
                type: 'sphere',
                material: material
            });

            // Scale to laser range
            this.rangeIndicator.setLocalScale(this.config.maxRange * 2, this.config.maxRange * 2, this.config.maxRange * 2);

            // Position at ship
            this.rangeIndicator.setPosition(entity.getPosition());

            // Add to scene
            app.root.addChild(this.rangeIndicator);
        },

        removeRangeIndicator() {
            if (this.rangeIndicator) {
                this.rangeIndicator.destroy();
                this.rangeIndicator = null;
            }
        },

        updateDebugIndicators() {
            if (this.debugMode && this.rangeIndicator) {
                // Update range indicator position
                this.rangeIndicator.setPosition(entity.getPosition());
            }
        }
    };

    // ADDED: Initialize camera to follow this ship
    if (window.spaceCamera) {
        entity.cameraController.target = entity;
        entity.cameraController.initializeCamera();
        console.log('[Ship] Camera controller initialized for ship');
    }

    // Initialize laser system
    if (entity.laserSystem && entity.laserSystem.init) {
        entity.laserSystem.init();
    }

    // ADDED: Laser system update loop using app.on('update')
    app.on('update', (dt) => {
        if (entity.laserSystem && entity.laserSystem.update) {
            entity.laserSystem.update(dt);
        }
    });
`;
}
