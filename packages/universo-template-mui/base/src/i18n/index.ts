// i18n registration for universo-template-mui
// Registers 'settings' namespace for SettingsDialog component

import { registerNamespace } from '@universo/i18n/registry'
import enSettings from '../../locales/en/settings.json'
import ruSettings from '../../locales/ru/settings.json'

let isRegistered = false

/**
 * Registers the 'settings' namespace.
 * Called automatically when the module is imported, but also exported
 * for explicit registration if needed.
 */
export function registerSettingsI18n(): void {
    if (isRegistered) return
    
    registerNamespace('settings', {
        en: enSettings,
        ru: ruSettings
    })
    
    isRegistered = true
}

// Auto-register on import
registerSettingsI18n()
