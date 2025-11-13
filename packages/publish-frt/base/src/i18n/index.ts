// Publish module i18n (TypeScript version)
// English comments only inside code

import { registerNamespace } from '@universo/i18n/registry'
// Import template-mmoomm translations to register its namespace for TemplateSelect labels
import templateMmoomm from '@universo/template-mmoomm/i18n'
import enMainTranslation from './locales/en/main.json'
import ruMainTranslation from './locales/ru/main.json'

// Register 'publish' namespace with flattened structure
registerNamespace('publish', {
    en: enMainTranslation.publish,
    ru: ruMainTranslation.publish
})

// Register separate 'common' namespace (was nested inside publish previously)
if (enMainTranslation.publish.common && ruMainTranslation.publish.common) {
    registerNamespace('common', {
        en: enMainTranslation.publish.common,
        ru: ruMainTranslation.publish.common
    })
}
export default {
    en: enMainTranslation.publish,
    ru: ruMainTranslation.publish
}

// Also register 'templateMmoomm' namespace so TemplateSelect can resolve PlayCanvas template labels
try {
    const en = (templateMmoomm as any)?.en?.templateMmoomm
    const ru = (templateMmoomm as any)?.ru?.templateMmoomm
    if (en && ru) {
        registerNamespace('templateMmoomm', { en, ru })
    }
} catch {
    // no-op: optional registration
}
