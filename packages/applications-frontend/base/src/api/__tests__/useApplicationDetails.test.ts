import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
})

describe('useApplicationDetails', () => {
    it('wires useQuery with application detail key and fetcher', async () => {
        const useQuery = vi.fn().mockReturnValue({ data: undefined })

        vi.doMock('@tanstack/react-query', async () => {
            const actual = await vi.importActual<any>('@tanstack/react-query')
            return { ...actual, useQuery }
        })

        const getApplication = vi.fn().mockResolvedValue({ data: { id: 'm1' } })
        vi.doMock('../applications', () => ({ getApplication }))

        const { useApplicationDetails } = await import('../useApplicationDetails')

        useApplicationDetails('m1', { enabled: true, staleTime: 123, retry: 0 })

        expect(useQuery).toHaveBeenCalledTimes(1)
        const opts = useQuery.mock.calls[0][0]

        expect(opts.queryKey).toEqual(['applications', 'detail', 'm1'])
        expect(opts.enabled).toBe(true)
        expect(opts.staleTime).toBe(123)
        expect(opts.retry).toBe(0)
        expect(opts.refetchOnWindowFocus).toBe(false)
        expect(opts.refetchOnMount).toBe('always')

        await expect(opts.queryFn()).resolves.toEqual({ id: 'm1' })
        expect(getApplication).toHaveBeenCalledWith('m1')
    })

    it('disables query when applicationId is empty', async () => {
        const useQuery = vi.fn().mockReturnValue({ data: undefined })

        vi.doMock('@tanstack/react-query', async () => {
            const actual = await vi.importActual<any>('@tanstack/react-query')
            return { ...actual, useQuery }
        })

        vi.doMock('../applications', () => ({ getApplication: vi.fn() }))

        const { useApplicationDetails } = await import('../useApplicationDetails')

        useApplicationDetails('' as any)

        const opts = useQuery.mock.calls[0][0]
        expect(opts.enabled).toBe(false)
    })
})
