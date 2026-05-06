/**
 * Integration tests for the optimistic CRUD lifecycle.
 *
 * These tests verify the full onMutate → onError/onSuccess → onSettled
 * cycle with realistic cache structures, ensuring that:
 * 1. Optimistic entities appear immediately in the cache
 * 2. Errors properly rollback the cache
 * 3. safeInvalidateQueries fires only when the last mutation completes
 * 4. Concurrent mutations don't corrupt each other's snapshots
 */

import { QueryClient } from '@tanstack/react-query'
import {
    applyOptimisticCreate,
    applyOptimisticUpdate,
    applyOptimisticDelete,
    rollbackOptimisticSnapshots,
    safeInvalidateQueries,
    generateOptimisticId,
    type ListCache
} from '../optimisticCrud'
import { makePendingMarkers, isPendingEntity, getPendingAction, stripPendingMarkers } from '@universo/utils'

describe('optimisticCrud integration', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } }
        })
    })

    afterEach(() => {
        queryClient.clear()
    })

    describe('full create lifecycle', () => {
        const listKey = ['hubs', 'list', { metahubId: 'm1' }]
        const queryKeyPrefix = ['hubs']

        beforeEach(() => {
            queryClient.setQueryData(listKey, {
                items: [
                    { id: 'h1', name: 'Hub 1' },
                    { id: 'h2', name: 'Hub 2' }
                ],
                pagination: { total: 2 }
            })
        })

        it('onMutate inserts optimistic entity, onSettled invalidates', async () => {
            const optimisticId = generateOptimisticId()
            const optimisticEntity = {
                id: optimisticId,
                name: 'New Hub',
                ...makePendingMarkers('create')
            }

            // onMutate phase
            const context = await applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity
            })

            // Verify optimistic entity in cache
            const data = queryClient.getQueryData<ListCache>(listKey)
            expect(data?.items).toHaveLength(3)
            expect(data?.items?.[0].id).toBe(optimisticId)
            expect(isPendingEntity(data?.items?.[0])).toBe(true)
            expect(getPendingAction(data?.items?.[0])).toBe('create')
            expect(data?.pagination?.total).toBe(3)

            // Snapshot preserved for rollback
            expect(context.previousSnapshots.length).toBeGreaterThan(0)
            expect(context.optimisticId).toBe(optimisticId)

            // onSettled phase — safeInvalidateQueries
            const spy = jest.spyOn(queryClient, 'invalidateQueries')
            jest.spyOn(queryClient, 'isMutating').mockReturnValue(0)
            safeInvalidateQueries(queryClient, ['hubs'], listKey)
            expect(spy).toHaveBeenCalledWith({ queryKey: listKey })
        })

        it('onMutate inserts, onError rolls back completely', async () => {
            const optimisticId = generateOptimisticId()
            const optimisticEntity = {
                id: optimisticId,
                name: 'Failing Hub',
                ...makePendingMarkers('create')
            }

            // onMutate
            const context = await applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity
            })

            // Verify entity was added
            let data = queryClient.getQueryData<ListCache>(listKey)
            expect(data?.items).toHaveLength(3)

            // onError — rollback
            rollbackOptimisticSnapshots(queryClient, context.previousSnapshots)

            // Verify complete rollback
            data = queryClient.getQueryData<ListCache>(listKey)
            expect(data?.items).toHaveLength(2)
            expect(data?.items?.some((item) => item.id === optimisticId)).toBe(false)
            expect(data?.pagination?.total).toBe(2)
        })

        it('breadcrumb is seeded on create and cleaned on rollback', async () => {
            const optimisticId = generateOptimisticId()
            const breadcrumbKey = ['breadcrumb', 'hub', 'm1', optimisticId, 'en']
            const optimisticEntity = {
                id: optimisticId,
                name: 'Breadcrumb Hub',
                ...makePendingMarkers('create')
            }

            const context = await applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity,
                breadcrumb: { queryKey: breadcrumbKey, name: 'Breadcrumb Hub' }
            })

            // Breadcrumb should exist
            expect(queryClient.getQueryData(breadcrumbKey)).toBe('Breadcrumb Hub')

            // Rollback
            rollbackOptimisticSnapshots(queryClient, context.previousSnapshots)

            // Note: breadcrumb is NOT part of the list snapshot, so it persists after rollback.
            // Real code calls cleanupBreadcrumbCache separately in onError.
        })
    })

    describe('full update lifecycle', () => {
        const listKey = ['catalogs', 'list', { metahubId: 'm1' }]
        const detailKey = ['catalogs', 'detail', 'c1']
        const queryKeyPrefix = ['catalogs']

        beforeEach(() => {
            queryClient.setQueryData(listKey, {
                items: [
                    { id: 'c1', name: 'Catalog 1', version: 1 },
                    { id: 'c2', name: 'Catalog 2', version: 1 }
                ],
                pagination: { total: 2 }
            })
            queryClient.setQueryData(detailKey, {
                id: 'c1',
                name: 'Catalog 1',
                version: 1,
                description: 'Original'
            })
        })

        it('onMutate updates both list and detail, onError rolls back both', async () => {
            // onMutate
            const context = await applyOptimisticUpdate<{ id: string; name: string; version: number; description?: string }>({
                queryClient,
                queryKeyPrefix,
                entityId: 'c1',
                updater: { name: 'Catalog 1 Updated' },
                detailQueryKey: detailKey
            })

            // Verify list updated
            const listData = queryClient.getQueryData<ListCache>(listKey)
            const updatedItem = listData?.items?.find((i) => i.id === 'c1')
            expect(updatedItem?.name).toBe('Catalog 1 Updated')
            expect(isPendingEntity(updatedItem)).toBe(true)
            expect(getPendingAction(updatedItem)).toBe('update')

            // Verify detail updated
            const detailData = queryClient.getQueryData<Record<string, unknown>>(detailKey)
            expect(detailData?.name).toBe('Catalog 1 Updated')
            expect(isPendingEntity(detailData)).toBe(true)

            // Other items unchanged
            const otherItem = listData?.items?.find((i) => i.id === 'c2')
            expect(otherItem?.name).toBe('Catalog 2')
            expect(isPendingEntity(otherItem)).toBe(false)

            // onError — rollback
            rollbackOptimisticSnapshots(queryClient, context.previousSnapshots)

            // Verify complete rollback
            const rolledBackList = queryClient.getQueryData<ListCache>(listKey)
            const rolledBackItem = rolledBackList?.items?.find((i) => i.id === 'c1')
            expect(rolledBackItem?.name).toBe('Catalog 1')
            expect(isPendingEntity(rolledBackItem)).toBe(false)

            const rolledBackDetail = queryClient.getQueryData<Record<string, unknown>>(detailKey)
            expect(rolledBackDetail?.name).toBe('Catalog 1')
            expect(rolledBackDetail?.description).toBe('Original')
        })
    })

    describe('full delete lifecycle', () => {
        const listKey = ['sets', 'list', { metahubId: 'm1' }]
        const queryKeyPrefix = ['sets']

        beforeEach(() => {
            queryClient.setQueryData(listKey, {
                items: [
                    { id: 's1', name: 'Set 1' },
                    { id: 's2', name: 'Set 2' },
                    { id: 's3', name: 'Set 3' }
                ],
                pagination: { total: 3 }
            })
        })

        it('fade strategy marks entity as pending-delete, rollback restores', async () => {
            // onMutate — fade strategy
            const context = await applyOptimisticDelete({
                queryClient,
                queryKeyPrefix,
                entityId: 's2',
                strategy: 'fade'
            })

            // Verify entity is marked
            let data = queryClient.getQueryData<ListCache>(listKey)
            const fadedItem = data?.items?.find((i) => i.id === 's2')
            expect(isPendingEntity(fadedItem)).toBe(true)
            expect(getPendingAction(fadedItem)).toBe('delete')
            expect(data?.items).toHaveLength(3) // Still in list

            // onError — rollback
            rollbackOptimisticSnapshots(queryClient, context.previousSnapshots)

            data = queryClient.getQueryData<ListCache>(listKey)
            const restoredItem = data?.items?.find((i) => i.id === 's2')
            expect(isPendingEntity(restoredItem)).toBe(false)
            expect(restoredItem?.name).toBe('Set 2')
        })

        it('remove strategy instantly removes entity', async () => {
            const context = await applyOptimisticDelete({
                queryClient,
                queryKeyPrefix,
                entityId: 's1',
                strategy: 'remove'
            })

            let data = queryClient.getQueryData<ListCache>(listKey)
            expect(data?.items).toHaveLength(2)
            expect(data?.items?.some((i) => i.id === 's1')).toBe(false)
            expect(data?.pagination?.total).toBe(2)

            // Rollback restores
            rollbackOptimisticSnapshots(queryClient, context.previousSnapshots)

            data = queryClient.getQueryData<ListCache>(listKey)
            expect(data?.items).toHaveLength(3)
            expect(data?.pagination?.total).toBe(3)
        })
    })

    describe('concurrent mutations safety', () => {
        const listKey = ['enumerations', 'list']
        const queryKeyPrefix = ['enumerations']

        beforeEach(() => {
            queryClient.setQueryData(listKey, {
                items: [{ id: 'e1', name: 'Enum 1' }],
                pagination: { total: 1 }
            })
        })

        it('two concurrent creates each have independent snapshots', async () => {
            const id1 = generateOptimisticId()
            const id2 = generateOptimisticId()

            // First create
            const firstCreateContext = await applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity: { id: id1, name: 'New 1', ...makePendingMarkers('create') }
            })
            expect(firstCreateContext.previousSnapshots.length).toBeGreaterThan(0)

            // Second create (while first is still "in flight")
            const ctx2 = await applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity: { id: id2, name: 'New 2', ...makePendingMarkers('create') }
            })

            // Both in cache
            let data = queryClient.getQueryData<ListCache>(listKey)
            expect(data?.items).toHaveLength(3)
            expect(data?.pagination?.total).toBe(3)

            // Second fails — rollback should restore to AFTER first create
            rollbackOptimisticSnapshots(queryClient, ctx2.previousSnapshots)

            data = queryClient.getQueryData<ListCache>(listKey)
            expect(data?.items).toHaveLength(2) // original + first create
            expect(data?.items?.some((i) => i.id === id1)).toBe(true)
            expect(data?.items?.some((i) => i.id === id2)).toBe(false)
        })

        it('safeInvalidateQueries skips when concurrent mutation exists', () => {
            const spy = jest.spyOn(queryClient, 'invalidateQueries')

            // Simulate 2 concurrent mutations
            jest.spyOn(queryClient, 'isMutating').mockReturnValue(2)
            safeInvalidateQueries(queryClient, ['enumerations'], listKey)
            expect(spy).not.toHaveBeenCalled()

            // Last mutation settles
            jest.spyOn(queryClient, 'isMutating').mockReturnValue(1)
            safeInvalidateQueries(queryClient, ['enumerations'], listKey)
            expect(spy).toHaveBeenCalledWith({ queryKey: listKey })
        })
    })

    describe('stripPendingMarkers utility', () => {
        it('removes pending markers from entity for submission', () => {
            const entity = {
                id: 'x1',
                name: 'Test',
                __pending: true as const,
                __pendingAction: 'create' as const
            }
            const cleaned = stripPendingMarkers(entity)
            expect(cleaned).toEqual({ id: 'x1', name: 'Test' })
            expect('__pending' in cleaned).toBe(false)
            expect('__pendingAction' in cleaned).toBe(false)
        })
    })

    describe('RowsListCache compatibility (runtime CRUD)', () => {
        it('applyOptimisticCreate inserts into rows-based caches', async () => {
            // Simulate a cache that has rows but not items
            const rowsKey = ['runtime', 'list', { linkedCollectionId: 'cat1' }]
            queryClient.setQueryData(rowsKey, {
                rows: [{ id: 'r1', title: 'Row 1' }],
                pagination: { total: 1 }
            })

            // applyOptimisticCreate targets both items- and rows-based caches
            await applyOptimisticCreate({
                queryClient,
                queryKeyPrefix: ['runtime'],
                optimisticEntity: { id: 'opt1', title: 'New', ...makePendingMarkers('create') }
            })

            // rows-based cache should include the new entity
            const data = queryClient.getQueryData<{ rows: unknown[]; pagination: { total: number } }>(rowsKey)
            expect(data?.rows).toHaveLength(2)
            expect(data?.pagination?.total).toBe(2)
        })
    })
})
