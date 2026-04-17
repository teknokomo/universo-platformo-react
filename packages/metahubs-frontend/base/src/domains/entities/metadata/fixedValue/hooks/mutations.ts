import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import {
    applyOptimisticCreate,
    applyOptimisticDelete,
    applyOptimisticUpdate,
    generateOptimisticId,
    getNextOptimisticSortOrderFromQueries,
    rollbackOptimisticSnapshots,
    safeInvalidateQueries,
    confirmOptimisticUpdate,
    confirmOptimisticCreate
} from '@universo/template-mui'
import { makePendingMarkers } from '@universo/utils'
import { applyMergedSharedEntityOrder, metahubsQueryKeys } from '../../../../shared'
import * as fixedValuesApi from '../api'
import type {
    BaseConstantScope,
    CreateFixedValueParams,
    UpdateFixedValueParams,
    DeleteFixedValueParams,
    MoveFixedValueParams,
    CopyFixedValueParams,
    ReorderFixedValueParams
} from './mutationTypes'

const invalidateSetConstantScopes = async (queryClient: ReturnType<typeof useQueryClient>, variables: BaseConstantScope): Promise<void> => {
    if (variables.treeEntityId) {
        await safeInvalidateQueries(
            queryClient,
            ['fixedValues'],
            metahubsQueryKeys.fixedValues(variables.metahubId, variables.treeEntityId, variables.valueGroupId, variables.kindKey),
            metahubsQueryKeys.fixedValuesDirect(variables.metahubId, variables.valueGroupId, variables.kindKey)
        )
        await queryClient.invalidateQueries({
            queryKey: metahubsQueryKeys.valueGroups(variables.metahubId, variables.treeEntityId),
            refetchType: 'inactive'
        })
    } else {
        await safeInvalidateQueries(
            queryClient,
            ['fixedValues'],
            metahubsQueryKeys.fixedValuesDirect(variables.metahubId, variables.valueGroupId, variables.kindKey)
        )
    }

    await queryClient.invalidateQueries({
        queryKey: metahubsQueryKeys.valueGroupDetail(variables.metahubId, variables.valueGroupId, variables.kindKey)
    })
    await queryClient.invalidateQueries({
        queryKey: metahubsQueryKeys.allValueGroups(variables.metahubId, variables.kindKey),
        refetchType: 'inactive'
    })
    await queryClient.invalidateQueries({
        queryKey: metahubsQueryKeys.allFixedValueCodenames(variables.metahubId, variables.valueGroupId, variables.kindKey),
        refetchType: 'inactive'
    })
}

const getConstantQueryKeyPrefix = (variables: BaseConstantScope) =>
    variables.treeEntityId
        ? metahubsQueryKeys.fixedValues(variables.metahubId, variables.treeEntityId, variables.valueGroupId, variables.kindKey)
        : metahubsQueryKeys.fixedValuesDirect(variables.metahubId, variables.valueGroupId, variables.kindKey)

export function useCreateFixedValue() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['fixedValues', 'create'],
        mutationFn: async ({ metahubId, treeEntityId, valueGroupId, kindKey, data }: CreateFixedValueParams) => {
            if (treeEntityId) {
                const response = await fixedValuesApi.createFixedValue(metahubId, treeEntityId, valueGroupId, data)
                return response.data
            }
            const response = await fixedValuesApi.createFixedValueDirect(metahubId, valueGroupId, data, kindKey)
            return response.data
        },
        onMutate: async (variables) => {
            const queryKeyPrefix = getConstantQueryKeyPrefix(variables)
            const optimisticSortOrder = getNextOptimisticSortOrderFromQueries(queryClient, queryKeyPrefix)
            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity: {
                    id: generateOptimisticId(),
                    valueGroupId: variables.valueGroupId,
                    codename: variables.data.codename || '',
                    dataType: variables.data.dataType,
                    name: variables.data.name,
                    validationRules: variables.data.validationRules ?? {},
                    uiConfig: variables.data.uiConfig ?? {},
                    value: variables.data.value,
                    sortOrder: optimisticSortOrder,
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
                confirmOptimisticCreate(queryClient, getConstantQueryKeyPrefix(variables), context.optimisticId, data.id, {
                    serverEntity: data
                })
            }
            enqueueSnackbar(t('fixedValues.createSuccess', 'Fixed value created'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('fixedValues.createError', 'Failed to create constant'), { variant: 'error' })
        },
        onSettled: async (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['fixedValues'] }) <= 1) {
                await invalidateSetConstantScopes(queryClient, variables)
            }
        }
    })
}

export function useUpdateFixedValue() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['fixedValues', 'update'],
        mutationFn: async ({ metahubId, treeEntityId, valueGroupId, kindKey, fixedValueId, data }: UpdateFixedValueParams) => {
            if (treeEntityId) {
                const response = await fixedValuesApi.updateFixedValue(metahubId, treeEntityId, valueGroupId, fixedValueId, data)
                return response.data
            }
            const response = await fixedValuesApi.updateFixedValueDirect(metahubId, valueGroupId, fixedValueId, data, kindKey)
            return response.data
        },
        onMutate: async (variables) => {
            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: getConstantQueryKeyPrefix(variables),
                entityId: variables.fixedValueId,
                updater: {
                    ...variables.data,
                    updatedAt: new Date().toISOString()
                },
                moveToFront: true
            })
        },
        onSuccess: (data, variables) => {
            confirmOptimisticUpdate(queryClient, getConstantQueryKeyPrefix(variables), variables.fixedValueId, {
                serverEntity: data ?? null
            })
            enqueueSnackbar(t('fixedValues.updateSuccess', 'Fixed value updated'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('fixedValues.updateError', 'Failed to update constant'), { variant: 'error' })
        },
        onSettled: async (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['fixedValues'] }) <= 1) {
                await invalidateSetConstantScopes(queryClient, variables)
            }
        }
    })
}

export function useDeleteFixedValue() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['fixedValues', 'delete'],
        mutationFn: async ({ metahubId, treeEntityId, valueGroupId, kindKey, fixedValueId }: DeleteFixedValueParams) => {
            if (treeEntityId) {
                await fixedValuesApi.deleteFixedValue(metahubId, treeEntityId, valueGroupId, fixedValueId)
            } else {
                await fixedValuesApi.deleteFixedValueDirect(metahubId, valueGroupId, fixedValueId, kindKey)
            }
        },
        onMutate: async (variables) => {
            return applyOptimisticDelete({
                queryClient,
                queryKeyPrefix: getConstantQueryKeyPrefix(variables),
                entityId: variables.fixedValueId,
                strategy: 'remove'
            })
        },
        onSuccess: () => {
            enqueueSnackbar(t('fixedValues.deleteSuccess', 'Fixed value deleted'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('fixedValues.deleteError', 'Failed to delete constant'), { variant: 'error' })
        },
        onSettled: async (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['fixedValues'] }) <= 1) {
                await invalidateSetConstantScopes(queryClient, variables)
            }
        }
    })
}

export function useMoveFixedValue() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['fixedValues', 'move'],
        mutationFn: async ({ metahubId, treeEntityId, valueGroupId, kindKey, fixedValueId, direction }: MoveFixedValueParams) => {
            if (treeEntityId) {
                const response = await fixedValuesApi.moveFixedValue(metahubId, treeEntityId, valueGroupId, fixedValueId, direction)
                return response.data
            }
            const response = await fixedValuesApi.moveFixedValueDirect(metahubId, valueGroupId, fixedValueId, direction, kindKey)
            return response.data
        },
        onSuccess: () => {
            enqueueSnackbar(t('fixedValues.moveSuccess', 'Fixed value order updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('fixedValues.moveError', 'Failed to update constant order'), { variant: 'error' })
        },
        onSettled: async (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['fixedValues'] }) <= 1) {
                await invalidateSetConstantScopes(queryClient, variables)
            }
        }
    })
}

export function useReorderFixedValue() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationKey: ['fixedValues', 'reorder'],
        mutationFn: async ({
            metahubId,
            treeEntityId,
            valueGroupId,
            kindKey,
            fixedValueId,
            newSortOrder,
            mergedOrderIds
        }: ReorderFixedValueParams) => {
            if (treeEntityId) {
                const response = await fixedValuesApi.reorderFixedValue(
                    metahubId,
                    treeEntityId,
                    valueGroupId,
                    fixedValueId,
                    newSortOrder,
                    mergedOrderIds
                )
                return response.data
            }
            const response = await fixedValuesApi.reorderFixedValueDirect(
                metahubId,
                valueGroupId,
                fixedValueId,
                newSortOrder,
                mergedOrderIds,
                kindKey
            )
            return response.data
        },
        onMutate: async (variables) => {
            const listKey = getConstantQueryKeyPrefix(variables)

            await queryClient.cancelQueries({ queryKey: listKey })
            const previousQueries = queryClient.getQueriesData<Record<string, unknown>>({ queryKey: listKey })

            queryClient.setQueriesData<Record<string, unknown>>({ queryKey: listKey }, (old) => {
                if (!old || !Array.isArray((old as { items?: unknown[] }).items)) return old
                const items = [...((old as { items: Array<Record<string, unknown>> }).items ?? [])]

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

                const fromIndex = items.findIndex((item) => item.id === variables.fixedValueId)
                if (fromIndex === -1) return old

                let toIndex = items.findIndex((item) => (item.sortOrder ?? 0) === variables.newSortOrder)
                if (toIndex === -1) toIndex = Math.max(0, Math.min(items.length - 1, variables.newSortOrder - 1))

                const [moved] = items.splice(fromIndex, 1)
                items.splice(toIndex, 0, moved)
                const updated = items.map((item, idx) => ({ ...item, sortOrder: idx + 1 }))
                return { ...old, items: updated }
            })

            return { previousQueries }
        },
        onError: (_error, _variables, context) => {
            if (!context?.previousQueries) return
            for (const [key, data] of context.previousQueries) {
                queryClient.setQueryData(key, data)
            }
        },
        onSettled: async (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['fixedValues'] }) <= 1) {
                await invalidateSetConstantScopes(queryClient, variables)
            }
        }
    })
}

export function useCopyFixedValue() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['fixedValues', 'copy'],
        mutationFn: async ({ metahubId, treeEntityId, valueGroupId, kindKey, fixedValueId, data }: CopyFixedValueParams) => {
            if (treeEntityId) {
                const response = await fixedValuesApi.copyFixedValue(metahubId, treeEntityId, valueGroupId, fixedValueId, data)
                return response.data
            }
            const response = await fixedValuesApi.copyFixedValueDirect(metahubId, valueGroupId, fixedValueId, data, kindKey)
            return response.data
        },
        onMutate: async (variables) => {
            const queryKeyPrefix = getConstantQueryKeyPrefix(variables)
            const existingFixedValue = queryClient
                .getQueriesData<{ items?: Array<Record<string, unknown>> }>({ queryKey: queryKeyPrefix })
                .flatMap(([, value]) => (Array.isArray(value?.items) ? value.items : []))
                .find((item) => item.id === variables.fixedValueId)

            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity: {
                    ...(existingFixedValue ?? {}),
                    id: generateOptimisticId(),
                    valueGroupId: variables.valueGroupId,
                    codename:
                        variables.data.codename || (typeof existingFixedValue?.codename === 'string' ? existingFixedValue.codename : ''),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    ...makePendingMarkers('copy')
                },
                insertPosition: 'prepend'
            })
        },
        onSuccess: (data, variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(queryClient, getConstantQueryKeyPrefix(variables), context.optimisticId, data.id, {
                    serverEntity: data
                })
            }
            enqueueSnackbar(t('fixedValues.copySuccess', 'Fixed value copied'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('fixedValues.copyError', 'Failed to copy constant'), { variant: 'error' })
        },
        onSettled: async (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['fixedValues'] }) <= 1) {
                await invalidateSetConstantScopes(queryClient, variables)
            }
        }
    })
}
