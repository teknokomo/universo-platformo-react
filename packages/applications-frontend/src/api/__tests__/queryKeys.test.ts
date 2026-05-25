import { describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'

import { invalidateApplicationMembers, invalidateApplicationsQueries, applicationsQueryKeys } from '../queryKeys'

describe('queryKeys factories + invalidation helpers', () => {
    it('builds stable keys with normalized params', () => {
        expect(applicationsQueryKeys.all).toEqual(['applications'])
        expect(applicationsQueryKeys.lists()).toEqual(['applications', 'list'])

        expect(applicationsQueryKeys.list()).toEqual([
            'applications',
            'list',
            { limit: 100, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: undefined }
        ])

        expect(
            applicationsQueryKeys.list({ limit: 10, offset: 20, sortBy: 'created' as any, sortOrder: 'asc' as any, search: '  q  ' })
        ).toEqual(['applications', 'list', { limit: 10, offset: 20, sortBy: 'created', sortOrder: 'asc', search: 'q' }])

        expect(applicationsQueryKeys.detail('m1')).toEqual(['applications', 'detail', 'm1'])
        expect(applicationsQueryKeys.members('m1')).toEqual(['applications', 'detail', 'm1', 'members'])

        expect(applicationsQueryKeys.membersList('m1')).toEqual([
            'applications',
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

        await invalidateApplicationsQueries.all(queryClient)
        await invalidateApplicationsQueries.lists(queryClient)
        await invalidateApplicationsQueries.detail(queryClient, 'm1')

        await invalidateApplicationMembers(queryClient, 'm1')

        expect(spy).toHaveBeenCalledWith({ queryKey: applicationsQueryKeys.all })
        expect(spy).toHaveBeenCalledWith({ queryKey: applicationsQueryKeys.lists() })
        expect(spy).toHaveBeenCalledWith({ queryKey: applicationsQueryKeys.detail('m1') })

        expect(spy).toHaveBeenCalledWith({ queryKey: applicationsQueryKeys.members('m1') })
    })
})
