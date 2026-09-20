import commonEn from '@universo-react/i18n/locales/en/common.json'
import commonRu from '@universo-react/i18n/locales/ru/common.json'
import { describe, expect, it } from 'vitest'

import { applicationsTranslations } from '../index'

const getPath = (source: Record<string, unknown>, path: string): unknown =>
    path
        .split('.')
        .reduce<unknown>(
            (current, segment) =>
                current && typeof current === 'object' && !Array.isArray(current)
                    ? (current as Record<string, unknown>)[segment]
                    : undefined,
            source
        )

describe('application alias and marketing image translations', () => {
    it('provides the application-owned alias strings in both supported locales', () => {
        for (const locale of ['en', 'ru'] as const) {
            const translations = applicationsTranslations[locale].applications

            expect(getPath(translations, 'aliases.page.title')).toEqual(expect.any(String))
            expect(getPath(translations, 'aliases.actions.copyStableAddress')).toEqual(expect.any(String))
            expect(getPath(translations, 'aliases.routing.canonical')).toEqual(expect.any(String))
            expect(getPath(translations, 'aliases.actions.releaseAddress')).toEqual(expect.any(String))
            expect(getPath(translations, 'aliases.errors.conflict')).toEqual(expect.any(String))
            expect(getPath(translations, 'aliases.filters.showReleased')).toEqual(expect.any(String))
            expect(getPath(translations, 'aliases.technicalAddress')).toEqual(expect.any(String))
            expect(getPath(translations, 'aliases.technicalAddressHelp')).toEqual(expect.any(String))
        }
    })

    it('provides MarketingWidgetConfigDialog image copy at the owning namespace boundary', () => {
        expect(getPath(commonEn.common, 'layouts.widgets.marketing.image')).toBe('Image')
        expect(getPath(commonRu.common, 'layouts.widgets.marketing.image')).toBe('Изображение')

        for (const locale of ['en', 'ru'] as const) {
            const translations = applicationsTranslations[locale].applications

            expect(getPath(translations, 'layouts.marketing.widget.imageGuidance')).toEqual(expect.any(String))
            expect(getPath(translations, 'layouts.marketing.widget.imageUrl')).toEqual(expect.any(String))
            expect(getPath(translations, 'layouts.marketing.widget.imageUrlHelper')).toEqual(expect.any(String))
            expect(getPath(translations, 'layouts.marketing.widget.imageDecorative')).toEqual(expect.any(String))
            expect(getPath(translations, 'layouts.marketing.widget.imageAlt')).toEqual(expect.any(String))
            expect(getPath(translations, 'layouts.marketing.widget.imagePreviewWarning')).toEqual(expect.any(String))

            expect(getPath(translations, 'settings.publicEntryWorkspaceTitle')).toEqual(expect.any(String))
            expect(getPath(translations, 'settings.publicEntryWorkspaceDescription')).toEqual(expect.any(String))
            expect(getPath(translations, 'settings.publicEntryWorkspaceLoadError')).toEqual(expect.any(String))
            expect(getPath(translations, 'settings.publicEntryWorkspaceSaveError')).toEqual(expect.any(String))
            expect(getPath(translations, 'settings.unnamedWorkspace')).toEqual(expect.any(String))
        }
    })
})
