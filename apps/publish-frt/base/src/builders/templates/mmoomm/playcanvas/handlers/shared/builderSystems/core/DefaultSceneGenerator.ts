// Universo Platformo | MMOOMM Default Scene Generator
// Extracts generateDefaultScene and generateErrorScene methods from PlayCanvasMMOOMMBuilder

import { BuildOptions } from '../../../../../../../common/types'

/**
 * Interface for default scene generator
 */
export interface IDefaultSceneGenerator {
    generateErrorScene(options: BuildOptions): string
    generateDefaultScene(options: BuildOptions): string
    generateEmptyScene(): string
    generateDemoScene(): string
    generateRotatorScriptCode(): string
}

/**
 * Default Scene Generator for MMOOMM template
 * Manages fallback and demo scene generation
 */
export class DefaultSceneGenerator implements IDefaultSceneGenerator {
    /**
     * Generate error scene based on demo mode
     */
    generateErrorScene(options: BuildOptions): string {
        const demoMode = options.demoMode || 'off'

        if (demoMode === 'off') {
            return this.generateEmptyScene()
        } else if (demoMode === 'primitives') {
            return this.generateDemoScene()
        } else {
            // Default to empty scene for unknown demo modes
            return this.generateEmptyScene()
        }
    }

    /**
     * Generate default scene (alias for error scene)
     */
    generateDefaultScene(options: BuildOptions): string {
        return this.generateErrorScene(options)
    }

    /**
     * Generate empty scene with just camera and lighting
     */
    generateEmptyScene(): string {
        return `// Empty scene - no demo objects
console.log('[MMOOMM] Empty scene loaded - demo mode disabled');

// Basic scene setup
const emptyEntity = new pc.Entity('empty-scene');
app.root.addChild(emptyEntity);

app.start();
console.log('[MMOOMM] Empty scene initialization complete');`
    }

    /**
     * Generate demo scene with rotating red cube
     */
    generateDemoScene(): string {
        return `// Default scene - red box indicating minimal MMOOMM setup
console.log('[MMOOMM] Demo scene loading...');

const defaultBox = new pc.Entity('default-box');
defaultBox.addComponent('model', { type: 'box' });

// Create red material
const material = new pc.StandardMaterial();
material.diffuse.set(1, 0, 0); // Red color
material.update();

defaultBox.model.material = material;
defaultBox.setLocalScale(2, 2, 2);
app.root.addChild(defaultBox);

// Add rotation script for smooth animation using new script system
${this.generateRotatorScriptCode()}

defaultBox.addComponent('script');
defaultBox.script.create('rotator', {
    attributes: {
        speed: 10
    }
});

app.start();
console.log('[MMOOMM] Demo scene with rotating red cube loaded');`
    }

    /**
     * Generate rotator script code for demo animations
     */
    generateRotatorScriptCode(): string {
        return `// Rotator script for demo objects
const RotatorScript = pc.createScript('rotator');

RotatorScript.attributes.add('speed', {
    type: 'number',
    default: 10,
    title: 'Speed',
    description: 'Rotation speed in degrees per second'
});

RotatorScript.prototype.update = function(dt) {
    this.entity.rotate(0, this.speed * dt, 0);
};

console.log('[MMOOMM] Rotator script registered');`
    }
}

/**
 * Demo mode options
 */
export type DemoMode = 'off' | 'primitives' | 'space' | 'debug'

/**
 * Configuration options for default scene generation
 */
export interface DefaultSceneConfig {
    demoMode?: DemoMode
    enableRotation?: boolean
    rotationSpeed?: number
    cubeColor?: { r: number; g: number; b: number }
    cubeScale?: { x: number; y: number; z: number }
    enableLighting?: boolean
    enableDebugLogging?: boolean
}

/**
 * Creates a configurable default scene generator
 */
export function createConfigurableDefaultSceneGenerator(
    config: DefaultSceneConfig = {}
): IDefaultSceneGenerator {
    const {
        demoMode = 'off',
        enableRotation = true,
        rotationSpeed = 10,
        cubeColor = { r: 1, g: 0, b: 0 },
        cubeScale = { x: 2, y: 2, z: 2 },
        enableLighting = true,
        enableDebugLogging = true
    } = config

    return {
        generateErrorScene(options: BuildOptions): string {
            const effectiveDemoMode = options.demoMode || demoMode
            const baseGenerator = new DefaultSceneGenerator()
            
            if (effectiveDemoMode === 'off') {
                return baseGenerator.generateEmptyScene()
            } else {
                let scene = baseGenerator.generateDemoScene()
                
                // Apply configuration
                if (cubeColor.r !== 1 || cubeColor.g !== 0 || cubeColor.b !== 0) {
                    scene = scene.replace(
                        'material.diffuse.set(1, 0, 0);',
                        `material.diffuse.set(${cubeColor.r}, ${cubeColor.g}, ${cubeColor.b});`
                    )
                }
                
                if (cubeScale.x !== 2 || cubeScale.y !== 2 || cubeScale.z !== 2) {
                    scene = scene.replace(
                        'defaultBox.setLocalScale(2, 2, 2);',
                        `defaultBox.setLocalScale(${cubeScale.x}, ${cubeScale.y}, ${cubeScale.z});`
                    )
                }
                
                if (rotationSpeed !== 10) {
                    scene = scene.replace(
                        'speed: 10',
                        `speed: ${rotationSpeed}`
                    )
                }
                
                if (!enableRotation) {
                    scene = scene.replace(/\/\/ Add rotation script[\s\S]*?}\);/s, '// Rotation disabled')
                }
                
                if (!enableDebugLogging) {
                    scene = scene.replace(/console\.log\([^)]+\);/g, '// Debug logging disabled')
                }
                
                return scene
            }
        },

        generateDefaultScene(options: BuildOptions): string {
            return this.generateErrorScene(options)
        },

        generateEmptyScene(): string {
            const baseGenerator = new DefaultSceneGenerator()
            let scene = baseGenerator.generateEmptyScene()
            
            if (!enableDebugLogging) {
                scene = scene.replace(/console\.log\([^)]+\);/g, '// Debug logging disabled')
            }
            
            return scene
        },

        generateDemoScene(): string {
            const baseGenerator = new DefaultSceneGenerator()
            return baseGenerator.generateDemoScene()
        },

        generateRotatorScriptCode(): string {
            const baseGenerator = new DefaultSceneGenerator()
            let script = baseGenerator.generateRotatorScriptCode()
            
            if (rotationSpeed !== 10) {
                script = script.replace(
                    'default: 10',
                    `default: ${rotationSpeed}`
                )
            }
            
            return script
        }
    }
}

/**
 * Creates a space-themed demo scene generator
 */
export function createSpaceDemoSceneGenerator(): IDefaultSceneGenerator {
    const spaceConfig: DefaultSceneConfig = {
        demoMode: 'space',
        enableRotation: true,
        rotationSpeed: 5, // Slower rotation for space
        cubeColor: { r: 0.2, g: 0.5, b: 1 }, // Blue for space
        cubeScale: { x: 1, y: 1, z: 1 }, // Smaller scale
        enableLighting: true,
        enableDebugLogging: true
    }

    return createConfigurableDefaultSceneGenerator(spaceConfig)
}

/**
 * Creates a debug scene generator with enhanced features
 */
export function createDebugSceneGenerator(): IDefaultSceneGenerator {
    return {
        generateErrorScene(options: BuildOptions): string {
            return `// Debug scene with enhanced features
console.log('[DEBUG] Debug scene loading...');

// Create multiple debug objects
const debugContainer = new pc.Entity('debug-container');
app.root.addChild(debugContainer);

// Red cube
const redCube = new pc.Entity('red-cube');
redCube.addComponent('model', { type: 'box' });
const redMaterial = new pc.StandardMaterial();
redMaterial.diffuse.set(1, 0, 0);
redMaterial.update();
redCube.model.material = redMaterial;
redCube.setPosition(-3, 0, 0);
debugContainer.addChild(redCube);

// Green sphere
const greenSphere = new pc.Entity('green-sphere');
greenSphere.addComponent('model', { type: 'sphere' });
const greenMaterial = new pc.StandardMaterial();
greenMaterial.diffuse.set(0, 1, 0);
greenMaterial.update();
greenSphere.model.material = greenMaterial;
greenSphere.setPosition(0, 0, 0);
debugContainer.addChild(greenSphere);

// Blue cylinder
const blueCylinder = new pc.Entity('blue-cylinder');
blueCylinder.addComponent('model', { type: 'cylinder' });
const blueMaterial = new pc.StandardMaterial();
blueMaterial.diffuse.set(0, 0, 1);
blueMaterial.update();
blueCylinder.model.material = blueMaterial;
blueCylinder.setPosition(3, 0, 0);
debugContainer.addChild(blueCylinder);

// Add rotation to container
${this.generateRotatorScriptCode()}
debugContainer.addComponent('script');
debugContainer.script.create('rotator', { attributes: { speed: 20 } });

app.start();
console.log('[DEBUG] Debug scene with multiple objects loaded');`
        },

        generateDefaultScene(options: BuildOptions): string {
            return this.generateErrorScene(options)
        },

        generateEmptyScene(): string {
            return `// Debug empty scene
console.log('[DEBUG] Debug empty scene loaded');
app.start();`
        },

        generateDemoScene(): string {
            return this.generateErrorScene({})
        },

        generateRotatorScriptCode(): string {
            const baseGenerator = new DefaultSceneGenerator()
            return baseGenerator.generateRotatorScriptCode()
        }
    }
}
