// Universo Platformo | MMOOMM Scene Initialization Template
// Shared template for scene initialization

import { 
    SceneInitializer, 
    ISceneInitializer, 
    SceneInitConfig, 
    createConfigurableSceneInitializer,
    createMinimalSceneInitializer,
    createDebugSceneInitializer
} from './SceneInitializer'

/**
 * Creates a standardized scene initializer
 * @returns Scene initializer instance
 */
export function createSceneInitializer(): ISceneInitializer {
    return new SceneInitializer()
}

/**
 * Generates scene initialization JavaScript code
 * @returns JavaScript code string for scene initialization
 */
export function generateSceneInitCode(): string {
    const initializer = createSceneInitializer()
    return initializer.generateSceneInitializationCode()
}

/**
 * Creates a production-ready scene initializer for MMOOMM
 * @returns Configured initializer for production environment
 */
export function createProductionSceneInitializer(): ISceneInitializer {
    const productionConfig: SceneInitConfig = {
        enableDebugLogging: false, // Disable debug logs in production
        enableFallbackInit: true,
        fallbackDelay: 2000, // Longer delay for production
        enableAppStateLogging: false,
        initializationFunctions: ['initializeSpaceControls', 'startHUDUpdates']
    }

    return createConfigurableSceneInitializer(productionConfig)
}

/**
 * Creates a development scene initializer with enhanced debugging
 * @returns Configured initializer for development environment
 */
export function createDevelopmentSceneInitializer(): ISceneInitializer {
    const devConfig: SceneInitConfig = {
        enableDebugLogging: true,
        enableFallbackInit: true,
        fallbackDelay: 500, // Shorter delay for development
        enableAppStateLogging: true,
        initializationFunctions: ['initializeSpaceControls', 'startHUDUpdates']
    }

    return createConfigurableSceneInitializer(devConfig)
}

/**
 * Creates a testing scene initializer with minimal features
 * @returns Configured initializer for testing environment
 */
export function createTestingSceneInitializer(): ISceneInitializer {
    const testConfig: SceneInitConfig = {
        enableDebugLogging: true,
        enableFallbackInit: false, // No fallback in tests
        enableAppStateLogging: true,
        initializationFunctions: ['initializeSpaceControls'] // Only essential functions
    }

    return createConfigurableSceneInitializer(testConfig)
}

/**
 * Validates scene initialization code for common issues
 */
export function validateSceneInitCode(code: string): {
    isValid: boolean
    warnings: string[]
    errors: string[]
} {
    const warnings: string[] = []
    const errors: string[] = []

    // Check for required app start handler
    if (!code.includes('app.on("start"')) {
        errors.push('Missing app start event handler')
    }

    // Check for initialization function calls
    const requiredFunctions = ['initializeSpaceControls', 'startHUDUpdates']
    for (const func of requiredFunctions) {
        if (!code.includes(func)) {
            warnings.push(`Missing ${func} function call`)
        }
    }

    // Check for function existence checks
    if (code.includes('initializeSpaceControls()') && !code.includes('typeof initializeSpaceControls === "function"')) {
        warnings.push('Missing function existence check for initializeSpaceControls')
    }

    // Check for fallback initialization
    if (!code.includes('setTimeout')) {
        warnings.push('Missing fallback initialization timeout')
    }

    // Check for debug logging
    if (!code.includes('console.log')) {
        warnings.push('No debug logging found - may make troubleshooting difficult')
    }

    // Check for app state validation
    if (!code.includes('app.running') && code.includes('console.log')) {
        warnings.push('Missing app state validation in debug logging')
    }

    return {
        isValid: errors.length === 0,
        warnings,
        errors
    }
}

/**
 * Scene initialization phases
 */
export enum InitializationPhase {
    APP_START = 'app_start',
    FALLBACK = 'fallback',
    COMPLETE = 'complete'
}

/**
 * Creates a phased scene initializer with different initialization phases
 */
export function createPhasedSceneInitializer(
    phases: Partial<Record<InitializationPhase, string[]>> = {}
): ISceneInitializer {
    const appStartFunctions = phases[InitializationPhase.APP_START] || ['initializeSpaceControls']
    const fallbackFunctions = phases[InitializationPhase.FALLBACK] || ['initializeSpaceControls']
    const completeFunctions = phases[InitializationPhase.COMPLETE] || ['startHUDUpdates']

    return {
        generateSceneInitializationCode(): string {
            return `// Phased scene initialization
console.log("[MMOOMM] Setting up phased initialization");

app.on("start", () => {
    console.log("[MMOOMM] Phase 1: App start");

    ${appStartFunctions.map(func => `
    if (typeof ${func} === "function") {
        console.log("[MMOOMM] Phase 1: Calling ${func}");
        ${func}();
    }`).join('')}
    
    // Phase 2: Complete initialization
    setTimeout(() => {
        console.log("[MMOOMM] Phase 2: Complete initialization");
        
        ${completeFunctions.map(func => `
        if (typeof ${func} === "function") {
            console.log("[MMOOMM] Phase 2: Calling ${func}");
            ${func}();
        }`).join('')}
        
        console.log("[MMOOMM] All phases complete");
    }, 100);
});

// Fallback phase
setTimeout(() => {
    console.log("[MMOOMM] Phase 3: Fallback check");
    
    if (!window.playerShip) {
        ${fallbackFunctions.map(func => `
        if (typeof ${func} === "function") {
            console.log("[MMOOMM] Phase 3: Fallback ${func}");
            ${func}();
        }`).join('')}
    }
}, 1000);

console.log("[MMOOMM] Phased initialization setup complete");`
        },

        generateAppStartHandler(): string {
            return 'app.on("start", () => { /* Phased initialization */ });'
        },

        generateFallbackInitialization(): string {
            return 'setTimeout(() => { /* Fallback phase */ }, 1000);'
        },

        generateDebugLogging(): string {
            return 'console.log("[MMOOMM] Phased debug logging");'
        }
    }
}

/**
 * Creates a scene initializer with custom initialization order
 */
export function createCustomOrderSceneInitializer(
    initOrder: string[]
): ISceneInitializer {
    return {
        generateSceneInitializationCode(): string {
            const baseInitializer = new SceneInitializer()
            let code = baseInitializer.generateSceneInitializationCode()

            // Replace initialization calls with custom order
            const customInitCalls = initOrder.map((func, index) => `
    // Step ${index + 1}: ${func}
    if (typeof ${func} === "function") {
        console.log("[MMOOMM] Step ${index + 1}: Calling ${func}");
        ${func}();
    } else {
        console.warn("[MMOOMM] Step ${index + 1}: ${func} not found");
    }`).join('')

            code = code.replace(
                /\/\/ Initialize space controls[\s\S]*?console\.log\("\[MMOOMM\] Scene initialization complete"\);/s,
                customInitCalls + '\n    \n    console.log("[MMOOMM] Custom initialization complete");'
            )

            return code
        },

        generateAppStartHandler(): string {
            const baseInitializer = new SceneInitializer()
            return baseInitializer.generateAppStartHandler()
        },

        generateFallbackInitialization(): string {
            const baseInitializer = new SceneInitializer()
            return baseInitializer.generateFallbackInitialization()
        },

        generateDebugLogging(): string {
            const baseInitializer = new SceneInitializer()
            return baseInitializer.generateDebugLogging()
        }
    }
}
