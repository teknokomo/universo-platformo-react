import { describe, it, expect } from 'vitest'

import { extractPaginationMeta } from '../apiClient'

const makeResponse = (headers: Record<string, string | undefined>) =>
    ({
        headers
    }) as any

describe('apiClient', () => {
    it('extractPaginationMeta parses pagination headers', () => {
        const meta = extractPaginationMeta(
            makeResponse({
                'x-pagination-limit': '20',
                'x-pagination-offset': '40',
                'x-pagination-count': '10',
                'x-total-count': '999',
                'x-pagination-has-more': 'true'
            })
        )

        expect(meta).toEqual({
            limit: 20,
            offset: 40,
            count: 10,
            total: 999,
            hasMore: true
        })
    })

    it('extractPaginationMeta falls back to defaults on missing headers', () => {
        const meta = extractPaginationMeta(makeResponse({}))

        expect(meta).toEqual({
            limit: 100,
            offset: 0,
            count: 0,
            total: 0,
            hasMore: false
        })
    })
})
