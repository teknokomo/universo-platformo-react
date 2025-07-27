// Universo Platformo | MMOOMM Embedded Helper Functions Template
// Shared template for helper functions creation

import { EmbeddedHelperFunctions, IEmbeddedHelperFunctions } from './EmbeddedHelperFunctions'
import { IEmbeddedSystem } from '../htmlSystems/EmbeddedSystemsRegistry'

/**
 * Creates a standardized embedded helper functions system
 * @returns Embedded helper functions instance
 */
export function createEmbeddedHelperFunctions(): IEmbeddedHelperFunctions {
    return new EmbeddedHelperFunctions()
}

/**
 * Creates embedded helper functions as IEmbeddedSystem for registry
 * @returns Embedded system interface
 */
export function createEmbeddedHelperFunctionsForRegistry(): IEmbeddedSystem {
    return new EmbeddedHelperFunctions()
}

/**
 * Generates helper functions JavaScript code
 * @returns JavaScript code string for trading and initialization functions
 */
export function generateEmbeddedHelperCode(): string {
    const helperSystem = createEmbeddedHelperFunctions()
    return helperSystem.generateCode()
}

/**
 * Trading configuration options
 */
export interface TradingConfig {
    enableTradeAll?: boolean
    enableTradeHalf?: boolean
    enableCloseTrade?: boolean
    tradableItems?: string[]
    exchangeRates?: Record<string, number>
    enableTradingLogs?: boolean
}

/**
 * Initialization configuration options
 */
export interface InitializationConfig {
    enableSpaceControlsInit?: boolean
    enableHUDUpdates?: boolean
    hudUpdateInterval?: number
    physicsInitDelay?: number
    enablePlayerShipSearch?: boolean
    enableDebugLogging?: boolean
}

/**
 * Creates a configurable embedded helper functions system
 */
export function createConfigurableEmbeddedHelperFunctions(
    tradingConfig: TradingConfig = {},
    initConfig: InitializationConfig = {}
): IEmbeddedHelperFunctions {
    const {
        enableTradeAll = true,
        enableTradeHalf = true,
        enableCloseTrade = true,
        tradableItems = ['asteroidMass'],
        enableTradingLogs = true
    } = tradingConfig

    const {
        enableSpaceControlsInit = true,
        enableHUDUpdates = true,
        hudUpdateInterval = 1000,
        physicsInitDelay = 500,
        enablePlayerShipSearch = true,
        enableDebugLogging = true
    } = initConfig

    return {
        name: 'HelperFunctions',
        getDependencies: () => ['SpaceHUD', 'SpaceControls', 'PhysicsSystem'],
        generateCode: () => {
            const baseSystem = new EmbeddedHelperFunctions()
            let code = baseSystem.generateCode()

            // Configure trading functions
            if (!enableTradeAll) {
                code = code.replace(/function tradeAll\(\)[\s\S]*?}/s, '// tradeAll disabled')
            }

            if (!enableTradeHalf) {
                code = code.replace(/function tradeHalf\(\)[\s\S]*?}/s, '// tradeHalf disabled')
            }

            if (!enableCloseTrade) {
                code = code.replace(/function closeTrade\(\)[\s\S]*?}/s, '// closeTrade disabled')
            }

            // Configure tradable items
            if (tradableItems.length > 0 && !tradableItems.includes('asteroidMass')) {
                const itemsCondition = tradableItems.map(item => `item.type === '${item}'`).join(' || ')
                code = code.replace(
                    "if (item.type === 'asteroidMass')",
                    `if (${itemsCondition})`
                )
            }

            // Configure initialization functions
            if (!enableSpaceControlsInit) {
                code = code.replace(/function initializeSpaceControls\(\)[\s\S]*?}/s, '// initializeSpaceControls disabled')
            }

            if (!enableHUDUpdates) {
                code = code.replace(/function startHUDUpdates\(\)[\s\S]*?}/s, '// startHUDUpdates disabled')
            }

            // Configure intervals and delays
            code = code.replace(/setInterval\([^,]+, 1000\)/, `setInterval(() => { /* HUD update */ }, ${hudUpdateInterval})`)
            code = code.replace(/setTimeout\([^,]+, 500\)/, `setTimeout(() => { /* Physics init */ }, ${physicsInitDelay})`)

            // Conditionally disable debug logging
            if (!enableDebugLogging) {
                code = code.replace(/console\.log\([^)]+\);/g, '// Debug logging disabled')
                code = code.replace(/console\.warn\([^)]+\);/g, '// Debug logging disabled')
            }

            // Conditionally disable trading logs
            if (!enableTradingLogs) {
                code = code.replace(/console\.log\('\[Trading\][^']+'\);/g, '// Trading logs disabled')
            }

            return code
        }
    }
}

/**
 * Validates helper functions code for common issues
 */
export function validateEmbeddedHelperCode(code: string): {
    isValid: boolean
    warnings: string[]
    errors: string[]
} {
    const warnings: string[] = []
    const errors: string[] = []

    // Check for required trading functions
    const tradingFunctions = ['tradeAll', 'tradeHalf', 'closeTrade']
    for (const func of tradingFunctions) {
        if (!code.includes(`function ${func}()`)) {
            warnings.push(`Trading function '${func}' not found`)
        }
    }

    // Check for required initialization functions
    const initFunctions = ['initializeSpaceControls', 'startHUDUpdates']
    for (const func of initFunctions) {
        if (!code.includes(`function ${func}()`)) {
            errors.push(`Initialization function '${func}' not found`)
        }
    }

    // Check for global objects usage
    const requiredGlobals = [
        'window.playerShip',
        'window.SpaceHUD',
        'window.SpaceControls',
        'window.MMOEntities'
    ]
    for (const globalObj of requiredGlobals) {
        if (!code.includes(globalObj)) {
            warnings.push(`Global object '${globalObj}' not referenced`)
        }
    }

    // Check for null safety in trading functions
    if (code.includes('ship?.nearStation') && !code.includes('if (ship && station')) {
        warnings.push('Trading functions may lack proper null safety checks')
    }

    // Check for timer usage
    if (!code.includes('setTimeout') || !code.includes('setInterval')) {
        warnings.push('Missing timer functions for initialization and updates')
    }

    // Check for physics initialization dependency
    if (code.includes('initializePhysics()') && !code.includes('typeof initializePhysics === \'function\'')) {
        warnings.push('Physics initialization lacks function existence check')
    }

    return {
        isValid: errors.length === 0,
        warnings,
        errors
    }
}

/**
 * Creates a minimal helper functions system (for testing)
 */
export function createMinimalEmbeddedHelperFunctions(): IEmbeddedHelperFunctions {
    return {
        name: 'HelperFunctions',
        getDependencies: () => [],
        generateCode: () => `        // Minimal helper functions
        function closeTrade() {
            if (window.SpaceHUD && window.SpaceHUD.hideTradingPanel) {
                window.SpaceHUD.hideTradingPanel();
            }
        }
        
        function startHUDUpdates() {
            console.log('[Space] Minimal HUD updates started');
        }`
    }
}

/**
 * Creates trading-only helper functions (no initialization)
 */
export function createTradingOnlyHelperFunctions(): IEmbeddedHelperFunctions {
    return {
        name: 'HelperFunctions',
        getDependencies: () => ['SpaceHUD'],
        generateCode: () => {
            const baseSystem = new EmbeddedHelperFunctions()
            const code = baseSystem.generateCode()
            
            // Remove initialization functions, keep only trading
            return code.replace(/\/\/ Initialization functions[\s\S]*$/s, '')
        }
    }
}
