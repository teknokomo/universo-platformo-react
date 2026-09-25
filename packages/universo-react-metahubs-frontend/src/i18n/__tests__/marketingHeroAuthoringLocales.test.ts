import { describe, expect, it } from 'vitest'
import english from '@universo-react/i18n/locales/en/common.json'
import russian from '@universo-react/i18n/locales/ru/common.json'

describe('shared Hero authoring translations', () => {
    it('provides matching English and Russian copy through the real common locale resources', () => {
        const en = english.common.layouts.marketing.heroAuthoring
        const ru = russian.common.layouts.marketing.heroAuthoring

        expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort())
        expect(ru.pageDescription).not.toBe(en.pageDescription)
        expect(ru.configureAndAdd).not.toBe(en.configureAndAdd)
        expect(ru.actionKinds.external).not.toBe(en.actionKinds.external)
        expect(ru.actionSummary.unavailable).not.toBe(en.actionSummary.unavailable)
    })
})
