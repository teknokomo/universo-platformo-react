// Universo Platformo | Builders setup
// Setup function to register all available builders

import { BuilderRegistry } from './BuilderRegistry'
import { ARJSBuilder } from '../templates/quiz/arjs/ARJSBuilder'

/**
 * Setup and register all available builders
 * Call this function during application initialization
 */
export function setupBuilders(): void {
    // Register AR.js builder
    BuilderRegistry.register('arjs', ARJSBuilder)

    console.log('[Setup] Builders registered: ARJSBuilder')
}
