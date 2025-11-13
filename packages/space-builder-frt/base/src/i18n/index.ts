// Space Builder i18n registration
// English-only comments inside code (per repository guidelines)
// We register a dedicated "spaceBuilder" namespace instead of merging into the generic "translation"
// so components can bind via useTranslation('spaceBuilder') and use short keys like t('title').

import en from './locales/en/main.json'
import ru from './locales/ru/main.json'
import { registerNamespace } from '@universo/i18n/registry'

// Extract nested object (the JSON has shape { spaceBuilder: { ... } })
const enNs = (en as any)?.spaceBuilder || {}
const ruNs = (ru as any)?.spaceBuilder || {}

registerNamespace('spaceBuilder', { en: enNs, ru: ruNs })

export const spaceBuilderTranslations: Record<string, any> = { en: enNs, ru: ruNs }
export default spaceBuilderTranslations

// Backward-compatible API for consumers still calling registerSpaceBuilderI18n(i18n)
// Safe to call multiple times; registry should merge/overwrite without side effects
export function registerSpaceBuilderI18n(_i18n?: unknown): void {
	// Ensure namespace is registered even if import order changes
	registerNamespace('spaceBuilder', { en: enNs, ru: ruNs })
}

