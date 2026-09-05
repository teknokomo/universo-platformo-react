import { describe, expect, it } from 'vitest'

import metahubsEn from '../locales/en/metahubs.json'
import metahubsRu from '../locales/ru/metahubs.json'

const MARKETING_ZONE_KEYS = ['marketingHeader', 'marketingMain', 'marketingFooter'] as const

const readZoneLabel = (locale: unknown, key: string): string => {
    if (!locale || typeof locale !== 'object' || Array.isArray(locale)) return ''
    const root = locale as { layouts?: unknown; metahubs?: unknown }
    const metahubs = root.metahubs
    const layouts =
        root.layouts ??
        (metahubs && typeof metahubs === 'object' && !Array.isArray(metahubs) ? (metahubs as { layouts?: unknown }).layouts : undefined)
    if (!layouts || typeof layouts !== 'object' || Array.isArray(layouts)) return ''
    const zones = (layouts as { zones?: unknown }).zones
    if (!zones || typeof zones !== 'object' || Array.isArray(zones)) return ''
    const value = (zones as Record<string, unknown>)[key]
    return typeof value === 'string' ? value.trim() : ''
}

describe('metahub marketing layout translations', () => {
    it('keeps all marketing zone labels present and localized in English and Russian', () => {
        for (const key of MARKETING_ZONE_KEYS) {
            const english = readZoneLabel(metahubsEn, key)
            const russian = readZoneLabel(metahubsRu, key)

            expect(english).not.toBe('')
            expect(russian).not.toBe('')
            expect(russian).not.toBe(english)
        }
    })
})
