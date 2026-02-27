import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import type { EnumerationLocalizedPayload, EnumerationValueLocalizedPayload } from '../../../types'
import { invalidateEnumerationValuesQueries, metahubsQueryKeys } from '../../shared'
import * as enumerationsApi from '../api'
import type { EnumerationCopyInput } from '../api'

interface CreateEnumerationParams {
    metahubId: string
    hubId: string
    data: EnumerationLocalizedPayload & { sortOrder?: number }
}

interface CreateEnumerationAtMetahubParams {
    metahubId: string
    data: EnumerationLocalizedPayload & { sortOrder?: number }
}

interface UpdateEnumerationParams {
    metahubId: string
    hubId: string
    enumerationId: string
    data: EnumerationLocalizedPayload & { sortOrder?: number }
}

interface UpdateEnumerationAtMetahubParams {
    metahubId: string
    enumerationId: string
    data: EnumerationLocalizedPayload & { sortOrder?: number }
}

interface DeleteEnumerationParams {
    metahubId: string
    hubId?: string
    enumerationId: string
    force?: boolean
}

interface CopyEnumerationParams {
    metahubId: string
    enumerationId: string
    data: EnumerationCopyInput
}

interface CreateEnumerationValueParams {
    metahubId: string
    enumerationId: string
    data: EnumerationValueLocalizedPayload
}

interface UpdateEnumerationValueParams {
    metahubId: string
    enumerationId: string
    valueId: string
    data: Partial<EnumerationValueLocalizedPayload> & { expectedVersion?: number }
}

interface DeleteEnumerationValueParams {
    metahubId: string
    enumerationId: string
    valueId: string
}

interface MoveEnumerationValueParams {
    metahubId: string
    enumerationId: string
    valueId: string
    direction: 'up' | 'down'
}

export function useCreateEnumerationAtMetahub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        retry: false,
        mutationFn: async ({ metahubId, data }: CreateEnumerationAtMetahubParams) => {
            const response = await enumerationsApi.createEnumerationAtMetahub(metahubId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allEnumerations(variables.metahubId) })
            const hubIds = variables.data.hubIds ?? []
            hubIds.forEach((hubId: string) => {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.enumerations(variables.metahubId, hubId) })
            })
            enqueueSnackbar(t('enumerations.createSuccess', 'Enumeration created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('enumerations.createError', 'Failed to create enumeration'), { variant: 'error' })
        }
    })
}

export function useCreateEnumeration() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        retry: false,
        mutationFn: async ({ metahubId, hubId, data }: CreateEnumerationParams) => {
            const response = await enumerationsApi.createEnumeration(metahubId, hubId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.enumerations(variables.metahubId, variables.hubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allEnumerations(variables.metahubId) })
            enqueueSnackbar(t('enumerations.createSuccess', 'Enumeration created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('enumerations.createError', 'Failed to create enumeration'), { variant: 'error' })
        }
    })
}

export function useUpdateEnumeration() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, enumerationId, data }: UpdateEnumerationParams) => {
            const response = await enumerationsApi.updateEnumeration(metahubId, hubId, enumerationId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.enumerations(variables.metahubId, variables.hubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allEnumerations(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.hubs(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) })
            enqueueSnackbar(t('enumerations.updateSuccess', 'Enumeration updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('enumerations.updateError', 'Failed to update enumeration'), { variant: 'error' })
        }
    })
}

export function useUpdateEnumerationAtMetahub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, enumerationId, data }: UpdateEnumerationAtMetahubParams) => {
            const response = await enumerationsApi.updateEnumerationAtMetahub(metahubId, enumerationId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allEnumerations(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.hubs(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) })
            enqueueSnackbar(t('enumerations.updateSuccess', 'Enumeration updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('enumerations.updateError', 'Failed to update enumeration'), { variant: 'error' })
        }
    })
}

export function useDeleteEnumeration() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, enumerationId, force }: DeleteEnumerationParams) => {
            if (hubId) {
                await enumerationsApi.deleteEnumeration(metahubId, hubId, enumerationId, force)
            } else {
                await enumerationsApi.deleteEnumerationDirect(metahubId, enumerationId)
            }
        },
        onSuccess: (_data, variables) => {
            if (variables.hubId) {
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.enumerations(variables.metahubId, variables.hubId) })
            }
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allEnumerations(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.hubs(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) })
            enqueueSnackbar(t('enumerations.deleteSuccess', 'Enumeration deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('enumerations.deleteError', 'Failed to delete enumeration'), { variant: 'error' })
        }
    })
}

export function useCopyEnumeration() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, enumerationId, data }: CopyEnumerationParams) => {
            const response = await enumerationsApi.copyEnumeration(metahubId, enumerationId, data)
            return response.data
        },
        onSuccess: async (copiedEnumeration, variables) => {
            const hubIds = Array.isArray(copiedEnumeration.hubs) ? copiedEnumeration.hubs.map((hub: { id: string }) => hub.id) : []

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allEnumerations(variables.metahubId) }),
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.hubs(variables.metahubId) }),
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) }),
                ...hubIds.map((hubId: string) =>
                    queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.enumerations(variables.metahubId, hubId) })
                )
            ])

            enqueueSnackbar(t('enumerations.copySuccess', 'Enumeration copied'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('enumerations.copyError', 'Failed to copy enumeration'), { variant: 'error' })
        }
    })
}

export function useCreateEnumerationValue() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, enumerationId, data }: CreateEnumerationValueParams) => {
            const response = await enumerationsApi.createEnumerationValue(metahubId, enumerationId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            invalidateEnumerationValuesQueries.all(queryClient, variables.metahubId, variables.enumerationId)
            enqueueSnackbar(t('enumerationValues.createSuccess', 'Enumeration value created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('enumerationValues.createError', 'Failed to create enumeration value'), { variant: 'error' })
        }
    })
}

export function useUpdateEnumerationValue() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, enumerationId, valueId, data }: UpdateEnumerationValueParams) => {
            const response = await enumerationsApi.updateEnumerationValue(metahubId, enumerationId, valueId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            invalidateEnumerationValuesQueries.all(queryClient, variables.metahubId, variables.enumerationId)
            enqueueSnackbar(t('enumerationValues.updateSuccess', 'Enumeration value updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('enumerationValues.updateError', 'Failed to update enumeration value'), { variant: 'error' })
        }
    })
}

export function useDeleteEnumerationValue() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, enumerationId, valueId }: DeleteEnumerationValueParams) => {
            await enumerationsApi.deleteEnumerationValue(metahubId, enumerationId, valueId)
        },
        onSuccess: (_data, variables) => {
            invalidateEnumerationValuesQueries.all(queryClient, variables.metahubId, variables.enumerationId)
            enqueueSnackbar(t('enumerationValues.deleteSuccess', 'Enumeration value deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('enumerationValues.deleteError', 'Failed to delete enumeration value'), { variant: 'error' })
        }
    })
}

export function useMoveEnumerationValue() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, enumerationId, valueId, direction }: MoveEnumerationValueParams) => {
            const response = await enumerationsApi.moveEnumerationValue(metahubId, enumerationId, valueId, direction)
            return response.data
        },
        onSuccess: (_data, variables) => {
            invalidateEnumerationValuesQueries.all(queryClient, variables.metahubId, variables.enumerationId)
            enqueueSnackbar(t('enumerationValues.moveSuccess', 'Value order updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('enumerationValues.moveError', 'Failed to move value'), { variant: 'error' })
        }
    })
}
