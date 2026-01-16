import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    useQuery: vi.fn().mockReturnValue({ data: undefined }),
    getMetahub: vi.fn()
}))

vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual<any>('@tanstack/react-query')
    return { ...actual, useQuery: mocks.useQuery }
})

vi.mock('../../api', () => ({
    getMetahub: mocks.getMetahub
}))

import { useMetahubDetails } from '../useMetahubDetails'

beforeEach(() => {
    vi.clearAllMocks()
    mocks.useQuery.mockClear()
    mocks.getMetahub.mockReset()
    mocks.useQuery.mockReturnValue({ data: undefined })
})

describe('useMetahubDetails', () => {
    it('wires useQuery with metahub detail key and fetcher', async () => {
        mocks.getMetahub.mockResolvedValue({ data: { id: 'm1' } })
        useMetahubDetails('m1', { enabled: true, staleTime: 123, retry: 0 })

        expect(mocks.useQuery).toHaveBeenCalledTimes(1)
        const opts = mocks.useQuery.mock.calls[0][0]

        expect(opts.queryKey).toEqual(['metahubs', 'detail', 'm1'])
        expect(opts.enabled).toBe(true)
        expect(opts.staleTime).toBe(123)
        expect(opts.retry).toBe(0)
        expect(opts.refetchOnWindowFocus).toBe(false)
        expect(opts.refetchOnMount).toBe('always')

        await expect(opts.queryFn()).resolves.toEqual({ id: 'm1' })
        expect(mocks.getMetahub).toHaveBeenCalledWith('m1')
    })

    it('disables query when metahubId is empty', async () => {
        useMetahubDetails('' as any)

        const opts = mocks.useQuery.mock.calls[0][0]
        expect(opts.enabled).toBe(false)
    })
})
