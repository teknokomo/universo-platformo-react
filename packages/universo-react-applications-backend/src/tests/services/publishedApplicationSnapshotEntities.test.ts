import { resolveExecutablePayloadEntities } from '../../services/publishedApplicationSnapshotEntities'
import type { PublishedApplicationSnapshot } from '../../services/applicationSyncContracts'
import { isUuidV7 } from '@universo-react/utils'

describe('resolveExecutablePayloadEntities', () => {
    it('merges type-level capabilities into executable entity configuration', () => {
        const snapshot = {
            entities: {
                'object-site-settings': {
                    id: 'object-site-settings',
                    kind: 'object',
                    codename: 'siteSettings',
                    config: {
                        recordBehavior: 'reference'
                    },
                    fields: []
                }
            },
            entityTypeDefinitions: {
                object: {
                    config: {
                        typeManaged: true
                    },
                    capabilities: {
                        layoutConfig: { enabled: true },
                        dataSchema: { enabled: true }
                    }
                }
            }
        } as unknown as PublishedApplicationSnapshot

        const [entity] = resolveExecutablePayloadEntities(snapshot)

        expect(entity).toBeDefined()
        expect(entity?.config).toEqual({
            typeManaged: true,
            recordBehavior: 'reference',
            capabilities: {
                layoutConfig: { enabled: true },
                dataSchema: { enabled: true }
            }
        })
    })

    it('keeps an entity override while preserving type-level capability ownership', () => {
        const snapshot = {
            entities: {
                'object-site-settings': {
                    id: 'object-site-settings',
                    kind: 'object',
                    codename: 'siteSettings',
                    config: {
                        capabilities: {
                            layoutConfig: false
                        }
                    },
                    fields: []
                }
            },
            entityTypeDefinitions: {
                object: {
                    capabilities: {
                        layoutConfig: { enabled: true }
                    }
                }
            }
        } as unknown as PublishedApplicationSnapshot

        const [entity] = resolveExecutablePayloadEntities(snapshot)

        expect(entity?.config?.capabilities).toEqual({
            layoutConfig: { enabled: true }
        })
    })

    it('allocates fresh UUID v7 field identities and keeps same-source resync stable', () => {
        const snapshot = {
            entities: {
                'object-first': {
                    id: 'object-first',
                    kind: 'object',
                    codename: 'first',
                    fields: [{ id: 'shared-field', codename: 'title', dataType: 'STRING' }]
                },
                'object-second': {
                    id: 'object-second',
                    kind: 'object',
                    codename: 'second',
                    fields: [{ id: 'shared-field', codename: 'title', dataType: 'STRING' }]
                }
            }
        } as unknown as PublishedApplicationSnapshot

        const firstRun = resolveExecutablePayloadEntities(snapshot)
        const secondRun = resolveExecutablePayloadEntities(snapshot)
        const firstFieldId = firstRun.find((entity) => entity.id === 'object-first')?.fields?.[0]?.id
        const secondFieldId = firstRun.find((entity) => entity.id === 'object-second')?.fields?.[0]?.id
        const firstFieldIdOnResync = secondRun.find((entity) => entity.id === 'object-first')?.fields?.[0]?.id
        const secondFieldIdOnResync = secondRun.find((entity) => entity.id === 'object-second')?.fields?.[0]?.id

        expect(firstFieldId).toEqual(expect.any(String))
        expect(secondFieldId).toEqual(expect.any(String))
        expect(firstFieldId).not.toBe(secondFieldId)
        expect(isUuidV7(firstFieldId)).toBe(true)
        expect(isUuidV7(secondFieldId)).toBe(true)
        expect(firstFieldIdOnResync).toBe(firstFieldId)
        expect(secondFieldIdOnResync).toBe(secondFieldId)
    })
})
