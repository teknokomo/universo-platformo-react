// Universo Platformo | MMOOMM Default Scene Template
// Shared template for default scene generation

import {
    DefaultSceneGenerator,
    IDefaultSceneGenerator,
    DefaultSceneConfig,
    DemoMode,
    createConfigurableDefaultSceneGenerator,
    createSpaceDemoSceneGenerator,
    createDebugSceneGenerator
} from './defaultSceneGenerator'
import { BuildOptions } from '../../../../../../../common/types'

/**
 * Creates a standardized default scene generator
 * @returns Default scene generator instance
 */
export function createDefaultSceneGenerator(): IDefaultSceneGenerator {
    return new DefaultSceneGenerator()
}

/**
 * Generates error scene JavaScript code
 * @param options Build options with demo mode
 * @returns JavaScript code string for error/fallback scene
 */
export function generateErrorSceneCode(options: BuildOptions = {}): string {
    const generator = createDefaultSceneGenerator()
    return generator.generateErrorScene(options)
}

/**
 * Generates default scene JavaScript code
 * @param options Build options with demo mode
 * @returns JavaScript code string for default scene
 */
export function generateDefaultSceneCode(options: BuildOptions = {}): string {
    const generator = createDefaultSceneGenerator()
    return generator.generateDefaultScene(options)
}

/**
 * Creates a production-ready default scene generator
 * @returns Configured generator for production environment
 */
export function createProductionDefaultSceneGenerator(): IDefaultSceneGenerator {
    const productionConfig: DefaultSceneConfig = {
        demoMode: 'off', // No demo objects in production
        enableRotation: false,
        enableLighting: false,
        enableDebugLogging: false
    }

    return createConfigurableDefaultSceneGenerator(productionConfig)
}

/**
 * Creates a development default scene generator with demo features
 * @returns Configured generator for development environment
 */
export function createDevelopmentDefaultSceneGenerator(): IDefaultSceneGenerator {
    const devConfig: DefaultSceneConfig = {
        demoMode: 'primitives',
        enableRotation: true,
        rotationSpeed: 15, // Faster for development
        cubeColor: { r: 1, g: 0.5, b: 0 }, // Orange for development
        enableLighting: true,
        enableDebugLogging: true
    }

    return createConfigurableDefaultSceneGenerator(devConfig)
}

/**
 * Creates a testing default scene generator with minimal features
 * @returns Configured generator for testing environment
 */
export function createTestingDefaultSceneGenerator(): IDefaultSceneGenerator {
    const testConfig: DefaultSceneConfig = {
        demoMode: 'off', // Clean scene for tests
        enableRotation: false,
        enableLighting: false,
        enableDebugLogging: true // Keep logging for test debugging
    }

    return createConfigurableDefaultSceneGenerator(testConfig)
}

/**
 * Validates default scene code for common issues
 */
export function validateDefaultSceneCode(code: string): {
    isValid: boolean
    warnings: string[]
    errors: string[]
} {
    const warnings: string[] = []
    const errors: string[] = []

    // Check for app.start() call
    if (!code.includes('app.start()')) {
        errors.push('Missing app.start() call')
    }

    // Check for basic scene setup
    if (!code.includes('app.root.addChild') && !code.includes('Empty scene')) {
        warnings.push('No entities added to scene')
    }

    // Check for material setup in demo scenes
    if (code.includes('addComponent(\'model\'') && !code.includes('StandardMaterial')) {
        warnings.push('Model component without material setup')
    }

    // Check for script registration
    if (code.includes('createScript') && !code.includes('prototype.update')) {
        warnings.push('Script created without update method')
    }

    // Check for console logging
    if (!code.includes('console.log')) {
        warnings.push('No debug logging found')
    }

    return {
        isValid: errors.length === 0,
        warnings,
        errors
    }
}

/**
 * Scene complexity levels
 */
export enum SceneComplexity {
    MINIMAL = 'minimal',
    BASIC = 'basic',
    STANDARD = 'standard',
    COMPLEX = 'complex'
}

/**
 * Creates a scene generator based on complexity level
 */
export function createComplexityBasedSceneGenerator(
    complexity: SceneComplexity
): IDefaultSceneGenerator {
    switch (complexity) {
        case SceneComplexity.MINIMAL:
            return createConfigurableDefaultSceneGenerator({
                demoMode: 'off',
                enableRotation: false,
                enableLighting: false,
                enableDebugLogging: false
            })

        case SceneComplexity.BASIC:
            return createConfigurableDefaultSceneGenerator({
                demoMode: 'primitives',
                enableRotation: false,
                enableLighting: false,
                enableDebugLogging: true
            })

        case SceneComplexity.STANDARD:
            return createConfigurableDefaultSceneGenerator({
                demoMode: 'primitives',
                enableRotation: true,
                rotationSpeed: 10,
                enableLighting: true,
                enableDebugLogging: true
            })

        case SceneComplexity.COMPLEX:
            return createDebugSceneGenerator()

        default:
            return createDefaultSceneGenerator()
    }
}

/**
 * Creates a custom scene generator with specific objects
 */
export function createCustomSceneGenerator(
    objects: Array<{
        name: string
        type: 'box' | 'sphere' | 'cylinder' | 'plane'
        color: { r: number; g: number; b: number }
        position: { x: number; y: number; z: number }
        scale: { x: number; y: number; z: number }
        rotation?: boolean
    }>
): IDefaultSceneGenerator {
    return {
        generateErrorScene(options: BuildOptions): string {
            return this.generateDemoScene()
        },

        generateDefaultScene(options: BuildOptions): string {
            return this.generateDemoScene()
        },

        generateEmptyScene(): string {
            return `// Custom empty scene
console.log('[CUSTOM] Custom empty scene loaded');
app.start();`
        },

        generateDemoScene(): string {
            const objectsCode = objects.map((obj, index) => `
// Create ${obj.name}
const ${obj.name} = new pc.Entity('${obj.name}');
${obj.name}.addComponent('model', { type: '${obj.type}' });

const ${obj.name}Material = new pc.StandardMaterial();
${obj.name}Material.diffuse.set(${obj.color.r}, ${obj.color.g}, ${obj.color.b});
${obj.name}Material.update();

${obj.name}.model.material = ${obj.name}Material;
${obj.name}.setPosition(${obj.position.x}, ${obj.position.y}, ${obj.position.z});
${obj.name}.setLocalScale(${obj.scale.x}, ${obj.scale.y}, ${obj.scale.z});
app.root.addChild(${obj.name});

${obj.rotation ? `
// Add rotation to ${obj.name}
${obj.name}.addComponent('script');
${obj.name}.script.create('rotator', { attributes: { speed: ${10 + index * 5} } });
` : ''}`).join('')

            return `// Custom scene with ${objects.length} objects
console.log('[CUSTOM] Custom scene loading...');

${this.generateRotatorScriptCode()}

${objectsCode}

app.start();
console.log('[CUSTOM] Custom scene with ${objects.length} objects loaded');`
        },

        generateRotatorScriptCode(): string {
            const baseGenerator = new DefaultSceneGenerator()
            return baseGenerator.generateRotatorScriptCode()
        }
    }
}

/**
 * Creates a scene generator for specific demo modes
 */
export function createDemoModeSceneGenerator(mode: DemoMode): IDefaultSceneGenerator {
    const configs: Record<DemoMode, DefaultSceneConfig> = {
        off: {
            demoMode: 'off',
            enableRotation: false,
            enableLighting: false,
            enableDebugLogging: true
        },
        primitives: {
            demoMode: 'primitives',
            enableRotation: true,
            rotationSpeed: 10,
            cubeColor: { r: 1, g: 0, b: 0 },
            enableLighting: true,
            enableDebugLogging: true
        },
        space: {
            demoMode: 'space',
            enableRotation: true,
            rotationSpeed: 5,
            cubeColor: { r: 0.2, g: 0.5, b: 1 },
            cubeScale: { x: 1, y: 1, z: 1 },
            enableLighting: true,
            enableDebugLogging: true
        },
        debug: {
            demoMode: 'debug',
            enableRotation: true,
            rotationSpeed: 20,
            enableLighting: true,
            enableDebugLogging: true
        }
    }

    const config = configs[mode] || configs.off
    return createConfigurableDefaultSceneGenerator(config)
}
