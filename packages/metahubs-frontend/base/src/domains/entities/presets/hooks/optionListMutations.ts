import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import {
    applyOptimisticCreate,
    applyOptimisticUpdate,
    applyOptimisticDelete,
    rollbackOptimisticSnapshots,
    generateOptimisticId,
    getNextOptimisticSortOrderFromQueries,
    safeInvalidateQueriesInactive,
    safeInvalidateQueries,
    confirmOptimisticUpdate,
    confirmOptimisticCreate
} from '@universo/template-mui'
import { makePendingMarkers } from '@universo/utils'
import {
    applyOptimisticCreateToQueryKeyPrefixes,
    applyMergedSharedEntityOrder,
    applyOptimisticReorder,
    collectMetahubCopyQueryKeyPrefixes,
    confirmOptimisticCreateInQueryKeyPrefixes,
    invalidateOptionValuesQueries,
    metahubsQueryKeys,
    rollbackReorderSnapshots
} from '../../../shared'
import * as enumerationsApi from '../api/optionLists'
import type {
    CreateOptionListParams,
    CreateOptionListAtMetahubParams,
    UpdateOptionListParams,
    UpdateOptionListAtMetahubParams,
    DeleteOptionListParams,
    CopyOptionListParams,
    ReorderOptionListParams,
    CreateOptionValueParams,
    UpdateOptionValueParams,
    DeleteOptionValueParams,
    MoveOptionValueParams,
    CopyOptionValueParams,
    ReorderOptionValueParams
} from './enumerationMutationTypes'

const getEnumerationValueQueryKeyPrefix = (metahubId: string, optionListId: string, kindKey?: string | null) =>
    metahubsQueryKeys.optionValues(metahubId, optionListId, kindKey)

export function useCreateOptionListAtMetahub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        retry: false,
        mutationKey: ['optionLists', 'create'],
        mutationFn: async ({ metahubId, kindKey, data }: CreateOptionListAtMetahubParams) => {
            const response = await enumerationsApi.createOptionListAtMetahub(metahubId, kindKey ? { ...data, kindKey } : data)
            return response.data
        },
        onMutate: async ({ metahubId, kindKey, data }) => {
            const optimisticId = generateOptimisticId()
            const queryKeyPrefix = metahubsQueryKeys.allOptionListsScope(metahubId, kindKey)
            const optimisticSortOrder = data.sortOrder ?? getNextOptimisticSortOrderFromQueries(queryClient, queryKeyPrefix)
            const optimisticEntity = {
                id: optimisticId,
                codename: data.codename || '',
                name: data.name,
                description: data.description,
                sortOrder: optimisticSortOrder,
                valuesCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                ...makePendingMarkers('create')
            }

            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity,
                insertPosition: 'prepend'
            })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('enumerations.createError', 'Failed to create enumeration'), { variant: 'error' })
        },
        onSuccess: (data, variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(
                    queryClient,
                    metahubsQueryKeys.allOptionListsScope(variables.metahubId, variables.kindKey),
                    context.optimisticId,
                    data.id,
                    {
                        serverEntity: data
                    }
                )
            }
            enqueueSnackbar(t('enumerations.createSuccess', 'Enumeration created'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['optionLists'] }) <= 1) {
                safeInvalidateQueries(
                    queryClient,
                    ['optionLists'],
                    metahubsQueryKeys.allOptionLists(variables.metahubId),
                    ...(variables.data.treeEntityIds ?? []).map((treeEntityId) =>
                        metahubsQueryKeys.optionLists(variables.metahubId, treeEntityId)
                    )
                )
            }
        }
    })
}

export function useCreateOptionList() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        retry: false,
        mutationKey: ['optionLists', 'create'],
        mutationFn: async ({ metahubId, treeEntityId, kindKey, data }: CreateOptionListParams) => {
            const response = await enumerationsApi.createOptionList(metahubId, treeEntityId, kindKey ? { ...data, kindKey } : data)
            return response.data
        },
        onMutate: async ({ metahubId, treeEntityId, kindKey, data }) => {
            const optimisticId = generateOptimisticId()
            const queryKeyPrefix = metahubsQueryKeys.optionListsScope(metahubId, treeEntityId, kindKey)
            const optimisticSortOrder = data.sortOrder ?? getNextOptimisticSortOrderFromQueries(queryClient, queryKeyPrefix)
            const optimisticEntity = {
                id: optimisticId,
                codename: data.codename || '',
                name: data.name,
                description: data.description,
                sortOrder: optimisticSortOrder,
                valuesCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                ...makePendingMarkers('create')
            }

            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity,
                insertPosition: 'prepend'
            })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('enumerations.createError', 'Failed to create enumeration'), { variant: 'error' })
        },
        onSuccess: (data, variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(
                    queryClient,
                    metahubsQueryKeys.optionListsScope(variables.metahubId, variables.treeEntityId, variables.kindKey),
                    context.optimisticId,
                    data.id,
                    { serverEntity: data }
                )
            }
            enqueueSnackbar(t('enumerations.createSuccess', 'Enumeration created'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueries(
                queryClient,
                ['optionLists'],
                metahubsQueryKeys.optionLists(variables.metahubId, variables.treeEntityId),
                metahubsQueryKeys.allOptionLists(variables.metahubId)
            )
        }
    })
}

export function useUpdateOptionList() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['optionLists', 'update'],
        mutationFn: async ({ metahubId, treeEntityId, optionListId, kindKey, data }: UpdateOptionListParams) => {
            const response = await enumerationsApi.updateOptionList(metahubId, treeEntityId, optionListId, data, kindKey)
            return response.data
        },
        onMutate: async ({ metahubId, treeEntityId, optionListId, kindKey, data }) => {
            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.optionListsScope(metahubId, treeEntityId, kindKey),
                entityId: optionListId,
                updater: { ...data, updatedAt: new Date().toISOString() },
                moveToFront: true
            })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('enumerations.updateError', 'Failed to update enumeration'), { variant: 'error' })
        },
        onSuccess: async (data, variables) => {
            await queryClient.cancelQueries({
                queryKey: metahubsQueryKeys.optionListsScope(variables.metahubId, variables.treeEntityId, variables.kindKey)
            })
            confirmOptimisticUpdate(
                queryClient,
                metahubsQueryKeys.optionListsScope(variables.metahubId, variables.treeEntityId, variables.kindKey),
                variables.optionListId,
                { serverEntity: data ?? null, moveToFront: true }
            )
            enqueueSnackbar(t('enumerations.updateSuccess', 'Enumeration updated'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(
                queryClient,
                ['optionLists'],
                metahubsQueryKeys.optionLists(variables.metahubId, variables.treeEntityId),
                metahubsQueryKeys.allOptionLists(variables.metahubId),
                metahubsQueryKeys.treeEntities(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
        }
    })
}

export function useUpdateOptionListAtMetahub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['optionLists', 'update'],
        mutationFn: async ({ metahubId, optionListId, kindKey, data }: UpdateOptionListAtMetahubParams) => {
            const response = await enumerationsApi.updateOptionListAtMetahub(metahubId, optionListId, data, kindKey)
            return response.data
        },
        onMutate: async ({ metahubId, optionListId, kindKey, data }) => {
            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.allOptionListsScope(metahubId, kindKey),
                entityId: optionListId,
                updater: { ...data, updatedAt: new Date().toISOString() },
                moveToFront: true
            })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('enumerations.updateError', 'Failed to update enumeration'), { variant: 'error' })
        },
        onSuccess: async (data, variables) => {
            await queryClient.cancelQueries({ queryKey: metahubsQueryKeys.allOptionListsScope(variables.metahubId, variables.kindKey) })
            confirmOptimisticUpdate(
                queryClient,
                metahubsQueryKeys.allOptionListsScope(variables.metahubId, variables.kindKey),
                variables.optionListId,
                {
                    serverEntity: data ?? null,
                    moveToFront: true
                }
            )
            enqueueSnackbar(t('enumerations.updateSuccess', 'Enumeration updated'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(
                queryClient,
                ['optionLists'],
                metahubsQueryKeys.allOptionLists(variables.metahubId),
                metahubsQueryKeys.treeEntities(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
        }
    })
}

export function useDeleteOptionList() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['optionLists', 'delete'],
        mutationFn: async ({ metahubId, treeEntityId, optionListId, force, kindKey }: DeleteOptionListParams) => {
            if (treeEntityId) {
                await enumerationsApi.deleteOptionList(metahubId, treeEntityId, optionListId, force, kindKey)
            } else {
                await enumerationsApi.deleteOptionListDirect(metahubId, optionListId, kindKey)
            }
        },
        onMutate: async ({ metahubId, treeEntityId, optionListId, kindKey }) => {
            const queryKeyPrefix = treeEntityId
                ? metahubsQueryKeys.optionListsScope(metahubId, treeEntityId, kindKey)
                : metahubsQueryKeys.allOptionListsScope(metahubId, kindKey)
            return applyOptimisticDelete({
                queryClient,
                queryKeyPrefix,
                entityId: optionListId,
                strategy: 'remove'
            })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('enumerations.deleteError', 'Failed to delete enumeration'), { variant: 'error' })
        },
        onSuccess: () => {
            enqueueSnackbar(t('enumerations.deleteSuccess', 'Enumeration deleted'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueries(
                queryClient,
                ['optionLists'],
                metahubsQueryKeys.allOptionLists(variables.metahubId),
                metahubsQueryKeys.treeEntities(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
            if (variables.treeEntityId) {
                safeInvalidateQueries(
                    queryClient,
                    ['optionLists'],
                    metahubsQueryKeys.optionLists(variables.metahubId, variables.treeEntityId)
                )
            }
        }
    })
}

export function useCopyOptionList() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['optionLists', 'copy'],
        mutationFn: async ({ metahubId, optionListId, kindKey, data }: CopyOptionListParams) => {
            const response = await enumerationsApi.copyOptionList(metahubId, optionListId, data, kindKey)
            return response.data
        },
        onMutate: async ({ metahubId, optionListId, kindKey, data }) => {
            const optimisticId = generateOptimisticId()
            const broadQueryKeyPrefix = metahubsQueryKeys.allOptionListsScope(metahubId, kindKey)
            const existingOptionList = queryClient
                .getQueriesData<{ items?: Array<Record<string, unknown>> }>({ queryKey: ['metahubs'] })
                .flatMap(([, value]) => (Array.isArray(value?.items) ? value.items : []))
                .find((item) => item.id === optionListId)
            const queryKeyPrefixes = collectMetahubCopyQueryKeyPrefixes({
                queryClient,
                metahubId,
                entityId: optionListId,
                entitySegment: 'optionLists',
                broadQueryKeyPrefix,
                scopedQueryKeyPrefixFactory: (treeEntityId) => metahubsQueryKeys.optionListsScope(metahubId, treeEntityId, kindKey),
                knownTreeEntityIds: Array.isArray(existingOptionList?.treeEntities)
                    ? existingOptionList.treeEntities
                          .map((hub) => (typeof hub?.id === 'string' ? hub.id : null))
                          .filter((treeEntityId): treeEntityId is string => Boolean(treeEntityId))
                    : []
            })
            const optimisticSortOrder = getNextOptimisticSortOrderFromQueries(queryClient, broadQueryKeyPrefix)
            const optimisticEntity = {
                ...(existingOptionList ?? {}),
                id: optimisticId,
                codename: data.codename ?? '',
                name: data.name || existingOptionList?.name || {},
                description: data.description ?? existingOptionList?.description,
                sortOrder: optimisticSortOrder,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                ...makePendingMarkers('copy')
            }

            const context = await applyOptimisticCreateToQueryKeyPrefixes({
                queryClient,
                queryKeyPrefixes,
                optimisticEntity,
                insertPosition: 'prepend'
            })

            return {
                ...context,
                queryKeyPrefixes
            }
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('enumerations.copyError', 'Failed to copy enumeration'), { variant: 'error' })
        },
        onSuccess: (data, variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreateInQueryKeyPrefixes(
                    queryClient,
                    context.queryKeyPrefixes ?? [metahubsQueryKeys.allOptionListsScope(variables.metahubId, variables.kindKey)],
                    context.optimisticId,
                    data.id,
                    { serverEntity: data }
                )
            }
            enqueueSnackbar(t('enumerations.copySuccess', 'Enumeration copied'), { variant: 'success' })
        },
        onSettled: async (copiedOptionList, _error, variables) => {
            safeInvalidateQueries(
                queryClient,
                ['optionLists'],
                metahubsQueryKeys.allOptionLists(variables.metahubId),
                metahubsQueryKeys.treeEntities(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
            if (copiedOptionList && Array.isArray(copiedOptionList.treeEntities)) {
                for (const hub of copiedOptionList.treeEntities as Array<{ id: string }>) {
                    safeInvalidateQueriesInactive(queryClient, ['optionLists'], metahubsQueryKeys.optionLists(variables.metahubId, hub.id))
                }
            }
        }
    })
}

export function useReorderOptionList() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationKey: ['optionLists', 'reorder'],
        mutationFn: async ({ metahubId, treeEntityId, optionListId, kindKey, newSortOrder }: ReorderOptionListParams) => {
            const response = await enumerationsApi.reorderOptionList(metahubId, optionListId, newSortOrder, treeEntityId, kindKey)
            return response.data
        },
        onMutate: async (variables) => {
            const listSnapshots =
                variables.treeEntityId != null
                    ? await applyOptimisticReorder(
                          queryClient,
                          metahubsQueryKeys.optionListsScope(variables.metahubId, variables.treeEntityId, variables.kindKey),
                          variables.optionListId,
                          variables.newSortOrder
                      )
                    : await applyOptimisticReorder(
                          queryClient,
                          metahubsQueryKeys.allOptionListsScope(variables.metahubId, variables.kindKey),
                          variables.optionListId,
                          variables.newSortOrder
                      )

            const globalSnapshots =
                variables.treeEntityId != null
                    ? await applyOptimisticReorder(
                          queryClient,
                          metahubsQueryKeys.allOptionListsScope(variables.metahubId, variables.kindKey),
                          variables.optionListId,
                          variables.newSortOrder
                      )
                    : []

            return { listSnapshots, globalSnapshots }
        },
        onError: (_error, _variables, context) => {
            rollbackReorderSnapshots(queryClient, context?.listSnapshots)
            rollbackReorderSnapshots(queryClient, context?.globalSnapshots)
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(
                queryClient,
                ['optionLists'],
                metahubsQueryKeys.allOptionLists(variables.metahubId),
                metahubsQueryKeys.treeEntities(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
            if (variables.treeEntityId) {
                safeInvalidateQueriesInactive(
                    queryClient,
                    ['optionLists'],
                    metahubsQueryKeys.optionLists(variables.metahubId, variables.treeEntityId)
                )
            }
        }
    })
}

export function useCreateOptionValue() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['optionValues', 'create'],
        mutationFn: async ({ metahubId, optionListId, kindKey, data }: CreateOptionValueParams) => {
            const response = await enumerationsApi.createOptionValue(metahubId, optionListId, data, kindKey)
            return response.data
        },
        onMutate: async ({ metahubId, optionListId, kindKey, data }) => {
            const queryKeyPrefix = getEnumerationValueQueryKeyPrefix(metahubId, optionListId, kindKey)
            const optimisticSortOrder = data.sortOrder ?? getNextOptimisticSortOrderFromQueries(queryClient, queryKeyPrefix)

            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity: {
                    id: generateOptimisticId(),
                    objectId: optionListId,
                    codename: data.codename || '',
                    name: data.name,
                    description: data.description,
                    sortOrder: optimisticSortOrder,
                    isDefault: data.isDefault ?? false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    version: 1,
                    ...makePendingMarkers('create')
                },
                insertPosition: 'prepend'
            })
        },
        onSuccess: (data, variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(
                    queryClient,
                    getEnumerationValueQueryKeyPrefix(variables.metahubId, variables.optionListId, variables.kindKey),
                    context.optimisticId,
                    data.id,
                    { serverEntity: data }
                )
            }
            enqueueSnackbar(t('optionValues.createSuccess', 'Enumeration value created'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('optionValues.createError', 'Failed to create option value'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['optionValues'] }) <= 1) {
                invalidateOptionValuesQueries.all(queryClient, variables.metahubId, variables.optionListId, variables.kindKey)
            }
        }
    })
}

export function useUpdateOptionValue() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['optionValues', 'update'],
        mutationFn: async ({ metahubId, optionListId, valueId, kindKey, data }: UpdateOptionValueParams) => {
            const response = await enumerationsApi.updateOptionValue(metahubId, optionListId, valueId, data, kindKey)
            return response.data
        },
        onMutate: async ({ metahubId, optionListId, valueId, kindKey, data }) => {
            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: getEnumerationValueQueryKeyPrefix(metahubId, optionListId, kindKey),
                entityId: valueId,
                updater: {
                    ...data,
                    updatedAt: new Date().toISOString()
                },
                moveToFront: true
            })
        },
        onSuccess: (data, variables) => {
            confirmOptimisticUpdate(
                queryClient,
                getEnumerationValueQueryKeyPrefix(variables.metahubId, variables.optionListId, variables.kindKey),
                variables.valueId,
                { serverEntity: data ?? null }
            )
            enqueueSnackbar(t('optionValues.updateSuccess', 'Enumeration value updated'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('optionValues.updateError', 'Failed to update option value'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['optionValues'] }) <= 1) {
                invalidateOptionValuesQueries.all(queryClient, variables.metahubId, variables.optionListId, variables.kindKey)
            }
        }
    })
}

export function useDeleteOptionValue() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['optionValues', 'delete'],
        mutationFn: async ({ metahubId, optionListId, valueId, kindKey }: DeleteOptionValueParams) => {
            await enumerationsApi.deleteOptionValue(metahubId, optionListId, valueId, kindKey)
        },
        onMutate: async ({ metahubId, optionListId, valueId, kindKey }) => {
            return applyOptimisticDelete({
                queryClient,
                queryKeyPrefix: getEnumerationValueQueryKeyPrefix(metahubId, optionListId, kindKey),
                entityId: valueId,
                strategy: 'remove'
            })
        },
        onSuccess: () => {
            enqueueSnackbar(t('optionValues.deleteSuccess', 'Enumeration value deleted'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('optionValues.deleteError', 'Failed to delete option value'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['optionValues'] }) <= 1) {
                invalidateOptionValuesQueries.all(queryClient, variables.metahubId, variables.optionListId, variables.kindKey)
            }
        }
    })
}

export function useMoveOptionValue() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['optionValues', 'move'],
        mutationFn: async ({ metahubId, optionListId, valueId, kindKey, direction }: MoveOptionValueParams) => {
            const response = await enumerationsApi.moveOptionValue(metahubId, optionListId, valueId, direction, kindKey)
            return response.data
        },
        onSuccess: () => {
            enqueueSnackbar(t('optionValues.moveSuccess', 'Value order updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('optionValues.moveError', 'Failed to move value'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['optionValues'] }) <= 1) {
                invalidateOptionValuesQueries.all(queryClient, variables.metahubId, variables.optionListId, variables.kindKey)
            }
        }
    })
}

/**
 * Reorder an option value via DnD to a new sort_order position.
 * Includes optimistic updates for instant visual feedback.
 */
export function useReorderOptionValue() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationKey: ['optionValues', 'reorder'],
        mutationFn: async ({ metahubId, optionListId, valueId, kindKey, newSortOrder, mergedOrderIds }: ReorderOptionValueParams) => {
            const response = await enumerationsApi.reorderOptionValue(
                metahubId,
                optionListId,
                valueId,
                newSortOrder,
                mergedOrderIds,
                kindKey
            )
            return response.data
        },
        onMutate: async (variables) => {
            const baseKey = metahubsQueryKeys.optionValues(variables.metahubId, variables.optionListId, variables.kindKey)

            // Cancel in-flight queries
            await queryClient.cancelQueries({ queryKey: baseKey })

            // Snapshot for rollback
            const previousQueries = queryClient.getQueriesData<Record<string, unknown>>({ queryKey: baseKey })

            // Optimistically reorder items
            queryClient.setQueriesData<Record<string, unknown>>({ queryKey: baseKey }, (old) => {
                if (!old || !Array.isArray((old as Record<string, unknown> & { items?: unknown[] }).items)) return old
                const items = [...(old as Record<string, unknown> & { items: Record<string, unknown>[] }).items]

                if (Array.isArray(variables.mergedOrderIds) && variables.mergedOrderIds.length > 0) {
                    return {
                        ...old,
                        items: applyMergedSharedEntityOrder(items, variables.mergedOrderIds).map((item, idx) => ({
                            ...item,
                            sortOrder: idx + 1,
                            effectiveSortOrder: idx + 1
                        }))
                    }
                }

                const fromIndex = items.findIndex((i) => (i as Record<string, unknown>).id === variables.valueId)
                if (fromIndex === -1) return old

                let toIndex = items.findIndex((i) => ((i as Record<string, unknown>).sortOrder ?? 0) === variables.newSortOrder)
                if (toIndex === -1) toIndex = items.length - 1

                const [moved] = items.splice(fromIndex, 1)
                items.splice(toIndex, 0, moved)
                const updated = items.map((item, idx) => ({ ...item, sortOrder: idx + 1 }))
                return { ...old, items: updated }
            })

            return { previousQueries, baseKey }
        },
        onError: (_error, _variables, context) => {
            // Rollback optimistic update
            if (context?.previousQueries) {
                for (const [key, data] of context.previousQueries) {
                    queryClient.setQueryData(key, data)
                }
            }
        },
        onSettled: (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['optionValues'] }) <= 1) {
                invalidateOptionValuesQueries.all(queryClient, variables.metahubId, variables.optionListId, variables.kindKey)
            }
        }
    })
}

export function useCopyOptionValue() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['optionValues', 'copy'],
        mutationFn: async ({ metahubId, optionListId, valueId, kindKey, data }: CopyOptionValueParams) => {
            const response = await enumerationsApi.copyOptionValue(metahubId, optionListId, valueId, data, kindKey)
            return response.data
        },
        onMutate: async ({ metahubId, optionListId, valueId, kindKey, data }) => {
            const queryKeyPrefix = getEnumerationValueQueryKeyPrefix(metahubId, optionListId, kindKey)
            const optimisticSortOrder = getNextOptimisticSortOrderFromQueries(queryClient, queryKeyPrefix)
            const existingValue = queryClient
                .getQueriesData<{ items?: Array<Record<string, unknown>> }>({ queryKey: queryKeyPrefix })
                .flatMap(([, value]) => (Array.isArray(value?.items) ? value.items : []))
                .find((item) => item.id === valueId)

            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity: {
                    ...(existingValue ?? {}),
                    id: generateOptimisticId(),
                    objectId: optionListId,
                    codename: data?.codename || (typeof existingValue?.codename === 'string' ? existingValue.codename : ''),
                    name: data?.name || existingValue?.name || {},
                    description: data?.description ?? existingValue?.description,
                    sortOrder: optimisticSortOrder,
                    isDefault: data?.isDefault ?? (typeof existingValue?.isDefault === 'boolean' ? existingValue.isDefault : false),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    version: 1,
                    ...makePendingMarkers('copy')
                },
                insertPosition: 'prepend'
            })
        },
        onSuccess: (data, variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(
                    queryClient,
                    getEnumerationValueQueryKeyPrefix(variables.metahubId, variables.optionListId, variables.kindKey),
                    context.optimisticId,
                    data.id,
                    { serverEntity: data }
                )
            }
            enqueueSnackbar(t('optionValues.copySuccess', 'Enumeration value copied'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('optionValues.copyError', 'Failed to copy option value'), {
                variant: 'error'
            })
        },
        onSettled: (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['optionValues'] }) <= 1) {
                invalidateOptionValuesQueries.all(queryClient, variables.metahubId, variables.optionListId, variables.kindKey)
            }
        }
    })
}
