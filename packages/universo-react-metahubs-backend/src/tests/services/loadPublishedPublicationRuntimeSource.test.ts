const mockFindPublicationById = jest.fn()
const mockFindPublicationVersionById = jest.fn()
const mockDeserializeSnapshot = jest.fn()
const mockCalculateHash = jest.fn()
const mockMaterializeSharedEntitiesForRuntime = jest.fn()
const mockEnrichDefinitionsWithSetConstants = jest.fn()
const mockSchemaServiceCtor = jest.fn()
const mockObjectsServiceCtor = jest.fn()
const mockComponentsServiceCtor = jest.fn()

jest.mock('../../persistence', () => ({
    findPublicationById: (...args: unknown[]) => mockFindPublicationById(...args),
    findPublicationVersionById: (...args: unknown[]) => mockFindPublicationVersionById(...args)
}))

jest.mock('../../domains/metahubs/services/MetahubSchemaService', () => ({
    MetahubSchemaService: jest.fn().mockImplementation((...args: unknown[]) => {
        mockSchemaServiceCtor(...args)
        return {}
    })
}))

jest.mock('../../domains/metahubs/services/MetahubObjectsService', () => ({
    MetahubObjectsService: jest.fn().mockImplementation((...args: unknown[]) => {
        mockObjectsServiceCtor(...args)
        return {}
    })
}))

jest.mock('../../domains/metahubs/services/MetahubComponentsService', () => ({
    MetahubComponentsService: jest.fn().mockImplementation((...args: unknown[]) => {
        mockComponentsServiceCtor(...args)
        return {}
    })
}))

jest.mock('../../domains/shared/valueGroupFixedValueRefs', () => ({
    enrichDefinitionsWithValueGroupFixedValues: (...args: unknown[]) => mockEnrichDefinitionsWithSetConstants(...args)
}))

jest.mock('../../domains/publications/services/SnapshotSerializer', () => {
    class MockSnapshotSerializer {
        deserializeSnapshot(...args: unknown[]) {
            return mockDeserializeSnapshot(...args)
        }

        calculateHash(...args: unknown[]) {
            return mockCalculateHash(...args)
        }

        static materializeSharedEntitiesForRuntime(...args: unknown[]) {
            return mockMaterializeSharedEntitiesForRuntime(...args)
        }
    }

    return {
        SnapshotSerializer: MockSnapshotSerializer
    }
})

import { loadPublishedPublicationRuntimeSource } from '../../domains/publications/services/loadPublishedPublicationRuntimeSource'

describe('loadPublishedPublicationRuntimeSource', () => {
    const executor = {
        query: jest.fn()
    }
    const layoutId = '0190a9b5-3cde-7abc-8def-0123456789b2'
    const rootWidgetId = '0190a9b5-3cde-7abc-8def-0123456789b1'
    const childWidgetId = '0190a9b5-3cde-7abc-8def-0123456789b3'

    const createDashboardSnapshot = (layoutZoneWidgets: Record<string, unknown>[]) => ({
        version: 2,
        entities: {},
        layouts: [
            {
                id: layoutId,
                templateKey: 'dashboard',
                scopeEntityId: null,
                compositionMode: 'independent',
                baseLayoutId: null,
                config: {}
            }
        ],
        layoutZoneWidgets
    })

    const setActiveSnapshot = (snapshotJson: unknown) => {
        mockFindPublicationById.mockResolvedValue({ id: 'publication-1', activeVersionId: 'version-1' })
        mockFindPublicationVersionById.mockResolvedValue({ id: 'version-1', snapshotJson, snapshotHash: 'stored-hash' })
    }

    beforeEach(() => {
        jest.clearAllMocks()
        mockEnrichDefinitionsWithSetConstants.mockImplementation((definitions: unknown) => definitions)
        mockMaterializeSharedEntitiesForRuntime.mockImplementation((snapshot: unknown) => snapshot)
        mockCalculateHash.mockReturnValue('calculated-snapshot-hash')
    })

    it('returns null when the publication has no active version', async () => {
        mockFindPublicationById.mockResolvedValue({
            id: 'publication-1',
            activeVersionId: null
        })

        await expect(loadPublishedPublicationRuntimeSource(executor as never, 'publication-1')).resolves.toBeNull()
        expect(mockFindPublicationVersionById).not.toHaveBeenCalled()
    })

    it('returns null when the active version snapshot payload is invalid', async () => {
        mockFindPublicationById.mockResolvedValue({
            id: 'publication-1',
            activeVersionId: 'version-1'
        })
        mockFindPublicationVersionById.mockResolvedValue({
            id: 'version-1',
            snapshotJson: { version: 2 },
            snapshotHash: 'stored-hash'
        })

        await expect(loadPublishedPublicationRuntimeSource(executor as never, 'publication-1')).resolves.toBeNull()
        expect(mockMaterializeSharedEntitiesForRuntime).not.toHaveBeenCalled()
        expect(mockDeserializeSnapshot).not.toHaveBeenCalled()
    })

    it('rejects malformed layout identities before runtime materialization', async () => {
        mockFindPublicationById.mockResolvedValue({
            id: 'publication-1',
            activeVersionId: 'version-1'
        })
        mockFindPublicationVersionById.mockResolvedValue({
            id: 'version-1',
            snapshotJson: {
                version: 2,
                entities: {},
                layouts: [{ id: 'not-a-uuid-v7' }]
            },
            snapshotHash: 'stored-hash'
        })

        await expect(loadPublishedPublicationRuntimeSource(executor as never, 'publication-1')).rejects.toThrow('UUID v7')
        expect(mockMaterializeSharedEntitiesForRuntime).not.toHaveBeenCalled()
        expect(mockDeserializeSnapshot).not.toHaveBeenCalled()
    })

    it.each(['missing parent', 'unknown slot', 'cycle', 'missing instance key'] as const)(
        'rejects a published Dashboard placement graph with a %s before runtime materialization',
        async (invalidCase) => {
            const root = {
                id: rootWidgetId,
                layoutId,
                instanceKey: 'columns-root',
                parentWidgetId: null,
                slotKey: null,
                zone: 'center',
                widgetKey: 'columnsContainer',
                sortOrder: 0,
                config: { columns: [{ slotKey: 'column:primary', width: 12 }] },
                isActive: true
            }
            const child: Record<string, unknown> = {
                id: childWidgetId,
                layoutId,
                instanceKey: 'canvas-child',
                parentWidgetId: rootWidgetId,
                slotKey: 'column:primary',
                zone: 'center',
                widgetKey: 'playcanvasCanvas',
                sortOrder: 1,
                config: {},
                isActive: true
            }
            let widgets: Record<string, unknown>[] = [root, child]

            if (invalidCase === 'missing parent') {
                widgets = [{ ...child, parentWidgetId: '0190a9b5-3cde-7abc-8def-0123456789b4' }]
            } else if (invalidCase === 'unknown slot') {
                widgets = [root, { ...child, slotKey: 'column:missing' }]
            } else if (invalidCase === 'cycle') {
                widgets = [{ ...root, parentWidgetId: childWidgetId, slotKey: 'column:primary' }, child]
            } else {
                const withoutInstanceKey = { ...child }
                delete withoutInstanceKey.instanceKey
                widgets = [root, withoutInstanceKey]
            }

            setActiveSnapshot(createDashboardSnapshot(widgets))

            await expect(loadPublishedPublicationRuntimeSource(executor as never, 'publication-1')).rejects.toThrow(
                'invalid layout widget placement graph'
            )
            expect(mockMaterializeSharedEntitiesForRuntime).not.toHaveBeenCalled()
            expect(mockDeserializeSnapshot).not.toHaveBeenCalled()
        }
    )

    it('accepts a valid overlay child whose portable parent reference belongs to its base layout', async () => {
        const baseLayoutId = layoutId
        const scopedLayoutId = '0190a9b5-3cde-7abc-8def-0123456789b4'
        const scopeEntityId = '0190a9b5-3cde-7abc-8def-0123456789b5'
        const parentId = rootWidgetId
        const overlaySnapshot = {
            version: 2,
            entities: { [scopeEntityId]: {} },
            layouts: [
                {
                    id: baseLayoutId,
                    templateKey: 'dashboard',
                    scopeEntityId: null,
                    compositionMode: 'independent',
                    baseLayoutId: null,
                    config: {}
                }
            ],
            scopedLayouts: [
                {
                    id: scopedLayoutId,
                    scopeEntityId,
                    templateKey: 'dashboard',
                    compositionMode: 'overlay',
                    baseLayoutId,
                    config: {}
                }
            ],
            layoutZoneWidgets: [
                {
                    id: parentId,
                    layoutId: baseLayoutId,
                    instanceKey: 'base-columns',
                    parentWidgetId: null,
                    slotKey: null,
                    zone: 'center',
                    widgetKey: 'columnsContainer',
                    sortOrder: 0,
                    config: { columns: [{ slotKey: 'column:primary', width: 12 }] },
                    isActive: true
                },
                {
                    id: childWidgetId,
                    layoutId: scopedLayoutId,
                    instanceKey: 'overlay-canvas',
                    parentWidgetId: parentId,
                    slotKey: 'column:primary',
                    zone: 'center',
                    widgetKey: 'playcanvasCanvas',
                    sortOrder: 0,
                    config: {},
                    isActive: true
                }
            ]
        }
        setActiveSnapshot(overlaySnapshot)

        await expect(loadPublishedPublicationRuntimeSource(executor as never, 'publication-1')).resolves.toMatchObject({
            publicationId: 'publication-1',
            publicationVersionId: 'version-1'
        })
        expect(mockMaterializeSharedEntitiesForRuntime).toHaveBeenCalledWith(overlaySnapshot)
        expect(mockDeserializeSnapshot).toHaveBeenCalled()
    })

    it('materializes shared entities before runtime deserialization and enrichment', async () => {
        const publicationSnapshot = {
            version: 2,
            entities: {
                'object-1': {
                    id: 'object-1',
                    kind: 'object'
                }
            },
            sharedComponents: [
                {
                    id: 'shared-component-1',
                    objectCollectionId: 'object-1'
                }
            ],
            sharedFixedValues: [
                {
                    id: 'shared-constant-1',
                    valueGroupId: 'set-1'
                }
            ],
            sharedOptionValues: [
                {
                    id: 'shared-value-1',
                    optionListId: 'enumeration-1'
                }
            ],
            sharedEntityOverrides: [
                {
                    id: 'override-1',
                    targetObjectId: 'object-1',
                    sharedEntityId: 'shared-component-1',
                    isExcluded: false
                }
            ]
        }
        const runtimeSnapshot = {
            ...publicationSnapshot,
            entities: {
                ...publicationSnapshot.entities,
                'object-1': {
                    ...publicationSnapshot.entities['object-1'],
                    fields: [{ id: 'shared-component-1' }]
                }
            }
        }
        const rawDefinitions = [{ objectCollectionId: 'object-1', fields: [{ id: 'shared-component-1' }] }]
        const enrichedDefinitions = [{ objectCollectionId: 'object-1', constantsResolved: true }]

        mockFindPublicationById.mockResolvedValue({
            id: 'publication-1',
            activeVersionId: 'version-1'
        })
        mockFindPublicationVersionById.mockResolvedValue({
            id: 'version-1',
            snapshotJson: publicationSnapshot,
            snapshotHash: null
        })
        mockMaterializeSharedEntitiesForRuntime.mockReturnValue(runtimeSnapshot)
        mockDeserializeSnapshot.mockReturnValue(rawDefinitions)
        mockEnrichDefinitionsWithSetConstants.mockReturnValue(enrichedDefinitions)

        const result = await loadPublishedPublicationRuntimeSource(executor as never, 'publication-1')

        expect(mockSchemaServiceCtor).toHaveBeenCalledWith(executor)
        expect(mockObjectsServiceCtor).toHaveBeenCalledWith(executor, expect.any(Object))
        expect(mockComponentsServiceCtor).toHaveBeenCalledWith(executor, expect.any(Object))
        expect(mockMaterializeSharedEntitiesForRuntime).toHaveBeenCalledWith(publicationSnapshot)
        expect(mockDeserializeSnapshot).toHaveBeenCalledWith(runtimeSnapshot)
        expect(mockEnrichDefinitionsWithSetConstants).toHaveBeenCalledWith(rawDefinitions, runtimeSnapshot)
        expect(mockCalculateHash).toHaveBeenCalledWith(runtimeSnapshot)
        expect(result).toEqual({
            publicationId: 'publication-1',
            publicationVersionId: 'version-1',
            snapshotHash: 'calculated-snapshot-hash',
            snapshot: runtimeSnapshot,
            entities: enrichedDefinitions,
            publicationSnapshot
        })
    })

    it('does not reuse the stored publication hash when runtime materialization changes the snapshot shape', async () => {
        const publicationSnapshot = {
            version: 2,
            entities: {
                'object-1': {
                    id: 'object-1',
                    kind: 'object'
                }
            },
            sharedComponents: [{ id: 'shared-component-1', objectCollectionId: 'object-1' }]
        }
        const runtimeSnapshot = {
            ...publicationSnapshot,
            entities: {
                ...publicationSnapshot.entities,
                'object-1': {
                    ...publicationSnapshot.entities['object-1'],
                    fields: [{ id: 'shared-component-1' }]
                }
            }
        }

        mockFindPublicationById.mockResolvedValue({
            id: 'publication-1',
            activeVersionId: 'version-1'
        })
        mockFindPublicationVersionById.mockResolvedValue({
            id: 'version-1',
            snapshotJson: publicationSnapshot,
            snapshotHash: 'stored-publication-hash'
        })
        mockMaterializeSharedEntitiesForRuntime.mockReturnValue(runtimeSnapshot)
        mockDeserializeSnapshot.mockReturnValue([])
        mockEnrichDefinitionsWithSetConstants.mockReturnValue([])

        await loadPublishedPublicationRuntimeSource(executor as never, 'publication-1')

        expect(mockCalculateHash).toHaveBeenCalledWith(runtimeSnapshot)
        expect(mockCalculateHash).not.toHaveBeenCalledWith(publicationSnapshot)
    })
})
