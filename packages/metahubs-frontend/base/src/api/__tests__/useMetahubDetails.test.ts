import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
})

describe('useMetahubDetails', () => {
    it('wires useQuery with metahub detail key and fetcher', async () => {
        const useQuery = vi.fn().mockReturnValue({ data: undefined })

        vi.doMock('@tanstack/react-query', async () => {
            const actual = await vi.importActual<any>('@tanstack/react-query')
            return { ...actual, useQuery }
        })

        const getMetahub = vi.fn().mockResolvedValue({ data: { id: 'm1' } })
        vi.doMock('../metahubs', () => ({ getMetahub }))

        const { useMetahubDetails } = await import('../useMetahubDetails')

        useMetahubDetails('m1', { enabled: true, staleTime: 123, retry: 0 })

        expect(useQuery).toHaveBeenCalledTimes(1)
        const opts = useQuery.mock.calls[0][0]

        expect(opts.queryKey).toEqual(['metahubs', 'detail', 'm1'])
        expect(opts.enabled).toBe(true)
        expect(opts.staleTime).toBe(123)
        expect(opts.retry).toBe(0)
        expect(opts.refetchOnWindowFocus).toBe(false)
        expect(opts.refetchOnMount).toBe('always')

        await expect(opts.queryFn()).resolves.toEqual({ id: 'm1' })
        expect(getMetahub).toHaveBeenCalledWith('m1')
    })

    it('disables query when metahubId is empty', async () => {
        const useQuery = vi.fn().mockReturnValue({ data: undefined })

        vi.doMock('@tanstack/react-query', async () => {
            const actual = await vi.importActual<any>('@tanstack/react-query')
            return { ...actual, useQuery }
        })

        vi.doMock('../metahubs', () => ({ getMetahub: vi.fn() }))

        const { useMetahubDetails } = await import('../useMetahubDetails')

        useMetahubDetails('' as any)

        const opts = useQuery.mock.calls[0][0]
        expect(opts.enabled).toBe(false)
    })
})
