import { QueryClient } from '@tanstack/react-query'
import {
    applyOptimisticCreate,
    applyOptimisticUpdate,
    applyOptimisticDelete,
    confirmOptimisticCreate,
    rollbackOptimisticSnapshots,
    cleanupBreadcrumbCache,
    safeInvalidateQueries,
    generateOptimisticId,
    getCurrentLanguageKey,
    type ListCache
} from '../optimisticCrud'
import { makePendingMarkers } from '@universo/utils'

interface TestEntity {
    id: string
    name?: string
    description?: string
    extra?: string
    __pending?: boolean
    __pendingAction?: string
}

describe('optimisticCrud', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } }
        })
    })

    describe('generateOptimisticId', () => {
        it('returns a non-empty string', () => {
            const id = generateOptimisticId()
            expect(id).toBeTruthy()
            expect(typeof id).toBe('string')
        })

        it('generates unique IDs', () => {
            const ids = new Set(Array.from({ length: 100 }, () => generateOptimisticId()))
            expect(ids.size).toBe(100)
        })
    })

    describe('getCurrentLanguageKey', () => {
        it('returns a string language key', () => {
            const lang = getCurrentLanguageKey()
            expect(typeof lang).toBe('string')
            expect(lang.length).toBeGreaterThan(0)
        })
    })

    describe('applyOptimisticCreate', () => {
        it('inserts entity at start of list cache (prepend)', async () => {
            const listKey = ['test', 'list']
            queryClient.setQueryData(listKey, {
                items: [{ id: '1', name: 'existing' }],
                pagination: { total: 1 }
            })

            await applyOptimisticCreate({
                queryClient,
                queryKeyPrefix: ['test'],
                optimisticEntity: { id: 'opt-1', name: 'new', ...makePendingMarkers('create') },
                insertPosition: 'prepend'
            })

            const data = queryClient.getQueryData<ListCache>(listKey)
            expect(data?.items).toHaveLength(2)
            expect(data?.items?.[0]).toHaveProperty('id', 'opt-1')
            expect(data?.pagination?.total).toBe(2)
        })

        it('inserts entity at end (append)', async () => {
            const listKey = ['test', 'list']
            queryClient.setQueryData(listKey, {
                items: [{ id: '1', name: 'first' }],
                pagination: { total: 1 }
            })

            await applyOptimisticCreate({
                queryClient,
                queryKeyPrefix: ['test'],
                optimisticEntity: { id: 'opt-1', name: 'last', ...makePendingMarkers('create') },
                insertPosition: 'append'
            })

            const data = queryClient.getQueryData<ListCache>(listKey)
            expect(data?.items).toHaveLength(2)
            expect(data?.items?.[1]).toHaveProperty('id', 'opt-1')
        })

        it('returns snapshots for rollback', async () => {
            queryClient.setQueryData(['test', 'list'], { items: [{ id: '1' }] })

            const context = await applyOptimisticCreate({
                queryClient,
                queryKeyPrefix: ['test'],
                optimisticEntity: { id: 'opt-1', ...makePendingMarkers('create') }
            })

            expect(context.previousSnapshots.length).toBeGreaterThan(0)
            expect(context.optimisticId).toBe('opt-1')
        })

        it('seeds breadcrumb cache', async () => {
            queryClient.setQueryData(['test', 'list'], { items: [] })

            const breadcrumbKey = ['breadcrumb', 'test', 'opt-1', 'en']
            await applyOptimisticCreate({
                queryClient,
                queryKeyPrefix: ['test'],
                optimisticEntity: { id: 'opt-1', ...makePendingMarkers('create') },
                breadcrumb: { queryKey: breadcrumbKey, name: 'Test Entity' }
            })

            expect(queryClient.getQueryData(breadcrumbKey)).toBe('Test Entity')
        })

        it('handles empty items array', async () => {
            queryClient.setQueryData(['test', 'list'], { items: [] })

            await applyOptimisticCreate({
                queryClient,
                queryKeyPrefix: ['test'],
                optimisticEntity: { id: 'opt-1', ...makePendingMarkers('create') }
            })

            const data = queryClient.getQueryData<ListCache>(['test', 'list'])
            expect(data?.items).toHaveLength(1)
        })

        it('skips caches without items array', async () => {
            queryClient.setQueryData(['test', 'detail'], { id: '1', name: 'detail' })

            await applyOptimisticCreate({
                queryClient,
                queryKeyPrefix: ['test'],
                optimisticEntity: { id: 'opt-1', ...makePendingMarkers('create') }
            })

            // Detail cache should be unchanged
            const data = queryClient.getQueryData(['test', 'detail'])
            expect(data).toEqual({ id: '1', name: 'detail' })
        })
    })

    describe('applyOptimisticUpdate', () => {
        it('updates entity in list cache', async () => {
            queryClient.setQueryData(['test', 'list'], {
                items: [
                    { id: '1', name: 'old', description: 'desc' },
                    { id: '2', name: 'other' }
                ]
            })

            await applyOptimisticUpdate<{ id: string; name: string; description?: string }>({
                queryClient,
                queryKeyPrefix: ['test'],
                entityId: '1',
                updater: { name: 'updated' }
            })

            const data = queryClient.getQueryData<ListCache<TestEntity>>(['test', 'list'])
            const item = data?.items?.find((i) => i.id === '1')
            expect(item).toBeDefined()
            expect(item.name).toBe('updated')
            expect(item.description).toBe('desc')
            expect(item.__pending).toBe(true)
            expect(item.__pendingAction).toBe('update')
        })

        it('updates detail cache when provided', async () => {
            queryClient.setQueryData(['test', 'list'], { items: [{ id: '1', name: 'old' }] })
            queryClient.setQueryData(['test', 'detail', '1'], { id: '1', name: 'old', extra: 'data' })

            await applyOptimisticUpdate<{ id: string; name: string; extra?: string }>({
                queryClient,
                queryKeyPrefix: ['test'],
                entityId: '1',
                updater: { name: 'updated' },
                detailQueryKey: ['test', 'detail', '1']
            })

            const detail = queryClient.getQueryData<TestEntity>(['test', 'detail', '1'])
            expect(detail).toBeDefined()
            expect(detail.name).toBe('updated')
            expect(detail.extra).toBe('data')
            expect(detail.__pending).toBe(true)
        })

        it('updates breadcrumb cache', async () => {
            queryClient.setQueryData(['test', 'list'], { items: [{ id: '1', name: 'old' }] })

            const breadcrumbKey = ['breadcrumb', 'test', '1', 'en']
            await applyOptimisticUpdate<{ id: string; name: string }>({
                queryClient,
                queryKeyPrefix: ['test'],
                entityId: '1',
                updater: { name: 'updated' },
                breadcrumb: { queryKey: breadcrumbKey, name: 'Updated Name' }
            })

            expect(queryClient.getQueryData(breadcrumbKey)).toBe('Updated Name')
        })

        it('does not modify other entities in list', async () => {
            queryClient.setQueryData(['test', 'list'], {
                items: [
                    { id: '1', name: 'one' },
                    { id: '2', name: 'two' }
                ]
            })

            await applyOptimisticUpdate<{ id: string; name: string }>({
                queryClient,
                queryKeyPrefix: ['test'],
                entityId: '1',
                updater: { name: 'updated' }
            })

            const data = queryClient.getQueryData<ListCache<TestEntity>>(['test', 'list'])
            const other = data?.items?.find((i) => i.id === '2')
            expect(other).toBeDefined()
            expect(other.name).toBe('two')
            expect(other.__pending).toBeUndefined()
        })
    })

    describe('applyOptimisticDelete', () => {
        it('removes entity with "remove" strategy', async () => {
            queryClient.setQueryData(['test', 'list'], {
                items: [{ id: '1' }, { id: '2' }],
                pagination: { total: 2 }
            })

            await applyOptimisticDelete({
                queryClient,
                queryKeyPrefix: ['test'],
                entityId: '1',
                strategy: 'remove'
            })

            const data = queryClient.getQueryData<ListCache>(['test', 'list'])
            expect(data?.items).toHaveLength(1)
            expect(data?.items?.[0]).toHaveProperty('id', '2')
            expect(data?.pagination?.total).toBe(1)
        })

        it('marks entity with "fade" strategy', async () => {
            queryClient.setQueryData(['test', 'list'], {
                items: [{ id: '1', name: 'to-delete' }, { id: '2' }]
            })

            await applyOptimisticDelete({
                queryClient,
                queryKeyPrefix: ['test'],
                entityId: '1',
                strategy: 'fade'
            })

            const data = queryClient.getQueryData<ListCache<TestEntity>>(['test', 'list'])
            expect(data?.items).toHaveLength(2)
            const deletedItem = data?.items?.find((i) => i.id === '1')
            expect(deletedItem).toBeDefined()
            expect(deletedItem.__pending).toBe(true)
            expect(deletedItem.__pendingAction).toBe('delete')
        })

        it('returns snapshots for rollback', async () => {
            queryClient.setQueryData(['test', 'list'], {
                items: [{ id: '1' }, { id: '2' }],
                pagination: { total: 2 }
            })

            const context = await applyOptimisticDelete({
                queryClient,
                queryKeyPrefix: ['test'],
                entityId: '1'
            })

            expect(context.previousSnapshots.length).toBeGreaterThan(0)
        })

        it('does not go below 0 for pagination total', async () => {
            queryClient.setQueryData(['test', 'list'], {
                items: [{ id: '1' }],
                pagination: { total: 0 }
            })

            await applyOptimisticDelete({
                queryClient,
                queryKeyPrefix: ['test'],
                entityId: '1',
                strategy: 'remove'
            })

            const data = queryClient.getQueryData<ListCache>(['test', 'list'])
            expect(data?.pagination?.total).toBe(0)
        })
    })

    describe('confirmOptimisticCreate', () => {
        it('replaces the optimistic id and strips pending markers', () => {
            queryClient.setQueryData(['test', 'list'], {
                items: [{ id: 'opt-1', name: 'Created', ...makePendingMarkers('create') }]
            })

            confirmOptimisticCreate(queryClient, ['test'], 'opt-1', 'real-1')

            const data = queryClient.getQueryData<ListCache<{ id: string; name: string }>>(['test', 'list'])
            expect(data?.items).toEqual([{ id: 'real-1', name: 'Created' }])
        })

        it('drops the optimistic placeholder when the real entity already exists', () => {
            queryClient.setQueryData(['test', 'list'], {
                items: [
                    { id: 'opt-1', name: 'Created', ...makePendingMarkers('create') },
                    { id: 'real-1', name: 'Created from server' }
                ]
            })

            confirmOptimisticCreate(queryClient, ['test'], 'opt-1', 'real-1')

            const data = queryClient.getQueryData<ListCache<{ id: string; name: string }>>(['test', 'list'])
            expect(data?.items).toEqual([{ id: 'real-1', name: 'Created from server' }])
        })
    })

    describe('rollbackOptimisticSnapshots', () => {
        it('restores all cached queries to previous state', () => {
            const key = ['test', 'list']
            const original = { items: [{ id: '1' }] }

            queryClient.setQueryData(key, { items: [{ id: '1' }, { id: 'opt-1' }] })

            rollbackOptimisticSnapshots(queryClient, [[key, original]])

            expect(queryClient.getQueryData(key)).toEqual(original)
        })

        it('handles empty snapshots array', () => {
            expect(() => rollbackOptimisticSnapshots(queryClient, [])).not.toThrow()
        })

        it('handles undefined snapshots', () => {
            expect(() => rollbackOptimisticSnapshots(queryClient, undefined)).not.toThrow()
        })

        it('restores multiple query caches', () => {
            const key1 = ['test', 'list1']
            const key2 = ['test', 'list2']
            const orig1 = { items: [{ id: '1' }] }
            const orig2 = { items: [{ id: '2' }] }

            queryClient.setQueryData(key1, { items: [] })
            queryClient.setQueryData(key2, { items: [] })

            rollbackOptimisticSnapshots(queryClient, [
                [key1, orig1],
                [key2, orig2]
            ])

            expect(queryClient.getQueryData(key1)).toEqual(orig1)
            expect(queryClient.getQueryData(key2)).toEqual(orig2)
        })
    })

    describe('cleanupBreadcrumbCache', () => {
        it('removes exact breadcrumb query', () => {
            const key = ['breadcrumb', 'test', 'opt-1', 'en']
            queryClient.setQueryData(key, 'Test')

            cleanupBreadcrumbCache(queryClient, key)

            expect(queryClient.getQueryData(key)).toBeUndefined()
        })

        it('does not remove non-matching keys', () => {
            const key1 = ['breadcrumb', 'test', '1', 'en']
            const key2 = ['breadcrumb', 'test', '2', 'en']
            queryClient.setQueryData(key1, 'One')
            queryClient.setQueryData(key2, 'Two')

            cleanupBreadcrumbCache(queryClient, key1)

            expect(queryClient.getQueryData(key1)).toBeUndefined()
            expect(queryClient.getQueryData(key2)).toBe('Two')
        })
    })

    describe('safeInvalidateQueries', () => {
        it('invalidates when isMutating returns 1 (only this mutation)', () => {
            const spy = jest.spyOn(queryClient, 'invalidateQueries')
            jest.spyOn(queryClient, 'isMutating').mockReturnValue(1)

            safeInvalidateQueries(queryClient, ['test'], ['test', 'list'])

            expect(spy).toHaveBeenCalledWith({ queryKey: ['test', 'list'] })
        })

        it('does NOT invalidate when isMutating > 1 (concurrent mutations)', () => {
            const spy = jest.spyOn(queryClient, 'invalidateQueries')
            jest.spyOn(queryClient, 'isMutating').mockReturnValue(2)

            safeInvalidateQueries(queryClient, ['test'], ['test', 'list'])

            expect(spy).not.toHaveBeenCalled()
        })

        it('invalidates when isMutating returns 0 (no pending mutations)', () => {
            const spy = jest.spyOn(queryClient, 'invalidateQueries')
            jest.spyOn(queryClient, 'isMutating').mockReturnValue(0)

            safeInvalidateQueries(queryClient, ['test'], ['test', 'list'])

            expect(spy).toHaveBeenCalledWith({ queryKey: ['test', 'list'] })
        })

        it('invalidates multiple query keys', () => {
            const spy = jest.spyOn(queryClient, 'invalidateQueries')
            jest.spyOn(queryClient, 'isMutating').mockReturnValue(1)

            safeInvalidateQueries(queryClient, ['test'], ['test', 'list'], ['test', 'detail'])

            expect(spy).toHaveBeenCalledTimes(2)
            expect(spy).toHaveBeenCalledWith({ queryKey: ['test', 'list'] })
            expect(spy).toHaveBeenCalledWith({ queryKey: ['test', 'detail'] })
        })
    })
})
