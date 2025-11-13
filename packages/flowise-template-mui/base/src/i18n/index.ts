// Flowise Template MUI local i18n namespaces
// Registers speechToText and speechToTextDialog feature namespaces
// English-only comments.

import { registerNamespace } from '@universo/i18n/registry'
import enMain from './locales/en/main.json'
import ruMain from './locales/ru/main.json'

registerNamespace('speechToText', {
  en: enMain.speechToText,
  ru: ruMain.speechToText
})

registerNamespace('speechToTextDialog', {
  en: enMain.speechToTextDialog,
  ru: ruMain.speechToTextDialog
})

export const speechToTextNamespaces = {
  en: enMain,
  ru: ruMain
}

export default speechToTextNamespaces
