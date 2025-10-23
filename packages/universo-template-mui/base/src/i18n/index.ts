import { registerNamespace } from '@universo/i18n/registry'
import enFlowListTranslation from './locales/en/flowList.json'
import ruFlowListTranslation from './locales/ru/flowList.json'
import enMenuTranslation from './locales/en/menu.json'
import ruMenuTranslation from './locales/ru/menu.json'

// Register flowList namespace
registerNamespace('flowList', {
    en: enFlowListTranslation.flowList ?? enFlowListTranslation,
    ru: ruFlowListTranslation.flowList ?? ruFlowListTranslation
})

// Register menu namespace
registerNamespace('menu', {
    en: enMenuTranslation.menu ?? enMenuTranslation,
    ru: ruMenuTranslation.menu ?? ruMenuTranslation
})
