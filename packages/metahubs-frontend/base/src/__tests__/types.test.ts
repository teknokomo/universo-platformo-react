import { describe, expect, it } from 'vitest'

import { toComponentDisplay, type Component } from '../types'

describe('metahubs frontend component types', () => {
    it('preserves system metadata when converting to display form', () => {
        const component: Component = {
            id: 'component-1',
            scopeEntityId: 'object-1',
            codename: {
                _primary: 'en',
                locales: {
                    en: { content: '_app_deleted' }
                }
            },
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
            isDisplayComponent: false,
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

        const display = toComponentDisplay(component, 'ru')

        expect(display.name).toBe('Удалён')
        expect(display.codename).toBe('_app_deleted')
        expect(display.system).toEqual(component.system)
    })
})
