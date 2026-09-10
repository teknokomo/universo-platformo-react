import { describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'

import {
    invalidateApplicationMembers,
    invalidateApplicationRuntimeQueries,
    invalidateApplicationsQueries,
    applicationsQueryKeys
} from '../queryKeys'

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
        expect(applicationsQueryKeys.runtimeTable('m1', { workspaceId: 'workspace-a' })).toEqual([
            'applications',
            'detail',
            'm1',
            'runtime',
            { limit: 50, offset: 0, locale: 'en', objectCollectionId: 'default', workspaceId: 'workspace-a' }
        ])
        expect(applicationsQueryKeys.runtimeRow('m1', 'row-1', 'workspace-a')).toEqual([
            'applications',
            'detail',
            'm1',
            'runtime',
            'row',
            'row-1',
            'workspace-a'
        ])
        expect(applicationsQueryKeys.runtimeRow('m1', 'row-1', 'workspace-b')).not.toEqual(
            applicationsQueryKeys.runtimeRow('m1', 'row-1', 'workspace-a')
        )
        expect(() =>
            applicationsQueryKeys.runtimeEffectiveLayout('m1', {
                entityTypeId: '  entity-1  ',
                entityTypeCodename: 'ignored-when-id-is-present',
                workspaceId: ' workspace-a '
            })
        ).toThrow('entityTypeId or entityTypeCodename')
        expect(
            applicationsQueryKeys.runtimeEffectiveLayout('m1', {
                targetKind: 'page',
                entityTypeCodename: 'Page',
                workspaceId: 'workspace-a',
                locale: 'ru',
                themeVariant: 'dark'
            })
        ).toEqual(
            applicationsQueryKeys.runtimeEffectiveLayout('m1', {
                targetKind: 'page',
                entityTypeCodename: 'Page',
                workspaceId: 'workspace-a',
                locale: 'ru',
                themeVariant: 'dark',
                ...({ recordKey: 'content-1' } as any)
            } as any)
        )
        expect(() =>
            applicationsQueryKeys.runtimeEffectiveLayout('m1', {
                entityTypeCodename: 'Page',
                workspaceId: 'workspace-a'
            })
        ).toThrow('Runtime target kind is required')
        expect(applicationsQueryKeys.runtimeEffectiveLayout('m1')).toEqual([
            'applications',
            'detail',
            'm1',
            'runtime',
            'effective-layout',
            { targetKind: null, entityTypeId: null, entityTypeCodename: null, workspaceId: null, locale: null, themeVariant: null }
        ])

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
        await invalidateApplicationRuntimeQueries.all(queryClient, 'm1')

        expect(spy).toHaveBeenCalledWith({ queryKey: applicationsQueryKeys.all })
        expect(spy).toHaveBeenCalledWith({ queryKey: applicationsQueryKeys.lists() })
        expect(spy).toHaveBeenCalledWith({ queryKey: applicationsQueryKeys.detail('m1') })

        expect(spy).toHaveBeenCalledWith({ queryKey: applicationsQueryKeys.members('m1') })
        expect(spy).toHaveBeenCalledWith({ queryKey: applicationsQueryKeys.runtimeAll('m1') })
    })
})
