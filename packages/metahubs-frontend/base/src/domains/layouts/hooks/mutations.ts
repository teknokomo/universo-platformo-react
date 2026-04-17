import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import {
    applyOptimisticCreate,
    applyOptimisticDelete,
    applyOptimisticUpdate,
    cleanupBreadcrumbCache,
    generateOptimisticId,
    getNextOptimisticSortOrderFromQueries,
    getCurrentLanguageKey,
    rollbackOptimisticSnapshots,
    safeInvalidateQueriesInactive,
    confirmOptimisticUpdate,
    confirmOptimisticCreate
} from '@universo/template-mui'
import { getVLCString, makePendingMarkers } from '@universo/utils'
import { metahubsQueryKeys } from '../../shared'
import * as layoutsApi from '../api'
import type { CreateLayoutParams, UpdateLayoutParams, DeleteLayoutParams, CopyLayoutParams } from './mutationTypes'

const resolveLayoutLinkedCollectionId = (linkedCollectionId?: string | null): string | null => {
    if (typeof linkedCollectionId !== 'string') return null
    const trimmed = linkedCollectionId.trim()
    return trimmed.length > 0 ? trimmed : null
}

export function useCreateLayout() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['layouts', 'create'],
        mutationFn: async ({ metahubId, data }: CreateLayoutParams) => {
            const response = await layoutsApi.createLayout(metahubId, data)
            return response.data
        },
        onMutate: async ({ metahubId, data }) => {
            const linkedCollectionId = resolveLayoutLinkedCollectionId(data.linkedCollectionId)
            const optimisticId = generateOptimisticId()
            const lang = getCurrentLanguageKey()
            const displayName = getVLCString(data.name, lang) || data.templateKey
            const breadcrumbKey = ['breadcrumb', 'layout', metahubId, optimisticId, lang] as const
            const queryKeyPrefix = metahubsQueryKeys.layouts(metahubId, linkedCollectionId)
            const optimisticSortOrder = data.sortOrder ?? getNextOptimisticSortOrderFromQueries(queryClient, queryKeyPrefix)

            const context = await applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity: {
                    id: optimisticId,
                    linkedCollectionId,
                    baseLayoutId: data.baseLayoutId ?? null,
                    templateKey: data.templateKey,
                    name: data.name,
                    description: data.description ?? null,
                    config: data.config ?? {},
                    isActive: data.isActive ?? false,
                    isDefault: data.isDefault ?? false,
                    sortOrder: optimisticSortOrder,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    version: 1,
                    ...makePendingMarkers('create')
                },
                insertPosition: 'prepend',
                breadcrumb: { queryKey: breadcrumbKey, name: displayName }
            })

            return { ...context, breadcrumbKey }
        },
        onSuccess: () => {
            enqueueSnackbar(t('layouts.createSuccess', 'Layout created'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            if (context?.breadcrumbKey) {
                cleanupBreadcrumbCache(queryClient, context.breadcrumbKey)
            }
            enqueueSnackbar(error.message || t('layouts.createError', 'Failed to create layout'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            const linkedCollectionId = resolveLayoutLinkedCollectionId(variables.data.linkedCollectionId)
            safeInvalidateQueriesInactive(
                queryClient,
                ['layouts'],
                metahubsQueryKeys.layouts(variables.metahubId, linkedCollectionId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
        }
    })
}

export function useUpdateLayout() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['layouts', 'update'],
        mutationFn: async ({ metahubId, layoutId, data }: UpdateLayoutParams) => {
            const response = await layoutsApi.updateLayout(metahubId, layoutId, data)
            return response.data
        },
        onMutate: async ({ metahubId, layoutId, linkedCollectionId, data }) => {
            const lang = getCurrentLanguageKey()
            const displayName = data.name ? getVLCString(data.name, lang) : undefined
            const normalizedLinkedCollectionId = resolveLayoutLinkedCollectionId(linkedCollectionId)

            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.layouts(metahubId, normalizedLinkedCollectionId),
                entityId: layoutId,
                updater: {
                    ...data,
                    updatedAt: new Date().toISOString()
                },
                moveToFront: true,
                detailQueryKey: metahubsQueryKeys.layoutDetail(metahubId, layoutId),
                breadcrumb: displayName ? { queryKey: ['breadcrumb', 'layout', metahubId, layoutId, lang], name: displayName } : undefined
            })
        },
        onSuccess: (data, variables) => {
            confirmOptimisticUpdate(
                queryClient,
                metahubsQueryKeys.layouts(variables.metahubId, resolveLayoutLinkedCollectionId(variables.linkedCollectionId)),
                variables.layoutId,
                {
                    serverEntity: data ?? null
                }
            )
            if (data) {
                queryClient.setQueryData(metahubsQueryKeys.layoutDetail(variables.metahubId, variables.layoutId), data)
            }
            enqueueSnackbar(t('layouts.updateSuccess', 'Layout updated'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('layouts.updateError', 'Failed to update layout'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            const linkedCollectionId = resolveLayoutLinkedCollectionId(variables.linkedCollectionId)
            const queryKeysToInvalidate = [
                metahubsQueryKeys.layouts(variables.metahubId, linkedCollectionId),
                metahubsQueryKeys.layoutDetail(variables.metahubId, variables.layoutId),
                metahubsQueryKeys.detail(variables.metahubId),
                ['breadcrumb', 'layout', variables.metahubId, variables.layoutId]
            ]

            if (linkedCollectionId === null) {
                queryKeysToInvalidate.push(metahubsQueryKeys.layoutsRoot(variables.metahubId))
            }

            safeInvalidateQueriesInactive(queryClient, ['layouts'], ...queryKeysToInvalidate)
        }
    })
}

export function useDeleteLayout() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['layouts', 'delete'],
        mutationFn: async ({ metahubId, layoutId }: DeleteLayoutParams) => {
            await layoutsApi.deleteLayout(metahubId, layoutId)
        },
        onMutate: async ({ metahubId, layoutId, linkedCollectionId }) => {
            return applyOptimisticDelete({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.layouts(metahubId, resolveLayoutLinkedCollectionId(linkedCollectionId)),
                entityId: layoutId,
                strategy: 'remove'
            })
        },
        onSuccess: () => {
            enqueueSnackbar(t('layouts.deleteSuccess', 'Layout deleted'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('layouts.deleteError', 'Failed to delete layout'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            const linkedCollectionId = resolveLayoutLinkedCollectionId(variables.linkedCollectionId)
            safeInvalidateQueriesInactive(
                queryClient,
                ['layouts'],
                metahubsQueryKeys.layouts(variables.metahubId, linkedCollectionId),
                metahubsQueryKeys.layoutDetail(variables.metahubId, variables.layoutId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
        }
    })
}

export function useCopyLayout() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['layouts', 'copy'],
        mutationFn: async ({ metahubId, layoutId, data }: CopyLayoutParams) => {
            const response = await layoutsApi.copyLayout(metahubId, layoutId, data)
            return response.data
        },
        onMutate: async ({ metahubId, linkedCollectionId, data }) => {
            const normalizedLinkedCollectionId = resolveLayoutLinkedCollectionId(linkedCollectionId)
            const optimisticId = generateOptimisticId()
            const lang = getCurrentLanguageKey()
            const displayName = getVLCString(data.name, lang) || t('layouts.copyInProgress', 'Copying…')
            const breadcrumbKey = ['breadcrumb', 'layout', metahubId, optimisticId, lang] as const
            const queryKeyPrefix = metahubsQueryKeys.layouts(metahubId, normalizedLinkedCollectionId)
            const optimisticSortOrder = getNextOptimisticSortOrderFromQueries(queryClient, queryKeyPrefix)

            const context = await applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity: {
                    id: optimisticId,
                    linkedCollectionId: normalizedLinkedCollectionId,
                    baseLayoutId: null,
                    templateKey: 'dashboard',
                    name: data.name,
                    description: data.description ?? null,
                    config: {},
                    isActive: false,
                    isDefault: false,
                    sortOrder: optimisticSortOrder,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    version: 1,
                    ...makePendingMarkers('copy')
                },
                insertPosition: 'prepend',
                breadcrumb: { queryKey: breadcrumbKey, name: displayName }
            })

            return { ...context, breadcrumbKey }
        },
        onSuccess: (data, _variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(
                    queryClient,
                    metahubsQueryKeys.layouts(_variables.metahubId, resolveLayoutLinkedCollectionId(_variables.linkedCollectionId)),
                    context.optimisticId,
                    data.id
                )
            }
            console.info('[optimistic-copy:layouts] onSuccess', {
                metahubId: _variables.metahubId,
                layoutId: _variables.layoutId,
                optimisticId: context?.optimisticId,
                realId: data?.id ?? null
            })
            enqueueSnackbar(t('layouts.copySuccess', 'Layout copied'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            if (context?.breadcrumbKey) {
                cleanupBreadcrumbCache(queryClient, context.breadcrumbKey)
            }
            enqueueSnackbar(error.message || t('layouts.copyError', 'Failed to copy layout'), { variant: 'error' })
        },
        onSettled: async (_data, _error, variables) => {
            const linkedCollectionId = resolveLayoutLinkedCollectionId(variables.linkedCollectionId)
            safeInvalidateQueriesInactive(
                queryClient,
                ['layouts'],
                metahubsQueryKeys.layouts(variables.metahubId, linkedCollectionId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
            console.info('[optimistic-copy:layouts] onSettled', {
                metahubId: variables.metahubId,
                layoutId: variables.layoutId,
                hasError: Boolean(_error)
            })
        }
    })
}
