// Universo Platformo | MMOOMM Global Objects Template
// Shared template for global objects management

import { GlobalObjectsManager, IGlobalObjectsManager, IGlobalObject } from './GlobalObjectsManager'

/**
 * Creates a standardized global objects manager
 * @returns Global objects manager instance
 */
export function createGlobalObjectsManager(): IGlobalObjectsManager {
    return new GlobalObjectsManager()
}

/**
 * Creates a MMOOMM-specific global objects manager with predefined objects
 * @returns Configured manager with MMOOMM global objects
 */
export function createMMOOMMGlobalObjectsManager(): IGlobalObjectsManager {
    const manager = new GlobalObjectsManager()
    
    // Register core MMOOMM global objects
    manager.registerGlobalObject(createAppGlobalObject())
    manager.registerGlobalObject(createSpaceCameraGlobalObject())
    manager.registerGlobalObject(createMMOEntitiesGlobalObject())
    manager.registerGlobalObject(createPlayerShipGlobalObject())
    manager.registerGlobalObject(createCurrentWorldGlobalObject())
    
    // Auto-resolve initialization order based on dependencies
    manager.autoResolveInitializationOrder()
    
    return manager
}

/**
 * Base class for MMOOMM global objects
 */
export abstract class BaseGlobalObject implements IGlobalObject {
    abstract name: string
    abstract type: 'object' | 'function' | 'primitive'
    abstract dependencies: string[]
    abstract generateCode(): string

    /**
     * Default initialization code (can be overridden)
     */
    getInitializationCode?(): string {
        return this.generateCode()
    }

    /**
     * Helper method to create window assignment
     */
    protected createWindowAssignment(value: string): string {
        return `window.${this.name} = ${value};`
    }
}

/**
 * Creates window.app global object definition
 */
export function createAppGlobalObject(): IGlobalObject {
    return {
        name: 'app',
        type: 'object',
        dependencies: [], // No dependencies - created first
        generateCode: () => {
            return `// window.app is created in PlayCanvas initialization
// This is a reference placeholder`
        },
        getInitializationCode: () => {
            return `// window.app will be created by PlayCanvas initializer
// No additional initialization needed here`
        }
    }
}

/**
 * Creates window.spaceCamera global object definition
 */
export function createSpaceCameraGlobalObject(): IGlobalObject {
    return {
        name: 'spaceCamera',
        type: 'object',
        dependencies: ['app'], // Depends on PlayCanvas app
        generateCode: () => {
            return `// window.spaceCamera is created in PlayCanvas initialization
// This is a reference placeholder`
        },
        getInitializationCode: () => {
            return `// window.spaceCamera will be created by PlayCanvas initializer
// No additional initialization needed here`
        }
    }
}

/**
 * Creates window.MMOEntities global object definition
 */
export function createMMOEntitiesGlobalObject(): IGlobalObject {
    return {
        name: 'MMOEntities',
        type: 'object',
        dependencies: [], // Created by handlers system
        generateCode: () => {
            return `// window.MMOEntities is created by EntityHandler
// This is a reference placeholder`
        },
        getInitializationCode: () => {
            return `// window.MMOEntities will be created by EntityHandler
// No additional initialization needed here`
        }
    }
}

/**
 * Creates window.playerShip global object definition
 */
export function createPlayerShipGlobalObject(): IGlobalObject {
    return {
        name: 'playerShip',
        type: 'object',
        dependencies: ['MMOEntities'], // Depends on entities registry
        generateCode: () => {
            return `// window.playerShip will be assigned during initialization
window.playerShip = null;`
        }
    }
}

/**
 * Creates window.currentWorld global object definition
 */
export function createCurrentWorldGlobalObject(): IGlobalObject {
    return {
        name: 'currentWorld',
        type: 'primitive',
        dependencies: [], // Independent
        generateCode: () => {
            return `// window.currentWorld stores current world name
window.currentWorld = 'Kubio';`
        }
    }
}

/**
 * Creates a custom global object from legacy code
 */
export function createLegacyGlobalObject(
    name: string,
    type: 'object' | 'function' | 'primitive',
    legacyCode: string,
    dependencies: string[] = []
): IGlobalObject {
    return {
        name,
        type,
        dependencies,
        generateCode: () => legacyCode
    }
}

/**
 * Generates global objects initialization code
 * @param manager Global objects manager
 * @returns Initialization code string
 */
export function generateGlobalObjectsInitCode(manager: IGlobalObjectsManager): string {
    // Validate dependencies before generation
    if (!manager.validateDependencies()) {
        throw new Error('Global objects have unresolved dependencies')
    }

    const header = [
        '// Universo Platformo | Global Objects Initialization',
        '// Generated by GlobalObjectsManager',
        ''
    ].join('\n')

    const initCode = manager.generateInitializationCode()

    return header + initCode
}

/**
 * Validates global objects for common issues
 */
export function validateGlobalObjects(manager: IGlobalObjectsManager): {
    isValid: boolean
    warnings: string[]
    errors: string[]
} {
    const warnings: string[] = []
    const errors: string[] = []

    // Check dependencies
    if (!manager.validateDependencies()) {
        errors.push('Unresolved dependencies detected')
    }

    // Check for common naming issues
    const registeredObjects = manager.getRegisteredObjects()
    for (const name of registeredObjects) {
        if (!name.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*$/)) {
            errors.push(`Invalid global object name: '${name}'`)
        }
        
        if (name.startsWith('_')) {
            warnings.push(`Global object '${name}' starts with underscore (private convention)`)
        }
    }

    // Check initialization order
    const initOrder = manager.getInitializationOrder()
    if (initOrder.length !== registeredObjects.length) {
        warnings.push('Initialization order length mismatch with registered objects')
    }

    return {
        isValid: errors.length === 0,
        warnings,
        errors
    }
}
