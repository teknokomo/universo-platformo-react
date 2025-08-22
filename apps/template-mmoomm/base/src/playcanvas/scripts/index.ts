// Universo Platformo | PlayCanvas Scripts Module
// Simplified export for MMOOMM template scripts

import { RotatorScript } from './RotatorScript'

// Base classes
export { BaseScript } from './BaseScript'

// Core scripts
export { RotatorScript } from './RotatorScript'

// Simple factory function for MVP
export function getDefaultRotatorScript() {
    return RotatorScript.createDefault()
}

// Simplified setup function for MVP
export function setupScriptSystem(): void {
    // Simple initialization - no complex registry needed for MVP
    console.log('[MMOOMM Scripts] Simple script system ready')
}
