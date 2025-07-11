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

    // Register PlayCanvas builder
    BuilderRegistry.register('playcanvas', PlayCanvasBuilder)

    // Future builders will be registered here
    // BuilderRegistry.register('threejs', ThreeJSBuilder)
}
