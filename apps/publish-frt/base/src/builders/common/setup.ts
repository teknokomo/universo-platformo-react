// Universo Platformo | Builders setup
// Setup function to register all available builders

import { BuilderRegistry } from './BuilderRegistry'
import { ARJSBuilder } from '../templates/quiz/arjs/ARJSBuilder'
import { PlayCanvasBuilder } from '../templates/mmoomm/playcanvas/PlayCanvasBuilder'

/**
 * Setup and register all available builders
 * Call this function during application initialization
 */
export function setupBuilders(): void {
    // Register AR.js builder
    BuilderRegistry.register('arjs', ARJSBuilder)

    // Register PlayCanvas builder (with Colyseus 0.16.x fixes)
    BuilderRegistry.register('playcanvas', PlayCanvasBuilder)

    console.log('[Setup] Builders registered: ARJSBuilder, PlayCanvasBuilder')
}
