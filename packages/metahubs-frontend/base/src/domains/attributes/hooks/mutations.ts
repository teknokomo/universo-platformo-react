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
} from '@universo/template-mui'
import { makePendingMarkers } from '@universo/utils'
import { applyMergedSharedEntityOrder, metahubsQueryKeys, invalidateAttributesQueries } from '../../shared'
import * as attributesApi from '../api'
import type {
    AttributeMutationError,
    CreateAttributeParams,
    UpdateAttributeParams,
    DeleteAttributeParams,
    MoveAttributeParams,
    CopyAttributeParams,
    CreateChildAttributeParams,
    UpdateChildAttributeParams,
    DeleteChildAttributeParams,
    CopyChildAttributeParams,
    ReorderAttributeParams,
    ToggleRequiredParams,
    SetDisplayAttributeParams
} from './mutationTypes'
import { handleAttributeError } from './attributeErrorHandler'

const getAttributeQueryKeyPrefix = (variables: { metahubId: string; hubId?: string; catalogId: string }) =>
    variables.hubId
        ? metahubsQueryKeys.attributes(variables.metahubId, variables.hubId, variables.catalogId)
        : metahubsQueryKeys.attributesDirect(variables.metahubId, variables.catalogId)

const getChildAttributeQueryKeyPrefix = (variables: { metahubId: string; catalogId: string; parentAttributeId: string }) =>
    ['metahubs', 'childAttributes', variables.metahubId, variables.catalogId, variables.parentAttributeId] as const

const invalidateAttributeScopes = (
    queryClient: ReturnType<typeof useQueryClient>,
    variables: { metahubId: string; hubId?: string; catalogId: string }
) => {
    if (queryClient.isMutating({ mutationKey: ['attributes'] }) <= 1) {
        if (variables.hubId) {
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.attributes(variables.metahubId, variables.hubId, variables.catalogId),
                refetchType: 'inactive'
            })
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId),
                refetchType: 'inactive'
            })
        } else {
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.attributesDirect(variables.metahubId, variables.catalogId),
                refetchType: 'inactive'
            })
        }
        queryClient.invalidateQueries({
            queryKey: metahubsQueryKeys.catalogDetail(variables.metahubId, variables.catalogId),
            refetchType: 'inactive'
        })
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId), refetchType: 'inactive' })
    }
}

const invalidateChildAttributeScopes = (
    queryClient: ReturnType<typeof useQueryClient>,
    variables: { metahubId: string; hubId?: string; catalogId: string; parentAttributeId: string }
) => {
    if (queryClient.isMutating({ mutationKey: ['childAttributes'] }) <= 1) {
        queryClient.invalidateQueries({
            queryKey: getChildAttributeQueryKeyPrefix(variables),
            refetchType: 'inactive'
        })
        queryClient.invalidateQueries({
            queryKey: ['metahubs', 'childAttributesForElements', variables.metahubId, variables.catalogId],
            refetchType: 'inactive'
        })
        queryClient.invalidateQueries({
            queryKey: ['metahubs', 'childEnumValues', variables.metahubId],
            refetchType: 'inactive'
        })
        invalidateAttributesQueries.allCodenames(queryClient, variables.metahubId, variables.catalogId)

        if (variables.hubId) {
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.attributes(variables.metahubId, variables.hubId, variables.catalogId),
                refetchType: 'inactive'
            })
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId),
                refetchType: 'inactive'
            })
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.catalogDetailInHub(variables.metahubId, variables.hubId, variables.catalogId),
                refetchType: 'inactive'
            })
        } else {
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.attributesDirect(variables.metahubId, variables.catalogId),
                refetchType: 'inactive'
            })
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.catalogDetail(variables.metahubId, variables.catalogId),
                refetchType: 'inactive'
            })
        }

        queryClient.invalidateQueries({
            queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId),
            refetchType: 'inactive'
        })
    }
}

export function useCreateAttribute() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['attributes', 'create'],
        mutationFn: async ({ metahubId, hubId, catalogId, data }: CreateAttributeParams) => {
            if (hubId) {
                const response = await attributesApi.createAttribute(
                    metahubId,
                    hubId,
                    catalogId,
                    data as Parameters<typeof attributesApi.createAttribute>[3]
                )
                return response.data
            }
            const response = await attributesApi.createAttributeDirect(
                metahubId,
                catalogId,
                data as Parameters<typeof attributesApi.createAttributeDirect>[2]
            )
            return response.data
        },
        onMutate: async (variables) => {
            const queryKeyPrefix = getAttributeQueryKeyPrefix(variables)
            const optimisticSortOrder = variables.data.sortOrder ?? getNextOptimisticSortOrderFromQueries(queryClient, queryKeyPrefix)
            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity: {
                    id: generateOptimisticId(),
                    catalogId: variables.catalogId,
                    codename: variables.data.codename || '',
                    dataType: variables.data.dataType,
                    name: variables.data.name,
                    targetEntityId: variables.data.targetEntityId ?? null,
                    targetEntityKind: variables.data.targetEntityKind ?? null,
                    targetConstantId: variables.data.targetConstantId ?? null,
                    validationRules: variables.data.validationRules ?? {},
                    uiConfig: variables.data.uiConfig ?? {},
                    isRequired: variables.data.isRequired ?? false,
                    isDisplayAttribute: false,
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
                confirmOptimisticCreate(queryClient, getAttributeQueryKeyPrefix(variables), context.optimisticId, data.id, {
                    serverEntity: data
                })
            }
            enqueueSnackbar(t('attributes.createSuccess', 'Attribute created'), { variant: 'success' })
        },
        onError: (error: AttributeMutationError, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            handleAttributeError(error, t, enqueueSnackbar, 'attributes.createError')
        },
        onSettled: (_data, _error, variables) => {
            invalidateAttributeScopes(queryClient, variables)
        }
    })
}

export function useCreateChildAttribute() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['childAttributes', 'create'],
        mutationFn: async ({ metahubId, hubId, catalogId, parentAttributeId, data }: CreateChildAttributeParams) => {
            if (hubId) {
                const response = await attributesApi.createChildAttribute(metahubId, hubId, catalogId, parentAttributeId, data)
                return response.data
            }
            const response = await attributesApi.createChildAttributeDirect(metahubId, catalogId, parentAttributeId, data)
            return response.data
        },
        onMutate: async (variables) => {
            const queryKeyPrefix = getChildAttributeQueryKeyPrefix(variables)
            const optimisticSortOrder = variables.data.sortOrder ?? getNextOptimisticSortOrderFromQueries(queryClient, queryKeyPrefix)

            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity: {
                    id: generateOptimisticId(),
                    catalogId: variables.catalogId,
                    parentAttributeId: variables.parentAttributeId,
                    codename: variables.data.codename || '',
                    dataType: variables.data.dataType,
                    name: variables.data.name,
                    targetEntityId: variables.data.targetEntityId ?? null,
                    targetEntityKind: variables.data.targetEntityKind ?? null,
                    targetConstantId: variables.data.targetConstantId ?? null,
                    validationRules: variables.data.validationRules ?? {},
                    uiConfig: variables.data.uiConfig ?? {},
                    isRequired: variables.data.isRequired ?? false,
                    isDisplayAttribute: variables.data.isDisplayAttribute ?? false,
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
                confirmOptimisticCreate(queryClient, getChildAttributeQueryKeyPrefix(variables), context.optimisticId, data.id, {
                    serverEntity: data
                })
            }
            enqueueSnackbar(t('attributes.createSuccess', 'Attribute created'), { variant: 'success' })
        },
        onError: (error: AttributeMutationError, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            handleAttributeError(error, t, enqueueSnackbar, 'attributes.createError')
        },
        onSettled: (_data, _error, variables) => {
            invalidateChildAttributeScopes(queryClient, variables)
        }
    })
}

export function useUpdateAttribute() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    const getErrorMessage = (error: AttributeMutationError) =>
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error.message ||
        t('attributes.updateError', 'Failed to update attribute')

    return useMutation({
        mutationKey: ['attributes', 'update'],
        mutationFn: async ({ metahubId, hubId, catalogId, attributeId, data }: UpdateAttributeParams) => {
            if (hubId) {
                const response = await attributesApi.updateAttribute(
                    metahubId,
                    hubId,
                    catalogId,
                    attributeId,
                    data as Parameters<typeof attributesApi.updateAttribute>[4]
                )
                return response.data
            }
            const response = await attributesApi.updateAttributeDirect(
                metahubId,
                catalogId,
                attributeId,
                data as Parameters<typeof attributesApi.updateAttributeDirect>[3]
            )
            return response.data
        },
        onMutate: async (variables) => {
            const isSystemToggle = variables.data.isEnabled !== undefined
            const updater: Record<string, unknown> = {
                ...variables.data,
                updatedAt: new Date().toISOString()
            }
            // For system toggles, update the nested system.isEnabled so UI visibility checks
            // see the correct state during the optimistic period
            if (isSystemToggle) {
                const queryKeyPrefix = getAttributeQueryKeyPrefix(variables)
                const queries = queryClient.getQueriesData<{ items?: Array<{ id: string; system?: { isEnabled?: boolean } }> }>({
                    queryKey: queryKeyPrefix
                })
                for (const [, data] of queries) {
                    const existing = data?.items?.find((item) => item.id === variables.attributeId)
                    if (existing?.system) {
                        updater.system = { ...existing.system, isEnabled: variables.data.isEnabled }
                        break
                    }
                }
            }
            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: getAttributeQueryKeyPrefix(variables),
                entityId: variables.attributeId,
                updater,
                moveToFront: !isSystemToggle
            })
        },
        onSuccess: async (data, variables) => {
            await queryClient.cancelQueries({ queryKey: getAttributeQueryKeyPrefix(variables) })
            const isSystemToggle = variables.data.isEnabled !== undefined
            confirmOptimisticUpdate(queryClient, getAttributeQueryKeyPrefix(variables), variables.attributeId, {
                serverEntity: data ?? null,
                moveToFront: !isSystemToggle
            })
            const successMessage =
                variables.data.isEnabled === true
                    ? t('attributes.system.enableSuccess', 'System attribute enabled')
                    : variables.data.isEnabled === false
                    ? t('attributes.system.disableSuccess', 'System attribute disabled')
                    : t('attributes.updateSuccess', 'Attribute updated')
            enqueueSnackbar(successMessage, { variant: 'success' })
        },
        onError: (error: AttributeMutationError, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(getErrorMessage(error), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            invalidateAttributeScopes(queryClient, variables)
            // For system toggles, force refetch of active queries to restore
            // authoritative server sort order (inactive-only invalidation above
            // does not refetch the visible list)
            if (variables.data.isEnabled !== undefined) {
                const queryKeyPrefix = getAttributeQueryKeyPrefix(variables)
                void queryClient.invalidateQueries({ queryKey: queryKeyPrefix })
            }
        }
    })
}

export function useUpdateChildAttribute() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['childAttributes', 'update'],
        mutationFn: async ({ metahubId, hubId, catalogId, attributeId, data }: UpdateChildAttributeParams) => {
            if (hubId) {
                const response = await attributesApi.updateAttribute(metahubId, hubId, catalogId, attributeId, data)
                return response.data
            }
            const response = await attributesApi.updateAttributeDirect(metahubId, catalogId, attributeId, data)
            return response.data
        },
        onMutate: async (variables) => {
            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: getChildAttributeQueryKeyPrefix(variables),
                entityId: variables.attributeId,
                updater: {
                    ...variables.data,
                    updatedAt: new Date().toISOString()
                }
            })
        },
        onSuccess: async (data, variables) => {
            await queryClient.cancelQueries({ queryKey: getChildAttributeQueryKeyPrefix(variables) })
            confirmOptimisticUpdate(queryClient, getChildAttributeQueryKeyPrefix(variables), variables.attributeId, {
                serverEntity: data ?? null
            })
            enqueueSnackbar(t('attributes.updateSuccess', 'Attribute updated'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('attributes.updateError', 'Failed to update attribute'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            invalidateChildAttributeScopes(queryClient, variables)
        }
    })
}

export function useDeleteAttribute() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['attributes', 'delete'],
        mutationFn: async ({ metahubId, hubId, catalogId, attributeId }: DeleteAttributeParams) => {
            if (hubId) {
                await attributesApi.deleteAttribute(metahubId, hubId, catalogId, attributeId)
            } else {
                await attributesApi.deleteAttributeDirect(metahubId, catalogId, attributeId)
            }
        },
        onMutate: async (variables) => {
            return applyOptimisticDelete({
                queryClient,
                queryKeyPrefix: getAttributeQueryKeyPrefix(variables),
                entityId: variables.attributeId,
                strategy: 'remove'
            })
        },
        onSuccess: () => {
            enqueueSnackbar(t('attributes.deleteSuccess', 'Attribute deleted'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('attributes.deleteError', 'Failed to delete attribute'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            invalidateAttributeScopes(queryClient, variables)
        }
    })
}

export function useDeleteChildAttribute() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['childAttributes', 'delete'],
        mutationFn: async ({ metahubId, hubId, catalogId, attributeId }: DeleteChildAttributeParams) => {
            if (hubId) {
                await attributesApi.deleteAttribute(metahubId, hubId, catalogId, attributeId)
            } else {
                await attributesApi.deleteAttributeDirect(metahubId, catalogId, attributeId)
            }
        },
        onMutate: async (variables) => {
            return applyOptimisticDelete({
                queryClient,
                queryKeyPrefix: getChildAttributeQueryKeyPrefix(variables),
                entityId: variables.attributeId,
                strategy: 'remove'
            })
        },
        onSuccess: () => {
            enqueueSnackbar(t('attributes.deleteSuccess', 'Attribute deleted'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('attributes.deleteError', 'Failed to delete attribute'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            invalidateChildAttributeScopes(queryClient, variables)
        }
    })
}

export function useMoveAttribute() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['attributes', 'move'],
        mutationFn: async ({ metahubId, hubId, catalogId, attributeId, direction }: MoveAttributeParams) => {
            if (hubId) {
                const response = await attributesApi.moveAttribute(metahubId, hubId, catalogId, attributeId, direction)
                return response.data
            }
            const response = await attributesApi.moveAttributeDirect(metahubId, catalogId, attributeId, direction)
            return response.data
        },
        onSuccess: () => {
            enqueueSnackbar(t('attributes.moveSuccess', 'Attribute order updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('attributes.moveError', 'Failed to update attribute order'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['attributes'] }) <= 1) {
                if (variables.hubId) {
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.attributes(variables.metahubId, variables.hubId, variables.catalogId)
                    })
                    queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId) })
                } else {
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.attributesDirect(variables.metahubId, variables.catalogId)
                    })
                }
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogDetail(variables.metahubId, variables.catalogId) })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
            }
        }
    })
}

/**
 * Reorder an attribute via DnD (same-list reorder + cross-list transfer).
 * No onError here — error handling is done in the calling component
 * to distinguish CODENAME_CONFLICT (409) and offer auto-rename dialog.
 * Optimistic updates for both same-list reorder and cross-list transfer.
 */
export function useReorderAttribute() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationKey: ['attributes', 'reorder'],
        mutationFn: async ({
            metahubId,
            hubId,
            catalogId,
            attributeId,
            newSortOrder,
            newParentAttributeId,
            mergedOrderIds,
            autoRenameCodename
        }: ReorderAttributeParams) => {
            if (hubId) {
                const response = await attributesApi.reorderAttribute(
                    metahubId,
                    hubId,
                    catalogId,
                    attributeId,
                    newSortOrder,
                    newParentAttributeId,
                    mergedOrderIds,
                    autoRenameCodename
                )
                return response.data
            }
            const response = await attributesApi.reorderAttributeDirect(
                metahubId,
                catalogId,
                attributeId,
                newSortOrder,
                newParentAttributeId,
                mergedOrderIds,
                autoRenameCodename
            )
            return response.data
        },
        onMutate: async (variables) => {
            const baseKey = variables.hubId
                ? metahubsQueryKeys.attributes(variables.metahubId, variables.hubId, variables.catalogId)
                : metahubsQueryKeys.attributesDirect(variables.metahubId, variables.catalogId)
            const childKeyPrefix = ['metahubs', 'childAttributes', variables.metahubId, variables.catalogId]

            // Cancel in-flight queries to prevent overwriting our optimistic update
            await queryClient.cancelQueries({ queryKey: baseKey })
            await queryClient.cancelQueries({ queryKey: childKeyPrefix })

            // Snapshot ALL relevant caches for rollback (covers both same-list and cross-list)
            const previousRootQueries = queryClient.getQueriesData<Record<string, unknown>>({ queryKey: baseKey })
            const previousChildQueries = queryClient.getQueriesData<Record<string, unknown>>({ queryKey: childKeyPrefix })

            const isCrossList = variables.newParentAttributeId !== undefined

            if (isCrossList) {
                // ── Cross-list transfer optimistic update ──
                const currentParent = variables.currentParentAttributeId ?? null
                const targetParent = variables.newParentAttributeId!
                const sourceIsRoot = currentParent === null
                const targetIsRoot = targetParent === null

                // Extract the moved item from source cache BEFORE applying updaters.
                // This avoids relying on a closure side-effect inside setQueriesData callbacks.
                const sourceKey = sourceIsRoot ? baseKey : [...childKeyPrefix, currentParent]
                let movedItem: Record<string, unknown> | null = null
                const sourceQueries = queryClient.getQueriesData<Record<string, unknown>>({ queryKey: sourceKey })
                for (const [, data] of sourceQueries) {
                    if (data && Array.isArray((data as Record<string, unknown> & { items?: unknown[] }).items)) {
                        const items = (data as Record<string, unknown> & { items: Record<string, unknown>[] }).items
                        const found = items.find((i) => (i as Record<string, unknown>).id === variables.attributeId)
                        if (found) {
                            movedItem = { ...found }
                            break
                        }
                    }
                }

                // Updater: remove the dragged attribute from source cache, re-index sort orders
                const removeUpdater = (old: Record<string, unknown> | undefined) => {
                    if (!old || !Array.isArray((old as Record<string, unknown> & { items?: unknown[] }).items)) return old
                    const items: Record<string, unknown>[] = (old as Record<string, unknown> & { items: Record<string, unknown>[] }).items
                    const idx = items.findIndex((i) => (i as Record<string, unknown>).id === variables.attributeId)
                    if (idx === -1) return old
                    const remaining = items.filter((_, i) => i !== idx)
                    const reindexed = remaining.map((item, i) => ({ ...item, sortOrder: i + 1 }))
                    return { ...old, items: reindexed }
                }

                // Remove from source cache
                queryClient.setQueriesData<Record<string, unknown>>({ queryKey: sourceKey }, removeUpdater)

                // Insert into target cache
                if (movedItem) {
                    const captured = movedItem
                    const insertUpdater = (old: Record<string, unknown> | undefined) => {
                        if (!old || !Array.isArray((old as Record<string, unknown> & { items?: unknown[] }).items)) return old
                        const items = [...(old as Record<string, unknown> & { items: Record<string, unknown>[] }).items]
                        const insertIdx = Math.min(Math.max(0, variables.newSortOrder - 1), items.length)
                        items.splice(insertIdx, 0, {
                            ...captured,
                            sortOrder: variables.newSortOrder,
                            parentAttributeId: variables.newParentAttributeId ?? null
                        })
                        const reindexed = items.map((item, i) => ({ ...item, sortOrder: i + 1 }))
                        return { ...old, items: reindexed }
                    }

                    const targetKey = targetIsRoot ? baseKey : [...childKeyPrefix, targetParent]
                    queryClient.setQueriesData<Record<string, unknown>>({ queryKey: targetKey }, insertUpdater)
                }
            } else {
                // ── Same-list reorder optimistic update ──
                const reorderUpdater = (old: Record<string, unknown> | undefined) => {
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

                    const fromIndex = items.findIndex((i) => (i as Record<string, unknown>).id === variables.attributeId)
                    if (fromIndex === -1) return old
                    let toIndex = items.findIndex((i) => ((i as Record<string, unknown>).sortOrder ?? 0) === variables.newSortOrder)
                    if (toIndex === -1) toIndex = items.length - 1
                    const [moved] = items.splice(fromIndex, 1)
                    items.splice(toIndex, 0, moved)
                    const updated = items.map((item, idx) => ({ ...item, sortOrder: idx + 1 }))
                    return { ...old, items: updated }
                }

                queryClient.setQueriesData<Record<string, unknown>>({ queryKey: baseKey }, reorderUpdater)
                queryClient.setQueriesData<Record<string, unknown>>({ queryKey: childKeyPrefix }, reorderUpdater)
            }

            return { previousRootQueries, previousChildQueries }
        },
        onError: (_error, _variables, context) => {
            // Rollback optimistic update on error
            if (context?.previousRootQueries) {
                for (const [key, data] of context.previousRootQueries) {
                    queryClient.setQueryData(key, data)
                }
            }
            if (context?.previousChildQueries) {
                for (const [key, data] of context.previousChildQueries) {
                    queryClient.setQueryData(key, data)
                }
            }
        },
        onSettled: (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['attributes'] }) <= 1) {
                if (variables.hubId) {
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.attributes(variables.metahubId, variables.hubId, variables.catalogId)
                    })
                    queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId) })
                } else {
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.attributesDirect(variables.metahubId, variables.catalogId)
                    })
                }
                // Invalidate child attribute queries only for cross-list transfers
                // (backend may auto-rename codename, auto-set display/required, etc.)
                if (variables.newParentAttributeId !== undefined) {
                    queryClient.invalidateQueries({
                        queryKey: ['metahubs', 'childAttributes', variables.metahubId, variables.catalogId]
                    })
                }
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogDetail(variables.metahubId, variables.catalogId) })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
            }
        }
    })
}

export function useCopyAttribute() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['attributes', 'copy'],
        mutationFn: async ({ metahubId, hubId, catalogId, attributeId, data }: CopyAttributeParams) => {
            if (hubId) {
                const response = await attributesApi.copyAttribute(metahubId, hubId, catalogId, attributeId, data)
                return response.data
            }
            const response = await attributesApi.copyAttributeDirect(metahubId, catalogId, attributeId, data)
            return response.data
        },
        onMutate: async (variables) => {
            const queryKeyPrefix = getAttributeQueryKeyPrefix(variables)
            const existingAttribute = queryClient
                .getQueriesData<{ items?: Array<Record<string, unknown>> }>({ queryKey: queryKeyPrefix })
                .flatMap(([, value]) => (Array.isArray(value?.items) ? value.items : []))
                .find((item) => item.id === variables.attributeId)

            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity: {
                    ...(existingAttribute ?? {}),
                    id: generateOptimisticId(),
                    catalogId: variables.catalogId,
                    codename:
                        variables.data.codename || (typeof existingAttribute?.codename === 'string' ? existingAttribute.codename : ''),
                    dataType:
                        (variables.data as Partial<CreateAttributeParams['data']>).dataType || existingAttribute?.dataType || 'STRING',
                    name: (variables.data as Partial<CreateAttributeParams['data']>).name || existingAttribute?.name || {},
                    updatedAt: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    ...makePendingMarkers('copy')
                },
                insertPosition: 'prepend'
            })
        },
        onSuccess: (data, _variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(queryClient, getAttributeQueryKeyPrefix(_variables), context.optimisticId, data.id, {
                    serverEntity: data
                })
            }
            console.info('[optimistic-copy:attributes] onSuccess', {
                metahubId: _variables.metahubId,
                catalogId: _variables.catalogId,
                attributeId: _variables.attributeId,
                optimisticId: context?.optimisticId,
                realId: data?.id ?? null
            })
            enqueueSnackbar(t('attributes.copySuccess', 'Attribute copied'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('attributes.copyError', 'Failed to copy attribute'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            invalidateAttributeScopes(queryClient, variables)
            console.info('[optimistic-copy:attributes] onSettled', {
                metahubId: variables.metahubId,
                catalogId: variables.catalogId,
                attributeId: variables.attributeId,
                hasError: Boolean(_error)
            })
        }
    })
}

export function useCopyChildAttribute() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['childAttributes', 'copy'],
        mutationFn: async ({ metahubId, hubId, catalogId, attributeId, data }: CopyChildAttributeParams) => {
            if (hubId) {
                const response = await attributesApi.copyAttribute(metahubId, hubId, catalogId, attributeId, data)
                return response.data
            }
            const response = await attributesApi.copyAttributeDirect(metahubId, catalogId, attributeId, data)
            return response.data
        },
        onMutate: async (variables) => {
            const queryKeyPrefix = getChildAttributeQueryKeyPrefix(variables)
            const optimisticSortOrder = getNextOptimisticSortOrderFromQueries(queryClient, queryKeyPrefix)
            const existingAttribute = queryClient
                .getQueriesData<{ items?: Array<Record<string, unknown>> }>({ queryKey: queryKeyPrefix })
                .flatMap(([, value]) => (Array.isArray(value?.items) ? value.items : []))
                .find((item) => item.id === variables.attributeId)

            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity: {
                    ...(existingAttribute ?? {}),
                    id: generateOptimisticId(),
                    catalogId: variables.catalogId,
                    parentAttributeId: variables.parentAttributeId,
                    codename:
                        variables.data.codename || (typeof existingAttribute?.codename === 'string' ? existingAttribute.codename : ''),
                    dataType:
                        (variables.data as Partial<CreateChildAttributeParams['data']>).dataType || existingAttribute?.dataType || 'STRING',
                    name: (variables.data as Partial<CreateChildAttributeParams['data']>).name || existingAttribute?.name || {},
                    targetEntityId:
                        (variables.data as Partial<CreateChildAttributeParams['data']>).targetEntityId ??
                        existingAttribute?.targetEntityId ??
                        null,
                    targetEntityKind:
                        (variables.data as Partial<CreateChildAttributeParams['data']>).targetEntityKind ??
                        existingAttribute?.targetEntityKind ??
                        null,
                    validationRules: variables.data.validationRules ?? existingAttribute?.validationRules ?? {},
                    uiConfig: variables.data.uiConfig ?? existingAttribute?.uiConfig ?? {},
                    isRequired:
                        typeof variables.data.isRequired === 'boolean' ? variables.data.isRequired : Boolean(existingAttribute?.isRequired),
                    isDisplayAttribute: false,
                    sortOrder: optimisticSortOrder,
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
                confirmOptimisticCreate(queryClient, getChildAttributeQueryKeyPrefix(variables), context.optimisticId, data.id, {
                    serverEntity: data
                })
            }
            enqueueSnackbar(t('attributes.copySuccess', 'Attribute copied'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('attributes.copyError', 'Failed to copy attribute'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            invalidateChildAttributeScopes(queryClient, variables)
        }
    })
}

export function useToggleAttributeRequired() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['attributes', 'toggleRequired'],
        mutationFn: async ({ metahubId, hubId, catalogId, attributeId, isRequired }: ToggleRequiredParams) => {
            if (hubId) {
                const response = await attributesApi.toggleAttributeRequired(metahubId, hubId, catalogId, attributeId, isRequired)
                return response.data
            }
            const response = await attributesApi.toggleAttributeRequiredDirect(metahubId, catalogId, attributeId, isRequired)
            return response.data
        },
        onSuccess: (_data, variables) => {
            const messageKey = variables.isRequired ? 'attributes.setRequiredSuccess' : 'attributes.setOptionalSuccess'
            const defaultMessage = variables.isRequired ? 'Attribute marked as required' : 'Attribute marked as optional'
            enqueueSnackbar(t(messageKey, defaultMessage), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('attributes.toggleRequiredError', 'Failed to update attribute'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['attributes'] }) <= 1) {
                if (variables.hubId) {
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.attributes(variables.metahubId, variables.hubId, variables.catalogId)
                    })
                } else {
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.attributesDirect(variables.metahubId, variables.catalogId)
                    })
                }
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogDetail(variables.metahubId, variables.catalogId) })
            }
        }
    })
}

export function useSetDisplayAttribute() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['attributes', 'setDisplay'],
        mutationFn: async ({ metahubId, hubId, catalogId, attributeId }: SetDisplayAttributeParams) => {
            if (hubId) {
                const response = await attributesApi.setDisplayAttribute(metahubId, hubId, catalogId, attributeId)
                return response.data
            }
            const response = await attributesApi.setDisplayAttributeDirect(metahubId, catalogId, attributeId)
            return response.data
        },
        onSuccess: () => {
            enqueueSnackbar(t('attributes.setDisplaySuccess', 'Attribute set as display attribute'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('attributes.setDisplayError', 'Failed to set display attribute'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['attributes'] }) <= 1) {
                if (variables.hubId) {
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.attributes(variables.metahubId, variables.hubId, variables.catalogId)
                    })
                } else {
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.attributesDirect(variables.metahubId, variables.catalogId)
                    })
                }
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogDetail(variables.metahubId, variables.catalogId) })
            }
        }
    })
}

export function useClearDisplayAttribute() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['attributes', 'clearDisplay'],
        mutationFn: async ({ metahubId, hubId, catalogId, attributeId }: SetDisplayAttributeParams) => {
            if (hubId) {
                const response = await attributesApi.clearDisplayAttribute(metahubId, hubId, catalogId, attributeId)
                return response.data
            }
            const response = await attributesApi.clearDisplayAttributeDirect(metahubId, catalogId, attributeId)
            return response.data
        },
        onSuccess: () => {
            enqueueSnackbar(t('attributes.clearDisplaySuccess', 'Display attribute flag cleared'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('attributes.clearDisplayError', 'Failed to clear display attribute'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['attributes'] }) <= 1) {
                if (variables.hubId) {
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.attributes(variables.metahubId, variables.hubId, variables.catalogId)
                    })
                } else {
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.attributesDirect(variables.metahubId, variables.catalogId)
                    })
                }
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogDetail(variables.metahubId, variables.catalogId) })
            }
        }
    })
}
