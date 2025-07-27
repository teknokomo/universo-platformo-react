// Universo Platformo | MMOOMM PlayCanvas Initializer
// Extracts generatePlayCanvasInit method from PlayCanvasMMOOMMBuilder

/**
 * Interface for PlayCanvas initializer
 */
export interface IPlayCanvasInitializer {
    generateInitializationCode(): string
    generatePhysicsSetup(): string
    generateLightingSetup(): string
    generateCameraSetup(): string
    generateCanvasSetup(): string
}

/**
 * PlayCanvas Initializer for MMOOMM template
 * Manages PlayCanvas application initialization
 */
export class PlayCanvasInitializer implements IPlayCanvasInitializer {
    /**
     * Generate complete PlayCanvas initialization code
     */
    generateInitializationCode(): string {
        return `// Initialize PlayCanvas application with MMO support
const canvas = document.getElementById('application-canvas');
const app = new pc.Application(canvas, {
    mouse: new pc.Mouse(canvas),
    touch: new pc.TouchDevice(canvas),
    keyboard: new pc.Keyboard(window),
    elementInput: new pc.ElementInput(canvas)
});

${this.generatePhysicsSetup()}

${this.generateCanvasSetup()}

${this.generateLightingSetup()}

${this.generateCameraSetup()}

// Make app globally accessible
window.app = app;

// Canvas resize handling
window.addEventListener('resize', () => {
    app.resizeCanvas();
});

console.log('[MMOOMM] PlayCanvas application initialized successfully');`
    }

    /**
     * Generate physics system setup
     */
    generatePhysicsSetup(): string {
        return `// FIXED: Enable physics system with proper initialization
console.log('[MMOOMM] Enabling physics system...');
if (app.systems.rigidbody) {
    app.systems.rigidbody.enabled = true;

    // FIXED: Proper physics world initialization
    // The physics world is created automatically when the first rigidbody is added
    // We just need to ensure the system is enabled and gravity is set

    // Universo Platformo | Space physics setup - no gravity for space environment
    app.systems.rigidbody.gravity.set(0, 0, 0);
    console.log('[MMOOMM] Physics system enabled with zero gravity for space');

    // Add debug info about physics state
    setTimeout(() => {
        console.log('[MMOOMM] Physics world state:', {
            enabled: app.systems.rigidbody.enabled,
            hasWorld: !!app.systems.rigidbody.dynamicsWorld,
            gravity: app.systems.rigidbody.gravity.toString()
        });
    }, 100);
} else {
    console.error('[MMOOMM] Physics system not available!');
}`
    }

    /**
     * Generate lighting setup
     */
    generateLightingSetup(): string {
        return `// Lighting setup for space environment
const light = new pc.Entity('directionalLight');
light.addComponent('light', {
    type: 'directional',
    color: new pc.Color(1, 1, 1),
    intensity: 1,
    castShadows: false // Disable shadows for better performance in space
});
light.setEulerAngles(45, 30, 0);
app.root.addChild(light);

// Ambient light for space
app.scene.ambientLight = new pc.Color(0.2, 0.2, 0.3);

console.log('[MMOOMM] Lighting setup complete');`
    }

    /**
     * Generate camera setup
     */
    generateCameraSetup(): string {
        return `// Camera setup
const camera = new pc.Entity('camera');
camera.addComponent('camera', {
    clearColor: new pc.Color(0.05, 0.05, 0.1), // Dark space background
    farClip: 10000, // Large far clip for space environment
    fov: 60
});

// Position camera for space view
camera.setPosition(0, 10, 20);
camera.lookAt(0, 0, 0);

app.root.addChild(camera);

// Make camera globally accessible
window.spaceCamera = camera;

console.log('[MMOOMM] Camera setup complete');`
    }

    /**
     * Generate canvas setup
     */
    generateCanvasSetup(): string {
        return `// Canvas configuration
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

console.log('[MMOOMM] Canvas configuration complete');`
    }
}

/**
 * Configuration options for PlayCanvas initialization
 */
export interface PlayCanvasConfig {
    enablePhysics?: boolean
    enableShadows?: boolean
    enableAmbientLight?: boolean
    ambientLightColor?: { r: number; g: number; b: number }
    cameraFarClip?: number
    cameraFov?: number
    backgroundColor?: { r: number; g: number; b: number }
    gravityVector?: { x: number; y: number; z: number }
}

/**
 * Creates a configurable PlayCanvas initializer
 */
export function createConfigurablePlayCanvasInitializer(
    config: PlayCanvasConfig = {}
): IPlayCanvasInitializer {
    const {
        enablePhysics = true,
        enableShadows = false,
        enableAmbientLight = true,
        ambientLightColor = { r: 0.2, g: 0.2, b: 0.3 },
        cameraFarClip = 10000,
        cameraFov = 60,
        backgroundColor = { r: 0.05, g: 0.05, b: 0.1 },
        gravityVector = { x: 0, y: 0, z: 0 }
    } = config

    return {
        generateInitializationCode(): string {
            const baseInitializer = new PlayCanvasInitializer()
            let code = baseInitializer.generateInitializationCode()

            // Apply configuration
            if (!enablePhysics) {
                code = code.replace(/\/\/ FIXED: Enable physics system[\s\S]*?}/s, '// Physics disabled')
            }

            // Update gravity
            if (gravityVector.x !== 0 || gravityVector.y !== 0 || gravityVector.z !== 0) {
                code = code.replace(
                    'app.systems.rigidbody.gravity.set(0, 0, 0);',
                    `app.systems.rigidbody.gravity.set(${gravityVector.x}, ${gravityVector.y}, ${gravityVector.z});`
                )
            }

            // Update camera settings
            code = code.replace(/farClip: 10000/, `farClip: ${cameraFarClip}`)
            code = code.replace(/fov: 60/, `fov: ${cameraFov}`)

            // Update background color
            code = code.replace(
                /clearColor: new pc\.Color\(0\.05, 0\.05, 0\.1\)/,
                `clearColor: new pc.Color(${backgroundColor.r}, ${backgroundColor.g}, ${backgroundColor.b})`
            )

            // Update ambient light
            if (enableAmbientLight) {
                code = code.replace(
                    /app\.scene\.ambientLight = new pc\.Color\(0\.2, 0\.2, 0\.3\)/,
                    `app.scene.ambientLight = new pc.Color(${ambientLightColor.r}, ${ambientLightColor.g}, ${ambientLightColor.b})`
                )
            } else {
                code = code.replace(/app\.scene\.ambientLight[\s\S]*?;/, '// Ambient light disabled')
            }

            // Update shadows
            code = code.replace(/castShadows: false/, `castShadows: ${enableShadows}`)

            return code
        },

        generatePhysicsSetup(): string {
            if (!enablePhysics) return '// Physics disabled'
            const baseInitializer = new PlayCanvasInitializer()
            return baseInitializer.generatePhysicsSetup()
        },

        generateLightingSetup(): string {
            const baseInitializer = new PlayCanvasInitializer()
            return baseInitializer.generateLightingSetup()
        },

        generateCameraSetup(): string {
            const baseInitializer = new PlayCanvasInitializer()
            return baseInitializer.generateCameraSetup()
        },

        generateCanvasSetup(): string {
            const baseInitializer = new PlayCanvasInitializer()
            return baseInitializer.generateCanvasSetup()
        }
    }
}
