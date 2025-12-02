/**
 * @fileoverview i18n namespace registration for @flowise/customtemplates-frt
 *
 * This module registers the 'templates' namespace with @universo/i18n
 * for use throughout the custom templates frontend package.
 */

import { registerNamespace } from '@universo/i18n'

// Import locale files
import en from './locales/en/templates.json'
import ru from './locales/ru/templates.json'

// Register the 'templates' namespace with translations
registerNamespace('templates', {
  en,
  ru
})

export { en, ru }
