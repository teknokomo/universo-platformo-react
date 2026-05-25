import type { DbExecutor } from '@universo/utils/database'
import {
    fetchObjectItems,
    fetchUserSelections,
    fetchAllUserSelections,
    validateItemExists,
    syncUserSelections
} from '../../persistence/onboardingStore'

const createMockExecutor = (queryImpl: jest.Mock): DbExecutor => ({ query: queryImpl, transaction: jest.fn() } as never)

describe('onboardingStore', () => {
    describe('fetchObjectItems', () => {
        it('queries correct table for each object kind', async () => {
            const query = jest.fn().mockResolvedValue([])
            const exec = createMockExecutor(query)

            await fetchObjectItems(exec, 'goals')
            expect(query).toHaveBeenCalledWith(expect.stringContaining('start.obj_goals'), [])

            query.mockClear()
            await fetchObjectItems(exec, 'topics')
            expect(query).toHaveBeenCalledWith(expect.stringContaining('start.obj_topics'), [])

            query.mockClear()
            await fetchObjectItems(exec, 'features')
            expect(query).toHaveBeenCalledWith(expect.stringContaining('start.obj_features'), [])
        })

        it('filters active and non-deleted rows, orders by sort_order', async () => {
            const query = jest.fn().mockResolvedValue([])
            const exec = createMockExecutor(query)

            await fetchObjectItems(exec, 'goals')
            const sql = query.mock.calls[0][0] as string
            expect(sql).toContain('is_active = true')
            expect(sql).toContain('_upl_deleted = false')
            expect(sql).toContain('_app_deleted = false')
            expect(sql).toContain('ORDER BY sort_order ASC')
        })
    })

    describe('fetchUserSelections', () => {
        it('queries with user_id and object_kind', async () => {
            const query = jest.fn().mockResolvedValue([])
            const exec = createMockExecutor(query)

            await fetchUserSelections(exec, 'user-1', 'goals')
            expect(query).toHaveBeenCalledWith(expect.stringContaining('start.rel_user_selections'), ['user-1', 'goals'])
        })
    })

    describe('fetchAllUserSelections', () => {
        it('queries all selections for a user', async () => {
            const query = jest.fn().mockResolvedValue([
                { id: 's-1', user_id: 'u-1', object_kind: 'goals', item_id: 'g-1' },
                { id: 's-2', user_id: 'u-1', object_kind: 'topics', item_id: 't-1' }
            ])
            const exec = createMockExecutor(query)

            const rows = await fetchAllUserSelections(exec, 'u-1')
            expect(rows).toHaveLength(2)
            expect(query).toHaveBeenCalledWith(expect.stringContaining('start.rel_user_selections'), ['u-1'])
        })
    })

    describe('validateItemExists', () => {
        it('returns true when item exists', async () => {
            const query = jest.fn().mockResolvedValue([{ id: 'g-1' }])
            const exec = createMockExecutor(query)

            const exists = await validateItemExists(exec, 'goals', 'g-1')
            expect(exists).toBe(true)
        })

        it('returns false when item does not exist', async () => {
            const query = jest.fn().mockResolvedValue([])
            const exec = createMockExecutor(query)

            const exists = await validateItemExists(exec, 'goals', 'nonexistent')
            expect(exists).toBe(false)
        })
    })

    describe('syncUserSelections', () => {
        it('adds new selections', async () => {
            const query = jest
                .fn()
                // fetchUserSelections returns empty
                .mockResolvedValueOnce([])
                // INSERT for item-1
                .mockResolvedValueOnce([{ id: 's-1', user_id: 'u-1', object_kind: 'goals', item_id: 'item-1' }])

            const exec = createMockExecutor(query)
            const result = await syncUserSelections(exec, 'u-1', 'goals', ['item-1'])

            expect(result).toEqual({ added: 1, removed: 0 })
            expect(query).toHaveBeenCalledTimes(2)
            const insertSql = query.mock.calls[1][0] as string
            expect(insertSql).toContain('INSERT INTO start.rel_user_selections')
            expect(insertSql).toContain('RETURNING')
        })

        it('removes deselected items via soft delete', async () => {
            const query = jest
                .fn()
                // fetchUserSelections returns an existing selection
                .mockResolvedValueOnce([{ id: 's-1', user_id: 'u-1', object_kind: 'goals', item_id: 'item-1' }])
                // UPDATE (soft delete) RETURNING
                .mockResolvedValueOnce([{ id: 's-1' }])

            const exec = createMockExecutor(query)
            const result = await syncUserSelections(exec, 'u-1', 'goals', [])

            expect(result).toEqual({ added: 0, removed: 1 })
            const updateSql = query.mock.calls[1][0] as string
            expect(updateSql).toContain('_upl_deleted = true')
            expect(updateSql).toContain('_upl_updated_at = now()')
            expect(updateSql).toContain('_upl_updated_by = $2')
            expect(updateSql).toContain('_app_deleted = true')
            expect(updateSql).toContain('_app_deleted_by = $2')
            expect(updateSql).toContain('_upl_version = _upl_version + 1')
            expect(updateSql).toContain('RETURNING')
        })

        it('returns zero counts for idempotent sync', async () => {
            const query = jest.fn().mockResolvedValueOnce([{ id: 's-1', user_id: 'u-1', object_kind: 'goals', item_id: 'item-1' }])

            const exec = createMockExecutor(query)
            const result = await syncUserSelections(exec, 'u-1', 'goals', ['item-1'])

            expect(result).toEqual({ added: 0, removed: 0 })
            // Only fetchUserSelections called, no INSERT/UPDATE
            expect(query).toHaveBeenCalledTimes(1)
        })

        it('deduplicates repeated item IDs before inserting', async () => {
            const query = jest
                .fn()
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([{ id: 's-1', user_id: 'u-1', object_kind: 'goals', item_id: 'item-1' }])

            const exec = createMockExecutor(query)
            const result = await syncUserSelections(exec, 'u-1', 'goals', ['item-1', 'item-1'])

            expect(result).toEqual({ added: 1, removed: 0 })
            expect(query).toHaveBeenCalledTimes(2)
        })
    })
})
