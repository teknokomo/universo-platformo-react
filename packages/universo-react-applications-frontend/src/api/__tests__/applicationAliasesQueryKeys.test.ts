import type { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import { applicationAliasesQueryKeys, invalidateApplicationAliasQueries } from '../applicationAliasesQueryKeys'
import { applicationsQueryKeys } from '../queryKeys'

describe('application alias query keys', () => {
    it('normalizes list parameters into stable cache keys', () => {
        expect(applicationAliasesQueryKeys.list()).toEqual([
            'application-aliases',
            'list',
            {
                limit: 20,
                offset: 0,
                sortBy: 'alias',
                sortOrder: 'asc',
                search: undefined,
                applicationId: undefined,
                includeReleased: false,
                locale: 'en'
            }
        ])

        expect(
            applicationAliasesQueryKeys.list({
                limit: 50,
                offset: 100,
                sortBy: 'application',
                sortOrder: 'desc',
                search: '  consortium  ',
                applicationId: '  application-1  ',
                includeReleased: true,
                locale: 'ru'
            })
        ).toEqual([
            'application-aliases',
            'list',
            {
                limit: 50,
                offset: 100,
                sortBy: 'application',
                sortOrder: 'desc',
                search: 'consortium',
                applicationId: 'application-1',
                includeReleased: true,
                locale: 'ru'
            }
        ])
    })

    it('invalidates deployment-wide and application-scoped alias caches after mutations', async () => {
        const invalidateQueries = vi.fn().mockResolvedValue(undefined)
        const queryClient = { invalidateQueries } as unknown as QueryClient

        await invalidateApplicationAliasQueries(queryClient, 'application-1')

        expect(invalidateQueries).toHaveBeenCalledTimes(4)
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: applicationAliasesQueryKeys.lists() })
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: applicationsQueryKeys.runtimeReferences() })
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: applicationAliasesQueryKeys.byApplication('application-1') })
        expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: applicationAliasesQueryKeys.policy('application-1') })
    })
})
