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
import { applyMergedSharedEntityOrder, metahubsQueryKeys, invalidateFieldDefinitionsQueries } from '../../../../shared'
import * as fieldDefinitionsApi from '../api'
import type {
    FieldDefinitionMutationError,
    CreateFieldDefinitionParams,
    UpdateFieldDefinitionParams,
    DeleteFieldDefinitionParams,
    MoveFieldDefinitionParams,
    CopyFieldDefinitionParams,
    CreateChildFieldDefinitionParams,
    UpdateChildFieldDefinitionParams,
    DeleteChildFieldDefinitionParams,
    CopyChildFieldDefinitionParams,
    ReorderFieldDefinitionParams,
    ToggleRequiredParams,
    SetDisplayFieldDefinitionParams
} from './mutationTypes'
import { handleAttributeError } from './fieldDefinitionErrorHandler'

const getAttributeQueryKeyPrefix = (variables: { metahubId: string; treeEntityId?: string; linkedCollectionId: string }) =>
    variables.treeEntityId
        ? metahubsQueryKeys.fieldDefinitions(variables.metahubId, variables.treeEntityId, variables.linkedCollectionId)
        : metahubsQueryKeys.fieldDefinitionsDirect(variables.metahubId, variables.linkedCollectionId)

const getChildAttributeQueryKeyPrefix = (variables: { metahubId: string; linkedCollectionId: string; parentAttributeId: string }) =>
    ['metahubs', 'childAttributes', variables.metahubId, variables.linkedCollectionId, variables.parentAttributeId] as const

const invalidateAttributeScopes = (
    queryClient: ReturnType<typeof useQueryClient>,
    variables: { metahubId: string; treeEntityId?: string; linkedCollectionId: string }
) => {
    if (queryClient.isMutating({ mutationKey: ['fieldDefinitions'] }) <= 1) {
        if (variables.treeEntityId) {
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.fieldDefinitions(variables.metahubId, variables.treeEntityId, variables.linkedCollectionId),
                refetchType: 'inactive'
            })
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.linkedCollections(variables.metahubId, variables.treeEntityId),
                refetchType: 'inactive'
            })
        } else {
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.fieldDefinitionsDirect(variables.metahubId, variables.linkedCollectionId),
                refetchType: 'inactive'
            })
        }
        queryClient.invalidateQueries({
            queryKey: metahubsQueryKeys.linkedCollectionDetail(variables.metahubId, variables.linkedCollectionId),
            refetchType: 'inactive'
        })
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allLinkedCollections(variables.metahubId), refetchType: 'inactive' })
    }
}

const invalidateChildAttributeScopes = (
    queryClient: ReturnType<typeof useQueryClient>,
    variables: { metahubId: string; treeEntityId?: string; linkedCollectionId: string; parentAttributeId: string }
) => {
    if (queryClient.isMutating({ mutationKey: ['childAttributes'] }) <= 1) {
        queryClient.invalidateQueries({
            queryKey: getChildAttributeQueryKeyPrefix(variables),
            refetchType: 'inactive'
        })
        queryClient.invalidateQueries({
            queryKey: ['metahubs', 'childAttributesForElements', variables.metahubId, variables.linkedCollectionId],
            refetchType: 'inactive'
        })
        queryClient.invalidateQueries({
            queryKey: ['metahubs', 'childEnumValues', variables.metahubId],
            refetchType: 'inactive'
        })
        invalidateFieldDefinitionsQueries.allCodenames(queryClient, variables.metahubId, variables.linkedCollectionId)

        if (variables.treeEntityId) {
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.fieldDefinitions(variables.metahubId, variables.treeEntityId, variables.linkedCollectionId),
                refetchType: 'inactive'
            })
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.linkedCollections(variables.metahubId, variables.treeEntityId),
                refetchType: 'inactive'
            })
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.linkedCollectionDetailInTreeEntity(
                    variables.metahubId,
                    variables.treeEntityId,
                    variables.linkedCollectionId
                ),
                refetchType: 'inactive'
            })
        } else {
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.fieldDefinitionsDirect(variables.metahubId, variables.linkedCollectionId),
                refetchType: 'inactive'
            })
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.linkedCollectionDetail(variables.metahubId, variables.linkedCollectionId),
                refetchType: 'inactive'
            })
        }

        queryClient.invalidateQueries({
            queryKey: metahubsQueryKeys.allLinkedCollections(variables.metahubId),
            refetchType: 'inactive'
        })
    }
}

export function useCreateFieldDefinition() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['fieldDefinitions', 'create'],
        mutationFn: async ({ metahubId, treeEntityId, linkedCollectionId, data }: CreateFieldDefinitionParams) => {
            if (treeEntityId) {
                const response = await fieldDefinitionsApi.createFieldDefinition(
                    metahubId,
                    treeEntityId,
                    linkedCollectionId,
                    data as Parameters<typeof fieldDefinitionsApi.createFieldDefinition>[3]
                )
                return response.data
            }
            const response = await fieldDefinitionsApi.createFieldDefinitionDirect(
                metahubId,
                linkedCollectionId,
                data as Parameters<typeof fieldDefinitionsApi.createFieldDefinitionDirect>[2]
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
                    linkedCollectionId: variables.linkedCollectionId,
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
            enqueueSnackbar(t('fieldDefinitions.createSuccess', 'Attribute created'), { variant: 'success' })
        },
        onError: (error: FieldDefinitionMutationError, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            handleAttributeError(error, t, enqueueSnackbar, 'fieldDefinitions.createError')
        },
        onSettled: (_data, _error, variables) => {
            invalidateAttributeScopes(queryClient, variables)
        }
    })
}

export function useCreateChildFieldDefinition() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['childAttributes', 'create'],
        mutationFn: async ({ metahubId, treeEntityId, linkedCollectionId, parentAttributeId, data }: CreateChildFieldDefinitionParams) => {
            if (treeEntityId) {
                const response = await fieldDefinitionsApi.createChildFieldDefinition(
                    metahubId,
                    treeEntityId,
                    linkedCollectionId,
                    parentAttributeId,
                    data
                )
                return response.data
            }
            const response = await fieldDefinitionsApi.createChildFieldDefinitionDirect(
                metahubId,
                linkedCollectionId,
                parentAttributeId,
                data
            )
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
                    linkedCollectionId: variables.linkedCollectionId,
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
            enqueueSnackbar(t('fieldDefinitions.createSuccess', 'Attribute created'), { variant: 'success' })
        },
        onError: (error: FieldDefinitionMutationError, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            handleAttributeError(error, t, enqueueSnackbar, 'fieldDefinitions.createError')
        },
        onSettled: (_data, _error, variables) => {
            invalidateChildAttributeScopes(queryClient, variables)
        }
    })
}

export function useUpdateFieldDefinition() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    const getErrorMessage = (error: FieldDefinitionMutationError) =>
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error.message ||
        t('fieldDefinitions.updateError', 'Failed to update attribute')

    return useMutation({
        mutationKey: ['fieldDefinitions', 'update'],
        mutationFn: async ({ metahubId, treeEntityId, linkedCollectionId, fieldDefinitionId, data }: UpdateFieldDefinitionParams) => {
            if (treeEntityId) {
                const response = await fieldDefinitionsApi.updateFieldDefinition(
                    metahubId,
                    treeEntityId,
                    linkedCollectionId,
                    fieldDefinitionId,
                    data as Parameters<typeof fieldDefinitionsApi.updateFieldDefinition>[4]
                )
                return response.data
            }
            const response = await fieldDefinitionsApi.updateFieldDefinitionDirect(
                metahubId,
                linkedCollectionId,
                fieldDefinitionId,
                data as Parameters<typeof fieldDefinitionsApi.updateFieldDefinitionDirect>[3]
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
                    const existing = data?.items?.find((item) => item.id === variables.fieldDefinitionId)
                    if (existing?.system) {
                        updater.system = { ...existing.system, isEnabled: variables.data.isEnabled }
                        break
                    }
                }
            }
            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: getAttributeQueryKeyPrefix(variables),
                entityId: variables.fieldDefinitionId,
                updater,
                moveToFront: !isSystemToggle
            })
        },
        onSuccess: async (data, variables) => {
            await queryClient.cancelQueries({ queryKey: getAttributeQueryKeyPrefix(variables) })
            const isSystemToggle = variables.data.isEnabled !== undefined
            confirmOptimisticUpdate(queryClient, getAttributeQueryKeyPrefix(variables), variables.fieldDefinitionId, {
                serverEntity: data ?? null,
                moveToFront: !isSystemToggle
            })
            const successMessage =
                variables.data.isEnabled === true
                    ? t('fieldDefinitions.system.enableSuccess', 'System attribute enabled')
                    : variables.data.isEnabled === false
                    ? t('fieldDefinitions.system.disableSuccess', 'System attribute disabled')
                    : t('fieldDefinitions.updateSuccess', 'Attribute updated')
            enqueueSnackbar(successMessage, { variant: 'success' })
        },
        onError: (error: FieldDefinitionMutationError, _variables, context) => {
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
        mutationFn: async ({ metahubId, treeEntityId, linkedCollectionId, fieldDefinitionId, data }: UpdateChildFieldDefinitionParams) => {
            if (treeEntityId) {
                const response = await fieldDefinitionsApi.updateFieldDefinition(
                    metahubId,
                    treeEntityId,
                    linkedCollectionId,
                    fieldDefinitionId,
                    data
                )
                return response.data
            }
            const response = await fieldDefinitionsApi.updateFieldDefinitionDirect(metahubId, linkedCollectionId, fieldDefinitionId, data)
            return response.data
        },
        onMutate: async (variables) => {
            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: getChildAttributeQueryKeyPrefix(variables),
                entityId: variables.fieldDefinitionId,
                updater: {
                    ...variables.data,
                    updatedAt: new Date().toISOString()
                }
            })
        },
        onSuccess: async (data, variables) => {
            await queryClient.cancelQueries({ queryKey: getChildAttributeQueryKeyPrefix(variables) })
            confirmOptimisticUpdate(queryClient, getChildAttributeQueryKeyPrefix(variables), variables.fieldDefinitionId, {
                serverEntity: data ?? null
            })
            enqueueSnackbar(t('fieldDefinitions.updateSuccess', 'Attribute updated'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('fieldDefinitions.updateError', 'Failed to update attribute'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            invalidateChildAttributeScopes(queryClient, variables)
        }
    })
}

export function useDeleteFieldDefinition() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['fieldDefinitions', 'delete'],
        mutationFn: async ({ metahubId, treeEntityId, linkedCollectionId, fieldDefinitionId }: DeleteFieldDefinitionParams) => {
            if (treeEntityId) {
                await fieldDefinitionsApi.deleteFieldDefinition(metahubId, treeEntityId, linkedCollectionId, fieldDefinitionId)
            } else {
                await fieldDefinitionsApi.deleteFieldDefinitionDirect(metahubId, linkedCollectionId, fieldDefinitionId)
            }
        },
        onMutate: async (variables) => {
            return applyOptimisticDelete({
                queryClient,
                queryKeyPrefix: getAttributeQueryKeyPrefix(variables),
                entityId: variables.fieldDefinitionId,
                strategy: 'remove'
            })
        },
        onSuccess: () => {
            enqueueSnackbar(t('fieldDefinitions.deleteSuccess', 'Attribute deleted'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('fieldDefinitions.deleteError', 'Failed to delete attribute'), { variant: 'error' })
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
        mutationFn: async ({ metahubId, treeEntityId, linkedCollectionId, fieldDefinitionId }: DeleteChildFieldDefinitionParams) => {
            if (treeEntityId) {
                await fieldDefinitionsApi.deleteFieldDefinition(metahubId, treeEntityId, linkedCollectionId, fieldDefinitionId)
            } else {
                await fieldDefinitionsApi.deleteFieldDefinitionDirect(metahubId, linkedCollectionId, fieldDefinitionId)
            }
        },
        onMutate: async (variables) => {
            return applyOptimisticDelete({
                queryClient,
                queryKeyPrefix: getChildAttributeQueryKeyPrefix(variables),
                entityId: variables.fieldDefinitionId,
                strategy: 'remove'
            })
        },
        onSuccess: () => {
            enqueueSnackbar(t('fieldDefinitions.deleteSuccess', 'Attribute deleted'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('fieldDefinitions.deleteError', 'Failed to delete attribute'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            invalidateChildAttributeScopes(queryClient, variables)
        }
    })
}

export function useMoveFieldDefinition() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['fieldDefinitions', 'move'],
        mutationFn: async ({ metahubId, treeEntityId, linkedCollectionId, fieldDefinitionId, direction }: MoveFieldDefinitionParams) => {
            if (treeEntityId) {
                const response = await fieldDefinitionsApi.moveFieldDefinition(
                    metahubId,
                    treeEntityId,
                    linkedCollectionId,
                    fieldDefinitionId,
                    direction
                )
                return response.data
            }
            const response = await fieldDefinitionsApi.moveFieldDefinitionDirect(
                metahubId,
                linkedCollectionId,
                fieldDefinitionId,
                direction
            )
            return response.data
        },
        onSuccess: () => {
            enqueueSnackbar(t('fieldDefinitions.moveSuccess', 'Attribute order updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('fieldDefinitions.moveError', 'Failed to update attribute order'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['fieldDefinitions'] }) <= 1) {
                if (variables.treeEntityId) {
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.fieldDefinitions(
                            variables.metahubId,
                            variables.treeEntityId,
                            variables.linkedCollectionId
                        )
                    })
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.linkedCollections(variables.metahubId, variables.treeEntityId)
                    })
                } else {
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.fieldDefinitionsDirect(variables.metahubId, variables.linkedCollectionId)
                    })
                }
                queryClient.invalidateQueries({
                    queryKey: metahubsQueryKeys.linkedCollectionDetail(variables.metahubId, variables.linkedCollectionId)
                })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allLinkedCollections(variables.metahubId) })
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
export function useReorderFieldDefinition() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationKey: ['fieldDefinitions', 'reorder'],
        mutationFn: async ({
            metahubId,
            treeEntityId,
            linkedCollectionId,
            fieldDefinitionId,
            newSortOrder,
            newParentAttributeId,
            mergedOrderIds,
            autoRenameCodename
        }: ReorderFieldDefinitionParams) => {
            if (treeEntityId) {
                const response = await fieldDefinitionsApi.reorderFieldDefinition(
                    metahubId,
                    treeEntityId,
                    linkedCollectionId,
                    fieldDefinitionId,
                    newSortOrder,
                    newParentAttributeId,
                    mergedOrderIds,
                    autoRenameCodename
                )
                return response.data
            }
            const response = await fieldDefinitionsApi.reorderFieldDefinitionDirect(
                metahubId,
                linkedCollectionId,
                fieldDefinitionId,
                newSortOrder,
                newParentAttributeId,
                mergedOrderIds,
                autoRenameCodename
            )
            return response.data
        },
        onMutate: async (variables) => {
            const baseKey = variables.treeEntityId
                ? metahubsQueryKeys.fieldDefinitions(variables.metahubId, variables.treeEntityId, variables.linkedCollectionId)
                : metahubsQueryKeys.fieldDefinitionsDirect(variables.metahubId, variables.linkedCollectionId)
            const childKeyPrefix = ['metahubs', 'childAttributes', variables.metahubId, variables.linkedCollectionId]

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
                        const found = items.find((i) => (i as Record<string, unknown>).id === variables.fieldDefinitionId)
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
                    const idx = items.findIndex((i) => (i as Record<string, unknown>).id === variables.fieldDefinitionId)
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

                    const fromIndex = items.findIndex((i) => (i as Record<string, unknown>).id === variables.fieldDefinitionId)
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
            if (queryClient.isMutating({ mutationKey: ['fieldDefinitions'] }) <= 1) {
                if (variables.treeEntityId) {
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.fieldDefinitions(
                            variables.metahubId,
                            variables.treeEntityId,
                            variables.linkedCollectionId
                        )
                    })
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.linkedCollections(variables.metahubId, variables.treeEntityId)
                    })
                } else {
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.fieldDefinitionsDirect(variables.metahubId, variables.linkedCollectionId)
                    })
                }
                // Invalidate child attribute queries only for cross-list transfers
                // (backend may auto-rename codename, auto-set display/required, etc.)
                if (variables.newParentAttributeId !== undefined) {
                    queryClient.invalidateQueries({
                        queryKey: ['metahubs', 'childAttributes', variables.metahubId, variables.linkedCollectionId]
                    })
                }
                queryClient.invalidateQueries({
                    queryKey: metahubsQueryKeys.linkedCollectionDetail(variables.metahubId, variables.linkedCollectionId)
                })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allLinkedCollections(variables.metahubId) })
            }
        }
    })
}

export function useCopyFieldDefinition() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['fieldDefinitions', 'copy'],
        mutationFn: async ({ metahubId, treeEntityId, linkedCollectionId, fieldDefinitionId, data }: CopyFieldDefinitionParams) => {
            if (treeEntityId) {
                const response = await fieldDefinitionsApi.copyFieldDefinition(
                    metahubId,
                    treeEntityId,
                    linkedCollectionId,
                    fieldDefinitionId,
                    data
                )
                return response.data
            }
            const response = await fieldDefinitionsApi.copyFieldDefinitionDirect(metahubId, linkedCollectionId, fieldDefinitionId, data)
            return response.data
        },
        onMutate: async (variables) => {
            const queryKeyPrefix = getAttributeQueryKeyPrefix(variables)
            const existingAttribute = queryClient
                .getQueriesData<{ items?: Array<Record<string, unknown>> }>({ queryKey: queryKeyPrefix })
                .flatMap(([, value]) => (Array.isArray(value?.items) ? value.items : []))
                .find((item) => item.id === variables.fieldDefinitionId)

            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity: {
                    ...(existingAttribute ?? {}),
                    id: generateOptimisticId(),
                    linkedCollectionId: variables.linkedCollectionId,
                    codename:
                        variables.data.codename || (typeof existingAttribute?.codename === 'string' ? existingAttribute.codename : ''),
                    dataType:
                        (variables.data as Partial<CreateFieldDefinitionParams['data']>).dataType ||
                        existingAttribute?.dataType ||
                        'STRING',
                    name: (variables.data as Partial<CreateFieldDefinitionParams['data']>).name || existingAttribute?.name || {},
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
            console.info('[optimistic-copy:fieldDefinitions] onSuccess', {
                metahubId: _variables.metahubId,
                linkedCollectionId: _variables.linkedCollectionId,
                fieldDefinitionId: _variables.fieldDefinitionId,
                optimisticId: context?.optimisticId,
                realId: data?.id ?? null
            })
            enqueueSnackbar(t('fieldDefinitions.copySuccess', 'Attribute copied'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('fieldDefinitions.copyError', 'Failed to copy attribute'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            invalidateAttributeScopes(queryClient, variables)
            console.info('[optimistic-copy:fieldDefinitions] onSettled', {
                metahubId: variables.metahubId,
                linkedCollectionId: variables.linkedCollectionId,
                fieldDefinitionId: variables.fieldDefinitionId,
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
        mutationFn: async ({ metahubId, treeEntityId, linkedCollectionId, fieldDefinitionId, data }: CopyChildFieldDefinitionParams) => {
            if (treeEntityId) {
                const response = await fieldDefinitionsApi.copyFieldDefinition(
                    metahubId,
                    treeEntityId,
                    linkedCollectionId,
                    fieldDefinitionId,
                    data
                )
                return response.data
            }
            const response = await fieldDefinitionsApi.copyFieldDefinitionDirect(metahubId, linkedCollectionId, fieldDefinitionId, data)
            return response.data
        },
        onMutate: async (variables) => {
            const queryKeyPrefix = getChildAttributeQueryKeyPrefix(variables)
            const optimisticSortOrder = getNextOptimisticSortOrderFromQueries(queryClient, queryKeyPrefix)
            const existingAttribute = queryClient
                .getQueriesData<{ items?: Array<Record<string, unknown>> }>({ queryKey: queryKeyPrefix })
                .flatMap(([, value]) => (Array.isArray(value?.items) ? value.items : []))
                .find((item) => item.id === variables.fieldDefinitionId)

            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity: {
                    ...(existingAttribute ?? {}),
                    id: generateOptimisticId(),
                    linkedCollectionId: variables.linkedCollectionId,
                    parentAttributeId: variables.parentAttributeId,
                    codename:
                        variables.data.codename || (typeof existingAttribute?.codename === 'string' ? existingAttribute.codename : ''),
                    dataType:
                        (variables.data as Partial<CreateChildFieldDefinitionParams['data']>).dataType ||
                        existingAttribute?.dataType ||
                        'STRING',
                    name: (variables.data as Partial<CreateChildFieldDefinitionParams['data']>).name || existingAttribute?.name || {},
                    targetEntityId:
                        (variables.data as Partial<CreateChildFieldDefinitionParams['data']>).targetEntityId ??
                        existingAttribute?.targetEntityId ??
                        null,
                    targetEntityKind:
                        (variables.data as Partial<CreateChildFieldDefinitionParams['data']>).targetEntityKind ??
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
            enqueueSnackbar(t('fieldDefinitions.copySuccess', 'Attribute copied'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('fieldDefinitions.copyError', 'Failed to copy attribute'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            invalidateChildAttributeScopes(queryClient, variables)
        }
    })
}

export function useToggleFieldDefinitionRequired() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['fieldDefinitions', 'toggleRequired'],
        mutationFn: async ({ metahubId, treeEntityId, linkedCollectionId, fieldDefinitionId, isRequired }: ToggleRequiredParams) => {
            if (treeEntityId) {
                const response = await fieldDefinitionsApi.toggleFieldDefinitionRequired(
                    metahubId,
                    treeEntityId,
                    linkedCollectionId,
                    fieldDefinitionId,
                    isRequired
                )
                return response.data
            }
            const response = await fieldDefinitionsApi.toggleFieldDefinitionRequiredDirect(
                metahubId,
                linkedCollectionId,
                fieldDefinitionId,
                isRequired
            )
            return response.data
        },
        onSuccess: (_data, variables) => {
            const messageKey = variables.isRequired ? 'fieldDefinitions.setRequiredSuccess' : 'fieldDefinitions.setOptionalSuccess'
            const defaultMessage = variables.isRequired ? 'Attribute marked as required' : 'Attribute marked as optional'
            enqueueSnackbar(t(messageKey, defaultMessage), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('fieldDefinitions.toggleRequiredError', 'Failed to update attribute'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['fieldDefinitions'] }) <= 1) {
                if (variables.treeEntityId) {
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.fieldDefinitions(
                            variables.metahubId,
                            variables.treeEntityId,
                            variables.linkedCollectionId
                        )
                    })
                } else {
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.fieldDefinitionsDirect(variables.metahubId, variables.linkedCollectionId)
                    })
                }
                queryClient.invalidateQueries({
                    queryKey: metahubsQueryKeys.linkedCollectionDetail(variables.metahubId, variables.linkedCollectionId)
                })
            }
        }
    })
}

export function useSetDisplayFieldDefinition() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['fieldDefinitions', 'setDisplay'],
        mutationFn: async ({ metahubId, treeEntityId, linkedCollectionId, fieldDefinitionId }: SetDisplayFieldDefinitionParams) => {
            if (treeEntityId) {
                const response = await fieldDefinitionsApi.setDisplayFieldDefinition(
                    metahubId,
                    treeEntityId,
                    linkedCollectionId,
                    fieldDefinitionId
                )
                return response.data
            }
            const response = await fieldDefinitionsApi.setDisplayFieldDefinitionDirect(metahubId, linkedCollectionId, fieldDefinitionId)
            return response.data
        },
        onSuccess: () => {
            enqueueSnackbar(t('fieldDefinitions.setDisplaySuccess', 'Attribute set as display attribute'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('fieldDefinitions.setDisplayError', 'Failed to set display attribute'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['fieldDefinitions'] }) <= 1) {
                if (variables.treeEntityId) {
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.fieldDefinitions(
                            variables.metahubId,
                            variables.treeEntityId,
                            variables.linkedCollectionId
                        )
                    })
                } else {
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.fieldDefinitionsDirect(variables.metahubId, variables.linkedCollectionId)
                    })
                }
                queryClient.invalidateQueries({
                    queryKey: metahubsQueryKeys.linkedCollectionDetail(variables.metahubId, variables.linkedCollectionId)
                })
            }
        }
    })
}

export function useClearDisplayFieldDefinition() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['fieldDefinitions', 'clearDisplay'],
        mutationFn: async ({ metahubId, treeEntityId, linkedCollectionId, fieldDefinitionId }: SetDisplayFieldDefinitionParams) => {
            if (treeEntityId) {
                const response = await fieldDefinitionsApi.clearDisplayFieldDefinition(
                    metahubId,
                    treeEntityId,
                    linkedCollectionId,
                    fieldDefinitionId
                )
                return response.data
            }
            const response = await fieldDefinitionsApi.clearDisplayFieldDefinitionDirect(metahubId, linkedCollectionId, fieldDefinitionId)
            return response.data
        },
        onSuccess: () => {
            enqueueSnackbar(t('fieldDefinitions.clearDisplaySuccess', 'Display attribute flag cleared'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('fieldDefinitions.clearDisplayError', 'Failed to clear display attribute'), {
                variant: 'error'
            })
        },
        onSettled: (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['fieldDefinitions'] }) <= 1) {
                if (variables.treeEntityId) {
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.fieldDefinitions(
                            variables.metahubId,
                            variables.treeEntityId,
                            variables.linkedCollectionId
                        )
                    })
                } else {
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.fieldDefinitionsDirect(variables.metahubId, variables.linkedCollectionId)
                    })
                }
                queryClient.invalidateQueries({
                    queryKey: metahubsQueryKeys.linkedCollectionDetail(variables.metahubId, variables.linkedCollectionId)
                })
            }
        }
    })
}
