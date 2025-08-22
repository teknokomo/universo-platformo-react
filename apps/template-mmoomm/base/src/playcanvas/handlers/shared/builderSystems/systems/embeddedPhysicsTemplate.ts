// Universo Platformo | MMOOMM Embedded Physics Template
// Shared template for physics system creation

import { EmbeddedPhysicsSystem, IEmbeddedPhysicsSystem } from './embeddedPhysicsSystem'
import { IEmbeddedSystem } from '../htmlSystems/embeddedSystemsRegistry'

/**
 * Creates a standardized embedded physics system
 * @returns Embedded physics system instance
 */
export function createEmbeddedPhysicsSystem(): IEmbeddedPhysicsSystem {
    return new EmbeddedPhysicsSystem()
}

/**
 * Creates embedded physics system as IEmbeddedSystem for registry
 * @returns Embedded system interface
 */
export function createEmbeddedPhysicsSystemForRegistry(): IEmbeddedSystem {
    return new EmbeddedPhysicsSystem()
}

/**
 * Generates physics system JavaScript code
 * @returns JavaScript code string for initializePhysics function
 */
export function generateEmbeddedPhysicsCode(): string {
    const physicsSystem = createEmbeddedPhysicsSystem()
    return physicsSystem.generateCode()
}

/**
 * Physics configuration options
 */
export interface PhysicsConfig {
    enableGravity?: boolean
    gravityVector?: { x: number; y: number; z: number }
    enableDebugLogging?: boolean
    autoEnableRigidbodies?: boolean
    validatePhysicsBodies?: boolean
}

/**
 * Creates a configurable embedded physics system
 */
export function createConfigurableEmbeddedPhysicsSystem(
    config: PhysicsConfig = {}
): IEmbeddedPhysicsSystem {
    const {
        enableGravity = false, // Space environment - no gravity by default
        gravityVector = { x: 0, y: 0, z: 0 },
        enableDebugLogging = true,
        autoEnableRigidbodies = true,
        validatePhysicsBodies = true
    } = config

    return {
        name: 'PhysicsSystem',
        getDependencies: () => [],
        generateCode: () => {
            const baseSystem = new EmbeddedPhysicsSystem()
            let code = baseSystem.generateCode()

            // Configure gravity
            if (enableGravity) {
                const gravitySetup = `
            // Set custom gravity
            window.app.systems.rigidbody.gravity.set(${gravityVector.x}, ${gravityVector.y}, ${gravityVector.z});
            console.log('[Space] Custom gravity set:', window.app.systems.rigidbody.gravity.toString());`
                
                code = code.replace(
                    'console.log(\'[Space] Physics system enabled\');',
                    `console.log('[Space] Physics system enabled');${gravitySetup}`
                )
            }

            // Conditionally disable debug logging
            if (!enableDebugLogging) {
                code = code.replace(/console\.log\([^)]+\);/g, '// Debug logging disabled')
                code = code.replace(/console\.warn\([^)]+\);/g, '// Debug logging disabled')
            }

            // Conditionally disable auto-enable rigidbodies
            if (!autoEnableRigidbodies) {
                code = code.replace(/entity\.rigidbody\.enabled = true;/g, '// Auto-enable disabled')
            }

            // Conditionally disable physics body validation
            if (!validatePhysicsBodies) {
                code = code.replace(/\/\/ Try to recreate physics body[\s\S]*?entity\.rigidbody\.enabled = true;/s, '// Physics body validation disabled')
            }

            return code
        }
    }
}

/**
 * Validates physics system code for common issues
 */
export function validateEmbeddedPhysicsCode(code: string): {
    isValid: boolean
    warnings: string[]
    errors: string[]
} {
    const warnings: string[] = []
    const errors: string[] = []

    // Check for required function declaration
    if (!code.includes('function initializePhysics()')) {
        errors.push('Missing initializePhysics function declaration')
    }

    // Check for global objects usage
    const requiredGlobals = ['window.MMOEntities', 'window.app']
    for (const globalObj of requiredGlobals) {
        if (!code.includes(globalObj)) {
            errors.push(`Missing reference to ${globalObj}`)
        }
    }

    // Check for physics system validation
    if (!code.includes('app.systems.rigidbody')) {
        errors.push('Missing physics system validation')
    }

    // Check for error handling
    if (!code.includes('try') || !code.includes('catch')) {
        warnings.push('Missing error handling for entity physics initialization')
    }

    // Check for null safety
    if (!code.includes('if (!window.MMOEntities)')) {
        warnings.push('Missing null safety check for MMOEntities')
    }

    if (!code.includes('if (!entity)')) {
        warnings.push('Missing null safety check for entities')
    }

    // Check for physics body validation
    if (!code.includes('entity.rigidbody.body')) {
        warnings.push('Missing physics body validation')
    }

    return {
        isValid: errors.length === 0,
        warnings,
        errors
    }
}

/**
 * Creates a minimal physics system (for testing or lightweight scenarios)
 */
export function createMinimalEmbeddedPhysicsSystem(): IEmbeddedPhysicsSystem {
    return {
        name: 'PhysicsSystem',
        getDependencies: () => [],
        generateCode: () => `        function initializePhysics() {
            console.log('[Space] Minimal physics initialization...');
            
            if (!window.app || !window.app.systems || !window.app.systems.rigidbody) {
                console.error('[Space] Physics system not available!');
                return;
            }
            
            // Enable physics system
            window.app.systems.rigidbody.enabled = true;
            
            console.log('[Space] Minimal physics initialization complete');
        }`
    }
}

/**
 * Creates an enhanced physics system with additional features
 */
export function createEnhancedEmbeddedPhysicsSystem(): IEmbeddedPhysicsSystem {
    return {
        name: 'PhysicsSystem',
        getDependencies: () => [],
        generateCode: () => {
            const baseSystem = new EmbeddedPhysicsSystem()
            const baseCode = baseSystem.generateCode()
            
            // Add enhanced features
            const enhancedFeatures = `
            
            // Enhanced physics features
            if (window.app.systems.rigidbody.dynamicsWorld) {
                // Set physics world properties for space environment
                const world = window.app.systems.rigidbody.dynamicsWorld;
                
                // Disable deactivation for space objects (they should always be active)
                if (world.setDeactivationTime) {
                    world.setDeactivationTime(0);
                }
                
                console.log('[Space] Enhanced physics features enabled');
            }`
            
            return baseCode.replace(
                '        }',
                `${enhancedFeatures}
        }`
            )
        }
    }
}
