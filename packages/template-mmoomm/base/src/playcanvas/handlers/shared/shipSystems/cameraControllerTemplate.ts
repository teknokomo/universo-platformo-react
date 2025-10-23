// Universo Platformo | MMOOMM Camera Controller Template
// Shared template for camera following and control system

/**
 * Interface for camera controller system
 */
export interface CameraControllerSystem {
    target: any;
    offset: any;
    distance: number;
    offsetRot: any;
    minDistance: number;
    maxDistance: number;
    followSpeed: number;
    lookSpeed: number;
    maxPitch: number;
    rotationSmoothing: number;
    enableSmoothLimits: boolean;
    debugCamera: boolean;
    getCamera(): any;
    update(dt: number): void;
    zoom(delta: number): void;
    initializeCamera(): void;
}

/**
 * Creates a standardized camera controller system object
 * @param distance Initial camera distance from target
 * @param followSpeed Camera follow speed
 * @param enableDebug Whether to enable debug logging
 * @returns Camera controller system object
 */
export function createCameraControllerSystem(
    distance: number = 15,
    followSpeed: number = 4.0,
    enableDebug: boolean = false
): CameraControllerSystem {
    return {
        target: null,
        offset: null, // Will be set in generated code
        distance,
        offsetRot: null, // Will be set in generated code
        minDistance: 5,
        maxDistance: 50,
        followSpeed,
        lookSpeed: 3.0,
        maxPitch: 80,
        rotationSmoothing: 5,
        enableSmoothLimits: true,
        debugCamera: enableDebug,

        getCamera(): any {
            // Implementation will be in generated code
            return null;
        },
        update(dt: number): void {
            // Implementation will be in generated code
        },
        zoom(delta: number): void {
            // Implementation will be in generated code
        },
        initializeCamera(): void {
            // Implementation will be in generated code
        }
    };
}

/**
 * Generates JavaScript code string for camera controller system
 * Used by ship entity generator to create runtime camera controller objects
 * @param distance Initial camera distance from target
 * @param followSpeed Camera follow speed
 * @param enableDebug Whether to enable debug logging
 * @param includeLogging Whether to include console logging
 * @returns JavaScript code string
 */
export function generateCameraControllerCode(
    distance: number = 15,
    followSpeed: number = 4.0,
    enableDebug: boolean = false,
    includeLogging: boolean = false
): string {
    const debugWarning = includeLogging && enableDebug ? `
                    console.warn('[Camera] Ship at extreme pitch angle:', shipEuler.x);` : '';

    const debugLogging = includeLogging && enableDebug ? `
            if (this.debugCamera && Math.random() < 0.001) {
                console.log('[Camera] Following ship at:', shipPos.toString(), 'camera at:', newPos.toString());
            }` : '';

    const initLogging = includeLogging ? `
                console.log('[Camera] Initialized at position:', initialPos.toString());` : '';

    const resetWarning = includeLogging ? `
                console.warn('[Camera] Reset camera position due to NaN values');` : '';

    return `{
        target: entity,
        offset: new pc.Vec3(0, 8, -18),
        distance: ${distance},
        offsetRot: new pc.Quat().setFromEulerAngles(-5, 180, 0),
        minDistance: 5,
        maxDistance: 50,
        followSpeed: ${followSpeed},
        lookSpeed: 3.0,
        maxPitch: 80,
        rotationSmoothing: 5,
        enableSmoothLimits: true,
        debugCamera: ${enableDebug},

        getCamera() {
            return window.spaceCamera;
        },

        update(dt) {
            const camera = this.getCamera();
            if (!camera || !this.target) return;

            if (this.debugCamera && this.enableSmoothLimits) {
                const shipEuler = this.target.getLocalEulerAngles();
                const maxPitch = this.maxPitch || 80;

                if (Math.abs(shipEuler.x) > maxPitch && Math.random() < 0.1) {${debugWarning}
                }
            }

            const shipPos = this.target.getPosition();
            const shipRotation = this.target.getRotation();

            const rotatedOffset = shipRotation.transformVector(this.offset.clone());
            const scaledOffset = rotatedOffset.scale(this.distance / 15);
            const targetPos = shipPos.clone().add(scaledOffset);

            const currentPos = camera.getPosition();

            if (isNaN(currentPos.x) || isNaN(currentPos.y) || isNaN(currentPos.z)) {
                camera.setPosition(targetPos);${resetWarning}
                return;
            }

            const lerpFactor = Math.min(this.followSpeed * dt, 1);
            const newPos = new pc.Vec3(
                currentPos.x + (targetPos.x - currentPos.x) * lerpFactor,
                currentPos.y + (targetPos.y - currentPos.y) * lerpFactor,
                currentPos.z + (targetPos.z - currentPos.z) * lerpFactor
            );

            camera.setPosition(newPos);
            const desiredRot = shipRotation.clone().mul(this.offsetRot);
            camera.setRotation(desiredRot);${debugLogging}
        },

        zoom(delta) {
            this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance + delta));
        },

        initializeCamera() {
            const camera = this.getCamera();
            if (camera && this.target) {
                const shipPos = this.target.getPosition();
                const shipRotation = this.target.getRotation();

                const rotatedOffset = shipRotation.transformVector(this.offset.clone());
                const scaledOffset = rotatedOffset.scale(this.distance / 15);
                const initialPos = shipPos.clone().add(scaledOffset);

                camera.setPosition(initialPos);
                const desiredRot = shipRotation.clone().mul(this.offsetRot);
                camera.setRotation(desiredRot);${initLogging}
            }
        }
    }`;
}
