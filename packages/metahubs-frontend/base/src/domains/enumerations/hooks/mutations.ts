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
    applyOptimisticReorder,
    collectMetahubCopyQueryKeyPrefixes,
    confirmOptimisticCreateInQueryKeyPrefixes,
    invalidateEnumerationValuesQueries,
    metahubsQueryKeys,
    rollbackReorderSnapshots
} from '../../shared'
import * as enumerationsApi from '../api'
import type {
    CreateEnumerationParams,
    CreateEnumerationAtMetahubParams,
    UpdateEnumerationParams,
    UpdateEnumerationAtMetahubParams,
    DeleteEnumerationParams,
    CopyEnumerationParams,
    ReorderEnumerationParams,
    CreateEnumerationValueParams,
    UpdateEnumerationValueParams,
    DeleteEnumerationValueParams,
    MoveEnumerationValueParams,
    CopyEnumerationValueParams,
    ReorderEnumerationValueParams
} from './mutationTypes'

const getEnumerationValueQueryKeyPrefix = (metahubId: string, enumerationId: string) =>
    metahubsQueryKeys.enumerationValues(metahubId, enumerationId)

export function useCreateEnumerationAtMetahub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        retry: false,
        mutationKey: ['enumerations', 'create'],
        mutationFn: async ({ metahubId, data }: CreateEnumerationAtMetahubParams) => {
            const response = await enumerationsApi.createEnumerationAtMetahub(metahubId, data)
            return response.data
        },
        onMutate: async ({ metahubId, data }) => {
            const optimisticId = generateOptimisticId()
            const queryKeyPrefix = metahubsQueryKeys.allEnumerations(metahubId)
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
                    metahubsQueryKeys.allEnumerations(variables.metahubId),
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
            if (queryClient.isMutating({ mutationKey: ['enumerations'] }) <= 1) {
                safeInvalidateQueries(
                    queryClient,
                    ['enumerations'],
                    metahubsQueryKeys.allEnumerations(variables.metahubId),
                    ...(variables.data.hubIds ?? []).map((hubId) => metahubsQueryKeys.enumerations(variables.metahubId, hubId))
                )
            }
        }
    })
}

export function useCreateEnumeration() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        retry: false,
        mutationKey: ['enumerations', 'create'],
        mutationFn: async ({ metahubId, hubId, data }: CreateEnumerationParams) => {
            const response = await enumerationsApi.createEnumeration(metahubId, hubId, data)
            return response.data
        },
        onMutate: async ({ metahubId, hubId, data }) => {
            const optimisticId = generateOptimisticId()
            const queryKeyPrefix = metahubsQueryKeys.enumerations(metahubId, hubId)
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
                    metahubsQueryKeys.enumerations(variables.metahubId, variables.hubId),
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
                ['enumerations'],
                metahubsQueryKeys.enumerations(variables.metahubId, variables.hubId),
                metahubsQueryKeys.allEnumerations(variables.metahubId)
            )
        }
    })
}

export function useUpdateEnumeration() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['enumerations', 'update'],
        mutationFn: async ({ metahubId, hubId, enumerationId, data }: UpdateEnumerationParams) => {
            const response = await enumerationsApi.updateEnumeration(metahubId, hubId, enumerationId, data)
            return response.data
        },
        onMutate: async ({ metahubId, hubId, enumerationId, data }) => {
            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.enumerations(metahubId, hubId),
                entityId: enumerationId,
                updater: { ...data, updatedAt: new Date().toISOString() },
                moveToFront: true
            })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('enumerations.updateError', 'Failed to update enumeration'), { variant: 'error' })
        },
        onSuccess: async (data, variables) => {
            await queryClient.cancelQueries({ queryKey: metahubsQueryKeys.enumerations(variables.metahubId, variables.hubId) })
            confirmOptimisticUpdate(
                queryClient,
                metahubsQueryKeys.enumerations(variables.metahubId, variables.hubId),
                variables.enumerationId,
                { serverEntity: data ?? null, moveToFront: true }
            )
            enqueueSnackbar(t('enumerations.updateSuccess', 'Enumeration updated'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(
                queryClient,
                ['enumerations'],
                metahubsQueryKeys.enumerations(variables.metahubId, variables.hubId),
                metahubsQueryKeys.allEnumerations(variables.metahubId),
                metahubsQueryKeys.hubs(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
        }
    })
}

export function useUpdateEnumerationAtMetahub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['enumerations', 'update'],
        mutationFn: async ({ metahubId, enumerationId, data }: UpdateEnumerationAtMetahubParams) => {
            const response = await enumerationsApi.updateEnumerationAtMetahub(metahubId, enumerationId, data)
            return response.data
        },
        onMutate: async ({ metahubId, enumerationId, data }) => {
            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.allEnumerations(metahubId),
                entityId: enumerationId,
                updater: { ...data, updatedAt: new Date().toISOString() },
                moveToFront: true
            })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('enumerations.updateError', 'Failed to update enumeration'), { variant: 'error' })
        },
        onSuccess: async (data, variables) => {
            await queryClient.cancelQueries({ queryKey: metahubsQueryKeys.allEnumerations(variables.metahubId) })
            confirmOptimisticUpdate(queryClient, metahubsQueryKeys.allEnumerations(variables.metahubId), variables.enumerationId, {
                serverEntity: data ?? null,
                moveToFront: true
            })
            enqueueSnackbar(t('enumerations.updateSuccess', 'Enumeration updated'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(
                queryClient,
                ['enumerations'],
                metahubsQueryKeys.allEnumerations(variables.metahubId),
                metahubsQueryKeys.hubs(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
        }
    })
}

export function useDeleteEnumeration() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['enumerations', 'delete'],
        mutationFn: async ({ metahubId, hubId, enumerationId, force }: DeleteEnumerationParams) => {
            if (hubId) {
                await enumerationsApi.deleteEnumeration(metahubId, hubId, enumerationId, force)
            } else {
                await enumerationsApi.deleteEnumerationDirect(metahubId, enumerationId)
            }
        },
        onMutate: async ({ metahubId, hubId, enumerationId }) => {
            const queryKeyPrefix = hubId ? metahubsQueryKeys.enumerations(metahubId, hubId) : metahubsQueryKeys.allEnumerations(metahubId)
            return applyOptimisticDelete({
                queryClient,
                queryKeyPrefix,
                entityId: enumerationId,
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
                ['enumerations'],
                metahubsQueryKeys.allEnumerations(variables.metahubId),
                metahubsQueryKeys.hubs(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
            if (variables.hubId) {
                safeInvalidateQueries(queryClient, ['enumerations'], metahubsQueryKeys.enumerations(variables.metahubId, variables.hubId))
            }
        }
    })
}

export function useCopyEnumeration() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['enumerations', 'copy'],
        mutationFn: async ({ metahubId, enumerationId, data }: CopyEnumerationParams) => {
            const response = await enumerationsApi.copyEnumeration(metahubId, enumerationId, data)
            return response.data
        },
        onMutate: async ({ metahubId, enumerationId, data }) => {
            const optimisticId = generateOptimisticId()
            const broadQueryKeyPrefix = metahubsQueryKeys.allEnumerations(metahubId)
            const existingEnumeration = queryClient
                .getQueriesData<{ items?: Array<Record<string, unknown>> }>({ queryKey: ['metahubs'] })
                .flatMap(([, value]) => (Array.isArray(value?.items) ? value.items : []))
                .find((item) => item.id === enumerationId)
            const queryKeyPrefixes = collectMetahubCopyQueryKeyPrefixes({
                queryClient,
                metahubId,
                entityId: enumerationId,
                entitySegment: 'enumerations',
                broadQueryKeyPrefix,
                scopedQueryKeyPrefixFactory: (hubId) => metahubsQueryKeys.enumerations(metahubId, hubId),
                knownHubIds: Array.isArray(existingEnumeration?.hubs)
                    ? existingEnumeration.hubs
                          .map((hub) => (typeof hub?.id === 'string' ? hub.id : null))
                          .filter((hubId): hubId is string => Boolean(hubId))
                    : []
            })
            const optimisticSortOrder = getNextOptimisticSortOrderFromQueries(queryClient, broadQueryKeyPrefix)
            const optimisticEntity = {
                ...(existingEnumeration ?? {}),
                id: optimisticId,
                codename: data.codename ?? '',
                name: data.name || existingEnumeration?.name || {},
                description: data.description ?? existingEnumeration?.description,
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
                    context.queryKeyPrefixes ?? [metahubsQueryKeys.allEnumerations(variables.metahubId)],
                    context.optimisticId,
                    data.id,
                    { serverEntity: data }
                )
            }
            enqueueSnackbar(t('enumerations.copySuccess', 'Enumeration copied'), { variant: 'success' })
        },
        onSettled: async (copiedEnumeration, _error, variables) => {
            safeInvalidateQueries(
                queryClient,
                ['enumerations'],
                metahubsQueryKeys.allEnumerations(variables.metahubId),
                metahubsQueryKeys.hubs(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
            if (copiedEnumeration && Array.isArray(copiedEnumeration.hubs)) {
                for (const hub of copiedEnumeration.hubs as Array<{ id: string }>) {
                    safeInvalidateQueriesInactive(
                        queryClient,
                        ['enumerations'],
                        metahubsQueryKeys.enumerations(variables.metahubId, hub.id)
                    )
                }
            }
        }
    })
}

export function useReorderEnumeration() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationKey: ['enumerations', 'reorder'],
        mutationFn: async ({ metahubId, hubId, enumerationId, newSortOrder }: ReorderEnumerationParams) => {
            const response = await enumerationsApi.reorderEnumeration(metahubId, enumerationId, newSortOrder, hubId)
            return response.data
        },
        onMutate: async (variables) => {
            const listSnapshots =
                variables.hubId != null
                    ? await applyOptimisticReorder(
                          queryClient,
                          metahubsQueryKeys.enumerations(variables.metahubId, variables.hubId),
                          variables.enumerationId,
                          variables.newSortOrder
                      )
                    : await applyOptimisticReorder(
                          queryClient,
                          metahubsQueryKeys.allEnumerations(variables.metahubId),
                          variables.enumerationId,
                          variables.newSortOrder
                      )

            const globalSnapshots =
                variables.hubId != null
                    ? await applyOptimisticReorder(
                          queryClient,
                          metahubsQueryKeys.allEnumerations(variables.metahubId),
                          variables.enumerationId,
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
                ['enumerations'],
                metahubsQueryKeys.allEnumerations(variables.metahubId),
                metahubsQueryKeys.hubs(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
            if (variables.hubId) {
                safeInvalidateQueriesInactive(
                    queryClient,
                    ['enumerations'],
                    metahubsQueryKeys.enumerations(variables.metahubId, variables.hubId)
                )
            }
        }
    })
}

export function useCreateEnumerationValue() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['enumerationValues', 'create'],
        mutationFn: async ({ metahubId, enumerationId, data }: CreateEnumerationValueParams) => {
            const response = await enumerationsApi.createEnumerationValue(metahubId, enumerationId, data)
            return response.data
        },
        onMutate: async ({ metahubId, enumerationId, data }) => {
            const queryKeyPrefix = getEnumerationValueQueryKeyPrefix(metahubId, enumerationId)
            const optimisticSortOrder = data.sortOrder ?? getNextOptimisticSortOrderFromQueries(queryClient, queryKeyPrefix)

            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity: {
                    id: generateOptimisticId(),
                    objectId: enumerationId,
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
                    getEnumerationValueQueryKeyPrefix(variables.metahubId, variables.enumerationId),
                    context.optimisticId,
                    data.id,
                    { serverEntity: data }
                )
            }
            enqueueSnackbar(t('enumerationValues.createSuccess', 'Enumeration value created'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('enumerationValues.createError', 'Failed to create enumeration value'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['enumerationValues'] }) <= 1) {
                invalidateEnumerationValuesQueries.all(queryClient, variables.metahubId, variables.enumerationId)
            }
        }
    })
}

export function useUpdateEnumerationValue() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['enumerationValues', 'update'],
        mutationFn: async ({ metahubId, enumerationId, valueId, data }: UpdateEnumerationValueParams) => {
            const response = await enumerationsApi.updateEnumerationValue(metahubId, enumerationId, valueId, data)
            return response.data
        },
        onMutate: async ({ metahubId, enumerationId, valueId, data }) => {
            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: getEnumerationValueQueryKeyPrefix(metahubId, enumerationId),
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
                getEnumerationValueQueryKeyPrefix(variables.metahubId, variables.enumerationId),
                variables.valueId,
                { serverEntity: data ?? null }
            )
            enqueueSnackbar(t('enumerationValues.updateSuccess', 'Enumeration value updated'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('enumerationValues.updateError', 'Failed to update enumeration value'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['enumerationValues'] }) <= 1) {
                invalidateEnumerationValuesQueries.all(queryClient, variables.metahubId, variables.enumerationId)
            }
        }
    })
}

export function useDeleteEnumerationValue() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['enumerationValues', 'delete'],
        mutationFn: async ({ metahubId, enumerationId, valueId }: DeleteEnumerationValueParams) => {
            await enumerationsApi.deleteEnumerationValue(metahubId, enumerationId, valueId)
        },
        onMutate: async ({ metahubId, enumerationId, valueId }) => {
            return applyOptimisticDelete({
                queryClient,
                queryKeyPrefix: getEnumerationValueQueryKeyPrefix(metahubId, enumerationId),
                entityId: valueId,
                strategy: 'remove'
            })
        },
        onSuccess: () => {
            enqueueSnackbar(t('enumerationValues.deleteSuccess', 'Enumeration value deleted'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('enumerationValues.deleteError', 'Failed to delete enumeration value'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['enumerationValues'] }) <= 1) {
                invalidateEnumerationValuesQueries.all(queryClient, variables.metahubId, variables.enumerationId)
            }
        }
    })
}

export function useMoveEnumerationValue() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['enumerationValues', 'move'],
        mutationFn: async ({ metahubId, enumerationId, valueId, direction }: MoveEnumerationValueParams) => {
            const response = await enumerationsApi.moveEnumerationValue(metahubId, enumerationId, valueId, direction)
            return response.data
        },
        onSuccess: () => {
            enqueueSnackbar(t('enumerationValues.moveSuccess', 'Value order updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('enumerationValues.moveError', 'Failed to move value'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['enumerationValues'] }) <= 1) {
                invalidateEnumerationValuesQueries.all(queryClient, variables.metahubId, variables.enumerationId)
            }
        }
    })
}

/**
 * Reorder an enumeration value via DnD to a new sort_order position.
 * Includes optimistic updates for instant visual feedback.
 */
export function useReorderEnumerationValue() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationKey: ['enumerationValues', 'reorder'],
        mutationFn: async ({ metahubId, enumerationId, valueId, newSortOrder }: ReorderEnumerationValueParams) => {
            const response = await enumerationsApi.reorderEnumerationValue(metahubId, enumerationId, valueId, newSortOrder)
            return response.data
        },
        onMutate: async (variables) => {
            const baseKey = metahubsQueryKeys.enumerationValues(variables.metahubId, variables.enumerationId)

            // Cancel in-flight queries
            await queryClient.cancelQueries({ queryKey: baseKey })

            // Snapshot for rollback
            const previousQueries = queryClient.getQueriesData<Record<string, unknown>>({ queryKey: baseKey })

            // Optimistically reorder items
            queryClient.setQueriesData<Record<string, unknown>>({ queryKey: baseKey }, (old) => {
                if (!old || !Array.isArray((old as Record<string, unknown> & { items?: unknown[] }).items)) return old
                const items = [...(old as Record<string, unknown> & { items: Record<string, unknown>[] }).items]
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
            if (queryClient.isMutating({ mutationKey: ['enumerationValues'] }) <= 1) {
                invalidateEnumerationValuesQueries.all(queryClient, variables.metahubId, variables.enumerationId)
            }
        }
    })
}

export function useCopyEnumerationValue() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['enumerationValues', 'copy'],
        mutationFn: async ({ metahubId, enumerationId, valueId, data }: CopyEnumerationValueParams) => {
            const response = await enumerationsApi.copyEnumerationValue(metahubId, enumerationId, valueId, data)
            return response.data
        },
        onMutate: async ({ metahubId, enumerationId, valueId, data }) => {
            const queryKeyPrefix = getEnumerationValueQueryKeyPrefix(metahubId, enumerationId)
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
                    objectId: enumerationId,
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
                    getEnumerationValueQueryKeyPrefix(variables.metahubId, variables.enumerationId),
                    context.optimisticId,
                    data.id,
                    { serverEntity: data }
                )
            }
            enqueueSnackbar(t('enumerationValues.copySuccess', 'Enumeration value copied'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('enumerationValues.copyError', 'Failed to copy enumeration value'), {
                variant: 'error'
            })
        },
        onSettled: (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['enumerationValues'] }) <= 1) {
                invalidateEnumerationValuesQueries.all(queryClient, variables.metahubId, variables.enumerationId)
            }
        }
    })
}
