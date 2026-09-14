import { createInstance } from 'i18next'
import { describe, expect, it } from 'vitest'

import commonEn from '@universo-react/i18n/locales/en/common.json'
import commonRu from '@universo-react/i18n/locales/ru/common.json'
import { LAYOUT_WIDGET_DEFINITIONS, LAYOUT_ZONE_DEFINITIONS } from '@universo-react/types'

const sharedLayoutTranslationPaths = [
    'startGroup',
    'endGroup',
    'zoneSettings.settings',
    'zoneSettings.headerBehavior',
    'zoneSettings.fixed',
    'zoneSettings.flow',
    'zoneSettings.inherited',
    'zoneSettings.customized',
    'zoneSettings.cancel',
    'zoneSettings.save',
    'zoneSettings.reset',
    'zoneSettings.saving'
] as const

const readPath = (value: Record<string, unknown>, path: string): unknown =>
    path.split('.').reduce<unknown>((current, segment) => {
        if (!current || typeof current !== 'object') return undefined
        return (current as Record<string, unknown>)[segment]
    }, value)

describe('shared layout authoring translations', () => {
    it('keeps every canonical layout authoring key present in EN and RU', () => {
        const enLayouts = commonEn.common.layouts as Record<string, unknown>
        const ruLayouts = commonRu.common.layouts as Record<string, unknown>

        for (const path of sharedLayoutTranslationPaths) {
            expect(readPath(enLayouts, path), `missing EN key common.layouts.${path}`).toEqual(expect.any(String))
            expect(readPath(ruLayouts, path), `missing RU key common.layouts.${path}`).toEqual(expect.any(String))
        }
    })

    it('resolves the Russian setting labels through the real common namespace', async () => {
        const i18n = createInstance()
        await i18n.init({
            resources: {
                en: { common: commonEn.common },
                ru: { common: commonRu.common }
            },
            lng: 'ru',
            fallbackLng: 'en',
            defaultNS: 'common'
        })

        expect(i18n.t('layouts.zoneSettings.settings')).toBe('Настройки')
        expect(i18n.t('layouts.zoneSettings.fixed')).toBe('Закреплена на экране')
        expect(i18n.t('layouts.zoneSettings.flow')).toBe('Прокручивается вместе со страницей')
    })

    it('keeps every canonical zone and widget registry label in the shared namespace', () => {
        const enLayouts = commonEn.common.layouts as Record<string, unknown>
        const ruLayouts = commonRu.common.layouts as Record<string, unknown>

        for (const definition of [...LAYOUT_ZONE_DEFINITIONS, ...LAYOUT_WIDGET_DEFINITIONS]) {
            const path = definition.labelKey.replace(/^layouts\./, '')
            const english = readPath(enLayouts, path)
            const russian = readPath(ruLayouts, path)

            expect(english, `missing EN key common.layouts.${path}`).toEqual(expect.any(String))
            expect(russian, `missing RU key common.layouts.${path}`).toEqual(expect.any(String))
        }
    })
})
