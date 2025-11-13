// English-only comments
// Register spaces-frt namespaces with global i18n instance
import { registerNamespace } from '@universo/i18n/registry'
import canvasEn from './en/canvas.json'
import canvasRu from './ru/canvas.json'

// Note: 'spaces' namespace is already registered in universo-i18n/instance.ts
// We only register canvas namespace here for spaces-frt specific translations

// Register canvas namespace for spaces-frt
registerNamespace('canvas', {
    en: canvasEn,
    ru: canvasRu
})

// Export translations for use in i18nInstance.js
export const spacesFrtTranslations = {
    en: {
        canvas: canvasEn
    },
    ru: {
        canvas: canvasRu
    }
}
