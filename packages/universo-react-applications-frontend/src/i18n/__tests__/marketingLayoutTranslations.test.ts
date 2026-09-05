import { describe, expect, it } from 'vitest'

import applicationsEn from '../locales/en/applications.json'
import applicationsRu from '../locales/ru/applications.json'

const MARKETING_ZONE_KEYS = ['marketingHeader', 'marketingMain', 'marketingFooter'] as const

const readZoneLabel = (locale: unknown, key: string): string => {
    if (!locale || typeof locale !== 'object' || Array.isArray(locale)) return ''
    const root = locale as { layouts?: unknown; applications?: unknown }
    const applications = root.applications
    const layouts =
        root.layouts ??
        (applications && typeof applications === 'object' && !Array.isArray(applications)
            ? (applications as { layouts?: unknown }).layouts
            : undefined)
    if (!layouts || typeof layouts !== 'object' || Array.isArray(layouts)) return ''
    const zones = (layouts as { zones?: unknown }).zones
    if (!zones || typeof zones !== 'object' || Array.isArray(zones)) return ''
    const value = (zones as Record<string, unknown>)[key]
    return typeof value === 'string' ? value.trim() : ''
}

describe('application marketing layout translations', () => {
    it('keeps all marketing zone labels present and localized in English and Russian', () => {
        for (const key of MARKETING_ZONE_KEYS) {
            const english = readZoneLabel(applicationsEn, key)
            const russian = readZoneLabel(applicationsRu, key)

            expect(english).not.toBe('')
            expect(russian).not.toBe('')
            expect(russian).not.toBe(english)
        }
    })
})
