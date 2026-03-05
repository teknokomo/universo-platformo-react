import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import type { SetLocalizedPayload } from '../../../types'
import { applyOptimisticReorder, metahubsQueryKeys, rollbackReorderSnapshots } from '../../shared'
import * as setsApi from '../api'
import type { SetCopyInput } from '../api'

interface CreateSetParams {
    metahubId: string
    hubId: string
    data: SetLocalizedPayload & { sortOrder?: number }
}

interface CreateSetAtMetahubParams {
    metahubId: string
    data: SetLocalizedPayload & { sortOrder?: number }
}

interface UpdateSetParams {
    metahubId: string
    hubId: string
    setId: string
    data: SetLocalizedPayload & { sortOrder?: number }
}

interface UpdateSetAtMetahubParams {
    metahubId: string
    setId: string
    data: SetLocalizedPayload & { sortOrder?: number }
}

interface DeleteSetParams {
    metahubId: string
    hubId?: string
    setId: string
    force?: boolean
}

interface CopySetParams {
    metahubId: string
    setId: string
    data: SetCopyInput
}

interface ReorderSetParams {
    metahubId: string
    hubId?: string
    setId: string
    newSortOrder: number
}

export function useCreateSetAtMetahub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        retry: false,
        mutationFn: async ({ metahubId, data }: CreateSetAtMetahubParams) => {
            const response = await setsApi.createSetAtMetahub(metahubId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allSets(variables.metahubId) })
            const hubIds = variables.data.hubIds ?? []
            hubIds.forEach((hubId: string) => {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.sets(variables.metahubId, hubId) })
            })
            enqueueSnackbar(t('sets.createSuccess', 'Set created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('sets.createError', 'Failed to create set'), { variant: 'error' })
        }
    })
}

export function useCreateSet() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        retry: false,
        mutationFn: async ({ metahubId, hubId, data }: CreateSetParams) => {
            const response = await setsApi.createSet(metahubId, hubId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.sets(variables.metahubId, variables.hubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allSets(variables.metahubId) })
            enqueueSnackbar(t('sets.createSuccess', 'Set created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('sets.createError', 'Failed to create set'), { variant: 'error' })
        }
    })
}

export function useUpdateSet() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, setId, data }: UpdateSetParams) => {
            const response = await setsApi.updateSet(metahubId, hubId, setId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.sets(variables.metahubId, variables.hubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allSets(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.hubs(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) })
            enqueueSnackbar(t('sets.updateSuccess', 'Set updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('sets.updateError', 'Failed to update set'), { variant: 'error' })
        }
    })
}

export function useUpdateSetAtMetahub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, setId, data }: UpdateSetAtMetahubParams) => {
            const response = await setsApi.updateSetAtMetahub(metahubId, setId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allSets(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.hubs(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) })
            enqueueSnackbar(t('sets.updateSuccess', 'Set updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('sets.updateError', 'Failed to update set'), { variant: 'error' })
        }
    })
}

export function useDeleteSet() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, setId, force }: DeleteSetParams) => {
            if (hubId) {
                await setsApi.deleteSet(metahubId, hubId, setId, force)
            } else {
                await setsApi.deleteSetDirect(metahubId, setId)
            }
        },
        onSuccess: (_data, variables) => {
            if (variables.hubId) {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.sets(variables.metahubId, variables.hubId) })
            }
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allSets(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.hubs(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) })
            enqueueSnackbar(t('sets.deleteSuccess', 'Set deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('sets.deleteError', 'Failed to delete set'), { variant: 'error' })
        }
    })
}

export function useCopySet() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, setId, data }: CopySetParams) => {
            const response = await setsApi.copySet(metahubId, setId, data)
            return response.data
        },
        onSuccess: async (copiedSet, variables) => {
            const hubIds = Array.isArray(copiedSet.hubs) ? copiedSet.hubs.map((hub: { id: string }) => hub.id) : []

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allSets(variables.metahubId) }),
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.hubs(variables.metahubId) }),
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) }),
                ...hubIds.map((hubId: string) =>
                    queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.sets(variables.metahubId, hubId) })
                )
            ])

            enqueueSnackbar(t('sets.copySuccess', 'Set copied'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('sets.copyError', 'Failed to copy set'), { variant: 'error' })
        }
    })
}

export function useReorderSet() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ metahubId, hubId, setId, newSortOrder }: ReorderSetParams) => {
            const response = await setsApi.reorderSet(metahubId, setId, newSortOrder, hubId)
            return response.data
        },
        onMutate: async (variables) => {
            const listSnapshots =
                variables.hubId != null
                    ? await applyOptimisticReorder(
                          queryClient,
                          metahubsQueryKeys.sets(variables.metahubId, variables.hubId),
                          variables.setId,
                          variables.newSortOrder
                      )
                    : await applyOptimisticReorder(
                          queryClient,
                          metahubsQueryKeys.allSets(variables.metahubId),
                          variables.setId,
                          variables.newSortOrder
                      )

            const globalSnapshots =
                variables.hubId != null
                    ? await applyOptimisticReorder(
                          queryClient,
                          metahubsQueryKeys.allSets(variables.metahubId),
                          variables.setId,
                          variables.newSortOrder
                      )
                    : []

            return { listSnapshots, globalSnapshots }
        },
        onError: (_error, _variables, context) => {
            rollbackReorderSnapshots(queryClient, context?.listSnapshots)
            rollbackReorderSnapshots(queryClient, context?.globalSnapshots)
        },
        onSuccess: (_data, variables) => {
            if (variables.hubId) {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.sets(variables.metahubId, variables.hubId) })
            }
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allSets(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.hubs(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) })
        }
    })
}
