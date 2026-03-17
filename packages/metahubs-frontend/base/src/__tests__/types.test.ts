import { describe, expect, it } from 'vitest'

import { toAttributeDisplay, type Attribute } from '../types'

describe('metahubs frontend attribute types', () => {
    it('preserves system metadata when converting to display form', () => {
        const attribute: Attribute = {
            id: 'attribute-1',
            catalogId: 'catalog-1',
            codename: '_app_deleted',
            codenameLocalized: null,
            dataType: 'BOOLEAN',
            name: {
                version: 1,
                locales: {
                    en: { content: 'Deleted' },
                    ru: { content: 'Удалён' }
                }
            },
            validationRules: {},
            uiConfig: {},
            isRequired: false,
            isDisplayAttribute: false,
            sortOrder: 1,
            createdAt: '2026-03-16T00:00:00.000Z',
            updatedAt: '2026-03-16T00:00:00.000Z',
            system: {
                isSystem: true,
                systemKey: 'app.deleted',
                isManaged: true,
                isEnabled: false
            }
        }

        const display = toAttributeDisplay(attribute, 'ru')

        expect(display.name).toBe('Удалён')
        expect(display.codename).toBe('_app_deleted')
        expect(display.system).toEqual(attribute.system)
    })
})
