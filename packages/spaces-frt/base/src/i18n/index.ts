// English-only comments
// Register spaces-frt namespaces with global i18n instance
import { registerNamespace } from '@universo/i18n/registry'
import canvasEn from './en/canvas.json'
import canvasRu from './ru/canvas.json'

// Register spaces namespace (currently empty, ready for expansion)
registerNamespace('spaces', {
    en: {},
    ru: {}
})

// Register canvas namespace for spaces-frt
registerNamespace('canvas', {
    en: canvasEn,
    ru: canvasRu
})

// Export translations for use in i18nInstance.js
export const spacesFrtTranslations = {
    en: {
        spaces: {},
        canvas: canvasEn
    },
    ru: {
        spaces: {},
        canvas: canvasRu
    }
}
