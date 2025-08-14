// Canonical constants for component names and intent types
export const UpComponentName = {
    Transform: 'transform',
    Visual: 'visual',
    Health: 'health'
} as const
export type UpComponentKind = (typeof UpComponentName)[keyof typeof UpComponentName]

export const UpIntentType = {
    Move: 'move',
    Rotate: 'rotate',
    Fire: 'fire',
    UseModule: 'use_module',
    Interact: 'interact'
} as const
export type UpIntentKind = (typeof UpIntentType)[keyof typeof UpIntentType]
