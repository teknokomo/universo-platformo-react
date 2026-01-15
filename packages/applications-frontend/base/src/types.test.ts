import { describe, expect, it } from 'vitest'

import { toApplicationDisplay, toConnectorDisplay, type Application, type Connector } from './types'

describe('types helpers', () => {
    it('toApplicationDisplay localizes fields and preserves metadata', () => {
        const app: Application = {
            id: 'a1',
            name: {
                _schema: '1',
                _primary: 'en',
                locales: {
                    en: { content: 'App EN' },
                    ru: { content: 'App RU' }
                }
            } as any,
            description: {
                _schema: '1',
                _primary: 'en',
                locales: {
                    en: { content: 'Desc EN' }
                }
            } as any,
            slug: 'app',
            isPublic: true,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z',
            connectorsCount: 3,
            membersCount: 2
        }

        const displayRu = toApplicationDisplay(app, 'ru')
        expect(displayRu.id).toBe('a1')
        expect(displayRu.name).toBe('App RU')
        // description falls back to primary locale when requested locale is missing
        expect(displayRu.description).toBe('Desc EN')
        expect(displayRu.slug).toBe('app')
        expect(displayRu.isPublic).toBe(true)
        expect(displayRu.connectorsCount).toBe(3)
        expect(displayRu.membersCount).toBe(2)

        const displayEn = toApplicationDisplay(app, 'en')
        expect(displayEn.name).toBe('App EN')
    })

    it('toConnectorDisplay localizes connector name/description', () => {
        const connector: Connector = {
            id: 's1',
            applicationId: 'a1',
            codename: 'connector',
            name: {
                _schema: '1',
                _primary: 'en',
                locales: {
                    en: { content: 'Connector EN' },
                    ru: { content: 'Connector RU' }
                }
            } as any,
            description: {
                _schema: '1',
                _primary: 'en',
                locales: {
                    en: { content: 'Description' }
                }
            } as any,
            sortOrder: 10,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z'
        }

        const display = toConnectorDisplay(connector, 'ru')
        expect(display.id).toBe('s1')
        expect(display.applicationId).toBe('a1')
        expect(display.codename).toBe('connector')
        expect(display.name).toBe('Connector RU')
        expect(display.description).toBe('Description')
        expect(display.sortOrder).toBe(10)
    })
})
