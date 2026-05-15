import { describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'

import {
    invalidateComponentsQueries,
    invalidateObjectCollectionsQueries,
    invalidateEntitiesQueries,
    invalidateEntityTypesQueries,
    invalidateOptionListsQueries,
    invalidateTreeEntitiesQueries,
    invalidateMetahubMembers,
    invalidateMetahubsQueries,
    invalidatePublicationsQueries,
    invalidateRecordsQueries,
    invalidateValueGroupsQueries,
    metahubsQueryKeys
} from '../queryKeys'

describe('queryKeys factories + invalidation helpers', () => {
    it('builds stable keys with normalized params', () => {
        expect(metahubsQueryKeys.all).toEqual(['metahubs'])
        expect(metahubsQueryKeys.lists()).toEqual(['metahubs', 'list'])
        expect(metahubsQueryKeys.templates()).toEqual(['metahubs', 'templates'])
        expect(metahubsQueryKeys.templatesList()).toEqual(['metahubs', 'templates', 'list', { definitionType: 'metahub_template' }])
        expect(metahubsQueryKeys.templatesList({ definitionType: 'entity_type_preset' })).toEqual([
            'metahubs',
            'templates',
            'list',
            { definitionType: 'entity_type_preset' }
        ])
        expect(metahubsQueryKeys.templateDetail('template-1')).toEqual(['metahubs', 'templates', 'detail', 'template-1'])

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

        expect(metahubsQueryKeys.branches('m1')).toEqual(['metahubs', 'detail', 'm1', 'branches'])
        expect(metahubsQueryKeys.branchesList('m1', { limit: 5, search: 'main' })).toEqual([
            'metahubs',
            'detail',
            'm1',
            'branches',
            'list',
            { limit: 5, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: 'main' }
        ])
        expect(metahubsQueryKeys.branchDetail('m1', 'b1')).toEqual(['metahubs', 'detail', 'm1', 'branches', 'detail', 'b1'])
        expect(metahubsQueryKeys.blockingBranchUsers('m1', 'b1')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'branches',
            'detail',
            'b1',
            'blockingUsers'
        ])

        expect(metahubsQueryKeys.entityTypes('m1')).toEqual(['metahubs', 'detail', 'm1', 'entityTypes'])
        expect(metahubsQueryKeys.entityTypesList('m1')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'entityTypes',
            'list',
            { limit: 100, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: undefined }
        ])
        expect(
            metahubsQueryKeys.entityTypesList('m1', {
                limit: 5,
                offset: 10,
                sortBy: 'created' as any,
                sortOrder: 'asc' as any,
                search: '  custom  '
            })
        ).toEqual([
            'metahubs',
            'detail',
            'm1',
            'entityTypes',
            'list',
            { limit: 5, offset: 10, sortBy: 'created', sortOrder: 'asc', search: 'custom' }
        ])
        expect(metahubsQueryKeys.entityTypeDetail('m1', 'et1')).toEqual(['metahubs', 'detail', 'm1', 'entityTypes', 'detail', 'et1'])

        expect(metahubsQueryKeys.entities('m1', 'custom.product')).toEqual(['metahubs', 'detail', 'm1', 'entities', 'custom.product'])
        expect(
            metahubsQueryKeys.entitiesList('m1', {
                kind: 'custom.product',
                limit: 5,
                offset: 1,
                sortBy: 'created' as any,
                sortOrder: 'asc' as any,
                search: '  rec  ',
                locale: 'ru',
                includeDeleted: true,
                onlyDeleted: false
            })
        ).toEqual([
            'metahubs',
            'detail',
            'm1',
            'entities',
            'custom.product',
            'list',
            {
                kind: 'custom.product',
                limit: 5,
                offset: 1,
                sortBy: 'created',
                sortOrder: 'asc',
                search: 'rec',
                locale: 'ru',
                includeDeleted: true,
                onlyDeleted: false
            }
        ])
        expect(metahubsQueryKeys.entityDetail('m1', 'e1')).toEqual(['metahubs', 'detail', 'm1', 'entity', 'e1'])

        expect(metahubsQueryKeys.treeEntities('m1')).toEqual(['metahubs', 'detail', 'm1', 'treeEntities'])
        expect(metahubsQueryKeys.treeEntitiesScope('m1', ' hub ')).toEqual(['metahubs', 'detail', 'm1', 'treeEntities', { kindKey: 'hub' }])
        expect(metahubsQueryKeys.treeEntitiesList('m1', { limit: 5, search: 'TreeEntity' })).toEqual([
            'metahubs',
            'detail',
            'm1',
            'treeEntities',
            'list',
            { limit: 5, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: 'TreeEntity' }
        ])
        expect(metahubsQueryKeys.treeEntitiesList('m1', { kindKey: ' hub ' })).toEqual([
            'metahubs',
            'detail',
            'm1',
            'treeEntities',
            { kindKey: 'hub' },
            'list',
            {
                limit: 100,
                offset: 0,
                sortBy: 'updated',
                sortOrder: 'desc',
                search: undefined,
                kindKey: 'hub'
            }
        ])

        expect(metahubsQueryKeys.treeEntityDetail('m1', 'h1')).toEqual(['metahubs', 'detail', 'm1', 'treeEntities', 'detail', 'h1'])
        expect(metahubsQueryKeys.treeEntityDetail('m1', 'h1', 'hub')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'treeEntities',
            { kindKey: 'hub' },
            'detail',
            'h1'
        ])
        expect(metahubsQueryKeys.blockingTreeDependencies('m1', 'h1')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'treeEntities',
            'detail',
            'h1',
            'blockingTreeDependencies'
        ])

        expect(metahubsQueryKeys.objectCollections('m1', 'h1')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'treeEntities',
            'detail',
            'h1',
            'objectCollections'
        ])
        expect(metahubsQueryKeys.objectCollectionsScope('m1', 'h1', ' object ')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'treeEntities',
            'detail',
            'h1',
            'objectCollections',
            { kindKey: 'object' }
        ])
        expect(metahubsQueryKeys.objectCollectionsList('m1', 'h1', { offset: 10, sortOrder: 'asc' as any })).toEqual([
            'metahubs',
            'detail',
            'm1',
            'treeEntities',
            'detail',
            'h1',
            'objectCollections',
            'list',
            { limit: 100, offset: 10, sortBy: 'updated', sortOrder: 'asc', search: undefined }
        ])
        expect(metahubsQueryKeys.objectCollectionsList('m1', 'h1', { kindKey: ' object ' })).toEqual([
            'metahubs',
            'detail',
            'm1',
            'treeEntities',
            'detail',
            'h1',
            'objectCollections',
            { kindKey: 'object' },
            'list',
            {
                limit: 100,
                offset: 0,
                sortBy: 'updated',
                sortOrder: 'desc',
                search: undefined,
                kindKey: 'object'
            }
        ])

        expect(metahubsQueryKeys.allObjectCollections('m1')).toEqual(['metahubs', 'detail', 'm1', 'allObjectCollections'])
        expect(metahubsQueryKeys.allObjectCollectionsScope('m1', ' object ')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'allObjectCollections',
            { kindKey: 'object' }
        ])
        expect(metahubsQueryKeys.allObjectCollectionsList('m1', { search: 'Cat' })).toEqual([
            'metahubs',
            'detail',
            'm1',
            'allObjectCollections',
            'list',
            { limit: 100, offset: 0, sortBy: 'updated', sortOrder: 'desc', search: 'Cat' }
        ])
        expect(metahubsQueryKeys.allObjectCollectionsList('m1', { kindKey: ' object ' })).toEqual([
            'metahubs',
            'detail',
            'm1',
            'allObjectCollections',
            { kindKey: 'object' },
            'list',
            {
                limit: 100,
                offset: 0,
                sortBy: 'updated',
                sortOrder: 'desc',
                search: undefined,
                kindKey: 'object'
            }
        ])

        expect(metahubsQueryKeys.allValueGroupsScope('m1', ' set ')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'allValueGroups',
            { kindKey: 'set' }
        ])
        expect(metahubsQueryKeys.valueGroupsScope('m1', 'h1', ' set ')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'treeEntities',
            'detail',
            'h1',
            'valueGroups',
            { kindKey: 'set' }
        ])
        expect(metahubsQueryKeys.allValueGroupsList('m1', { kindKey: ' set ' })).toEqual([
            'metahubs',
            'detail',
            'm1',
            'allValueGroups',
            { kindKey: 'set' },
            'list',
            {
                limit: 100,
                offset: 0,
                sortBy: 'updated',
                sortOrder: 'desc',
                search: undefined,
                kindKey: 'set'
            }
        ])
        expect(metahubsQueryKeys.valueGroupsList('m1', 'h1', { kindKey: ' set ' })).toEqual([
            'metahubs',
            'detail',
            'm1',
            'treeEntities',
            'detail',
            'h1',
            'valueGroups',
            { kindKey: 'set' },
            'list',
            {
                limit: 100,
                offset: 0,
                sortBy: 'updated',
                sortOrder: 'desc',
                search: undefined,
                kindKey: 'set'
            }
        ])
        expect(metahubsQueryKeys.valueGroupDetail('m1', 'set-1', 'set')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'allValueGroups',
            { kindKey: 'set' },
            'detail',
            'set-1'
        ])
        expect(metahubsQueryKeys.fixedValuesDirect('m1', 'set-1', 'set')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'allValueGroups',
            { kindKey: 'set' },
            'detail',
            'set-1',
            'fixedValues'
        ])
        expect(metahubsQueryKeys.fixedValuesListDirect('m1', 'set-1', { kindKey: ' set ' })).toEqual([
            'metahubs',
            'detail',
            'm1',
            'allValueGroups',
            { kindKey: 'set' },
            'detail',
            'set-1',
            'fixedValues',
            'list',
            {
                limit: 100,
                offset: 0,
                sortBy: 'updated',
                sortOrder: 'desc',
                search: undefined,
                locale: undefined,
                includeShared: false,
                kindKey: 'set'
            }
        ])
        expect(metahubsQueryKeys.allFixedValueCodenames('m1', 'set-1', 'set')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'allValueGroups',
            { kindKey: 'set' },
            'detail',
            'set-1',
            'fixedValueCodenames'
        ])

        expect(metahubsQueryKeys.allOptionListsScope('m1', ' enumeration ')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'allOptionLists',
            { kindKey: 'enumeration' }
        ])
        expect(metahubsQueryKeys.optionListsScope('m1', 'h1', ' enumeration ')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'treeEntities',
            'detail',
            'h1',
            'optionLists',
            { kindKey: 'enumeration' }
        ])
        expect(metahubsQueryKeys.allOptionListsList('m1', { kindKey: ' enumeration ' })).toEqual([
            'metahubs',
            'detail',
            'm1',
            'allOptionLists',
            { kindKey: 'enumeration' },
            'list',
            {
                limit: 100,
                offset: 0,
                sortBy: 'updated',
                sortOrder: 'desc',
                search: undefined,
                kindKey: 'enumeration'
            }
        ])
        expect(metahubsQueryKeys.optionListsList('m1', 'h1', { kindKey: ' enumeration ' })).toEqual([
            'metahubs',
            'detail',
            'm1',
            'treeEntities',
            'detail',
            'h1',
            'optionLists',
            { kindKey: 'enumeration' },
            'list',
            {
                limit: 100,
                offset: 0,
                sortBy: 'updated',
                sortOrder: 'desc',
                search: undefined,
                kindKey: 'enumeration'
            }
        ])
        expect(metahubsQueryKeys.optionListDetail('m1', 'enum-1', 'enumeration')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'allOptionLists',
            { kindKey: 'enumeration' },
            'detail',
            'enum-1'
        ])
        expect(metahubsQueryKeys.optionValues('m1', 'enum-1', 'enumeration')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'allOptionLists',
            { kindKey: 'enumeration' },
            'detail',
            'enum-1',
            'optionValues'
        ])
        expect(metahubsQueryKeys.optionValuesList('m1', 'enum-1', { includeShared: true, kindKey: ' enumeration ' })).toEqual([
            'metahubs',
            'detail',
            'm1',
            'allOptionLists',
            { kindKey: 'enumeration' },
            'detail',
            'enum-1',
            'optionValues',
            'list',
            {
                includeShared: true,
                kindKey: 'enumeration'
            }
        ])

        expect(metahubsQueryKeys.objectCollectionDetail('m1', 'c1')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'allObjectCollections',
            'detail',
            'c1'
        ])
        expect(metahubsQueryKeys.objectCollectionDetail('m1', 'c1', 'object')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'allObjectCollections',
            { kindKey: 'object' },
            'detail',
            'c1'
        ])
        expect(metahubsQueryKeys.objectCollectionDetailInTreeEntity('m1', 'h1', 'c1')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'treeEntities',
            'detail',
            'h1',
            'objectCollections',
            'detail',
            'c1'
        ])
        expect(metahubsQueryKeys.objectCollectionDetailInTreeEntity('m1', 'h1', 'c1', 'object')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'treeEntities',
            'detail',
            'h1',
            'objectCollections',
            { kindKey: 'object' },
            'detail',
            'c1'
        ])

        expect(metahubsQueryKeys.components('m1', 'h1', 'c1')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'treeEntities',
            'detail',
            'h1',
            'objectCollections',
            'detail',
            'c1',
            'components'
        ])
        expect(metahubsQueryKeys.componentsList('m1', 'h1', 'c1')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'treeEntities',
            'detail',
            'h1',
            'objectCollections',
            'detail',
            'c1',
            'components',
            'list',
            {
                limit: 100,
                offset: 0,
                sortBy: 'updated',
                sortOrder: 'desc',
                search: undefined,
                locale: undefined,
                scope: undefined,
                includeShared: false
            }
        ])
        expect(metahubsQueryKeys.componentsList('m1', 'h1', 'c1', { scope: 'system', locale: 'ru' })).toEqual([
            'metahubs',
            'detail',
            'm1',
            'treeEntities',
            'detail',
            'h1',
            'objectCollections',
            'detail',
            'c1',
            'components',
            'list',
            {
                limit: 100,
                offset: 0,
                sortBy: 'updated',
                sortOrder: 'desc',
                search: undefined,
                locale: 'ru',
                scope: 'system',
                includeShared: false
            }
        ])
        expect(metahubsQueryKeys.componentsDirect('m1', 'c1')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'allObjectCollections',
            'detail',
            'c1',
            'components'
        ])
        expect(metahubsQueryKeys.componentsListDirect('m1', 'c1', { sortBy: 'created' as any })).toEqual([
            'metahubs',
            'detail',
            'm1',
            'allObjectCollections',
            'detail',
            'c1',
            'components',
            'list',
            {
                limit: 100,
                offset: 0,
                sortBy: 'created',
                sortOrder: 'desc',
                search: undefined,
                locale: undefined,
                scope: undefined,
                includeShared: false
            }
        ])
        expect(metahubsQueryKeys.componentsListDirect('m1', 'c1', { scope: 'system' })).toEqual([
            'metahubs',
            'detail',
            'm1',
            'allObjectCollections',
            'detail',
            'c1',
            'components',
            'list',
            {
                limit: 100,
                offset: 0,
                sortBy: 'updated',
                sortOrder: 'desc',
                search: undefined,
                locale: undefined,
                scope: 'system',
                includeShared: false
            }
        ])

        expect(metahubsQueryKeys.records('m1', 'h1', 'c1')).toEqual([
            'metahubs',
            'detail',
            'm1',
            'treeEntities',
            'detail',
            'h1',
            'objectCollections',
            'detail',
            'c1',
            'records'
        ])
        expect(metahubsQueryKeys.recordsList('m1', 'h1', 'c1', { limit: 5 })).toEqual([
            'metahubs',
            'detail',
            'm1',
            'treeEntities',
            'detail',
            'h1',
            'objectCollections',
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
            'allObjectCollections',
            'detail',
            'c1',
            'records'
        ])
        expect(metahubsQueryKeys.recordsListDirect('m1', 'c1', { offset: 5, search: '  rec  ' })).toEqual([
            'metahubs',
            'detail',
            'm1',
            'allObjectCollections',
            'detail',
            'c1',
            'records',
            'list',
            { limit: 100, offset: 5, sortBy: 'updated', sortOrder: 'desc', search: 'rec' }
        ])

        expect(metahubsQueryKeys.publications('m1')).toEqual(['metahubs', 'detail', 'm1', 'publications'])
        expect(metahubsQueryKeys.publicationsList('m1')).toEqual(['metahubs', 'detail', 'm1', 'publications', 'list'])
        expect(metahubsQueryKeys.publicationDetail('m1', 'p1')).toEqual(['metahubs', 'detail', 'm1', 'publications', 'detail', 'p1'])
        expect(metahubsQueryKeys.publicationDiff('m1', 'p1')).toEqual(['metahubs', 'detail', 'm1', 'publications', 'detail', 'p1', 'diff'])
    })

    it('calls invalidateQueries with expected queryKey', async () => {
        const queryClient = new QueryClient()
        const spy = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined as any)

        await invalidateMetahubsQueries.all(queryClient)
        await invalidateMetahubsQueries.lists(queryClient)
        await invalidateMetahubsQueries.detail(queryClient, 'm1')

        await invalidateMetahubMembers(queryClient, 'm1')

        await invalidateEntityTypesQueries.all(queryClient, 'm1')
        await invalidateEntityTypesQueries.lists(queryClient, 'm1', false)
        await invalidateEntityTypesQueries.detail(queryClient, 'm1', 'et1')

        await invalidateEntitiesQueries.all(queryClient, 'm1', 'custom.product')
        await invalidateEntitiesQueries.lists(queryClient, 'm1', 'custom.product')
        await invalidateEntitiesQueries.detail(queryClient, 'm1', 'e1')

        await invalidateTreeEntitiesQueries.all(queryClient, 'm1')
        await invalidateTreeEntitiesQueries.lists(queryClient, 'm1')
        await invalidateTreeEntitiesQueries.detail(queryClient, 'm1', 'h1')

        await invalidateObjectCollectionsQueries.all(queryClient, 'm1', 'h1')
        await invalidateObjectCollectionsQueries.lists(queryClient, 'm1', 'h1')
        await invalidateObjectCollectionsQueries.detail(queryClient, 'm1', 'c1', 'h1')

        await invalidateValueGroupsQueries.all(queryClient, 'm1')
        await invalidateValueGroupsQueries.lists(queryClient, 'm1')
        await invalidateValueGroupsQueries.detail(queryClient, 'm1', 'set-1')
        await invalidateValueGroupsQueries.blockingReferences(queryClient, 'm1', 'set-1')

        await invalidateOptionListsQueries.all(queryClient, 'm1')
        await invalidateOptionListsQueries.lists(queryClient, 'm1')
        await invalidateOptionListsQueries.detail(queryClient, 'm1', 'enum-1')

        await invalidateComponentsQueries.all(queryClient, 'm1', 'h1', 'c1')
        await invalidateComponentsQueries.lists(queryClient, 'm1', 'h1', 'c1')

        await invalidateRecordsQueries.all(queryClient, 'm1', 'h1', 'c1')
        await invalidateRecordsQueries.lists(queryClient, 'm1', 'h1', 'c1')

        await invalidatePublicationsQueries.all(queryClient, 'm1')
        await invalidatePublicationsQueries.lists(queryClient, 'm1')
        await invalidatePublicationsQueries.detail(queryClient, 'm1', 'p1')

        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.all })
        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.lists() })
        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.detail('m1') })

        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.members('m1') })

        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.entityTypes('m1') })
        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.entityTypesList('m1') })
        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.entityTypeDetail('m1', 'et1') })

        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.entities('m1', 'custom.product') })
        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.entitiesList('m1', { kind: 'custom.product' }) })
        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.entityDetail('m1', 'e1') })

        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.treeEntities('m1') })
        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.treeEntitiesList('m1') })
        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.treeEntityDetail('m1', 'h1') })

        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.objectCollections('m1', 'h1') })
        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.objectCollectionsList('m1', 'h1') })
        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.objectCollectionDetailInTreeEntity('m1', 'h1', 'c1') })

        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.allValueGroups('m1') })
        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.allValueGroupsList('m1') })
        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.valueGroupDetail('m1', 'set-1') })
        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.blockingValueGroupReferences('m1', 'set-1') })

        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.allOptionLists('m1') })
        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.allOptionListsList('m1') })
        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.optionListDetail('m1', 'enum-1') })

        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.components('m1', 'h1', 'c1') })
        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.componentsList('m1', 'h1', 'c1') })

        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.records('m1', 'h1', 'c1') })
        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.recordsList('m1', 'h1', 'c1') })

        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.publications('m1') })
        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.publicationsList('m1') })
        expect(spy).toHaveBeenCalledWith({ queryKey: metahubsQueryKeys.publicationDetail('m1', 'p1') })
    })
})
