import { describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'

import {
    entitiesQueryKeys,
    invalidateEntitiesQueries,
    invalidateMetaversesQueries,
    invalidateSectionsQueries,
    metaversesQueryKeys,
    sectionsQueryKeys
} from '../queryKeys'

describe('queryKeys factories + invalidation helpers', () => {
    it('builds stable keys with normalized params', () => {
        expect(metaversesQueryKeys.all).toEqual(['metaverses'])
        expect(metaversesQueryKeys.lists()).toEqual(['metaverses', 'list'])

        expect(metaversesQueryKeys.list()).toEqual([
            'metaverses',
            'list',
            { limit: 100, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: undefined }
        ])

        expect(metaversesQueryKeys.list({ limit: 10, offset: 20, sortBy: 'created' as any, sortOrder: 'asc' as any, search: '  q  ' })).toEqual([
            'metaverses',
            'list',
            { limit: 10, offset: 20, sortBy: 'created', sortOrder: 'asc', search: 'q' }
        ])

        expect(metaversesQueryKeys.detail('m1')).toEqual(['metaverses', 'detail', 'm1'])
        expect(metaversesQueryKeys.members('m1')).toEqual(['metaverses', 'detail', 'm1', 'members'])

        expect(metaversesQueryKeys.membersList('m1')).toEqual([
            'metaverses',
            'detail',
            'm1',
            'members',
            'list',
            { limit: 100, offset: 0, sortBy: 'created', sortOrder: 'desc', search: undefined }
        ])

        expect(metaversesQueryKeys.entities('m1')).toEqual(['metaverses', 'detail', 'm1', 'entities'])
        expect(metaversesQueryKeys.entitiesList('m1')).toEqual([
            'metaverses',
            'detail',
            'm1',
            'entities',
            'list',
            { limit: 100, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: undefined }
        ])

        expect(metaversesQueryKeys.sections('m1')).toEqual(['metaverses', 'detail', 'm1', 'sections'])
        expect(metaversesQueryKeys.sectionsList('m1')).toEqual([
            'metaverses',
            'detail',
            'm1',
            'sections',
            'list',
            { limit: 100, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: undefined }
        ])

        expect(sectionsQueryKeys.all).toEqual(['sections'])
        expect(sectionsQueryKeys.lists()).toEqual(['sections', 'list'])
        expect(sectionsQueryKeys.list({ search: '   ' } as any)).toEqual([
            'sections',
            'list',
            { limit: 100, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: undefined }
        ])
        expect(sectionsQueryKeys.detail('s1')).toEqual(['sections', 'detail', 's1'])
        expect(sectionsQueryKeys.entities('s1')).toEqual(['sections', 'detail', 's1', 'entities'])

        expect(entitiesQueryKeys.all).toEqual(['entities'])
        expect(entitiesQueryKeys.lists()).toEqual(['entities', 'list'])
        expect(entitiesQueryKeys.list()).toEqual([
            'entities',
            'list',
            { limit: 100, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: undefined }
        ])
        expect(entitiesQueryKeys.detail('e1')).toEqual(['entities', 'detail', 'e1'])
    })

    it('calls invalidateQueries with expected queryKey', async () => {
        const queryClient = new QueryClient()
        const spy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined as any)

        await invalidateMetaversesQueries.all(queryClient)
        await invalidateMetaversesQueries.lists(queryClient)
        await invalidateMetaversesQueries.detail(queryClient, 'm1')

        await invalidateSectionsQueries.all(queryClient)
        await invalidateSectionsQueries.lists(queryClient)
        await invalidateSectionsQueries.detail(queryClient, 's1')

        await invalidateEntitiesQueries.all(queryClient)
        await invalidateEntitiesQueries.lists(queryClient)
        await invalidateEntitiesQueries.detail(queryClient, 'e1')

        expect(spy).toHaveBeenCalledWith({ queryKey: metaversesQueryKeys.all })
        expect(spy).toHaveBeenCalledWith({ queryKey: metaversesQueryKeys.lists() })
        expect(spy).toHaveBeenCalledWith({ queryKey: metaversesQueryKeys.detail('m1') })

        expect(spy).toHaveBeenCalledWith({ queryKey: sectionsQueryKeys.all })
        expect(spy).toHaveBeenCalledWith({ queryKey: sectionsQueryKeys.lists() })
        expect(spy).toHaveBeenCalledWith({ queryKey: sectionsQueryKeys.detail('s1') })

        expect(spy).toHaveBeenCalledWith({ queryKey: entitiesQueryKeys.all })
        expect(spy).toHaveBeenCalledWith({ queryKey: entitiesQueryKeys.lists() })
        expect(spy).toHaveBeenCalledWith({ queryKey: entitiesQueryKeys.detail('e1') })
    })
})
