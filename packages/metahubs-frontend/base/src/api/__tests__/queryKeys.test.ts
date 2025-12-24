import { describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'

import {
    invalidateMetaEntitiesQueries,
    invalidateMetaSectionsQueries,
    invalidateMetahubMembers,
    invalidateMetahubsQueries,
    meta_entitiesQueryKeys,
    meta_sectionsQueryKeys,
    metahubsQueryKeys
} from '../queryKeys'

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

        expect(metahubsQueryKeys.meta_entities('m1')).toEqual(['metahubs', 'detail', 'm1', 'meta_entities'])
        expect(metahubsQueryKeys.meta_entitiesList('m1')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'meta_entities',
            'list',
            { limit: 100, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: undefined }
        ])

        expect(metahubsQueryKeys.meta_sections('m1')).toEqual(['metahubs', 'detail', 'm1', 'meta_sections'])
        expect(metahubsQueryKeys.meta_sectionsList('m1')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'meta_sections',
            'list',
            { limit: 100, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: undefined }
        ])

        expect(meta_sectionsQueryKeys.all).toEqual(['meta_sections'])
        expect(meta_sectionsQueryKeys.lists()).toEqual(['meta_sections', 'list'])
        expect(meta_sectionsQueryKeys.list({ search: '   ' } as any)).toEqual([
            'meta_sections',
            'list',
            { limit: 100, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: undefined }
        ])
        expect(meta_sectionsQueryKeys.detail('s1')).toEqual(['meta_sections', 'detail', 's1'])
        expect(meta_sectionsQueryKeys.meta_entities('s1')).toEqual(['meta_sections', 'detail', 's1', 'meta_entities'])

        expect(meta_entitiesQueryKeys.all).toEqual(['meta_entities'])
        expect(meta_entitiesQueryKeys.lists()).toEqual(['meta_entities', 'list'])
        expect(meta_entitiesQueryKeys.list()).toEqual([
            'meta_entities',
            'list',
            { limit: 100, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: undefined }
        ])
        expect(meta_entitiesQueryKeys.detail('e1')).toEqual(['meta_entities', 'detail', 'e1'])
    })

    it('calls invalidateQueries with expected queryKey', async () => {
        const queryClient = new QueryClient()
        const spy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined as any)

        await invalidateMetahubsQueries.all(queryClient)
        await invalidateMetahubsQueries.lists(queryClient)
        await invalidateMetahubsQueries.detail(queryClient, 'm1')

        await invalidateMetaSectionsQueries.all(queryClient)
        await invalidateMetaSectionsQueries.lists(queryClient)
        await invalidateMetaSectionsQueries.detail(queryClient, 's1')

        await invalidateMetaEntitiesQueries.all(queryClient)
        await invalidateMetaEntitiesQueries.lists(queryClient)
        await invalidateMetaEntitiesQueries.detail(queryClient, 'e1')

        await invalidateMetahubMembers(queryClient, 'm1')

        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.all })
        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.lists() })
        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.detail('m1') })

        expect(spy).toHaveBeenCalledWith({ queryKey: meta_sectionsQueryKeys.all })
        expect(spy).toHaveBeenCalledWith({ queryKey: meta_sectionsQueryKeys.lists() })
        expect(spy).toHaveBeenCalledWith({ queryKey: meta_sectionsQueryKeys.detail('s1') })

        expect(spy).toHaveBeenCalledWith({ queryKey: meta_entitiesQueryKeys.all })
        expect(spy).toHaveBeenCalledWith({ queryKey: meta_entitiesQueryKeys.lists() })
        expect(spy).toHaveBeenCalledWith({ queryKey: meta_entitiesQueryKeys.detail('e1') })

        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.members('m1') })
    })
})
