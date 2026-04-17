import { executeBlockedDelete, executeHubScopedDelete, executeEntityReorder } from '../../domains/entities/services/entityDeletePatterns'

describe('entityDeletePatterns', () => {
    it('returns 404 for blocked delete when the entity is missing', async () => {
        const result = await executeBlockedDelete({
            entity: null,
            entityLabel: 'Set',
            notFoundMessage: 'set not found',
            deleteEntity: jest.fn(async () => undefined)
        })

        expect(result).toEqual({
            status: 404,
            body: { error: 'set not found' }
        })
    })

    it('detaches only the selected hub when multiple hubs exist and forceDelete is false', async () => {
        const detachFromHub = jest.fn(async () => undefined)

        const result = await executeHubScopedDelete({
            entity: {
                id: 'entity-1',
                config: { hubs: ['hub-1', 'hub-2'] }
            },
            entityLabel: 'Enumeration',
            treeEntityId: 'hub-1',
            forceDelete: false,
            getTreeEntityIds: (entity) => entity.config.hubs,
            detachFromHub,
            detachedMessage: 'Enumeration removed from hub',
            deleteEntity: jest.fn(async () => undefined)
        })

        expect(detachFromHub).toHaveBeenCalledWith(['hub-2'])
        expect(result).toEqual({
            status: 200,
            body: {
                message: 'Enumeration removed from hub',
                remainingHubs: 1
            }
        })
    })

    it('returns the required-hub conflict before full delete', async () => {
        const result = await executeHubScopedDelete({
            entity: {
                id: 'entity-1',
                config: { hubs: ['hub-1'], isRequiredHub: true }
            },
            entityLabel: 'Catalog',
            treeEntityId: 'hub-1',
            forceDelete: false,
            getTreeEntityIds: (entity) => entity.config.hubs,
            isRequiredHub: (entity) => entity.config.isRequiredHub,
            lastHubConflictMessage:
                'Cannot remove catalog from its last hub because it requires at least one hub association. Use force=true to delete the catalog entirely.',
            detachFromHub: jest.fn(async () => undefined),
            detachedMessage: 'Catalog removed from hub',
            deleteEntity: jest.fn(async () => undefined)
        })

        expect(result).toEqual({
            status: 409,
            body: {
                error: 'Cannot remove catalog from its last hub because it requires at least one hub association. Use force=true to delete the catalog entirely.'
            }
        })
    })

    it('short-circuits full delete when blocking references are found', async () => {
        const deleteEntity = jest.fn(async () => undefined)

        const result = await executeBlockedDelete({
            entity: { id: 'entity-1' },
            entityLabel: 'Set',
            findBlockingReferences: jest.fn(async () => [{ id: 'ref-1' }]),
            blockedOutcome: (blockers) => ({
                status: 409,
                body: {
                    error: 'Cannot delete value group because there are blocking references',
                    blockingReferences: blockers
                }
            }),
            deleteEntity
        })

        expect(result).toEqual({
            status: 409,
            body: {
                error: 'Cannot delete value group because there are blocking references',
                blockingReferences: [{ id: 'ref-1' }]
            }
        })
        expect(deleteEntity).not.toHaveBeenCalled()
    })

    it('maps reorder not-found errors to a 404 outcome', async () => {
        const result = await executeEntityReorder({
            entityLabel: 'Enumeration',
            notFoundErrorMessage: 'enumeration not found',
            notFoundResponseMessage: 'Enumeration not found',
            reorderEntity: jest.fn(async () => {
                throw new Error('enumeration not found')
            }),
            getId: (updated) => updated.id,
            getSortOrder: (updated) => updated.sortOrder
        })

        expect(result).toEqual({
            status: 404,
            body: {
                error: 'Enumeration not found'
            }
        })
    })
})
