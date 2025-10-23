// Universo Platformo | MMOOMM Embedded Controls Template
// Shared template for controls system creation

import { EmbeddedControlsSystem, IEmbeddedControlsSystem } from './embeddedControlsSystem'
import { IEmbeddedSystem } from '../htmlSystems/embeddedSystemsRegistry'

/**
 * Creates a standardized embedded controls system
 * @returns Embedded controls system instance
 */
export function createEmbeddedControlsSystem(): IEmbeddedControlsSystem {
    return new EmbeddedControlsSystem()
}

/**
 * Creates embedded controls system as IEmbeddedSystem for registry
 * @returns Embedded system interface
 */
export function createEmbeddedControlsSystemForRegistry(): IEmbeddedSystem {
    return new EmbeddedControlsSystem()
}

/**
 * Generates controls system JavaScript code
 * @returns JavaScript code string for window.SpaceControls
 */
export function generateEmbeddedControlsCode(): string {
    const controlsSystem = createEmbeddedControlsSystem()
    return controlsSystem.generateCode()
}

/**
 * Control scheme configuration
 */
export interface ControlSchemeConfig {
    moveKeys?: {
        forward: string
        backward: string
        left: string
        right: string
        up: string
        down: string
    }
    actionKeys?: {
        fire: string
        interact: string
        roll_left: string
        roll_right: string
    }
    enableMouseZoom?: boolean
    enableStrafe?: boolean
    moveSpeed?: number
    rotateSpeed?: number
}

/**
 * Creates a configurable embedded controls system
 */
export function createConfigurableEmbeddedControlsSystem(
    config: ControlSchemeConfig = {}
): IEmbeddedControlsSystem {
    const {
        moveKeys = {
            forward: 'KeyW',
            backward: 'KeyS',
            left: 'KeyA',
            right: 'KeyD',
            up: 'KeyQ',
            down: 'KeyZ'
        },
        actionKeys = {
            fire: 'Space',
            interact: 'KeyF',
            roll_left: 'KeyE',
            roll_right: 'KeyC'
        },
        enableMouseZoom = true,
        enableStrafe = true,
        moveSpeed = 50,
        rotateSpeed = 90
    } = config

    return {
        name: 'SpaceControls',
        getDependencies: () => ['SpaceHUD'],
        generateCode: () => {
            const baseSystem = new EmbeddedControlsSystem()
            let code = baseSystem.generateCode()

            // Replace default key codes with configured ones
            for (const [action, keyCode] of Object.entries(moveKeys)) {
                const defaultKey = getDefaultKeyForAction(action)
                if (defaultKey && defaultKey !== keyCode) {
                    code = code.replace(new RegExp(`'${defaultKey}'`, 'g'), `'${keyCode}'`)
                }
            }

            for (const [action, keyCode] of Object.entries(actionKeys)) {
                const defaultKey = getDefaultActionKey(action)
                if (defaultKey && defaultKey !== keyCode) {
                    code = code.replace(new RegExp(`'${defaultKey}'`, 'g'), `'${keyCode}'`)
                }
            }

            // Replace speed values
            code = code.replace(/moveSpeed = 50/, `moveSpeed = ${moveSpeed}`)
            code = code.replace(/rotateSpeed = 90/, `rotateSpeed = ${rotateSpeed}`)

            // Conditionally disable features
            if (!enableMouseZoom) {
                code = code.replace(/\/\/ Mouse wheel for camera zoom[\s\S]*?}\);/s, '')
            }

            if (!enableStrafe) {
                code = code.replace(/if \(this\.keys\['ShiftLeft'\][\s\S]*?}/g, '')
            }

            return code
        }
    }
}

/**
 * Helper function to get default key for movement action
 */
function getDefaultKeyForAction(action: string): string | null {
    const keyMap: Record<string, string> = {
        forward: 'KeyW',
        backward: 'KeyS',
        left: 'KeyA',
        right: 'KeyD',
        up: 'KeyQ',
        down: 'KeyZ'
    }
    return keyMap[action] || null
}

/**
 * Helper function to get default key for action
 */
function getDefaultActionKey(action: string): string | null {
    const keyMap: Record<string, string> = {
        fire: 'Space',
        interact: 'KeyF',
        roll_left: 'KeyE',
        roll_right: 'KeyC'
    }
    return keyMap[action] || null
}

/**
 * Validates controls system code for common issues
 */
export function validateEmbeddedControlsCode(code: string): {
    isValid: boolean
    warnings: string[]
    errors: string[]
} {
    const warnings: string[] = []
    const errors: string[] = []

    // Check for required methods
    const requiredMethods = [
        'init',
        'updateShipMovement',
        'updateCamera',
        'handleCameraZoom',
        'fireWeapon',
        'interact'
    ]

    for (const method of requiredMethods) {
        if (!code.includes(method)) {
            errors.push(`Missing required method: ${method}`)
        }
    }

    // Check for event listeners
    const requiredEventListeners = ['keydown', 'keyup', 'wheel']
    for (const event of requiredEventListeners) {
        if (!code.includes(`addEventListener('${event}'`)) {
            warnings.push(`Event listener for '${event}' not found`)
        }
    }

    // Check for global objects usage
    const globalObjects = [
        'window.playerShip',
        'window.spaceCamera',
        'window.SpaceHUD',
        'window.app'
    ]
    for (const globalObj of globalObjects) {
        if (!code.includes(globalObj)) {
            warnings.push(`Global object '${globalObj}' not referenced`)
        }
    }

    // Check for null safety
    if (!code.includes('if (!window.playerShip')) {
        warnings.push('Missing null safety checks for window.playerShip')
    }

    // Check for preventDefault on Space key
    if (code.includes("'Space'") && !code.includes('preventDefault')) {
        warnings.push('Space key handling may lack preventDefault()')
    }

    return {
        isValid: errors.length === 0,
        warnings,
        errors
    }
}

/**
 * Creates a custom controls system with additional key bindings
 */
export function createCustomEmbeddedControlsSystem(
    customKeyBindings: Record<string, string>
): IEmbeddedControlsSystem {
    const baseSystem = new EmbeddedControlsSystem()
    
    return {
        name: baseSystem.name,
        getDependencies: () => baseSystem.getDependencies(),
        generateCode: () => {
            const baseCode = baseSystem.generateCode()
            
            // Add custom key bindings to the keydown event handler
            const customBindingsCode = Object.entries(customKeyBindings)
                .map(([key, action]) => `                    } else if (e.code === '${key}') {\n                        ${action};`)
                .join('\n')
            
            if (customBindingsCode) {
                return baseCode.replace(
                    "} else if (e.code === 'KeyF') {",
                    `} else if (e.code === 'KeyF') {\n${customBindingsCode}`
                )
            }
            
            return baseCode
        }
    }
}
