import { describe, expect, it } from 'vitest'

import { toRecordItemDisplay } from '../displayConverters'
import type { Component, RecordItem } from '../types'

const record: RecordItem = {
    id: '0190a9b5-3cde-7abc-8def-0123456789ab',
    objectCollectionId: '0190a9b5-3cde-7abc-8def-0123456789ac',
    data: { HeroKey: 'default', Title: { en: 'Our latest', ru: 'Новинки' } },
    ownerId: null,
    sortOrder: 0,
    createdAt: '2026-09-28T00:00:00.000Z',
    updatedAt: '2026-09-28T00:00:00.000Z'
}

const component = (overrides: Partial<Component>): Component =>
    ({
        id: '0190a9b5-3cde-7abc-8def-0123456789ad',
        objectCollectionId: record.objectCollectionId,
        codename: overrides.codename ?? 'Title',
        dataType: overrides.dataType ?? 'STRING',
        name: { version: 1, locales: { en: { content: 'Title' } } },
        validationRules: {},
        uiConfig: {},
        isRequired: false,
        isDisplayComponent: false,
        sortOrder: 0,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        ...overrides
    } as Component)

describe('toRecordItemDisplay', () => {
    it('uses a visible label instead of a hidden semantic key', () => {
        const hiddenKey = component({ codename: 'HeroKey', isDisplayComponent: true, uiConfig: { hidden: true, gridHidden: true } })
        const title = component({ codename: 'Title' })

        expect(toRecordItemDisplay(record, [hiddenKey, title], 'en').name).toBe('Our latest')
    })

    it('uses a localized generic label instead of exposing a record identifier', () => {
        expect(toRecordItemDisplay({ ...record, data: {} }, [], 'en').name).toBe('Record')
        expect(toRecordItemDisplay({ ...record, data: {} }, [], 'ru').name).toBe('Запись')
    })
})
