// Universo Platformo | Builders setup
// Setup function to register all available builders

import { BuilderRegistry } from './BuilderRegistry'
import { ARJSBuilder } from '../arjs/ARJSBuilder'

/**
 * Setup and register all available builders
 * Call this function during application initialization
 */
export function setupBuilders(): void {
    // Register AR.js builder
    BuilderRegistry.register('arjs', ARJSBuilder)

    // Future builders will be registered here
    // BuilderRegistry.register('playcanvas', PlayCanvasBuilder)
    // BuilderRegistry.register('threejs', ThreeJSBuilder)
}
