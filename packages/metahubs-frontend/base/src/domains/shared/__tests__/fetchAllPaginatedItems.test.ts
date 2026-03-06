import { describe, expect, it, vi } from 'vitest'

import { fetchAllPaginatedItems } from '../fetchAllPaginatedItems'

describe('fetchAllPaginatedItems', () => {
    it('loads all pages and returns flattened result', async () => {
        const fetchPage = vi
            .fn()
            .mockResolvedValueOnce({
                items: [{ id: '1' }, { id: '2' }],
                pagination: { limit: 2, offset: 0, count: 2, total: 3, hasMore: true }
            })
            .mockResolvedValueOnce({
                items: [{ id: '3' }],
                pagination: { limit: 2, offset: 2, count: 1, total: 3, hasMore: false }
            })

        const result = await fetchAllPaginatedItems(fetchPage, { limit: 2, sortBy: 'sortOrder', sortOrder: 'asc' })

        expect(result.items).toEqual([{ id: '1' }, { id: '2' }, { id: '3' }])
        expect(result.pagination.count).toBe(3)
        expect(result.pagination.total).toBe(3)
        expect(result.pagination.hasMore).toBe(false)
        expect(fetchPage).toHaveBeenCalledTimes(2)
    })

    it('stops on empty page even if backend reports hasMore=true', async () => {
        const fetchPage = vi.fn().mockResolvedValue({
            items: [],
            pagination: { limit: 1000, offset: 0, count: 0, total: 0, hasMore: true }
        })

        const result = await fetchAllPaginatedItems(fetchPage)

        expect(result.items).toEqual([])
        expect(result.pagination.hasMore).toBe(false)
        expect(fetchPage).toHaveBeenCalledTimes(1)
    })

    it('throws when max pages guard is reached', async () => {
        const fetchPage = vi.fn().mockResolvedValue({
            items: [{ id: 'x' }],
            pagination: { limit: 1, offset: 0, count: 1, total: Number.MAX_SAFE_INTEGER, hasMore: true }
        })

        await expect(fetchAllPaginatedItems(fetchPage, { limit: 1 })).rejects.toThrow('Reached max pages guard')
        expect(fetchPage).toHaveBeenCalledTimes(1000)
    })
})
