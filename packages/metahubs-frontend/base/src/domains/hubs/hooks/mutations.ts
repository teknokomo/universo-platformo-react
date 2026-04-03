import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import {
    applyOptimisticCreate,
    applyOptimisticUpdate,
    applyOptimisticDelete,
    rollbackOptimisticSnapshots,
    generateOptimisticId,
    cleanupBreadcrumbCache,
    getNextOptimisticSortOrderFromQueries,
    safeInvalidateQueries,
    safeInvalidateQueriesInactive,
    confirmOptimisticUpdate,
    confirmOptimisticCreate,
    getCurrentLanguageKey
} from '@universo/template-mui'
import { makePendingMarkers } from '@universo/utils'
import { getVLCString } from '@universo/utils/vlc'
import { applyOptimisticReorder, metahubsQueryKeys, rollbackReorderSnapshots } from '../../shared'
import * as hubsApi from '../api'
import type { CreateHubParams, UpdateHubParams, DeleteHubParams, CopyHubParams, ReorderHubParams } from './mutationTypes'

export function useCreateHub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['hubs', 'create'],
        mutationFn: async ({ metahubId, data }: CreateHubParams) => {
            const response = await hubsApi.createHub(metahubId, data)
            return response.data
        },
        onMutate: async ({ metahubId, data }) => {
            const optimisticId = generateOptimisticId()
            const lang = getCurrentLanguageKey()
            const displayName = getVLCString(data.name, lang) || data.codename || ''
            const queryKeyPrefix = metahubsQueryKeys.hubs(metahubId)
            const optimisticSortOrder = data.sortOrder ?? getNextOptimisticSortOrderFromQueries(queryClient, queryKeyPrefix)

            const optimisticEntity = {
                id: optimisticId,
                codename: data.codename || '',
                name: data.name,
                description: data.description,
                sortOrder: optimisticSortOrder,
                catalogsCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                ...makePendingMarkers('create')
            }

            const breadcrumbKey = ['breadcrumb', 'hub', metahubId, optimisticId, lang] as const

            console.info('[hub:create] onMutate', { metahubId, optimisticId, displayName })

            const context = await applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity,
                insertPosition: 'prepend',
                breadcrumb: { queryKey: breadcrumbKey, name: displayName }
            })

            return { ...context, breadcrumbKey }
        },
        onError: (error: Error, _variables, context) => {
            console.info('[hub:create] onError', { error: error.message })
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            if (context?.breadcrumbKey) {
                cleanupBreadcrumbCache(queryClient, context.breadcrumbKey)
            }
            enqueueSnackbar(error.message || t('hubs.createError', 'Failed to create hub'), { variant: 'error' })
        },
        onSuccess: (data, variables, context) => {
            console.info('[hub:create] onSuccess', {
                metahubId: variables.metahubId,
                optimisticId: context?.optimisticId,
                realId: data?.id
            })
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(queryClient, metahubsQueryKeys.hubs(variables.metahubId), context.optimisticId, data.id, {
                    serverEntity: data
                })
            }
            enqueueSnackbar(t('hubs.createSuccess', 'Hub created'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            console.info('[hub:create] onSettled', { metahubId: variables.metahubId })
            safeInvalidateQueries(
                queryClient,
                ['hubs'],
                metahubsQueryKeys.hubs(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
        }
    })
}

export function useUpdateHub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['hubs', 'update'],
        mutationFn: async ({ metahubId, hubId, data }: UpdateHubParams) => {
            const response = await hubsApi.updateHub(metahubId, hubId, data)
            return response.data
        },
        onMutate: async ({ metahubId, hubId, data }) => {
            const lang = getCurrentLanguageKey()
            const displayName = data.name ? getVLCString(data.name, lang) : undefined

            console.info('[hub:update] onMutate', { metahubId, hubId, displayName })

            const context = await applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.hubs(metahubId),
                entityId: hubId,
                updater: {
                    ...data,
                    updatedAt: new Date().toISOString()
                },
                moveToFront: true,
                detailQueryKey: metahubsQueryKeys.hubDetail(metahubId, hubId),
                breadcrumb: displayName ? { queryKey: ['breadcrumb', 'hub', metahubId, hubId, lang], name: displayName } : undefined
            })

            return context
        },
        onError: (error: Error, _variables, context) => {
            console.info('[hub:update] onError', { error: error.message })
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('hubs.updateError', 'Failed to update hub'), { variant: 'error' })
        },
        onSuccess: async (data, variables) => {
            console.info('[hub:update] onSuccess', { metahubId: variables.metahubId, hubId: variables.hubId })
            await queryClient.cancelQueries({ queryKey: metahubsQueryKeys.hubs(variables.metahubId) })
            confirmOptimisticUpdate(queryClient, metahubsQueryKeys.hubs(variables.metahubId), variables.hubId, {
                serverEntity: data ?? null,
                moveToFront: true
            })
            // Seed detail cache
            if (data) {
                queryClient.setQueryData(metahubsQueryKeys.hubDetail(variables.metahubId, variables.hubId), data)
            }
            enqueueSnackbar(t('hubs.updateSuccess', 'Hub updated'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            console.info('[hub:update] onSettled', { metahubId: variables.metahubId, hubId: variables.hubId })
            safeInvalidateQueriesInactive(
                queryClient,
                ['hubs'],
                metahubsQueryKeys.hubs(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
        }
    })
}

export function useDeleteHub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['hubs', 'delete'],
        mutationFn: async ({ metahubId, hubId }: DeleteHubParams) => {
            await hubsApi.deleteHub(metahubId, hubId)
        },
        onMutate: async ({ metahubId, hubId }) => {
            console.info('[hub:delete] onMutate', { metahubId, hubId })
            return applyOptimisticDelete({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.hubs(metahubId),
                entityId: hubId,
                strategy: 'remove'
            })
        },
        onError: (error: Error, _variables, context) => {
            console.info('[hub:delete] onError', { error: error.message })
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('hubs.deleteError', 'Failed to delete hub'), { variant: 'error' })
        },
        onSuccess: (_data, variables) => {
            console.info('[hub:delete] onSuccess', { metahubId: variables.metahubId, hubId: variables.hubId })
            enqueueSnackbar(t('hubs.deleteSuccess', 'Hub deleted'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            console.info('[hub:delete] onSettled', { metahubId: variables.metahubId, hubId: variables.hubId })
            // Use active refetch to ensure the deleted entity is gone from the list
            safeInvalidateQueries(
                queryClient,
                ['hubs'],
                metahubsQueryKeys.hubs(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
        }
    })
}

export function useCopyHub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['hubs', 'copy'],
        mutationFn: async ({ metahubId, hubId, data }: CopyHubParams) => {
            const response = await hubsApi.copyHub(metahubId, hubId, data)
            return response.data
        },
        onMutate: async ({ metahubId, hubId, data }) => {
            const optimisticId = generateOptimisticId()
            const lang = getCurrentLanguageKey()
            const queryKeyPrefix = metahubsQueryKeys.hubs(metahubId)
            const optimisticSortOrder = getNextOptimisticSortOrderFromQueries(queryClient, queryKeyPrefix)
            const existingHub = queryClient
                .getQueriesData<{ items?: Array<Record<string, unknown>> }>({ queryKey: ['metahubs'] })
                .flatMap(([, value]) => (Array.isArray(value?.items) ? value.items : []))
                .find((item) => item.id === hubId)

            const optimisticEntity = {
                ...(existingHub ?? {}),
                id: optimisticId,
                codename: data.codename || (typeof existingHub?.codename === 'string' ? existingHub.codename : ''),
                name: data.name || existingHub?.name || { [lang]: t('hubs.copyInProgress', 'Copying…') },
                description: data.description ?? existingHub?.description,
                sortOrder: optimisticSortOrder,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                ...makePendingMarkers('copy')
            }

            const context = await applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity,
                insertPosition: 'prepend'
            })

            console.info('[optimistic-copy:hubs] onMutate', {
                metahubId,
                hubId,
                optimisticId: context.optimisticId,
                codename: optimisticEntity.codename
            })

            return context
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('hubs.copyError', 'Failed to copy hub'), { variant: 'error' })
        },
        onSuccess: (data, _variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(queryClient, metahubsQueryKeys.hubs(_variables.metahubId), context.optimisticId, data.id, {
                    serverEntity: data
                })
            }
            console.info('[optimistic-copy:hubs] onSuccess', {
                metahubId: _variables.metahubId,
                hubId: _variables.hubId,
                optimisticId: context?.optimisticId,
                realId: data?.id ?? null
            })
            enqueueSnackbar(t('hubs.copySuccess', 'Hub copied'), { variant: 'success' })
        },
        onSettled: async (_data, _error, variables) => {
            safeInvalidateQueries(
                queryClient,
                ['hubs'],
                metahubsQueryKeys.hubs(variables.metahubId),
                metahubsQueryKeys.allCatalogs(variables.metahubId),
                metahubsQueryKeys.allEnumerations(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
            console.info('[optimistic-copy:hubs] onSettled', {
                metahubId: variables.metahubId,
                hubId: variables.hubId,
                hasError: Boolean(_error)
            })
        }
    })
}

export function useReorderHub() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationKey: ['hubs', 'reorder'],
        mutationFn: async ({ metahubId, hubId, newSortOrder }: ReorderHubParams) => {
            const response = await hubsApi.reorderHub(metahubId, hubId, newSortOrder)
            return response.data
        },
        onMutate: async (variables) => {
            const snapshots = await applyOptimisticReorder(
                queryClient,
                metahubsQueryKeys.hubs(variables.metahubId),
                variables.hubId,
                variables.newSortOrder
            )
            return { snapshots }
        },
        onError: (_error, _variables, context) => {
            rollbackReorderSnapshots(queryClient, context?.snapshots)
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(
                queryClient,
                ['hubs'],
                metahubsQueryKeys.hubs(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
        }
    })
}
