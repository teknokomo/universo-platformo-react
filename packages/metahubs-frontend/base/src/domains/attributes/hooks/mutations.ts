import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import type { AttributeLocalizedPayload } from '../../../types'
import { metahubsQueryKeys } from '../../shared'
import * as attributesApi from '../api'
import type { AttributeCopyInput } from '../api'

interface CreateAttributeParams {
    metahubId: string
    hubId?: string
    catalogId: string
    data: AttributeLocalizedPayload & {
        validationRules?: Record<string, unknown>
        uiConfig?: Record<string, unknown>
        isRequired?: boolean
        sortOrder?: number
    }
}

interface UpdateAttributeParams {
    metahubId: string
    hubId?: string
    catalogId: string
    attributeId: string
    data: AttributeLocalizedPayload & {
        validationRules?: Record<string, unknown>
        uiConfig?: Record<string, unknown>
        isRequired?: boolean
        sortOrder?: number
    }
}

interface DeleteAttributeParams {
    metahubId: string
    hubId?: string
    catalogId: string
    attributeId: string
}

interface MoveAttributeParams {
    metahubId: string
    hubId?: string
    catalogId: string
    attributeId: string
    direction: 'up' | 'down'
}

interface CopyAttributeParams {
    metahubId: string
    hubId?: string
    catalogId: string
    attributeId: string
    data: AttributeCopyInput
}

interface ReorderAttributeParams {
    metahubId: string
    hubId?: string
    catalogId: string
    attributeId: string
    newSortOrder: number
    newParentAttributeId?: string | null
    currentParentAttributeId?: string | null
    autoRenameCodename?: boolean
}

export function useCreateAttribute() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
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
        onSuccess: (_data, variables) => {
            if (variables.hubId) {
                queryClient.invalidateQueries({
                    queryKey: metahubsQueryKeys.attributes(variables.metahubId, variables.hubId, variables.catalogId)
                })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId) })
            } else {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributesDirect(variables.metahubId, variables.catalogId) })
            }
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogDetail(variables.metahubId, variables.catalogId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
            enqueueSnackbar(t('attributes.createSuccess', 'Attribute created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('attributes.createError', 'Failed to create attribute'), { variant: 'error' })
        }
    })
}

export function useUpdateAttribute() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
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
        onSuccess: (_data, variables) => {
            if (variables.hubId) {
                queryClient.invalidateQueries({
                    queryKey: metahubsQueryKeys.attributes(variables.metahubId, variables.hubId, variables.catalogId)
                })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId) })
            } else {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributesDirect(variables.metahubId, variables.catalogId) })
            }
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogDetail(variables.metahubId, variables.catalogId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
            enqueueSnackbar(t('attributes.updateSuccess', 'Attribute updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('attributes.updateError', 'Failed to update attribute'), { variant: 'error' })
        }
    })
}

export function useDeleteAttribute() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, catalogId, attributeId }: DeleteAttributeParams) => {
            if (hubId) {
                await attributesApi.deleteAttribute(metahubId, hubId, catalogId, attributeId)
            } else {
                await attributesApi.deleteAttributeDirect(metahubId, catalogId, attributeId)
            }
        },
        onSuccess: (_data, variables) => {
            if (variables.hubId) {
                queryClient.invalidateQueries({
                    queryKey: metahubsQueryKeys.attributes(variables.metahubId, variables.hubId, variables.catalogId)
                })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId) })
            } else {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributesDirect(variables.metahubId, variables.catalogId) })
            }
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogDetail(variables.metahubId, variables.catalogId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
            enqueueSnackbar(t('attributes.deleteSuccess', 'Attribute deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('attributes.deleteError', 'Failed to delete attribute'), { variant: 'error' })
        }
    })
}

export function useMoveAttribute() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, catalogId, attributeId, direction }: MoveAttributeParams) => {
            if (hubId) {
                const response = await attributesApi.moveAttribute(metahubId, hubId, catalogId, attributeId, direction)
                return response.data
            }
            const response = await attributesApi.moveAttributeDirect(metahubId, catalogId, attributeId, direction)
            return response.data
        },
        onSuccess: (_data, variables) => {
            if (variables.hubId) {
                queryClient.invalidateQueries({
                    queryKey: metahubsQueryKeys.attributes(variables.metahubId, variables.hubId, variables.catalogId)
                })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId) })
            } else {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributesDirect(variables.metahubId, variables.catalogId) })
            }
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogDetail(variables.metahubId, variables.catalogId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
            enqueueSnackbar(t('attributes.moveSuccess', 'Attribute order updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('attributes.moveError', 'Failed to update attribute order'), { variant: 'error' })
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
        mutationFn: async ({
            metahubId,
            hubId,
            catalogId,
            attributeId,
            newSortOrder,
            newParentAttributeId,
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
        onSuccess: (_data, variables) => {
            if (variables.hubId) {
                queryClient.invalidateQueries({
                    queryKey: metahubsQueryKeys.attributes(variables.metahubId, variables.hubId, variables.catalogId)
                })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId) })
            } else {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributesDirect(variables.metahubId, variables.catalogId) })
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
    })
}

export function useCopyAttribute() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, catalogId, attributeId, data }: CopyAttributeParams) => {
            if (hubId) {
                const response = await attributesApi.copyAttribute(metahubId, hubId, catalogId, attributeId, data)
                return response.data
            }
            const response = await attributesApi.copyAttributeDirect(metahubId, catalogId, attributeId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            if (variables.hubId) {
                queryClient.invalidateQueries({
                    queryKey: metahubsQueryKeys.attributes(variables.metahubId, variables.hubId, variables.catalogId)
                })
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogs(variables.metahubId, variables.hubId) })
            } else {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributesDirect(variables.metahubId, variables.catalogId) })
            }
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogDetail(variables.metahubId, variables.catalogId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
            enqueueSnackbar(t('attributes.copySuccess', 'Attribute copied'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('attributes.copyError', 'Failed to copy attribute'), { variant: 'error' })
        }
    })
}

interface ToggleRequiredParams {
    metahubId: string
    hubId?: string
    catalogId: string
    attributeId: string
    isRequired: boolean
}

export function useToggleAttributeRequired() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, catalogId, attributeId, isRequired }: ToggleRequiredParams) => {
            if (hubId) {
                const response = await attributesApi.toggleAttributeRequired(metahubId, hubId, catalogId, attributeId, isRequired)
                return response.data
            }
            const response = await attributesApi.toggleAttributeRequiredDirect(metahubId, catalogId, attributeId, isRequired)
            return response.data
        },
        onSuccess: (_data, variables) => {
            if (variables.hubId) {
                queryClient.invalidateQueries({
                    queryKey: metahubsQueryKeys.attributes(variables.metahubId, variables.hubId, variables.catalogId)
                })
            } else {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributesDirect(variables.metahubId, variables.catalogId) })
            }
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogDetail(variables.metahubId, variables.catalogId) })
            const messageKey = variables.isRequired ? 'attributes.setRequiredSuccess' : 'attributes.setOptionalSuccess'
            const defaultMessage = variables.isRequired ? 'Attribute marked as required' : 'Attribute marked as optional'
            enqueueSnackbar(t(messageKey, defaultMessage), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('attributes.toggleRequiredError', 'Failed to update attribute'), { variant: 'error' })
        }
    })
}

interface SetDisplayAttributeParams {
    metahubId: string
    hubId?: string
    catalogId: string
    attributeId: string
}

export function useSetDisplayAttribute() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, catalogId, attributeId }: SetDisplayAttributeParams) => {
            if (hubId) {
                const response = await attributesApi.setDisplayAttribute(metahubId, hubId, catalogId, attributeId)
                return response.data
            }
            const response = await attributesApi.setDisplayAttributeDirect(metahubId, catalogId, attributeId)
            return response.data
        },
        onSuccess: (_data, variables) => {
            if (variables.hubId) {
                queryClient.invalidateQueries({
                    queryKey: metahubsQueryKeys.attributes(variables.metahubId, variables.hubId, variables.catalogId)
                })
            } else {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributesDirect(variables.metahubId, variables.catalogId) })
            }
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogDetail(variables.metahubId, variables.catalogId) })
            enqueueSnackbar(t('attributes.setDisplaySuccess', 'Attribute set as display attribute'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('attributes.setDisplayError', 'Failed to set display attribute'), { variant: 'error' })
        }
    })
}

export function useClearDisplayAttribute() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, catalogId, attributeId }: SetDisplayAttributeParams) => {
            if (hubId) {
                const response = await attributesApi.clearDisplayAttribute(metahubId, hubId, catalogId, attributeId)
                return response.data
            }
            const response = await attributesApi.clearDisplayAttributeDirect(metahubId, catalogId, attributeId)
            return response.data
        },
        onSuccess: (_data, variables) => {
            if (variables.hubId) {
                queryClient.invalidateQueries({
                    queryKey: metahubsQueryKeys.attributes(variables.metahubId, variables.hubId, variables.catalogId)
                })
            } else {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.attributesDirect(variables.metahubId, variables.catalogId) })
            }
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogDetail(variables.metahubId, variables.catalogId) })
            enqueueSnackbar(t('attributes.clearDisplaySuccess', 'Display attribute flag cleared'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('attributes.clearDisplayError', 'Failed to clear display attribute'), { variant: 'error' })
        }
    })
}
