import { describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'

import { invalidateMetahubMembers, invalidateMetahubsQueries, metahubsQueryKeys } from '../queryKeys'

describe('queryKeys factories + invalidation helpers', () => {
    it('builds stable keys with normalized params', () => {
        expect(metahubsQueryKeys.all).toEqual(['metahubs'])
        expect(metahubsQueryKeys.lists()).toEqual(['metahubs', 'list'])

        expect(metahubsQueryKeys.list()).toEqual([
            'metahubs',
            'list',
            { limit: 100, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: undefined }
        ])

        expect(
            metahubsQueryKeys.list({ limit: 10, offset: 20, sortBy: 'created' as any, sortOrder: 'asc' as any, search: '  q  ' })
        ).toEqual(['metahubs', 'list', { limit: 10, offset: 20, sortBy: 'created', sortOrder: 'asc', search: 'q' }])

        expect(metahubsQueryKeys.detail('m1')).toEqual(['metahubs', 'detail', 'm1'])
        expect(metahubsQueryKeys.members('m1')).toEqual(['metahubs', 'detail', 'm1', 'members'])

        expect(metahubsQueryKeys.membersList('m1')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'members',
            'list',
            { limit: 100, offset: 0, sortBy: 'created', sortOrder: 'desc', search: undefined }
        ])
    })

    it('calls invalidateQueries with expected queryKey', async () => {
        const queryClient = new QueryClient()
        const spy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined as any)

        await invalidateMetahubsQueries.all(queryClient)
        await invalidateMetahubsQueries.lists(queryClient)
        await invalidateMetahubsQueries.detail(queryClient, 'm1')

        await invalidateMetahubMembers(queryClient, 'm1')

        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.all })
        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.lists() })
        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.detail('m1') })

        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.members('m1') })
    })
})
