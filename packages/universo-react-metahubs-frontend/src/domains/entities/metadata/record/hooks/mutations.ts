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
    confirmOptimisticUpdate,
    confirmOptimisticCreate
} from '@universo-react/template-mui'
import { isApiError, makePendingMarkers, resolveApiErrorMessage } from '@universo-react/utils'
import { applyOptimisticReorder, metahubsQueryKeys, rollbackReorderSnapshots } from '../../../../shared'
import * as recordsApi from '../api'
import type {
    BaseElementScope,
    CreateRecordParams,
    UpdateRecordParams,
    DeleteRecordParams,
    CopyRecordParams,
    MoveRecordParams,
    ReorderRecordParams
} from './mutationTypes'

const invalidateElementScopes = async (queryClient: ReturnType<typeof useQueryClient>, variables: BaseElementScope): Promise<void> => {
    if (variables.treeEntityId) {
        await queryClient.invalidateQueries({
            queryKey: metahubsQueryKeys.records(variables.metahubId, variables.treeEntityId, variables.objectCollectionId),
            refetchType: 'inactive'
        })
        await queryClient.invalidateQueries({
            queryKey: metahubsQueryKeys.objectCollections(variables.metahubId, variables.treeEntityId),
            refetchType: 'inactive'
        })
    } else {
        await queryClient.invalidateQueries({
            queryKey: metahubsQueryKeys.recordsDirect(variables.metahubId, variables.objectCollectionId),
            refetchType: 'inactive'
        })
    }
    await queryClient.invalidateQueries({
        queryKey: metahubsQueryKeys.objectCollectionDetail(variables.metahubId, variables.objectCollectionId),
        refetchType: 'inactive'
    })
    await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allObjectCollections(variables.metahubId), refetchType: 'inactive' })
}

const getElementQueryKeyPrefix = (variables: BaseElementScope) =>
    variables.treeEntityId
        ? metahubsQueryKeys.records(variables.metahubId, variables.treeEntityId, variables.objectCollectionId)
        : metahubsQueryKeys.recordsDirect(variables.metahubId, variables.objectCollectionId)

export function useCreateRecord() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['records', 'create'],
        mutationFn: async ({ metahubId, treeEntityId, objectCollectionId, data }: CreateRecordParams) => {
            if (treeEntityId) {
                const response = await recordsApi.createRecord(metahubId, treeEntityId, objectCollectionId, data)
                return response.data
            }
            const response = await recordsApi.createRecordDirect(metahubId, objectCollectionId, data)
            return response.data
        },
        onMutate: async (variables) => {
            const queryKeyPrefix = getElementQueryKeyPrefix(variables)
            const optimisticSortOrder = variables.data.sortOrder ?? getNextOptimisticSortOrderFromQueries(queryClient, queryKeyPrefix)
            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity: {
                    id: generateOptimisticId(),
                    objectCollectionId: variables.objectCollectionId,
                    data: variables.data.data,
                    ownerId: null,
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
                confirmOptimisticCreate(queryClient, getElementQueryKeyPrefix(variables), context.optimisticId, data.id, {
                    serverEntity: data
                })
            }
            enqueueSnackbar(t('records.createSuccess', 'Element created'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            const message = isApiError(error, 'RECORD_KEY_DUPLICATE')
                ? t('records.keyDuplicate', 'A record with the same key already exists. Change the key and try again.')
                : isApiError(error, 'RECORD_REF_TARGET_MISSING')
                ? t('records.refTargetMissing', 'The selected related record no longer exists. Refresh the form and choose it again.')
                : resolveApiErrorMessage(error, t('records.createError', 'Failed to create element'))
            enqueueSnackbar(message, { variant: 'error' })
        },
        onSettled: async (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['records'] }) <= 1) {
                await invalidateElementScopes(queryClient, variables)
            }
        }
    })
}

export function useUpdateRecord() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['records', 'update'],
        mutationFn: async ({ metahubId, treeEntityId, objectCollectionId, recordId, data }: UpdateRecordParams) => {
            if (treeEntityId) {
                const response = await recordsApi.updateRecord(metahubId, treeEntityId, objectCollectionId, recordId, data)
                return response.data
            }
            const response = await recordsApi.updateRecordDirect(metahubId, objectCollectionId, recordId, data)
            return response.data
        },
        onMutate: async (variables) => {
            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: getElementQueryKeyPrefix(variables),
                entityId: variables.recordId,
                updater: {
                    ...variables.data,
                    updatedAt: new Date().toISOString()
                },
                moveToFront: true
            })
        },
        onSuccess: async (data, variables) => {
            await queryClient.cancelQueries({ queryKey: getElementQueryKeyPrefix(variables) })
            confirmOptimisticUpdate(queryClient, getElementQueryKeyPrefix(variables), variables.recordId, {
                serverEntity: data ?? null,
                moveToFront: true
            })
            enqueueSnackbar(t('records.updateSuccess', 'Element updated'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            const message = isApiError(error, 'RECORD_KEY_DUPLICATE')
                ? t('records.keyDuplicate', 'A record with the same key already exists. Change the key and try again.')
                : isApiError(error, 'RECORD_REF_TARGET_MISSING')
                ? t('records.refTargetMissing', 'The selected related record no longer exists. Refresh the form and choose it again.')
                : resolveApiErrorMessage(error, t('records.updateError', 'Failed to update element'))
            enqueueSnackbar(message, { variant: 'error' })
        },
        onSettled: async (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['records'] }) <= 1) {
                await invalidateElementScopes(queryClient, variables)
            }
        }
    })
}

export function useDeleteRecord() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['records', 'delete'],
        mutationFn: async ({ metahubId, treeEntityId, objectCollectionId, recordId }: DeleteRecordParams) => {
            if (treeEntityId) {
                await recordsApi.deleteRecord(metahubId, treeEntityId, objectCollectionId, recordId)
            } else {
                await recordsApi.deleteRecordDirect(metahubId, objectCollectionId, recordId)
            }
        },
        onMutate: async (variables) => {
            return applyOptimisticDelete({
                queryClient,
                queryKeyPrefix: getElementQueryKeyPrefix(variables),
                entityId: variables.recordId,
                strategy: 'remove'
            })
        },
        onSuccess: () => {
            enqueueSnackbar(t('records.deleteSuccess', 'Element deleted'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            const message = isApiError(error, 'RECORD_REFERENCED')
                ? t('records.deleteReferenced', 'This record is used by other records. Remove those references first.')
                : resolveApiErrorMessage(error, t('records.deleteError', 'Failed to delete element'))
            enqueueSnackbar(message, { variant: 'error' })
        },
        onSettled: async (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['records'] }) <= 1) {
                await invalidateElementScopes(queryClient, variables)
            }
        }
    })
}

export function useMoveRecord() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationKey: ['records', 'move'],
        mutationFn: async ({ metahubId, treeEntityId, objectCollectionId, recordId, direction }: MoveRecordParams) => {
            if (treeEntityId) {
                const response = await recordsApi.moveRecord(metahubId, treeEntityId, objectCollectionId, recordId, direction)
                return response.data
            }
            const response = await recordsApi.moveRecordDirect(metahubId, objectCollectionId, recordId, direction)
            return response.data
        },
        onSettled: async (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['records'] }) <= 1) {
                await invalidateElementScopes(queryClient, variables)
            }
        }
    })
}

export function useReorderRecord() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationKey: ['records', 'reorder'],
        mutationFn: async ({ metahubId, treeEntityId, objectCollectionId, recordId, newSortOrder }: ReorderRecordParams) => {
            if (treeEntityId) {
                const response = await recordsApi.reorderRecord(metahubId, treeEntityId, objectCollectionId, recordId, newSortOrder)
                return response.data
            }
            const response = await recordsApi.reorderRecordDirect(metahubId, objectCollectionId, recordId, newSortOrder)
            return response.data
        },
        onMutate: async (variables) => {
            const snapshots =
                variables.treeEntityId != null
                    ? await applyOptimisticReorder(
                          queryClient,
                          metahubsQueryKeys.records(variables.metahubId, variables.treeEntityId, variables.objectCollectionId),
                          variables.recordId,
                          variables.newSortOrder
                      )
                    : await applyOptimisticReorder(
                          queryClient,
                          metahubsQueryKeys.recordsDirect(variables.metahubId, variables.objectCollectionId),
                          variables.recordId,
                          variables.newSortOrder
                      )

            return { snapshots }
        },
        onError: (_error, _variables, context) => {
            rollbackReorderSnapshots(queryClient, context?.snapshots)
        },
        onSettled: async (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['records'] }) <= 1) {
                await invalidateElementScopes(queryClient, variables)
            }
        }
    })
}

export function useCopyRecord() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['records', 'copy'],
        mutationFn: async ({ metahubId, treeEntityId, objectCollectionId, recordId, data }: CopyRecordParams) => {
            if (treeEntityId) {
                const response = await recordsApi.copyRecord(metahubId, treeEntityId, objectCollectionId, recordId, data)
                return response.data
            }
            const response = await recordsApi.copyRecordDirect(metahubId, objectCollectionId, recordId, data)
            return response.data
        },
        onMutate: async (variables) => {
            const queryKeyPrefix = getElementQueryKeyPrefix(variables)
            const existingElement = queryClient
                .getQueriesData<{ items?: Array<Record<string, unknown>> }>({ queryKey: queryKeyPrefix })
                .flatMap(([, value]) => (Array.isArray(value?.items) ? value.items : []))
                .find((item) => item.id === variables.recordId)

            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity: {
                    ...(existingElement ?? {}),
                    id: generateOptimisticId(),
                    objectCollectionId: variables.objectCollectionId,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    ...makePendingMarkers('copy')
                },
                insertPosition: 'prepend'
            })
        },
        onSuccess: (data, _variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(queryClient, getElementQueryKeyPrefix(_variables), context.optimisticId, data.id, {
                    serverEntity: data
                })
            }
            enqueueSnackbar(t('records.copySuccess', 'Element copied'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(resolveApiErrorMessage(error, t('records.copyError', 'Failed to copy element')), { variant: 'error' })
        },
        onSettled: async (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['records'] }) <= 1) {
                await invalidateElementScopes(queryClient, variables)
            }
        }
    })
}
