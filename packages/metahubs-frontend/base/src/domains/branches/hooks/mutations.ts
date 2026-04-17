import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import {
    applyOptimisticCreate,
    applyOptimisticDelete,
    applyOptimisticUpdate,
    generateOptimisticId,
    rollbackOptimisticSnapshots,
    safeInvalidateQueries,
    safeInvalidateQueriesInactive,
    confirmOptimisticUpdate,
    confirmOptimisticCreate
} from '@universo/template-mui'
import { makePendingMarkers } from '@universo/utils'
import { metahubsQueryKeys } from '../../shared'
import * as branchesApi from '../api'
import { resolveBranchCopyCompatibilityCode } from '../utils/copyOptions'
import type {
    CreateBranchParams,
    UpdateBranchParams,
    DeleteBranchParams,
    ActivateBranchParams,
    SetDefaultBranchParams,
    CopyBranchParams,
    BranchMutationError
} from './mutationTypes'

const invalidateBranchScopes = (queryClient: ReturnType<typeof useQueryClient>, metahubId: string, branchId?: string): void => {
    safeInvalidateQueries(queryClient, ['branches'], metahubsQueryKeys.branches(metahubId), metahubsQueryKeys.detail(metahubId), [
        'metahub-branches'
    ])

    if (branchId) {
        safeInvalidateQueriesInactive(queryClient, ['branches'], metahubsQueryKeys.branchDetail(metahubId, branchId))
    }
}

export function useCreateBranch() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['branches', 'create'],
        mutationFn: async ({ metahubId, data }: CreateBranchParams) => {
            const response = await branchesApi.createBranch(metahubId, data)
            return response.data
        },
        onMutate: async ({ metahubId, data }) => {
            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.branches(metahubId),
                optimisticEntity: {
                    id: generateOptimisticId(),
                    metahubId,
                    codename: data.codename || '',
                    name: data.name,
                    description: data.description ?? null,
                    sourceBranchId: data.sourceBranchId ?? null,
                    branchNumber: Number.MAX_SAFE_INTEGER,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    isDefault: false,
                    isActive: false,
                    ...makePendingMarkers('create')
                },
                insertPosition: 'prepend'
            })
        },
        onSuccess: (data, variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(queryClient, metahubsQueryKeys.branches(variables.metahubId), context.optimisticId, data.id, {
                    serverEntity: data
                })
            }
            enqueueSnackbar(t('branches.createSuccess', 'Branch created'), { variant: 'success' })
        },
        onError: (error: BranchMutationError, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
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
            if (status === 400 && compatibilityCode === 'BRANCH_COPY_OPTION_LIST_REFERENCES') {
                enqueueSnackbar(
                    t(
                        'branches.copyOptionListReferencesError',
                        'Cannot disable option list copy while copied entity groups still reference option lists.'
                    ),
                    { variant: 'warning' }
                )
                return
            }
            if (status === 400 && compatibilityCode === 'BRANCH_COPY_DANGLING_ENTITY_REFERENCES') {
                enqueueSnackbar(
                    t(
                        'branches.copyDanglingEntityReferencesError',
                        'Copy options would create invalid entity references. Keep all referenced entity groups enabled.'
                    ),
                    { variant: 'warning' }
                )
                return
            }

            enqueueSnackbar(backendMessage || error.message || t('branches.createError', 'Failed to create branch'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            invalidateBranchScopes(queryClient, variables.metahubId)
        }
    })
}

export function useCopyBranch() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['branches', 'copy'],
        mutationFn: async ({ metahubId, data }: CopyBranchParams) => {
            const response = await branchesApi.createBranch(metahubId, data)
            return response.data
        },
        onMutate: async ({ metahubId, data }) => {
            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.branches(metahubId),
                optimisticEntity: {
                    id: generateOptimisticId(),
                    metahubId,
                    codename: data.codename || '',
                    name: data.name,
                    description: data.description ?? null,
                    sourceBranchId: data.sourceBranchId ?? null,
                    branchNumber: Number.MAX_SAFE_INTEGER,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    isDefault: false,
                    isActive: false,
                    ...makePendingMarkers('copy')
                },
                insertPosition: 'prepend'
            })
        },
        onSuccess: (data, _variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(queryClient, metahubsQueryKeys.branches(_variables.metahubId), context.optimisticId, data.id, {
                    serverEntity: data
                })
            }
            console.info('[optimistic-copy:branches] onSuccess', {
                metahubId: _variables.metahubId,
                sourceBranchId: _variables.data.sourceBranchId ?? null,
                optimisticId: context?.optimisticId,
                realId: data?.id ?? null
            })
            enqueueSnackbar(t('branches.copySuccess', 'Branch copied'), { variant: 'success' })
        },
        onError: (error: BranchMutationError, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
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
            if (status === 400 && compatibilityCode === 'BRANCH_COPY_OPTION_LIST_REFERENCES') {
                enqueueSnackbar(
                    t(
                        'branches.copyOptionListReferencesError',
                        'Cannot disable option list copy while copied entity groups still reference option lists.'
                    ),
                    { variant: 'warning' }
                )
                return
            }
            if (status === 400 && compatibilityCode === 'BRANCH_COPY_DANGLING_ENTITY_REFERENCES') {
                enqueueSnackbar(
                    t(
                        'branches.copyDanglingEntityReferencesError',
                        'Copy options would create invalid entity references. Keep all referenced entity groups enabled.'
                    ),
                    { variant: 'warning' }
                )
                return
            }

            enqueueSnackbar(backendMessage || error.message || t('branches.copyError', 'Failed to copy branch'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            invalidateBranchScopes(queryClient, variables.metahubId)
            console.info('[optimistic-copy:branches] onSettled', {
                metahubId: variables.metahubId,
                sourceBranchId: variables.data.sourceBranchId ?? null,
                hasError: Boolean(_error)
            })
        }
    })
}

export function useUpdateBranch() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['branches', 'update'],
        mutationFn: async ({ metahubId, branchId, data }: UpdateBranchParams) => {
            const response = await branchesApi.updateBranch(metahubId, branchId, data)
            return response.data
        },
        onMutate: async ({ metahubId, branchId, data }) => {
            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.branches(metahubId),
                entityId: branchId,
                updater: {
                    ...data,
                    updatedAt: new Date().toISOString()
                },
                moveToFront: true,
                detailQueryKey: metahubsQueryKeys.branchDetail(metahubId, branchId)
            })
        },
        onSuccess: async (data, variables) => {
            await queryClient.cancelQueries({ queryKey: metahubsQueryKeys.branches(variables.metahubId) })
            confirmOptimisticUpdate(queryClient, metahubsQueryKeys.branches(variables.metahubId), variables.branchId, {
                serverEntity: data ?? null,
                moveToFront: true
            })
            if (data) {
                queryClient.setQueryData(metahubsQueryKeys.branchDetail(variables.metahubId, variables.branchId), data)
            }
            enqueueSnackbar(t('branches.updateSuccess', 'Branch updated'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('branches.updateError', 'Failed to update branch'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            invalidateBranchScopes(queryClient, variables.metahubId, variables.branchId)
        }
    })
}

export function useDeleteBranch() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['branches', 'delete'],
        mutationFn: async ({ metahubId, branchId }: DeleteBranchParams) => {
            await branchesApi.deleteBranch(metahubId, branchId)
        },
        onMutate: async ({ metahubId, branchId }) => {
            return applyOptimisticDelete({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.branches(metahubId),
                entityId: branchId,
                strategy: 'remove'
            })
        },
        onSuccess: () => {
            enqueueSnackbar(t('branches.deleteSuccess', 'Branch deleted'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('branches.deleteError', 'Failed to delete branch'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            invalidateBranchScopes(queryClient, variables.metahubId, variables.branchId)
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
