// Universo Platformo | MMOOMM Embedded HUD Template
// Shared template for HUD system creation

import { EmbeddedHUDSystem, IEmbeddedHUDSystem } from './EmbeddedHUDSystem'
import { IEmbeddedSystem } from '../htmlSystems/EmbeddedSystemsRegistry'

/**
 * Creates a standardized embedded HUD system
 * @returns Embedded HUD system instance
 */
export function createEmbeddedHUDSystem(): IEmbeddedHUDSystem {
    return new EmbeddedHUDSystem()
}

/**
 * Creates embedded HUD system as IEmbeddedSystem for registry
 * @returns Embedded system interface
 */
export function createEmbeddedHUDSystemForRegistry(): IEmbeddedSystem {
    return new EmbeddedHUDSystem()
}

/**
 * Generates HUD system JavaScript code
 * @returns JavaScript code string for window.SpaceHUD
 */
export function generateEmbeddedHUDCode(): string {
    const hudSystem = createEmbeddedHUDSystem()
    return hudSystem.generateCode()
}

/**
 * Validates HUD system code for common issues
 */
export function validateEmbeddedHUDCode(code: string): {
    isValid: boolean
    warnings: string[]
    errors: string[]
} {
    const warnings: string[] = []
    const errors: string[] = []

    // Check for required methods
    const requiredMethods = [
        'updateShipStatus',
        'showTradingPanel',
        'hideTradingPanel',
        'updateMiniMap',
        'updateWorld'
    ]

    for (const method of requiredMethods) {
        if (!code.includes(method)) {
            errors.push(`Missing required method: ${method}`)
        }
    }

    // Check for DOM element access patterns
    const domElements = [
        'ship-currency',
        'cargo-capacity',
        'cargo-bar',
        'cargo-items',
        'laser-status',
        'trading-panel',
        'station-name',
        'mini-map-canvas',
        'current-world'
    ]

    for (const elementId of domElements) {
        if (!code.includes(elementId)) {
            warnings.push(`DOM element '${elementId}' not referenced`)
        }
    }

    // Check for global objects usage
    const globalObjects = ['window.MMOEntities', 'window.playerShip', 'window.currentWorld']
    for (const globalObj of globalObjects) {
        if (!code.includes(globalObj)) {
            warnings.push(`Global object '${globalObj}' not referenced`)
        }
    }

    // Check for null safety
    if (!code.includes('document.getElementById') || !code.includes('if (')) {
        warnings.push('DOM element access may lack null safety checks')
    }

    return {
        isValid: errors.length === 0,
        warnings,
        errors
    }
}

/**
 * Creates a custom HUD system with additional methods
 */
export function createCustomEmbeddedHUDSystem(
    customMethods: Record<string, string>
): IEmbeddedHUDSystem {
    const baseSystem = new EmbeddedHUDSystem()
    
    return {
        name: baseSystem.name,
        getDependencies: () => baseSystem.getDependencies(),
        generateCode: () => {
            const baseCode = baseSystem.generateCode()
            
            // Insert custom methods before the closing brace
            const customMethodsCode = Object.entries(customMethods)
                .map(([name, code]) => `            // Custom method: ${name}\n            ${name}${code}`)
                .join(',\n\n')
            
            if (customMethodsCode) {
                return baseCode.replace(
                    '        }',
                    `,\n\n${customMethodsCode}\n        }`
                )
            }
            
            return baseCode
        }
    }
}

/**
 * HUD system configuration options
 */
export interface HUDSystemConfig {
    enableMiniMap?: boolean
    enableTradingPanel?: boolean
    enableLaserStatus?: boolean
    customElementIds?: Record<string, string>
}

/**
 * Creates a configurable embedded HUD system
 */
export function createConfigurableEmbeddedHUDSystem(
    config: HUDSystemConfig = {}
): IEmbeddedHUDSystem {
    const {
        enableMiniMap = true,
        enableTradingPanel = true,
        enableLaserStatus = true,
        customElementIds = {}
    } = config

    return {
        name: 'SpaceHUD',
        getDependencies: () => [],
        generateCode: () => {
            const baseSystem = new EmbeddedHUDSystem()
            let code = baseSystem.generateCode()

            // Apply custom element IDs
            for (const [originalId, customId] of Object.entries(customElementIds)) {
                code = code.replace(new RegExp(originalId, 'g'), customId)
            }

            // Conditionally disable features
            if (!enableMiniMap) {
                code = code.replace(/updateMiniMap\([^}]+\},?\s*/s, '')
            }

            if (!enableTradingPanel) {
                code = code.replace(/showTradingPanel\([^}]+\},?\s*/s, '')
                code = code.replace(/hideTradingPanel\([^}]+\},?\s*/s, '')
            }

            if (!enableLaserStatus) {
                code = code.replace(/\/\/ Update laser system status[\s\S]*?}\s*}/s, '')
            }

            return code
        }
    }
}
