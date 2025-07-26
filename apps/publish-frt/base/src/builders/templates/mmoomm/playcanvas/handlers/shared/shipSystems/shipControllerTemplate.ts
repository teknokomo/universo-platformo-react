// Universo Platformo | MMOOMM Ship Controller Template
// Shared template for ship movement and physics control system

/**
 * Interface for ship controller system
 */
export interface ShipControllerSystem {
    speed: number;
    rotationSpeed: number;
    thrustForce: number;
    backwardThrustRatio: number;
    isThrusting: boolean;
    physicsInitialized: boolean;
    initializationAttempted: boolean;
    fallbackWarningShown: boolean;
    maxPitchAngle: number;
    rotationSmoothing: number;
    enableGimbalProtection: boolean;
    maxRotationPerFrame: number;
    debugRotation: boolean;
    thrust(direction: any): void;
    stopThrust(): void;
    moveDirectly(direction: any): void;
    initializePhysics(): boolean;
    rotate(rotationVector: any, dt: number): void;
    rotateDirectly(rotationVector: any, dt: number): void;
}

/**
 * Creates a standardized ship controller system object
 * @param speed Base movement speed
 * @param rotationSpeed Rotation speed in degrees per second
 * @param thrustForce Physics thrust force
 * @param enableDebug Whether to enable debug logging
 * @returns Ship controller system object
 */
export function createShipControllerSystem(
    speed: number = 10,
    rotationSpeed: number = 60,
    thrustForce: number = 500,
    enableDebug: boolean = false
): ShipControllerSystem {
    return {
        speed,
        rotationSpeed,
        thrustForce,
        backwardThrustRatio: 0.7,
        isThrusting: false,
        physicsInitialized: false,
        initializationAttempted: false,
        fallbackWarningShown: false,
        maxPitchAngle: 85,
        rotationSmoothing: 5,
        enableGimbalProtection: true,
        maxRotationPerFrame: 180,
        debugRotation: enableDebug,

        thrust(direction: any): void {
            // Implementation will be in generated code
        },
        stopThrust(): void {
            // Implementation will be in generated code
        },
        moveDirectly(direction: any): void {
            // Implementation will be in generated code
        },
        initializePhysics(): boolean {
            // Implementation will be in generated code
            return false;
        },
        rotate(rotationVector: any, dt: number): void {
            // Implementation will be in generated code
        },
        rotateDirectly(rotationVector: any, dt: number): void {
            // Implementation will be in generated code
        }
    };
}

/**
 * Generates JavaScript code string for ship controller system
 * Used by ship entity generator to create runtime controller objects
 * @param speed Base movement speed
 * @param rotationSpeed Rotation speed in degrees per second
 * @param thrustForce Physics thrust force
 * @param enableDebug Whether to enable debug logging
 * @param includeLogging Whether to include console logging
 * @returns JavaScript code string
 */
export function generateShipControllerCode(
    speed: number = 10,
    rotationSpeed: number = 60,
    thrustForce: number = 500,
    enableDebug: boolean = false,
    includeLogging: boolean = false
): string {
    const debugLogging = includeLogging && enableDebug ? `
                if (this.debugRotation) {
                    console.warn('[Ship] Invalid rotation parameters');
                }` : '';

    const debugOutput = includeLogging && enableDebug ? `
            if (this.debugRotation && Math.random() < 0.005) {
                console.log('[Ship] Quaternion rotation:', currentQuat.toString());
            }` : '';

    const physicsLogging = includeLogging ? `
                    console.log('[ShipController] Physics body successfully initialized');` : '';

    const errorLogging = includeLogging ? `
                console.error('[ShipController] No rigidbody found on entity!');` : '';

    return `{
        speed: ${speed},
        rotationSpeed: ${rotationSpeed},
        thrustForce: ${thrustForce},
        backwardThrustRatio: 0.7,
        isThrusting: false,
        physicsInitialized: false,
        initializationAttempted: false,
        fallbackWarningShown: false,
        maxPitchAngle: 85,
        rotationSmoothing: 5,
        enableGimbalProtection: true,
        maxRotationPerFrame: 180,
        debugRotation: ${enableDebug},

        thrust(direction) {
            if (!entity.rigidbody) {
                if (!this.initializationAttempted) {${errorLogging}
                    this.initializationAttempted = true;
                }
                return;
            }

            if (!this.physicsInitialized && !this.initializationAttempted && !entity.rigidbody.body) {
                this.physicsInitialized = this.initializePhysics();
                this.initializationAttempted = true;

                if (!this.physicsInitialized && !this.fallbackWarningShown) {
                    console.warn('[ShipController] Physics initialization failed, using direct movement fallback');
                    this.fallbackWarningShown = true;
                }
            }

            if (entity.rigidbody.body) {
                const force = direction.clone().scale(this.thrustForce);
                entity.rigidbody.applyForce(force);
            } else {
                this.moveDirectly(direction);
            }

            this.isThrusting = true;
        },

        stopThrust() {
            this.isThrusting = false;
            if (entity.rigidbody && entity.rigidbody.body) {
                const currentVelocity = entity.rigidbody.linearVelocity;
                const dampedVelocity = currentVelocity.clone().scale(0.98);
                entity.rigidbody.linearVelocity = dampedVelocity;
            }
        },

        moveDirectly(direction) {
            const moveSpeed = this.speed * 0.016;
            const currentPos = entity.getPosition();
            const movement = direction.clone().scale(moveSpeed);
            entity.setPosition(currentPos.add(movement));
        },

        initializePhysics() {
            if (!entity.rigidbody) {
                console.error('[ShipController] No rigidbody component found');
                return false;
            }

            if (entity.rigidbody.body) {
                return true;
            }

            if (!entity.parent) {
                console.error('[ShipController] Entity not in scene hierarchy, cannot initialize physics');
                return false;
            }

            if (!entity.collision) {
                console.error('[ShipController] No collision component found, required for rigidbody');
                return false;
            }

            try {
                entity.rigidbody.enabled = true;

                if (!entity.rigidbody.body && typeof entity.rigidbody._createBody === 'function') {
                    entity.rigidbody._createBody();
                }

                const success = !!entity.rigidbody.body;
                if (success) {${physicsLogging}
                }

                return success;
            } catch (error) {
                console.error('[ShipController] Error initializing physics:', error);
                return false;
            }
        },

        rotate(rotationVector, dt) {
            if (entity.rigidbody && entity.rigidbody.body) {
                const torque = rotationVector.clone().scale(this.rotationSpeed * 10);
                entity.rigidbody.applyTorque(torque);
            } else {
                this.rotateDirectly(rotationVector, dt);
            }
        },

        rotateDirectly(rotationVector, dt) {
            if (!rotationVector || isNaN(dt) || dt <= 0) {${debugLogging}
                return;
            }

            const rotationAmount = this.rotationSpeed * dt;
            const maxRotation = this.maxRotationPerFrame || 180;
            const clampedX = pc.math.clamp(rotationVector.x * rotationAmount, -maxRotation, maxRotation);
            const clampedY = pc.math.clamp(rotationVector.y * rotationAmount, -maxRotation, maxRotation);
            const clampedZ = pc.math.clamp(rotationVector.z * rotationAmount, -maxRotation, maxRotation);

            const right = entity.right.clone().normalize();
            const up = entity.up.clone().normalize();
            const forward = entity.forward.clone().normalize();

            const qPitch = new pc.Quat().setFromAxisAngle(right, clampedX);
            const qYaw = new pc.Quat().setFromAxisAngle(up, clampedY);
            const qRoll = new pc.Quat().setFromAxisAngle(forward, clampedZ);

            const qDelta = new pc.Quat();
            qDelta.mul2(qYaw, qPitch);
            qDelta.mul(qRoll);

            const currentQuat = entity.getRotation().clone();
            currentQuat.mul2(qDelta, currentQuat);
            currentQuat.normalize();
            entity.setRotation(currentQuat);${debugOutput}
        }
    }`;
}
