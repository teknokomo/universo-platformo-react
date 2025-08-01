// Universo Platformo | MMOOMM PlayCanvas Initialization Template
// Shared template for PlayCanvas initialization

import { PlayCanvasInitializer, IPlayCanvasInitializer, PlayCanvasConfig, createConfigurablePlayCanvasInitializer } from './playcanvasInitializer'

/**
 * Creates a standardized PlayCanvas initializer
 * @returns PlayCanvas initializer instance
 */
export function createPlayCanvasInitializer(): IPlayCanvasInitializer {
    return new PlayCanvasInitializer()
}

/**
 * Generates PlayCanvas initialization JavaScript code
 * @returns JavaScript code string for PlayCanvas setup
 */
export function generatePlayCanvasInitCode(): string {
    const initializer = createPlayCanvasInitializer()
    return initializer.generateInitializationCode()
}

/**
 * Creates a space-optimized PlayCanvas initializer for MMOOMM
 * @returns Configured initializer for space environment
 */
export function createSpacePlayCanvasInitializer(): IPlayCanvasInitializer {
    const spaceConfig: PlayCanvasConfig = {
        enablePhysics: true,
        enableShadows: false, // Better performance in space
        enableAmbientLight: true,
        ambientLightColor: { r: 0.2, g: 0.2, b: 0.3 }, // Cool space ambient
        cameraFarClip: 10000, // Large view distance for space
        cameraFov: 60,
        backgroundColor: { r: 0.05, g: 0.05, b: 0.1 }, // Dark space background
        gravityVector: { x: 0, y: 0, z: 0 } // Zero gravity for space
    }

    return createConfigurablePlayCanvasInitializer(spaceConfig)
}

/**
 * Creates a performance-optimized PlayCanvas initializer
 * @returns Configured initializer for better performance
 */
export function createPerformancePlayCanvasInitializer(): IPlayCanvasInitializer {
    const performanceConfig: PlayCanvasConfig = {
        enablePhysics: true,
        enableShadows: false, // Disable shadows for performance
        enableAmbientLight: false, // Minimal lighting
        cameraFarClip: 5000, // Reduced view distance
        cameraFov: 45, // Narrower FOV
        backgroundColor: { r: 0, g: 0, b: 0 }, // Pure black background
        gravityVector: { x: 0, y: 0, z: 0 }
    }

    return createConfigurablePlayCanvasInitializer(performanceConfig)
}

/**
 * Creates a debug-enabled PlayCanvas initializer
 * @returns Configured initializer with debug features
 */
export function createDebugPlayCanvasInitializer(): IPlayCanvasInitializer {
    return {
        generateInitializationCode(): string {
            const baseInitializer = new PlayCanvasInitializer()
            const baseCode = baseInitializer.generateInitializationCode()
            
            // Add debug features
            const debugFeatures = `
// Debug features enabled
app.scene.layers.getLayerByName('World').enabled = true;

// Debug physics rendering (if available)
if (app.systems.rigidbody && app.systems.rigidbody.dynamicsWorld) {
    console.log('[DEBUG] Physics world available for debug rendering');
}

// Performance monitoring
let frameCount = 0;
let lastTime = performance.now();
app.on('update', () => {
    frameCount++;
    const currentTime = performance.now();
    if (currentTime - lastTime >= 1000) {
        console.log('[DEBUG] FPS:', frameCount);
        frameCount = 0;
        lastTime = currentTime;
    }
});

console.log('[DEBUG] Debug features enabled');`

            return baseCode + debugFeatures
        },

        generatePhysicsSetup(): string {
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

/**
 * Validates PlayCanvas initialization code for common issues
 */
export function validatePlayCanvasInitCode(code: string): {
    isValid: boolean
    warnings: string[]
    errors: string[]
} {
    const warnings: string[] = []
    const errors: string[] = []

    // Check for required PlayCanvas setup
    if (!code.includes('new pc.Application')) {
        errors.push('Missing PlayCanvas Application creation')
    }

    if (!code.includes('document.getElementById(\'application-canvas\')')) {
        errors.push('Missing canvas element reference')
    }

    // Check for global objects creation
    if (!code.includes('window.app = app')) {
        errors.push('Missing window.app global assignment')
    }

    if (!code.includes('window.spaceCamera')) {
        warnings.push('Missing window.spaceCamera global assignment')
    }

    // Check for physics setup
    if (!code.includes('app.systems.rigidbody')) {
        warnings.push('Missing physics system setup')
    }

    // Check for camera setup
    if (!code.includes('addComponent(\'camera\'')) {
        errors.push('Missing camera component setup')
    }

    // Check for lighting setup
    if (!code.includes('addComponent(\'light\'')) {
        warnings.push('Missing lighting setup')
    }

    // Check for canvas configuration
    if (!code.includes('setCanvasFillMode') || !code.includes('setCanvasResolution')) {
        warnings.push('Missing canvas configuration')
    }

    // Check for resize handling
    if (!code.includes('addEventListener(\'resize\'')) {
        warnings.push('Missing window resize handling')
    }

    return {
        isValid: errors.length === 0,
        warnings,
        errors
    }
}

/**
 * Creates a minimal PlayCanvas initializer (for testing)
 */
export function createMinimalPlayCanvasInitializer(): IPlayCanvasInitializer {
    return {
        generateInitializationCode(): string {
            return `// Minimal PlayCanvas initialization
const canvas = document.getElementById('application-canvas');
const app = new pc.Application(canvas);

// Basic camera
const camera = new pc.Entity('camera');
camera.addComponent('camera');
app.root.addChild(camera);

// Make globally accessible
window.app = app;
window.spaceCamera = camera;

console.log('[MMOOMM] Minimal PlayCanvas initialization complete');`
        },

        generatePhysicsSetup(): string {
            return '// Physics disabled in minimal mode'
        },

        generateLightingSetup(): string {
            return '// Lighting disabled in minimal mode'
        },

        generateCameraSetup(): string {
            return '// Basic camera only in minimal mode'
        },

        generateCanvasSetup(): string {
            return '// Basic canvas only in minimal mode'
        }
    }
}
