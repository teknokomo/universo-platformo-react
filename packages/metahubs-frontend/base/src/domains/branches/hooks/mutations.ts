import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import type { BranchLocalizedPayload } from '../../../types'
import { metahubsQueryKeys } from '../../shared'
import * as branchesApi from '../api'
import { resolveBranchCopyCompatibilityCode } from '../utils/copyOptions'

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

interface CopyBranchParams {
    metahubId: string
    data: BranchLocalizedPayload
}

type BranchMutationError = Error & {
    response?: {
        status?: number
        data?: {
            code?: string
            error?: string
        }
    }
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
        onError: (error: BranchMutationError) => {
            const status = error?.response?.status
            const errorCode = error?.response?.data?.code
            const backendMessage = error?.response?.data?.error
            const compatibilityCode = resolveBranchCopyCompatibilityCode(errorCode, backendMessage)

            if (status === 409 && errorCode === 'BRANCH_CREATION_IN_PROGRESS') {
                enqueueSnackbar(t('branches.createLocked', 'Branch creation is already in progress. Please try again.'), {
                    variant: 'warning'
                })
                return
            }
            if (status === 409 && errorCode === 'BRANCH_CODENAME_EXISTS') {
                enqueueSnackbar(t('branches.codenameExists', 'Branch with this codename already exists'), { variant: 'warning' })
                return
            }
            if (status === 409 && errorCode === 'BRANCH_NUMBER_CONFLICT') {
                enqueueSnackbar(t('branches.numberConflict', 'Branch numbering conflict. Please try again.'), { variant: 'warning' })
                return
            }
            if (status === 400 && compatibilityCode === 'BRANCH_COPY_ENUM_REFERENCES') {
                enqueueSnackbar(
                    t(
                        'branches.copyEnumReferencesError',
                        'Cannot disable enumerations copy while related catalogs or hubs are being copied.'
                    ),
                    { variant: 'warning' }
                )
                return
            }
            if (status === 400 && compatibilityCode === 'BRANCH_COPY_DANGLING_REFERENCES') {
                enqueueSnackbar(
                    t(
                        'branches.copyDanglingReferencesError',
                        'Copy options would create invalid references. Keep all referenced entity groups enabled.'
                    ),
                    { variant: 'warning' }
                )
                return
            }

            enqueueSnackbar(backendMessage || error.message || t('branches.createError', 'Failed to create branch'), { variant: 'error' })
        }
    })
}

export function useCopyBranch() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, data }: CopyBranchParams) => {
            const response = await branchesApi.createBranch(metahubId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.branches(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.detail(variables.metahubId) })
            queryClient.invalidateQueries({ queryKey: ['metahub-branches'], exact: false })
            enqueueSnackbar(t('branches.copySuccess', 'Branch copied'), { variant: 'success' })
        },
        onError: (error: BranchMutationError) => {
            const status = error?.response?.status
            const errorCode = error?.response?.data?.code
            const backendMessage = error?.response?.data?.error
            const compatibilityCode = resolveBranchCopyCompatibilityCode(errorCode, backendMessage)

            if (status === 409 && errorCode === 'BRANCH_CREATION_IN_PROGRESS') {
                enqueueSnackbar(t('branches.createLocked', 'Branch creation is already in progress. Please try again.'), {
                    variant: 'warning'
                })
                return
            }
            if (status === 409 && errorCode === 'BRANCH_CODENAME_EXISTS') {
                enqueueSnackbar(t('branches.codenameExists', 'Branch with this codename already exists'), { variant: 'warning' })
                return
            }
            if (status === 409 && errorCode === 'BRANCH_NUMBER_CONFLICT') {
                enqueueSnackbar(t('branches.numberConflict', 'Branch numbering conflict. Please try again.'), { variant: 'warning' })
                return
            }
            if (status === 400 && compatibilityCode === 'BRANCH_COPY_ENUM_REFERENCES') {
                enqueueSnackbar(
                    t(
                        'branches.copyEnumReferencesError',
                        'Cannot disable enumerations copy while related catalogs or hubs are being copied.'
                    ),
                    { variant: 'warning' }
                )
                return
            }
            if (status === 400 && compatibilityCode === 'BRANCH_COPY_DANGLING_REFERENCES') {
                enqueueSnackbar(
                    t(
                        'branches.copyDanglingReferencesError',
                        'Copy options would create invalid references. Keep all referenced entity groups enabled.'
                    ),
                    { variant: 'warning' }
                )
                return
            }

            enqueueSnackbar(backendMessage || error.message || t('branches.copyError', 'Failed to copy branch'), { variant: 'error' })
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
