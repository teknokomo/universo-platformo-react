import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import type { BranchLocalizedPayload } from '../../../types'
import { metahubsQueryKeys } from '../../shared'
import * as branchesApi from '../api'

interface CreateBranchParams {
    metahubId: string
    data: BranchLocalizedPayload
}

interface UpdateBranchParams {
    metahubId: string
    branchId: string
    data: BranchLocalizedPayload
}

interface DeleteBranchParams {
    metahubId: string
    branchId: string
}

interface ActivateBranchParams {
    metahubId: string
    branchId: string
}

interface SetDefaultBranchParams {
    metahubId: string
    branchId: string
}

export function useCreateBranch() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, data }: CreateBranchParams) => {
            const response = await branchesApi.createBranch(metahubId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.branches(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: ['metahub-branches'], exact: false })
            enqueueSnackbar(t('branches.createSuccess', 'Branch created'), { variant: 'success' })
        },
        onError: (error: Error & { response?: { status?: number } }) => {
            const status = error?.response?.status
            if (status === 409) {
                enqueueSnackbar(t('branches.createLocked', 'Branch creation is already in progress. Please try again.'), { variant: 'warning' })
                return
            }
            enqueueSnackbar(error.message || t('branches.createError', 'Failed to create branch'), { variant: 'error' })
        }
    })
}

export function useUpdateBranch() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, branchId, data }: UpdateBranchParams) => {
            const response = await branchesApi.updateBranch(metahubId, branchId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.branches(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: ['metahub-branches'], exact: false })
            enqueueSnackbar(t('branches.updateSuccess', 'Branch updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('branches.updateError', 'Failed to update branch'), { variant: 'error' })
        }
    })
}

export function useDeleteBranch() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, branchId }: DeleteBranchParams) => {
            await branchesApi.deleteBranch(metahubId, branchId)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.branches(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: ['metahub-branches'], exact: false })
            enqueueSnackbar(t('branches.deleteSuccess', 'Branch deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('branches.deleteError', 'Failed to delete branch'), { variant: 'error' })
        }
    })
}

export function useActivateBranch() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, branchId }: ActivateBranchParams) => {
            await branchesApi.activateBranch(metahubId, branchId)
        },
        onSuccess: (_data, variables) => {
            queryClient.resetQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.branches(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: ['metahub-branches'], exact: false })
            enqueueSnackbar(t('branches.activateSuccess', 'Branch activated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('branches.activateError', 'Failed to activate branch'), { variant: 'error' })
        }
    })
}

export function useSetDefaultBranch() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, branchId }: SetDefaultBranchParams) => {
            await branchesApi.setDefaultBranch(metahubId, branchId)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.branches(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: ['metahub-branches'], exact: false })
            enqueueSnackbar(t('branches.setDefaultSuccess', 'Default branch updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('branches.setDefaultError', 'Failed to set default branch'), { variant: 'error' })
        }
    })
}
