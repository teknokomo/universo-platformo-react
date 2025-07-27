// Universo Platformo | MMOOMM Scene Initializer
// Extracts scene initialization logic from PlayCanvasMMOOMMBuilder

/**
 * Interface for scene initializer
 */
export interface ISceneInitializer {
    generateSceneInitializationCode(): string
    generateAppStartHandler(): string
    generateFallbackInitialization(): string
    generateDebugLogging(): string
}

/**
 * Scene Initializer for MMOOMM template
 * Manages scene initialization and app start events
 */
export class SceneInitializer implements ISceneInitializer {
    /**
     * Generate complete scene initialization code
     */
    generateSceneInitializationCode(): string {
        return `${this.generateAppStartHandler()}

${this.generateFallbackInitialization()}

console.log("[MMOOMM] Virtual world initialized - ready for players");`
    }

    /**
     * Generate app start event handler
     */
    generateAppStartHandler(): string {
        return `console.log("[MMOOMM] Setting up app start event listener");
app.on("start", () => {
    console.log("[MMOOMM] App start event fired");
    
${this.generateDebugLogging()}
    
    // Initialize space controls
    if (typeof initializeSpaceControls === "function") {
        console.log("[MMOOMM] Calling initializeSpaceControls");
        initializeSpaceControls();
    } else {
        console.log("[MMOOMM] initializeSpaceControls not found");
    }
    
    // Start HUD updates
    if (typeof startHUDUpdates === "function") {
        console.log("[MMOOMM] Starting HUD updates");
        startHUDUpdates();
    } else {
        console.log("[MMOOMM] startHUDUpdates not found");
    }
    
    console.log("[MMOOMM] Scene initialization complete");
});`
    }

    /**
     * Generate fallback initialization
     */
    generateFallbackInitialization(): string {
        return `// Also try to initialize immediately after a delay (fallback)
setTimeout(() => {
    console.log("[MMOOMM] Timeout initialization attempt");
    
    // Check if initialization already happened
    if (window.playerShip) {
        console.log("[MMOOMM] Player ship already found, skipping fallback initialization");
        return;
    }
    
    if (typeof initializeSpaceControls === "function") {
        console.log("[MMOOMM] Calling initializeSpaceControls from timeout");
        initializeSpaceControls();
    } else {
        console.warn("[MMOOMM] initializeSpaceControls still not available after timeout");
    }
}, 1000);`
    }

    /**
     * Generate debug logging for app state
     */
    generateDebugLogging(): string {
        return `    // Debug app state after start
    console.log("[MMOOMM] App state after start:", {
        running: app.running,
        entitiesCount: app.root.children.length,
        physicsWorld: !!app.systems.rigidbody.dynamicsWorld,
        mmoEntitiesCount: window.MMOEntities?.size || 0,
        hasSpaceControls: !!window.SpaceControls,
        hasSpaceHUD: !!window.SpaceHUD
    });`
    }
}

/**
 * Configuration options for scene initialization
 */
export interface SceneInitConfig {
    enableDebugLogging?: boolean
    enableFallbackInit?: boolean
    fallbackDelay?: number
    enableAppStateLogging?: boolean
    initializationFunctions?: string[]
}

/**
 * Creates a configurable scene initializer
 */
export function createConfigurableSceneInitializer(
    config: SceneInitConfig = {}
): ISceneInitializer {
    const {
        enableDebugLogging = true,
        enableFallbackInit = true,
        fallbackDelay = 1000,
        enableAppStateLogging = true,
        initializationFunctions = ['initializeSpaceControls', 'startHUDUpdates']
    } = config

    return {
        generateSceneInitializationCode(): string {
            const baseInitializer = new SceneInitializer()
            let code = baseInitializer.generateSceneInitializationCode()

            // Configure fallback delay
            if (fallbackDelay !== 1000) {
                code = code.replace(/}, 1000\);/, `}, ${fallbackDelay});`)
            }

            // Conditionally disable features
            if (!enableDebugLogging) {
                code = code.replace(/console\.log\([^)]+\);/g, '// Debug logging disabled')
            }

            if (!enableFallbackInit) {
                code = code.replace(/\/\/ Also try to initialize[\s\S]*?}, \d+\);/s, '// Fallback initialization disabled')
            }

            return code
        },

        generateAppStartHandler(): string {
            const baseInitializer = new SceneInitializer()
            let code = baseInitializer.generateAppStartHandler()

            // Configure initialization functions
            const initCalls = initializationFunctions.map(funcName => `
    // Initialize ${funcName}
    if (typeof ${funcName} === "function") {
        console.log("[MMOOMM] Calling ${funcName}");
        ${funcName}();
    } else {
        console.log("[MMOOMM] ${funcName} not found");
    }`).join('')

            // Replace default initialization calls
            code = code.replace(
                /\/\/ Initialize space controls[\s\S]*?\/\/ Start HUD updates[\s\S]*?}/s,
                initCalls
            )

            return code
        },

        generateFallbackInitialization(): string {
            if (!enableFallbackInit) return '// Fallback initialization disabled'
            const baseInitializer = new SceneInitializer()
            return baseInitializer.generateFallbackInitialization()
        },

        generateDebugLogging(): string {
            if (!enableAppStateLogging) return '    // App state logging disabled'
            const baseInitializer = new SceneInitializer()
            return baseInitializer.generateDebugLogging()
        }
    }
}

/**
 * Creates a minimal scene initializer (for testing)
 */
export function createMinimalSceneInitializer(): ISceneInitializer {
    return {
        generateSceneInitializationCode(): string {
            return `// Minimal scene initialization
app.on("start", () => {
    console.log("[MMOOMM] Minimal scene start");
    
    if (typeof initializeSpaceControls === "function") {
        initializeSpaceControls();
    }
});

console.log("[MMOOMM] Minimal scene initialized");`
        },

        generateAppStartHandler(): string {
            return `app.on("start", () => {
    console.log("[MMOOMM] Minimal app start");
});`
        },

        generateFallbackInitialization(): string {
            return '// No fallback in minimal mode'
        },

        generateDebugLogging(): string {
            return '// No debug logging in minimal mode'
        }
    }
}

/**
 * Creates a debug-enhanced scene initializer
 */
export function createDebugSceneInitializer(): ISceneInitializer {
    return {
        generateSceneInitializationCode(): string {
            const baseInitializer = new SceneInitializer()
            const baseCode = baseInitializer.generateSceneInitializationCode()
            
            // Add enhanced debug features
            const debugEnhancements = `
// Enhanced debug features
app.on("update", (dt) => {
    // Log performance metrics every 5 seconds
    if (!window.debugTimer) window.debugTimer = 0;
    window.debugTimer += dt;
    
    if (window.debugTimer >= 5) {
        console.log("[DEBUG] Performance metrics:", {
            fps: Math.round(1 / dt),
            entities: app.root.children.length,
            playerShip: !!window.playerShip,
            mmoEntities: window.MMOEntities?.size || 0
        });
        window.debugTimer = 0;
    }
});

// Debug keyboard shortcuts
window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'd') {
        console.log("[DEBUG] Current state dump:", {
            app: !!window.app,
            playerShip: !!window.playerShip,
            spaceControls: !!window.SpaceControls,
            spaceHUD: !!window.SpaceHUD,
            mmoEntities: window.MMOEntities?.size || 0
        });
    }
});`

            return baseCode + debugEnhancements
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
