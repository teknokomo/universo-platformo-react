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
import { applyMergedSharedEntityOrder, metahubsQueryKeys, invalidateComponentsQueries } from '../../../../shared'
import * as componentsApi from '../api'
import type {
    ComponentMutationError,
    CreateComponentParams,
    UpdateComponentParams,
    DeleteComponentParams,
    MoveComponentParams,
    CopyComponentParams,
    CreateChildComponentParams,
    UpdateChildComponentParams,
    DeleteChildComponentParams,
    CopyChildComponentParams,
    ReorderComponentParams,
    ToggleRequiredParams,
    SetDisplayComponentParams
} from './mutationTypes'
import { handleComponentError } from './componentErrorHandler'

const getComponentQueryKeyPrefix = (variables: { metahubId: string; treeEntityId?: string; objectCollectionId: string }) =>
    variables.treeEntityId
        ? metahubsQueryKeys.components(variables.metahubId, variables.treeEntityId, variables.objectCollectionId)
        : metahubsQueryKeys.componentsDirect(variables.metahubId, variables.objectCollectionId)

const getChildComponentQueryKeyPrefix = (variables: { metahubId: string; objectCollectionId: string; parentComponentId: string }) =>
    ['metahubs', 'childComponents', variables.metahubId, variables.objectCollectionId, variables.parentComponentId] as const

const invalidateComponentScopes = (
    queryClient: ReturnType<typeof useQueryClient>,
    variables: { metahubId: string; treeEntityId?: string; objectCollectionId: string }
) => {
    if (queryClient.isMutating({ mutationKey: ['components'] }) <= 1) {
        if (variables.treeEntityId) {
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.components(variables.metahubId, variables.treeEntityId, variables.objectCollectionId),
                refetchType: 'inactive'
            })
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.objectCollections(variables.metahubId, variables.treeEntityId),
                refetchType: 'inactive'
            })
        } else {
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.componentsDirect(variables.metahubId, variables.objectCollectionId),
                refetchType: 'inactive'
            })
        }
        queryClient.invalidateQueries({
            queryKey: metahubsQueryKeys.objectCollectionDetail(variables.metahubId, variables.objectCollectionId),
            refetchType: 'inactive'
        })
        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allObjectCollections(variables.metahubId), refetchType: 'inactive' })
    }
}

const invalidateChildComponentScopes = (
    queryClient: ReturnType<typeof useQueryClient>,
    variables: { metahubId: string; treeEntityId?: string; objectCollectionId: string; parentComponentId: string }
) => {
    if (queryClient.isMutating({ mutationKey: ['childComponents'] }) <= 1) {
        queryClient.invalidateQueries({
            queryKey: getChildComponentQueryKeyPrefix(variables),
            refetchType: 'inactive'
        })
        queryClient.invalidateQueries({
            queryKey: ['metahubs', 'childComponentsForElements', variables.metahubId, variables.objectCollectionId],
            refetchType: 'inactive'
        })
        queryClient.invalidateQueries({
            queryKey: ['metahubs', 'childEnumValues', variables.metahubId],
            refetchType: 'inactive'
        })
        invalidateComponentsQueries.allCodenames(queryClient, variables.metahubId, variables.objectCollectionId)

        if (variables.treeEntityId) {
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.components(variables.metahubId, variables.treeEntityId, variables.objectCollectionId),
                refetchType: 'inactive'
            })
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.objectCollections(variables.metahubId, variables.treeEntityId),
                refetchType: 'inactive'
            })
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.objectCollectionDetailInTreeEntity(
                    variables.metahubId,
                    variables.treeEntityId,
                    variables.objectCollectionId
                ),
                refetchType: 'inactive'
            })
        } else {
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.componentsDirect(variables.metahubId, variables.objectCollectionId),
                refetchType: 'inactive'
            })
            queryClient.invalidateQueries({
                queryKey: metahubsQueryKeys.objectCollectionDetail(variables.metahubId, variables.objectCollectionId),
                refetchType: 'inactive'
            })
        }

        queryClient.invalidateQueries({
            queryKey: metahubsQueryKeys.allObjectCollections(variables.metahubId),
            refetchType: 'inactive'
        })
    }
}

export function useCreateComponent() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['components', 'create'],
        mutationFn: async ({ metahubId, treeEntityId, objectCollectionId, data }: CreateComponentParams) => {
            if (treeEntityId) {
                const response = await componentsApi.createComponent(
                    metahubId,
                    treeEntityId,
                    objectCollectionId,
                    data as Parameters<typeof componentsApi.createComponent>[3]
                )
                return response.data
            }
            const response = await componentsApi.createComponentDirect(
                metahubId,
                objectCollectionId,
                data as Parameters<typeof componentsApi.createComponentDirect>[2]
            )
            return response.data
        },
        onMutate: async (variables) => {
            const queryKeyPrefix = getComponentQueryKeyPrefix(variables)
            const optimisticSortOrder = variables.data.sortOrder ?? getNextOptimisticSortOrderFromQueries(queryClient, queryKeyPrefix)
            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity: {
                    id: generateOptimisticId(),
                    objectCollectionId: variables.objectCollectionId,
                    codename: variables.data.codename || '',
                    dataType: variables.data.dataType,
                    name: variables.data.name,
                    targetEntityId: variables.data.targetEntityId ?? null,
                    targetEntityKind: variables.data.targetEntityKind ?? null,
                    targetConstantId: variables.data.targetConstantId ?? null,
                    validationRules: variables.data.validationRules ?? {},
                    uiConfig: variables.data.uiConfig ?? {},
                    isRequired: variables.data.isRequired ?? false,
                    isDisplayComponent: false,
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
                confirmOptimisticCreate(queryClient, getComponentQueryKeyPrefix(variables), context.optimisticId, data.id, {
                    serverEntity: data
                })
            }
            enqueueSnackbar(t('components.createSuccess', 'Component created'), { variant: 'success' })
        },
        onError: (error: ComponentMutationError, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            handleComponentError(error, t, enqueueSnackbar, 'components.createError')
        },
        onSettled: (_data, _error, variables) => {
            invalidateComponentScopes(queryClient, variables)
        }
    })
}

export function useCreateChildComponent() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['childComponents', 'create'],
        mutationFn: async ({ metahubId, treeEntityId, objectCollectionId, parentComponentId, data }: CreateChildComponentParams) => {
            if (treeEntityId) {
                const response = await componentsApi.createChildComponent(
                    metahubId,
                    treeEntityId,
                    objectCollectionId,
                    parentComponentId,
                    data
                )
                return response.data
            }
            const response = await componentsApi.createChildComponentDirect(metahubId, objectCollectionId, parentComponentId, data)
            return response.data
        },
        onMutate: async (variables) => {
            const queryKeyPrefix = getChildComponentQueryKeyPrefix(variables)
            const optimisticSortOrder = variables.data.sortOrder ?? getNextOptimisticSortOrderFromQueries(queryClient, queryKeyPrefix)

            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity: {
                    id: generateOptimisticId(),
                    objectCollectionId: variables.objectCollectionId,
                    parentComponentId: variables.parentComponentId,
                    codename: variables.data.codename || '',
                    dataType: variables.data.dataType,
                    name: variables.data.name,
                    targetEntityId: variables.data.targetEntityId ?? null,
                    targetEntityKind: variables.data.targetEntityKind ?? null,
                    targetConstantId: variables.data.targetConstantId ?? null,
                    validationRules: variables.data.validationRules ?? {},
                    uiConfig: variables.data.uiConfig ?? {},
                    isRequired: variables.data.isRequired ?? false,
                    isDisplayComponent: variables.data.isDisplayComponent ?? false,
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
                confirmOptimisticCreate(queryClient, getChildComponentQueryKeyPrefix(variables), context.optimisticId, data.id, {
                    serverEntity: data
                })
            }
            enqueueSnackbar(t('components.createSuccess', 'Component created'), { variant: 'success' })
        },
        onError: (error: ComponentMutationError, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            handleComponentError(error, t, enqueueSnackbar, 'components.createError')
        },
        onSettled: (_data, _error, variables) => {
            invalidateChildComponentScopes(queryClient, variables)
        }
    })
}

export function useUpdateComponent() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    const getErrorMessage = (error: ComponentMutationError) =>
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error.message ||
        t('components.updateError', 'Failed to update component')

    return useMutation({
        mutationKey: ['components', 'update'],
        mutationFn: async ({ metahubId, treeEntityId, objectCollectionId, componentId, data }: UpdateComponentParams) => {
            if (treeEntityId) {
                const response = await componentsApi.updateComponent(
                    metahubId,
                    treeEntityId,
                    objectCollectionId,
                    componentId,
                    data as Parameters<typeof componentsApi.updateComponent>[4]
                )
                return response.data
            }
            const response = await componentsApi.updateComponentDirect(
                metahubId,
                objectCollectionId,
                componentId,
                data as Parameters<typeof componentsApi.updateComponentDirect>[3]
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
                const queryKeyPrefix = getComponentQueryKeyPrefix(variables)
                const queries = queryClient.getQueriesData<{ items?: Array<{ id: string; system?: { isEnabled?: boolean } }> }>({
                    queryKey: queryKeyPrefix
                })
                for (const [, data] of queries) {
                    const existing = data?.items?.find((item) => item.id === variables.componentId)
                    if (existing?.system) {
                        updater.system = { ...existing.system, isEnabled: variables.data.isEnabled }
                        break
                    }
                }
            }
            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: getComponentQueryKeyPrefix(variables),
                entityId: variables.componentId,
                updater,
                moveToFront: !isSystemToggle
            })
        },
        onSuccess: async (data, variables) => {
            await queryClient.cancelQueries({ queryKey: getComponentQueryKeyPrefix(variables) })
            const isSystemToggle = variables.data.isEnabled !== undefined
            confirmOptimisticUpdate(queryClient, getComponentQueryKeyPrefix(variables), variables.componentId, {
                serverEntity: data ?? null,
                moveToFront: !isSystemToggle
            })
            const successMessage =
                variables.data.isEnabled === true
                    ? t('components.system.enableSuccess', 'System component enabled')
                    : variables.data.isEnabled === false
                    ? t('components.system.disableSuccess', 'System component disabled')
                    : t('components.updateSuccess', 'Component updated')
            enqueueSnackbar(successMessage, { variant: 'success' })
        },
        onError: (error: ComponentMutationError, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(getErrorMessage(error), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            invalidateComponentScopes(queryClient, variables)
            // For system toggles, force refetch of active queries to restore
            // authoritative server sort order (inactive-only invalidation above
            // does not refetch the visible list)
            if (variables.data.isEnabled !== undefined) {
                const queryKeyPrefix = getComponentQueryKeyPrefix(variables)
                void queryClient.invalidateQueries({ queryKey: queryKeyPrefix })
            }
        }
    })
}

export function useUpdateChildComponent() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['childComponents', 'update'],
        mutationFn: async ({ metahubId, treeEntityId, objectCollectionId, componentId, data }: UpdateChildComponentParams) => {
            if (treeEntityId) {
                const response = await componentsApi.updateComponent(metahubId, treeEntityId, objectCollectionId, componentId, data)
                return response.data
            }
            const response = await componentsApi.updateComponentDirect(metahubId, objectCollectionId, componentId, data)
            return response.data
        },
        onMutate: async (variables) => {
            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: getChildComponentQueryKeyPrefix(variables),
                entityId: variables.componentId,
                updater: {
                    ...variables.data,
                    updatedAt: new Date().toISOString()
                }
            })
        },
        onSuccess: async (data, variables) => {
            await queryClient.cancelQueries({ queryKey: getChildComponentQueryKeyPrefix(variables) })
            confirmOptimisticUpdate(queryClient, getChildComponentQueryKeyPrefix(variables), variables.componentId, {
                serverEntity: data ?? null
            })
            enqueueSnackbar(t('components.updateSuccess', 'Component updated'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('components.updateError', 'Failed to update component'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            invalidateChildComponentScopes(queryClient, variables)
        }
    })
}

export function useDeleteComponent() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['components', 'delete'],
        mutationFn: async ({ metahubId, treeEntityId, objectCollectionId, componentId }: DeleteComponentParams) => {
            if (treeEntityId) {
                await componentsApi.deleteComponent(metahubId, treeEntityId, objectCollectionId, componentId)
            } else {
                await componentsApi.deleteComponentDirect(metahubId, objectCollectionId, componentId)
            }
        },
        onMutate: async (variables) => {
            return applyOptimisticDelete({
                queryClient,
                queryKeyPrefix: getComponentQueryKeyPrefix(variables),
                entityId: variables.componentId,
                strategy: 'remove'
            })
        },
        onSuccess: () => {
            enqueueSnackbar(t('components.deleteSuccess', 'Component deleted'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('components.deleteError', 'Failed to delete component'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            invalidateComponentScopes(queryClient, variables)
        }
    })
}

export function useDeleteChildComponent() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['childComponents', 'delete'],
        mutationFn: async ({ metahubId, treeEntityId, objectCollectionId, componentId }: DeleteChildComponentParams) => {
            if (treeEntityId) {
                await componentsApi.deleteComponent(metahubId, treeEntityId, objectCollectionId, componentId)
            } else {
                await componentsApi.deleteComponentDirect(metahubId, objectCollectionId, componentId)
            }
        },
        onMutate: async (variables) => {
            return applyOptimisticDelete({
                queryClient,
                queryKeyPrefix: getChildComponentQueryKeyPrefix(variables),
                entityId: variables.componentId,
                strategy: 'remove'
            })
        },
        onSuccess: () => {
            enqueueSnackbar(t('components.deleteSuccess', 'Component deleted'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('components.deleteError', 'Failed to delete component'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            invalidateChildComponentScopes(queryClient, variables)
        }
    })
}

export function useMoveComponent() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['components', 'move'],
        mutationFn: async ({ metahubId, treeEntityId, objectCollectionId, componentId, direction }: MoveComponentParams) => {
            if (treeEntityId) {
                const response = await componentsApi.moveComponent(metahubId, treeEntityId, objectCollectionId, componentId, direction)
                return response.data
            }
            const response = await componentsApi.moveComponentDirect(metahubId, objectCollectionId, componentId, direction)
            return response.data
        },
        onSuccess: () => {
            enqueueSnackbar(t('components.moveSuccess', 'Component order updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('components.moveError', 'Failed to update component order'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['components'] }) <= 1) {
                if (variables.treeEntityId) {
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.components(variables.metahubId, variables.treeEntityId, variables.objectCollectionId)
                    })
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.objectCollections(variables.metahubId, variables.treeEntityId)
                    })
                } else {
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.componentsDirect(variables.metahubId, variables.objectCollectionId)
                    })
                }
                queryClient.invalidateQueries({
                    queryKey: metahubsQueryKeys.objectCollectionDetail(variables.metahubId, variables.objectCollectionId)
                })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allObjectCollections(variables.metahubId) })
            }
        }
    })
}

/**
 * Reorder an component via DnD (same-list reorder + cross-list transfer).
 * No onError here — error handling is done in the calling component
 * to distinguish CODENAME_CONFLICT (409) and offer auto-rename dialog.
 * Optimistic updates for both same-list reorder and cross-list transfer.
 */
export function useReorderComponent() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationKey: ['components', 'reorder'],
        mutationFn: async ({
            metahubId,
            treeEntityId,
            objectCollectionId,
            componentId,
            newSortOrder,
            newParentComponentId,
            mergedOrderIds,
            autoRenameCodename
        }: ReorderComponentParams) => {
            if (treeEntityId) {
                const response = await componentsApi.reorderComponent(
                    metahubId,
                    treeEntityId,
                    objectCollectionId,
                    componentId,
                    newSortOrder,
                    newParentComponentId,
                    mergedOrderIds,
                    autoRenameCodename
                )
                return response.data
            }
            const response = await componentsApi.reorderComponentDirect(
                metahubId,
                objectCollectionId,
                componentId,
                newSortOrder,
                newParentComponentId,
                mergedOrderIds,
                autoRenameCodename
            )
            return response.data
        },
        onMutate: async (variables) => {
            const baseKey = variables.treeEntityId
                ? metahubsQueryKeys.components(variables.metahubId, variables.treeEntityId, variables.objectCollectionId)
                : metahubsQueryKeys.componentsDirect(variables.metahubId, variables.objectCollectionId)
            const childKeyPrefix = ['metahubs', 'childComponents', variables.metahubId, variables.objectCollectionId]

            // Cancel in-flight queries to prevent overwriting our optimistic update
            await queryClient.cancelQueries({ queryKey: baseKey })
            await queryClient.cancelQueries({ queryKey: childKeyPrefix })

            // Snapshot ALL relevant caches for rollback (covers both same-list and cross-list)
            const previousRootQueries = queryClient.getQueriesData<Record<string, unknown>>({ queryKey: baseKey })
            const previousChildQueries = queryClient.getQueriesData<Record<string, unknown>>({ queryKey: childKeyPrefix })

            const isCrossList = variables.newParentComponentId !== undefined

            if (isCrossList) {
                // ── Cross-list transfer optimistic update ──
                const currentParent = variables.currentParentComponentId ?? null
                const targetParent = variables.newParentComponentId!
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
                        const found = items.find((i) => (i as Record<string, unknown>).id === variables.componentId)
                        if (found) {
                            movedItem = { ...found }
                            break
                        }
                    }
                }

                // Updater: remove the dragged component from source cache, re-index sort orders
                const removeUpdater = (old: Record<string, unknown> | undefined) => {
                    if (!old || !Array.isArray((old as Record<string, unknown> & { items?: unknown[] }).items)) return old
                    const items: Record<string, unknown>[] = (old as Record<string, unknown> & { items: Record<string, unknown>[] }).items
                    const idx = items.findIndex((i) => (i as Record<string, unknown>).id === variables.componentId)
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
                            parentComponentId: variables.newParentComponentId ?? null
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

                    const fromIndex = items.findIndex((i) => (i as Record<string, unknown>).id === variables.componentId)
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
            if (queryClient.isMutating({ mutationKey: ['components'] }) <= 1) {
                if (variables.treeEntityId) {
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.components(variables.metahubId, variables.treeEntityId, variables.objectCollectionId)
                    })
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.objectCollections(variables.metahubId, variables.treeEntityId)
                    })
                } else {
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.componentsDirect(variables.metahubId, variables.objectCollectionId)
                    })
                }
                // Invalidate child component queries only for cross-list transfers
                // (backend may auto-rename codename, auto-set display/required, etc.)
                if (variables.newParentComponentId !== undefined) {
                    queryClient.invalidateQueries({
                        queryKey: ['metahubs', 'childComponents', variables.metahubId, variables.objectCollectionId]
                    })
                }
                queryClient.invalidateQueries({
                    queryKey: metahubsQueryKeys.objectCollectionDetail(variables.metahubId, variables.objectCollectionId)
                })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allObjectCollections(variables.metahubId) })
            }
        }
    })
}

export function useCopyComponent() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['components', 'copy'],
        mutationFn: async ({ metahubId, treeEntityId, objectCollectionId, componentId, data }: CopyComponentParams) => {
            if (treeEntityId) {
                const response = await componentsApi.copyComponent(metahubId, treeEntityId, objectCollectionId, componentId, data)
                return response.data
            }
            const response = await componentsApi.copyComponentDirect(metahubId, objectCollectionId, componentId, data)
            return response.data
        },
        onMutate: async (variables) => {
            const queryKeyPrefix = getComponentQueryKeyPrefix(variables)
            const existingComponent = queryClient
                .getQueriesData<{ items?: Array<Record<string, unknown>> }>({ queryKey: queryKeyPrefix })
                .flatMap(([, value]) => (Array.isArray(value?.items) ? value.items : []))
                .find((item) => item.id === variables.componentId)

            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity: {
                    ...(existingComponent ?? {}),
                    id: generateOptimisticId(),
                    objectCollectionId: variables.objectCollectionId,
                    codename:
                        variables.data.codename || (typeof existingComponent?.codename === 'string' ? existingComponent.codename : ''),
                    dataType:
                        (variables.data as Partial<CreateComponentParams['data']>).dataType || existingComponent?.dataType || 'STRING',
                    name: (variables.data as Partial<CreateComponentParams['data']>).name || existingComponent?.name || {},
                    updatedAt: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    ...makePendingMarkers('copy')
                },
                insertPosition: 'prepend'
            })
        },
        onSuccess: (data, _variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(queryClient, getComponentQueryKeyPrefix(_variables), context.optimisticId, data.id, {
                    serverEntity: data
                })
            }
            console.info('[optimistic-copy:components] onSuccess', {
                metahubId: _variables.metahubId,
                objectCollectionId: _variables.objectCollectionId,
                componentId: _variables.componentId,
                optimisticId: context?.optimisticId,
                realId: data?.id ?? null
            })
            enqueueSnackbar(t('components.copySuccess', 'Component copied'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('components.copyError', 'Failed to copy component'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            invalidateComponentScopes(queryClient, variables)
            console.info('[optimistic-copy:components] onSettled', {
                metahubId: variables.metahubId,
                objectCollectionId: variables.objectCollectionId,
                componentId: variables.componentId,
                hasError: Boolean(_error)
            })
        }
    })
}

export function useCopyChildComponent() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['childComponents', 'copy'],
        mutationFn: async ({ metahubId, treeEntityId, objectCollectionId, componentId, data }: CopyChildComponentParams) => {
            if (treeEntityId) {
                const response = await componentsApi.copyComponent(metahubId, treeEntityId, objectCollectionId, componentId, data)
                return response.data
            }
            const response = await componentsApi.copyComponentDirect(metahubId, objectCollectionId, componentId, data)
            return response.data
        },
        onMutate: async (variables) => {
            const queryKeyPrefix = getChildComponentQueryKeyPrefix(variables)
            const optimisticSortOrder = getNextOptimisticSortOrderFromQueries(queryClient, queryKeyPrefix)
            const existingComponent = queryClient
                .getQueriesData<{ items?: Array<Record<string, unknown>> }>({ queryKey: queryKeyPrefix })
                .flatMap(([, value]) => (Array.isArray(value?.items) ? value.items : []))
                .find((item) => item.id === variables.componentId)

            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity: {
                    ...(existingComponent ?? {}),
                    id: generateOptimisticId(),
                    objectCollectionId: variables.objectCollectionId,
                    parentComponentId: variables.parentComponentId,
                    codename:
                        variables.data.codename || (typeof existingComponent?.codename === 'string' ? existingComponent.codename : ''),
                    dataType:
                        (variables.data as Partial<CreateChildComponentParams['data']>).dataType || existingComponent?.dataType || 'STRING',
                    name: (variables.data as Partial<CreateChildComponentParams['data']>).name || existingComponent?.name || {},
                    targetEntityId:
                        (variables.data as Partial<CreateChildComponentParams['data']>).targetEntityId ??
                        existingComponent?.targetEntityId ??
                        null,
                    targetEntityKind:
                        (variables.data as Partial<CreateChildComponentParams['data']>).targetEntityKind ??
                        existingComponent?.targetEntityKind ??
                        null,
                    validationRules: variables.data.validationRules ?? existingComponent?.validationRules ?? {},
                    uiConfig: variables.data.uiConfig ?? existingComponent?.uiConfig ?? {},
                    isRequired:
                        typeof variables.data.isRequired === 'boolean' ? variables.data.isRequired : Boolean(existingComponent?.isRequired),
                    isDisplayComponent: false,
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
                confirmOptimisticCreate(queryClient, getChildComponentQueryKeyPrefix(variables), context.optimisticId, data.id, {
                    serverEntity: data
                })
            }
            enqueueSnackbar(t('components.copySuccess', 'Component copied'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('components.copyError', 'Failed to copy component'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            invalidateChildComponentScopes(queryClient, variables)
        }
    })
}

export function useToggleComponentRequired() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['components', 'toggleRequired'],
        mutationFn: async ({ metahubId, treeEntityId, objectCollectionId, componentId, isRequired }: ToggleRequiredParams) => {
            if (treeEntityId) {
                const response = await componentsApi.toggleComponentRequired(
                    metahubId,
                    treeEntityId,
                    objectCollectionId,
                    componentId,
                    isRequired
                )
                return response.data
            }
            const response = await componentsApi.toggleComponentRequiredDirect(metahubId, objectCollectionId, componentId, isRequired)
            return response.data
        },
        onSuccess: (_data, variables) => {
            const messageKey = variables.isRequired ? 'components.setRequiredSuccess' : 'components.setOptionalSuccess'
            const defaultMessage = variables.isRequired ? 'Component marked as required' : 'Component marked as optional'
            enqueueSnackbar(t(messageKey, defaultMessage), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('components.toggleRequiredError', 'Failed to update component'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['components'] }) <= 1) {
                if (variables.treeEntityId) {
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.components(variables.metahubId, variables.treeEntityId, variables.objectCollectionId)
                    })
                } else {
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.componentsDirect(variables.metahubId, variables.objectCollectionId)
                    })
                }
                queryClient.invalidateQueries({
                    queryKey: metahubsQueryKeys.objectCollectionDetail(variables.metahubId, variables.objectCollectionId)
                })
            }
        }
    })
}

export function useSetDisplayComponent() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['components', 'setDisplay'],
        mutationFn: async ({ metahubId, treeEntityId, objectCollectionId, componentId }: SetDisplayComponentParams) => {
            if (treeEntityId) {
                const response = await componentsApi.setDisplayComponent(metahubId, treeEntityId, objectCollectionId, componentId)
                return response.data
            }
            const response = await componentsApi.setDisplayComponentDirect(metahubId, objectCollectionId, componentId)
            return response.data
        },
        onSuccess: () => {
            enqueueSnackbar(t('components.setDisplaySuccess', 'Component set as display component'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('components.setDisplayError', 'Failed to set display component'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['components'] }) <= 1) {
                if (variables.treeEntityId) {
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.components(variables.metahubId, variables.treeEntityId, variables.objectCollectionId)
                    })
                } else {
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.componentsDirect(variables.metahubId, variables.objectCollectionId)
                    })
                }
                queryClient.invalidateQueries({
                    queryKey: metahubsQueryKeys.objectCollectionDetail(variables.metahubId, variables.objectCollectionId)
                })
            }
        }
    })
}

export function useClearDisplayComponent() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['components', 'clearDisplay'],
        mutationFn: async ({ metahubId, treeEntityId, objectCollectionId, componentId }: SetDisplayComponentParams) => {
            if (treeEntityId) {
                const response = await componentsApi.clearDisplayComponent(metahubId, treeEntityId, objectCollectionId, componentId)
                return response.data
            }
            const response = await componentsApi.clearDisplayComponentDirect(metahubId, objectCollectionId, componentId)
            return response.data
        },
        onSuccess: () => {
            enqueueSnackbar(t('components.clearDisplaySuccess', 'Display component flag cleared'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('components.clearDisplayError', 'Failed to clear display component'), {
                variant: 'error'
            })
        },
        onSettled: (_data, _error, variables) => {
            if (queryClient.isMutating({ mutationKey: ['components'] }) <= 1) {
                if (variables.treeEntityId) {
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.components(variables.metahubId, variables.treeEntityId, variables.objectCollectionId)
                    })
                } else {
                    queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.componentsDirect(variables.metahubId, variables.objectCollectionId)
                    })
                }
                queryClient.invalidateQueries({
                    queryKey: metahubsQueryKeys.objectCollectionDetail(variables.metahubId, variables.objectCollectionId)
                })
            }
        }
    })
}
