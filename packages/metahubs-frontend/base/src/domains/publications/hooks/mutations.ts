import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import {
    applyOptimisticCreate,
    applyOptimisticDelete,
    applyOptimisticUpdate,
    confirmOptimisticCreate,
    generateOptimisticId,
    getCurrentLanguageKey,
    rollbackOptimisticSnapshots,
    safeInvalidateQueriesInactive,
    safeInvalidateQueries,
    confirmOptimisticUpdate
} from '@universo/template-mui'
import { getVLCString, makePendingMarkers } from '@universo/utils'
import { metahubsQueryKeys } from '../../shared'
import * as publicationsApi from '../api'
import type {
    CreatePublicationParams,
    UpdatePublicationParams,
    SyncPublicationParams,
    DeletePublicationParams
} from './mutationTypes'

// Applications query keys for cross-domain invalidation
const applicationsQueryKeys = {
    all: ['applications'] as const,
    lists: () => [...applicationsQueryKeys.all, 'list'] as const
}

export function useCreatePublication() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['publications', 'create'],
        mutationFn: async ({ metahubId, data }: CreatePublicationParams) => {
            return publicationsApi.createPublication(metahubId, data)
        },
        onMutate: async ({ metahubId, data }) => {
            const lang = getCurrentLanguageKey()

            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.publications(metahubId),
                optimisticEntity: {
                    id: generateOptimisticId(),
                    metahubId,
                    name: data.name ?? { [lang]: t('publications.copyInProgress', 'Creating…') },
                    description: data.description,
                    accessMode: 'full',
                    accessConfig: null,
                    schemaName: '',
                    schemaStatus: 'pending',
                    schemaError: null,
                    schemaSyncedAt: null,
                    autoCreateApplication: data.autoCreateApplication ?? false,
                    activeVersionId: null,
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
                confirmOptimisticCreate(queryClient, metahubsQueryKeys.publications(variables.metahubId), context.optimisticId, data.id, {
                    serverEntity: data
                })
            }
            enqueueSnackbar(t('publications.messages.createSuccess', 'Information base created'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('publications.messages.createError', 'Failed to create information base'), {
                variant: 'error'
            })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(
                queryClient,
                ['publications'],
                metahubsQueryKeys.publications(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
            // Cross-domain: always invalidate applications if autoCreateApplication was enabled
            if (variables.data.autoCreateApplication) {
                queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.lists() })
            }
        }
    })
}

export function useUpdatePublication() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['publications', 'update'],
        mutationFn: async ({ metahubId, publicationId, data }: UpdatePublicationParams) => {
            return publicationsApi.updatePublication(metahubId, publicationId, data)
        },
        onMutate: async ({ metahubId, publicationId, data }) => {
            const lang = getCurrentLanguageKey()
            const displayName = data.name ? getVLCString(data.name, lang) : undefined

            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.publications(metahubId),
                entityId: publicationId,
                updater: {
                    ...data,
                    updatedAt: new Date().toISOString()
                },
                moveToFront: true,
                detailQueryKey: metahubsQueryKeys.publicationDetail(metahubId, publicationId),
                breadcrumb: displayName
                    ? { queryKey: ['breadcrumb', 'metahub-publication', metahubId, publicationId, lang], name: displayName }
                    : undefined
            })
        },
        onSuccess: async (_data, variables) => {
            await queryClient.cancelQueries({ queryKey: metahubsQueryKeys.publications(variables.metahubId) })
            confirmOptimisticUpdate(queryClient, metahubsQueryKeys.publications(variables.metahubId), variables.publicationId, {
                serverEntity: _data,
                moveToFront: true
            })
            enqueueSnackbar(t('publications.messages.updateSuccess', 'Publication updated'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('publications.messages.updateError', 'Failed to update publication'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(
                queryClient,
                ['publications'],
                metahubsQueryKeys.publications(variables.metahubId),
                metahubsQueryKeys.publicationDetail(variables.metahubId, variables.publicationId),
                metahubsQueryKeys.detail(variables.metahubId),
                ['breadcrumb', 'metahub-publication', variables.metahubId, variables.publicationId]
            )
        }
    })
}

export function useSyncPublication() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, publicationId, confirmDestructive = false }: SyncPublicationParams) => {
            return publicationsApi.syncPublication(metahubId, publicationId, confirmDestructive)
        },
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.publications(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.publicationDetail(variables.metahubId, variables.publicationId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) })

            if (data.status === 'pending_confirmation') {
                enqueueSnackbar(t('publications.messages.syncPending', 'Destructive changes detected. Confirm to proceed.'), {
                    variant: 'warning'
                })
            } else {
                enqueueSnackbar(t('publications.messages.syncSuccess', 'Schema synchronized'), { variant: 'success' })
            }
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('publications.messages.syncError', 'Schema sync failed'), { variant: 'error' })
        }
    })
}

export function useDeletePublication() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['publications', 'delete'],
        mutationFn: async ({ metahubId, publicationId }: DeletePublicationParams) => {
            return publicationsApi.deletePublication(metahubId, publicationId)
        },
        onMutate: async ({ metahubId, publicationId }) => {
            return applyOptimisticDelete({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.publications(metahubId),
                entityId: publicationId,
                strategy: 'remove'
            })
        },
        onSuccess: () => {
            enqueueSnackbar(t('publications.messages.deleteSuccess', 'Information base deleted'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('publications.messages.deleteError', 'Failed to delete information base'), {
                variant: 'error'
            })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueries(
                queryClient,
                ['publications'],
                metahubsQueryKeys.publications(variables.metahubId),
                metahubsQueryKeys.publicationDetail(variables.metahubId, variables.publicationId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
        }
    })
}
