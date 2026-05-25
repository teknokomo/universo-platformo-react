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
