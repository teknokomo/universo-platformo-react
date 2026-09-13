import { describe, expect, it } from 'vitest'

import commonEn from '@universo-react/i18n/locales/en/common.json'
import commonRu from '@universo-react/i18n/locales/ru/common.json'

const MARKETING_ZONE_KEYS = ['marketingHeader', 'marketingMain', 'marketingFooter'] as const

const readZoneLabel = (locale: unknown, key: string): string => {
    if (!locale || typeof locale !== 'object' || Array.isArray(locale)) return ''
    const root = locale as { common?: { layouts?: unknown } }
    const layouts = root.common?.layouts
    if (!layouts || typeof layouts !== 'object' || Array.isArray(layouts)) return ''
    const zones = (layouts as { zones?: unknown }).zones
    if (!zones || typeof zones !== 'object' || Array.isArray(zones)) return ''
    const value = (zones as Record<string, unknown>)[key]
    return typeof value === 'string' ? value.trim() : ''
}

describe('application marketing layout translations', () => {
    it('keeps all marketing zone labels present and localized in English and Russian', () => {
        for (const key of MARKETING_ZONE_KEYS) {
            const english = readZoneLabel(commonEn, key)
            const russian = readZoneLabel(commonRu, key)

            expect(english).not.toBe('')
            expect(russian).not.toBe('')
            expect(russian).not.toBe(english)
        }
    })
})
