import { paginateItems, validateListQuery } from '../../domains/shared/queryParams'

describe('paginateItems', () => {
    const items = ['a', 'b', 'c', 'd', 'e']

    it('returns first page', () => {
        const result = paginateItems(items, { limit: 2, offset: 0 })

        expect(result.items).toEqual(['a', 'b'])
        expect(result.pagination).toEqual({
            limit: 2,
            offset: 0,
            total: 5,
            hasMore: true
        })
    })

    it('returns middle page', () => {
        const result = paginateItems(items, { limit: 2, offset: 2 })

        expect(result.items).toEqual(['c', 'd'])
        expect(result.pagination.hasMore).toBe(true)
    })

    it('returns last page', () => {
        const result = paginateItems(items, { limit: 2, offset: 4 })

        expect(result.items).toEqual(['e'])
        expect(result.pagination.hasMore).toBe(false)
    })

    it('returns empty page when offset exceeds total', () => {
        const result = paginateItems(items, { limit: 2, offset: 10 })

        expect(result.items).toEqual([])
        expect(result.pagination.total).toBe(5)
        expect(result.pagination.hasMore).toBe(false)
    })

    it('handles empty items', () => {
        const result = paginateItems([], { limit: 10, offset: 0 })

        expect(result.items).toEqual([])
        expect(result.pagination.total).toBe(0)
        expect(result.pagination.hasMore).toBe(false)
    })

    it('returns all items when limit exceeds total', () => {
        const result = paginateItems(items, { limit: 100, offset: 0 })

        expect(result.items).toEqual(items)
        expect(result.pagination.hasMore).toBe(false)
    })
})

describe('validateListQuery', () => {
    it('applies defaults for missing params', () => {
        const result = validateListQuery({})

        expect(result.limit).toBe(100)
        expect(result.offset).toBe(0)
        expect(result.sortBy).toBe('updated')
        expect(result.sortOrder).toBe('desc')
        expect(result.showAll).toBe(false)
    })

    it('parses string numbers (from query string)', () => {
        const result = validateListQuery({ limit: '50', offset: '10' })

        expect(result.limit).toBe(50)
        expect(result.offset).toBe(10)
    })

    it('throws on invalid limit', () => {
        expect(() => validateListQuery({ limit: '0' })).toThrow()
        expect(() => validateListQuery({ limit: '1001' })).toThrow()
    })

    it('throws on negative offset', () => {
        expect(() => validateListQuery({ offset: '-1' })).toThrow()
    })

    it('trims search string', () => {
        const result = validateListQuery({ search: '  hello  ' })
        expect(result.search).toBe('hello')
    })

    it('converts empty search to undefined', () => {
        const result = validateListQuery({ search: '' })
        expect(result.search).toBeUndefined()
    })

    it('correctly handles showAll string "false" (not coerced to true)', () => {
        const result = validateListQuery({ showAll: 'false' })
        expect(result.showAll).toBe(false)
    })

    it('correctly handles showAll string "true"', () => {
        const result = validateListQuery({ showAll: 'true' })
        expect(result.showAll).toBe(true)
    })
})
