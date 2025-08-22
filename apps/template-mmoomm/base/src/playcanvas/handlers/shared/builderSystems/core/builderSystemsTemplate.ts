// Universo Platformo | MMOOMM Builder Systems Template
// Shared template for builder systems manager creation

import { BuilderSystemsManager, IBuilderSystemsManager, BuilderSystemsConfig, createBuilderSystemsManager } from './builderSystemsManager'
import { createHTMLDocumentGenerator } from '../htmlSystems/htmlDocumentTemplate'
import { createMMOOMMEmbeddedSystemsRegistry } from '../htmlSystems/embeddedSystemsTemplate'
import { createMMOOMMGlobalObjectsManager } from '../globalObjects/globalObjectsTemplate'
import { createSpacePlayCanvasInitializer } from '../initialization/playcanvasInitTemplate'
import { createDevelopmentSceneInitializer } from '../initialization/sceneInitTemplate'
import { createDefaultSceneGenerator } from './defaultSceneTemplate'

// Import embedded systems
import { createEmbeddedHUDSystemForRegistry } from '../systems/embeddedHUDTemplate'
import { createEmbeddedControlsSystemForRegistry } from '../systems/embeddedControlsTemplate'
import { createEmbeddedPhysicsSystemForRegistry } from '../systems/embeddedPhysicsTemplate'
import { createEmbeddedHelperFunctionsForRegistry } from '../systems/embeddedHelperTemplate'

/**
 * Creates a complete MMOOMM builder systems manager with all systems configured
 * @returns Fully configured builder systems manager
 */
export function createMMOOMMBuilderSystemsManager(): IBuilderSystemsManager {
    // Create all individual systems
    const htmlGenerator = createHTMLDocumentGenerator()
    const embeddedRegistry = createMMOOMMEmbeddedSystemsRegistry()
    const globalManager = createMMOOMMGlobalObjectsManager()
    const playcanvasInitializer = createSpacePlayCanvasInitializer()
    const sceneInitializer = createDevelopmentSceneInitializer()
    const defaultSceneGenerator = createDefaultSceneGenerator()

    // Register all embedded systems in correct dependency order
    embeddedRegistry.registerSystem(createEmbeddedHUDSystemForRegistry())
    embeddedRegistry.registerSystem(createEmbeddedControlsSystemForRegistry())
    embeddedRegistry.registerSystem(createEmbeddedPhysicsSystemForRegistry())
    embeddedRegistry.registerSystem(createEmbeddedHelperFunctionsForRegistry())

    // Set proper injection order AFTER systems are registered
    // Order is critical for global objects dependencies
    const mmoomOrder = [
        'SpaceHUD',           // window.SpaceHUD object
        'SpaceControls',      // window.SpaceControls object (depends on SpaceHUD)
        'PhysicsSystem',      // initializePhysics function
        'HelperFunctions'     // Initialization functions (depends on all above)
    ]
    embeddedRegistry.setInjectionOrder(mmoomOrder)

    // Create and configure manager
    const manager = createBuilderSystemsManager(
        htmlGenerator,
        embeddedRegistry,
        globalManager,
        playcanvasInitializer,
        sceneInitializer,
        defaultSceneGenerator,
        {
            enableDebugLogging: true,
            validateOnInitialize: true,
            autoInitialize: true
        }
    )

    return manager
}

/**
 * Creates a production-ready builder systems manager
 * @returns Production-configured builder systems manager
 */
export function createProductionBuilderSystemsManager(): IBuilderSystemsManager {
    // Import production variants
    const { createProductionSceneInitializer } = require('../initialization/sceneInitTemplate')
    const { createProductionDefaultSceneGenerator } = require('./defaultSceneTemplate')

    const htmlGenerator = createHTMLDocumentGenerator()
    const embeddedRegistry = createMMOOMMEmbeddedSystemsRegistry()
    const globalManager = createMMOOMMGlobalObjectsManager()
    const playcanvasInitializer = createSpacePlayCanvasInitializer()
    const sceneInitializer = createProductionSceneInitializer()
    const defaultSceneGenerator = createProductionDefaultSceneGenerator()

    // Register embedded systems
    embeddedRegistry.registerSystem(createEmbeddedHUDSystemForRegistry())
    embeddedRegistry.registerSystem(createEmbeddedControlsSystemForRegistry())
    embeddedRegistry.registerSystem(createEmbeddedPhysicsSystemForRegistry())
    embeddedRegistry.registerSystem(createEmbeddedHelperFunctionsForRegistry())

    const manager = createBuilderSystemsManager(
        htmlGenerator,
        embeddedRegistry,
        globalManager,
        playcanvasInitializer,
        sceneInitializer,
        defaultSceneGenerator,
        {
            enableDebugLogging: false, // Disable debug logging in production
            validateOnInitialize: true,
            autoInitialize: true
        }
    )

    return manager
}

/**
 * Creates a testing builder systems manager with minimal features
 * @returns Testing-configured builder systems manager
 */
export function createTestingBuilderSystemsManager(): IBuilderSystemsManager {
    const { createTestingSceneInitializer } = require('../initialization/sceneInitTemplate')
    const { createTestingDefaultSceneGenerator } = require('./defaultSceneTemplate')
    const { createMinimalPlayCanvasInitializer } = require('../initialization/playcanvasInitTemplate')

    const htmlGenerator = createHTMLDocumentGenerator()
    const embeddedRegistry = createMMOOMMEmbeddedSystemsRegistry()
    const globalManager = createMMOOMMGlobalObjectsManager()
    const playcanvasInitializer = createMinimalPlayCanvasInitializer()
    const sceneInitializer = createTestingSceneInitializer()
    const defaultSceneGenerator = createTestingDefaultSceneGenerator()

    // Register only essential embedded systems for testing
    embeddedRegistry.registerSystem(createEmbeddedHUDSystemForRegistry())
    embeddedRegistry.registerSystem(createEmbeddedHelperFunctionsForRegistry())

    const manager = createBuilderSystemsManager(
        htmlGenerator,
        embeddedRegistry,
        globalManager,
        playcanvasInitializer,
        sceneInitializer,
        defaultSceneGenerator,
        {
            enableDebugLogging: true, // Keep logging for test debugging
            validateOnInitialize: true,
            autoInitialize: false // Manual initialization in tests
        }
    )

    return manager
}

/**
 * Creates a custom builder systems manager with specific configuration
 */
export function createCustomBuilderSystemsManager(
    config: {
        enableHUD?: boolean
        enableControls?: boolean
        enablePhysics?: boolean
        enableHelpers?: boolean
        environment?: 'development' | 'production' | 'testing'
        customSystems?: any[]
    } = {}
): IBuilderSystemsManager {
    const {
        enableHUD = true,
        enableControls = true,
        enablePhysics = true,
        enableHelpers = true,
        environment = 'development',
        customSystems = []
    } = config

    const htmlGenerator = createHTMLDocumentGenerator()
    const embeddedRegistry = createMMOOMMEmbeddedSystemsRegistry()
    const globalManager = createMMOOMMGlobalObjectsManager()
    const playcanvasInitializer = createSpacePlayCanvasInitializer()
    
    // Choose initializers based on environment
    let sceneInitializer, defaultSceneGenerator
    switch (environment) {
        case 'production':
            const { createProductionSceneInitializer, createProductionDefaultSceneGenerator } = require('../initialization/sceneInitTemplate')
            sceneInitializer = createProductionSceneInitializer()
            defaultSceneGenerator = createProductionDefaultSceneGenerator()
            break
        case 'testing':
            const { createTestingSceneInitializer, createTestingDefaultSceneGenerator } = require('./defaultSceneTemplate')
            sceneInitializer = createTestingSceneInitializer()
            defaultSceneGenerator = createTestingDefaultSceneGenerator()
            break
        default:
            sceneInitializer = createDevelopmentSceneInitializer()
            defaultSceneGenerator = createDefaultSceneGenerator()
    }

    // Register systems based on configuration
    if (enableHUD) {
        embeddedRegistry.registerSystem(createEmbeddedHUDSystemForRegistry())
    }
    if (enableControls) {
        embeddedRegistry.registerSystem(createEmbeddedControlsSystemForRegistry())
    }
    if (enablePhysics) {
        embeddedRegistry.registerSystem(createEmbeddedPhysicsSystemForRegistry())
    }
    if (enableHelpers) {
        embeddedRegistry.registerSystem(createEmbeddedHelperFunctionsForRegistry())
    }

    // Register custom systems
    for (const customSystem of customSystems) {
        embeddedRegistry.registerSystem(customSystem)
    }

    const manager = createBuilderSystemsManager(
        htmlGenerator,
        embeddedRegistry,
        globalManager,
        playcanvasInitializer,
        sceneInitializer,
        defaultSceneGenerator,
        {
            enableDebugLogging: environment !== 'production',
            validateOnInitialize: true,
            autoInitialize: true
        }
    )

    return manager
}

/**
 * Validates a builder systems manager configuration
 */
export function validateBuilderSystemsManager(manager: IBuilderSystemsManager): {
    isValid: boolean
    warnings: string[]
    errors: string[]
} {
    const warnings: string[] = []
    const errors: string[] = []

    try {
        // Check systems status
        const status = manager.getSystemsStatus()

        if (!status.initialized) {
            errors.push('Builder systems manager not initialized')
        }

        if (!status.htmlGenerator) {
            errors.push('HTML generator not configured')
        }

        if (!status.embeddedRegistry) {
            errors.push('Embedded systems registry not configured')
        }

        if (!status.globalManager) {
            errors.push('Global objects manager not configured')
        }

        if (!status.embeddedDependenciesValid) {
            errors.push('Embedded systems dependencies are invalid')
        }

        if (!status.globalDependenciesValid) {
            errors.push('Global objects dependencies are invalid')
        }

        // Check registered systems
        const embeddedSystems = manager.getRegisteredEmbeddedSystems()
        if (embeddedSystems.length === 0) {
            warnings.push('No embedded systems registered')
        }

        const globalObjects = manager.getRegisteredGlobalObjects()
        if (globalObjects.length === 0) {
            warnings.push('No global objects registered')
        }

        // Check for essential systems
        const essentialSystems = ['SpaceHUD', 'SpaceControls']
        for (const system of essentialSystems) {
            if (!embeddedSystems.includes(system)) {
                warnings.push(`Essential system '${system}' not registered`)
            }
        }

    } catch (error) {
        errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`)
    }

    return {
        isValid: errors.length === 0,
        warnings,
        errors
    }
}
