import { describe, expect, it } from 'vitest'

import { applicationsTranslations } from '@universo-react/applications-frontend/i18n'
import { metahubsTranslations } from '@universo-react/metahubs-frontend/i18n'

/**
 * The shared MarketingWidgetConfigDialog renders the same image settings on
 * both the metahub and the application layout surfaces, while each surface
 * owns its own translation namespace. This guard keeps the duplicated keys
 * from drifting apart in either locale.
 */
const SHARED_IMAGE_KEYS = [
    'layouts.marketing.widget.imageGuidance',
    'layouts.marketing.widget.imageUrl',
    'layouts.marketing.widget.imageUrlHelper',
    'layouts.marketing.widget.imageUrlInvalid',
    'layouts.marketing.widget.imageDecorative',
    'layouts.marketing.widget.imageAlt',
    'layouts.marketing.widget.imagePreviewWarning'
] as const

const readPath = (value: unknown, path: string): unknown =>
    path.split('.').reduce<unknown>((current, segment) => {
        if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined
        return (current as Record<string, unknown>)[segment]
    }, value)

describe('shared marketing image translation parity', () => {
    it('keeps the shared image settings keys identical between the applications and metahubs namespaces', () => {
        for (const locale of ['en', 'ru'] as const) {
            const applicationNamespace = applicationsTranslations[locale].applications
            const metahubNamespace = metahubsTranslations[locale].metahubs

            for (const key of SHARED_IMAGE_KEYS) {
                const applicationValue = readPath(applicationNamespace, key)
                const metahubValue = readPath(metahubNamespace, key)

                expect(typeof applicationValue, `${locale} ${key} (applications)`).toBe('string')
                expect(typeof metahubValue, `${locale} ${key} (metahubs)`).toBe('string')
                expect(metahubValue, `${locale} ${key} must not drift from the applications namespace`).toBe(applicationValue)
            }
        }
    })
})
