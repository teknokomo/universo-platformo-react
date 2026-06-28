// Interpretation Network cell-style widget i18n bundle.
import { registerNamespace } from '@universo-react/i18n/registry'
import enInterpretationNetwork from './locales/en/interpretationNetwork.json'
import ruInterpretationNetwork from './locales/ru/interpretationNetwork.json'

registerNamespace('interpretationNetwork', {
    en: enInterpretationNetwork,
    ru: ruInterpretationNetwork
})

export const interpretationNetworkTranslations = {
    en: enInterpretationNetwork,
    ru: ruInterpretationNetwork
}
