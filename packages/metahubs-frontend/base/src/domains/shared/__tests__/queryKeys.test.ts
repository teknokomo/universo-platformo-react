import { describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'

import {
    invalidateAttributesQueries,
    invalidateCatalogsQueries,
    invalidateHubsQueries,
    invalidateMetahubMembers,
    invalidateMetahubsQueries,
    invalidatePublicationsQueries,
    invalidateRecordsQueries,
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

        expect(metahubsQueryKeys.hubs('m1')).toEqual(['metahubs', 'detail', 'm1', 'hubs'])
        expect(metahubsQueryKeys.hubsList('m1', { limit: 5, search: 'Hub' })).toEqual([
            'metahubs',
            'detail',
            'm1',
            'hubs',
            'list',
            { limit: 5, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: 'Hub' }
        ])

        expect(metahubsQueryKeys.hubDetail('m1', 'h1')).toEqual(['metahubs', 'detail', 'm1', 'hubs', 'detail', 'h1'])
        expect(metahubsQueryKeys.blockingCatalogs('m1', 'h1')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'hubs',
            'detail',
            'h1',
            'blockingCatalogs'
        ])

        expect(metahubsQueryKeys.catalogs('m1', 'h1')).toEqual(['metahubs', 'detail', 'm1', 'hubs', 'detail', 'h1', 'catalogs'])
        expect(metahubsQueryKeys.catalogsList('m1', 'h1', { offset: 10, sortOrder: 'asc' as any })).toEqual([
            'metahubs',
            'detail',
            'm1',
            'hubs',
            'detail',
            'h1',
            'catalogs',
            'list',
            { limit: 100, offset: 10, sortBy: 'updated', sortOrder: 'asc', search: undefined }
        ])

        expect(metahubsQueryKeys.allCatalogs('m1')).toEqual(['metahubs', 'detail', 'm1', 'allCatalogs'])
        expect(metahubsQueryKeys.allCatalogsList('m1', { search: 'Cat' })).toEqual([
            'metahubs',
            'detail',
            'm1',
            'allCatalogs',
            'list',
            { limit: 100, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: 'Cat' }
        ])

        expect(metahubsQueryKeys.catalogDetail('m1', 'c1')).toEqual(['metahubs', 'detail', 'm1', 'allCatalogs', 'detail', 'c1'])
        expect(metahubsQueryKeys.catalogDetailInHub('m1', 'h1', 'c1')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'hubs',
            'detail',
            'h1',
            'catalogs',
            'detail',
            'c1'
        ])

        expect(metahubsQueryKeys.attributes('m1', 'h1', 'c1')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'hubs',
            'detail',
            'h1',
            'catalogs',
            'detail',
            'c1',
            'attributes'
        ])
        expect(metahubsQueryKeys.attributesList('m1', 'h1', 'c1')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'hubs',
            'detail',
            'h1',
            'catalogs',
            'detail',
            'c1',
            'attributes',
            'list',
            { limit: 100, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: undefined }
        ])
        expect(metahubsQueryKeys.attributesDirect('m1', 'c1')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'allCatalogs',
            'detail',
            'c1',
            'attributes'
        ])
        expect(metahubsQueryKeys.attributesListDirect('m1', 'c1', { sortBy: 'created' as any })).toEqual([
            'metahubs',
            'detail',
            'm1',
            'allCatalogs',
            'detail',
            'c1',
            'attributes',
            'list',
            { limit: 100, offset: 0, sortBy: 'created', sortOrder: 'desc', search: undefined }
        ])

        expect(metahubsQueryKeys.records('m1', 'h1', 'c1')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'hubs',
            'detail',
            'h1',
            'catalogs',
            'detail',
            'c1',
            'records'
        ])
        expect(metahubsQueryKeys.recordsList('m1', 'h1', 'c1', { limit: 5 })).toEqual([
            'metahubs',
            'detail',
            'm1',
            'hubs',
            'detail',
            'h1',
            'catalogs',
            'detail',
            'c1',
            'records',
            'list',
            { limit: 5, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: undefined }
        ])
        expect(metahubsQueryKeys.recordsDirect('m1', 'c1')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'allCatalogs',
            'detail',
            'c1',
            'records'
        ])
        expect(metahubsQueryKeys.recordsListDirect('m1', 'c1', { offset: 5, search: '  rec  ' })).toEqual([
            'metahubs',
            'detail',
            'm1',
            'allCatalogs',
            'detail',
            'c1',
            'records',
            'list',
            { limit: 100, offset: 5, sortBy: 'updated', sortOrder: 'desc', search: 'rec' }
        ])

        expect(metahubsQueryKeys.publications('m1')).toEqual(['metahubs', 'detail', 'm1', 'publications'])
        expect(metahubsQueryKeys.publicationsList('m1')).toEqual(['metahubs', 'detail', 'm1', 'publications', 'list'])
        expect(metahubsQueryKeys.publicationDetail('m1', 'p1')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'publications',
            'detail',
            'p1'
        ])
        expect(metahubsQueryKeys.publicationDiff('m1', 'p1')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'publications',
            'detail',
            'p1',
            'diff'
        ])
    })

    it('calls invalidateQueries with expected queryKey', async () => {
        const queryClient = new QueryClient()
        const spy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined as any)

        await invalidateMetahubsQueries.all(queryClient)
        await invalidateMetahubsQueries.lists(queryClient)
        await invalidateMetahubsQueries.detail(queryClient, 'm1')

        await invalidateMetahubMembers(queryClient, 'm1')

        await invalidateHubsQueries.all(queryClient, 'm1')
        await invalidateHubsQueries.lists(queryClient, 'm1')
        await invalidateHubsQueries.detail(queryClient, 'm1', 'h1')

        await invalidateCatalogsQueries.all(queryClient, 'm1', 'h1')
        await invalidateCatalogsQueries.lists(queryClient, 'm1', 'h1')
        await invalidateCatalogsQueries.detail(queryClient, 'm1', 'h1', 'c1')

        await invalidateAttributesQueries.all(queryClient, 'm1', 'h1', 'c1')
        await invalidateAttributesQueries.lists(queryClient, 'm1', 'h1', 'c1')

        await invalidateRecordsQueries.all(queryClient, 'm1', 'h1', 'c1')
        await invalidateRecordsQueries.lists(queryClient, 'm1', 'h1', 'c1')

        await invalidatePublicationsQueries.all(queryClient, 'm1')
        await invalidatePublicationsQueries.lists(queryClient, 'm1')
        await invalidatePublicationsQueries.detail(queryClient, 'm1', 'p1')

        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.all })
        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.lists() })
        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.detail('m1') })

        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.members('m1') })

        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.hubs('m1') })
        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.hubsList('m1') })
        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.hubDetail('m1', 'h1') })

        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.catalogs('m1', 'h1') })
        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.catalogsList('m1', 'h1') })
        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.catalogDetailInHub('m1', 'h1', 'c1') })

        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.attributes('m1', 'h1', 'c1') })
        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.attributesList('m1', 'h1', 'c1') })

        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.records('m1', 'h1', 'c1') })
        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.recordsList('m1', 'h1', 'c1') })

        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.publications('m1') })
        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.publicationsList('m1') })
        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.publicationDetail('m1', 'p1') })
    })
})
