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
import { metahubsQueryKeys } from '../../shared'
import * as constantsApi from '../api'
import type {
    BaseConstantScope,
    CreateConstantParams,
    UpdateConstantParams,
    DeleteConstantParams,
    MoveConstantParams,
    CopyConstantParams,
    ReorderConstantParams
} from './mutationTypes'

const invalidateSetConstantScopes = async (queryClient: ReturnType<typeof useQueryClient>, variables: BaseConstantScope): Promise<void> => {
    if (variables.hubId) {
        await safeInvalidateQueries(
            queryClient,
            ['constants'],
            metahubsQueryKeys.constants(variables.metahubId, variables.hubId, variables.setId),
            metahubsQueryKeys.constantsDirect(variables.metahubId, variables.setId)
        )
        await queryClient.invalidateQueries({
            queryKey: metahubsQueryKeys.sets(variables.metahubId, variables.hubId),
            refetchType: 'inactive'
        })
    } else {
        await safeInvalidateQueries(queryClient, ['constants'], metahubsQueryKeys.constantsDirect(variables.metahubId, variables.setId))
    }

    await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.setDetail(variables.metahubId, variables.setId) })
    await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allSets(variables.metahubId), refetchType: 'inactive' })
    await queryClient.invalidateQueries({
        queryKey: metahubsQueryKeys.allConstantCodenames(variables.metahubId, variables.setId),
        refetchType: 'inactive'
    })
}

const getConstantQueryKeyPrefix = (variables: BaseConstantScope) =>
    variables.hubId
        ? metahubsQueryKeys.constants(variables.metahubId, variables.hubId, variables.setId)
        : metahubsQueryKeys.constantsDirect(variables.metahubId, variables.setId)

export function useCreateConstant() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['constants', 'create'],
        mutationFn: async ({ metahubId, hubId, setId, data }: CreateConstantParams) => {
            if (hubId) {
                const response = await constantsApi.createConstant(metahubId, hubId, setId, data)
                return response.data
            }
            const response = await constantsApi.createConstantDirect(metahubId, setId, data)
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
                    setId: variables.setId,
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
            enqueueSnackbar(t('constants.createSuccess', 'Constant created'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('constants.createError', 'Failed to create constant'), { variant: 'error' })
        },
        onSettled: async (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['constants'] }) <= 1) {
                await invalidateSetConstantScopes(queryClient, variables)
            }
        }
    })
}

export function useUpdateConstant() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['constants', 'update'],
        mutationFn: async ({ metahubId, hubId, setId, constantId, data }: UpdateConstantParams) => {
            if (hubId) {
                const response = await constantsApi.updateConstant(metahubId, hubId, setId, constantId, data)
                return response.data
            }
            const response = await constantsApi.updateConstantDirect(metahubId, setId, constantId, data)
            return response.data
        },
        onMutate: async (variables) => {
            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: getConstantQueryKeyPrefix(variables),
                entityId: variables.constantId,
                updater: {
                    ...variables.data,
                    updatedAt: new Date().toISOString()
                },
                moveToFront: true
            })
        },
        onSuccess: (data, variables) => {
            confirmOptimisticUpdate(queryClient, getConstantQueryKeyPrefix(variables), variables.constantId, {
                serverEntity: data ?? null
            })
            enqueueSnackbar(t('constants.updateSuccess', 'Constant updated'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('constants.updateError', 'Failed to update constant'), { variant: 'error' })
        },
        onSettled: async (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['constants'] }) <= 1) {
                await invalidateSetConstantScopes(queryClient, variables)
            }
        }
    })
}

export function useDeleteConstant() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['constants', 'delete'],
        mutationFn: async ({ metahubId, hubId, setId, constantId }: DeleteConstantParams) => {
            if (hubId) {
                await constantsApi.deleteConstant(metahubId, hubId, setId, constantId)
            } else {
                await constantsApi.deleteConstantDirect(metahubId, setId, constantId)
            }
        },
        onMutate: async (variables) => {
            return applyOptimisticDelete({
                queryClient,
                queryKeyPrefix: getConstantQueryKeyPrefix(variables),
                entityId: variables.constantId,
                strategy: 'remove'
            })
        },
        onSuccess: () => {
            enqueueSnackbar(t('constants.deleteSuccess', 'Constant deleted'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('constants.deleteError', 'Failed to delete constant'), { variant: 'error' })
        },
        onSettled: async (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['constants'] }) <= 1) {
                await invalidateSetConstantScopes(queryClient, variables)
            }
        }
    })
}

export function useMoveConstant() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['constants', 'move'],
        mutationFn: async ({ metahubId, hubId, setId, constantId, direction }: MoveConstantParams) => {
            if (hubId) {
                const response = await constantsApi.moveConstant(metahubId, hubId, setId, constantId, direction)
                return response.data
            }
            const response = await constantsApi.moveConstantDirect(metahubId, setId, constantId, direction)
            return response.data
        },
        onSuccess: () => {
            enqueueSnackbar(t('constants.moveSuccess', 'Constant order updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('constants.moveError', 'Failed to update constant order'), { variant: 'error' })
        },
        onSettled: async (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['constants'] }) <= 1) {
                await invalidateSetConstantScopes(queryClient, variables)
            }
        }
    })
}

export function useReorderConstant() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationKey: ['constants', 'reorder'],
        mutationFn: async ({ metahubId, hubId, setId, constantId, newSortOrder }: ReorderConstantParams) => {
            if (hubId) {
                const response = await constantsApi.reorderConstant(metahubId, hubId, setId, constantId, newSortOrder)
                return response.data
            }
            const response = await constantsApi.reorderConstantDirect(metahubId, setId, constantId, newSortOrder)
            return response.data
        },
        onMutate: async (variables) => {
            const listKey = variables.hubId
                ? metahubsQueryKeys.constantsList(variables.metahubId, variables.hubId, variables.setId)
                : metahubsQueryKeys.constantsListDirect(variables.metahubId, variables.setId)

            await queryClient.cancelQueries({ queryKey: listKey })
            const previousQueries = queryClient.getQueriesData<Record<string, unknown>>({ queryKey: listKey })

            queryClient.setQueriesData<Record<string, unknown>>({ queryKey: listKey }, (old) => {
                if (!old || !Array.isArray((old as { items?: unknown[] }).items)) return old
                const items = [...((old as { items: Array<Record<string, unknown>> }).items ?? [])]
                const fromIndex = items.findIndex((item) => item.id === variables.constantId)
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
            if (queryClient.isMutating({ mutationKey: ['constants'] }) <= 1) {
                await invalidateSetConstantScopes(queryClient, variables)
            }
        }
    })
}

export function useCopyConstant() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['constants', 'copy'],
        mutationFn: async ({ metahubId, hubId, setId, constantId, data }: CopyConstantParams) => {
            if (hubId) {
                const response = await constantsApi.copyConstant(metahubId, hubId, setId, constantId, data)
                return response.data
            }
            const response = await constantsApi.copyConstantDirect(metahubId, setId, constantId, data)
            return response.data
        },
        onMutate: async (variables) => {
            const queryKeyPrefix = getConstantQueryKeyPrefix(variables)
            const existingConstant = queryClient
                .getQueriesData<{ items?: Array<Record<string, unknown>> }>({ queryKey: queryKeyPrefix })
                .flatMap(([, value]) => (Array.isArray(value?.items) ? value.items : []))
                .find((item) => item.id === variables.constantId)

            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity: {
                    ...(existingConstant ?? {}),
                    id: generateOptimisticId(),
                    setId: variables.setId,
                    codename: variables.data.codename || (typeof existingConstant?.codename === 'string' ? existingConstant.codename : ''),
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
            enqueueSnackbar(t('constants.copySuccess', 'Constant copied'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('constants.copyError', 'Failed to copy constant'), { variant: 'error' })
        },
        onSettled: async (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['constants'] }) <= 1) {
                await invalidateSetConstantScopes(queryClient, variables)
            }
        }
    })
}
