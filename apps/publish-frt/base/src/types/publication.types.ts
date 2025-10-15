// Universo Platformo | Publication Types
// Types for publication settings and demo modes

/**
 * Available demo modes for PlayCanvas publication
 */
export type DemoMode = 'off' | 'primitives'

/**
 * Demo mode configuration with display information
 */
export interface DemoModeConfig {
    value: DemoMode
    labelKey: string
    hintKey: string
}

/**
 * Available demo modes with their configurations
 */
export const DEMO_MODES: DemoModeConfig[] = [
    {
        value: 'off',
        labelKey: 'publish.playcanvas.demoMode.off',
        hintKey: 'publish.playcanvas.demoMode.offHint'
    },
    {
        value: 'primitives',
        labelKey: 'publish.playcanvas.demoMode.primitives',
        hintKey: 'publish.playcanvas.demoMode.primitivesHint'
    }
]

/**
 * Default demo mode
 */
export const DEFAULT_DEMO_MODE: DemoMode = 'off'
