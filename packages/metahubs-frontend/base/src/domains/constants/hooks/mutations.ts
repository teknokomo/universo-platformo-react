import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import type { ConstantLocalizedPayload } from '../../../types'
import { metahubsQueryKeys } from '../../shared'
import * as constantsApi from '../api'
import type { ConstantCopyInput } from '../api'

interface BaseConstantScope {
    metahubId: string
    hubId?: string
    setId: string
}

interface CreateConstantParams extends BaseConstantScope {
    data: ConstantLocalizedPayload
}

interface UpdateConstantParams extends BaseConstantScope {
    constantId: string
    data: ConstantLocalizedPayload
}

interface DeleteConstantParams extends BaseConstantScope {
    constantId: string
}

interface MoveConstantParams extends BaseConstantScope {
    constantId: string
    direction: 'up' | 'down'
}

interface CopyConstantParams extends BaseConstantScope {
    constantId: string
    data: ConstantCopyInput
}

interface ReorderConstantParams extends BaseConstantScope {
    constantId: string
    newSortOrder: number
}

const invalidateSetConstantScopes = async (queryClient: ReturnType<typeof useQueryClient>, variables: BaseConstantScope): Promise<void> => {
    if (variables.hubId) {
        await queryClient.invalidateQueries({
            queryKey: metahubsQueryKeys.constants(variables.metahubId, variables.hubId, variables.setId)
        })
        await queryClient.invalidateQueries({
            queryKey: metahubsQueryKeys.constantsDirect(variables.metahubId, variables.setId)
        })
        await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.sets(variables.metahubId, variables.hubId) })
        await queryClient.refetchQueries({
            queryKey: metahubsQueryKeys.constants(variables.metahubId, variables.hubId, variables.setId),
            type: 'active'
        })
    } else {
        await queryClient.invalidateQueries({
            queryKey: metahubsQueryKeys.constantsDirect(variables.metahubId, variables.setId)
        })
        await queryClient.refetchQueries({
            queryKey: metahubsQueryKeys.constantsDirect(variables.metahubId, variables.setId),
            type: 'active'
        })
    }

    await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.setDetail(variables.metahubId, variables.setId) })
    await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allSets(variables.metahubId) })
    await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allConstantCodenames(variables.metahubId, variables.setId) })
}

export function useCreateConstant() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, setId, data }: CreateConstantParams) => {
            if (hubId) {
                const response = await constantsApi.createConstant(metahubId, hubId, setId, data)
                return response.data
            }
            const response = await constantsApi.createConstantDirect(metahubId, setId, data)
            return response.data
        },
        onSuccess: async (_data, variables) => {
            await invalidateSetConstantScopes(queryClient, variables)
            enqueueSnackbar(t('constants.createSuccess', 'Constant created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('constants.createError', 'Failed to create constant'), { variant: 'error' })
        }
    })
}

export function useUpdateConstant() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, setId, constantId, data }: UpdateConstantParams) => {
            if (hubId) {
                const response = await constantsApi.updateConstant(metahubId, hubId, setId, constantId, data)
                return response.data
            }
            const response = await constantsApi.updateConstantDirect(metahubId, setId, constantId, data)
            return response.data
        },
        onSuccess: async (_data, variables) => {
            await invalidateSetConstantScopes(queryClient, variables)
            enqueueSnackbar(t('constants.updateSuccess', 'Constant updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('constants.updateError', 'Failed to update constant'), { variant: 'error' })
        }
    })
}

export function useDeleteConstant() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, setId, constantId }: DeleteConstantParams) => {
            if (hubId) {
                await constantsApi.deleteConstant(metahubId, hubId, setId, constantId)
            } else {
                await constantsApi.deleteConstantDirect(metahubId, setId, constantId)
            }
        },
        onSuccess: async (_data, variables) => {
            await invalidateSetConstantScopes(queryClient, variables)
            enqueueSnackbar(t('constants.deleteSuccess', 'Constant deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('constants.deleteError', 'Failed to delete constant'), { variant: 'error' })
        }
    })
}

export function useMoveConstant() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, setId, constantId, direction }: MoveConstantParams) => {
            if (hubId) {
                const response = await constantsApi.moveConstant(metahubId, hubId, setId, constantId, direction)
                return response.data
            }
            const response = await constantsApi.moveConstantDirect(metahubId, setId, constantId, direction)
            return response.data
        },
        onSuccess: async (_data, variables) => {
            await invalidateSetConstantScopes(queryClient, variables)
            enqueueSnackbar(t('constants.moveSuccess', 'Constant order updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('constants.moveError', 'Failed to update constant order'), { variant: 'error' })
        }
    })
}

export function useReorderConstant() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ metahubId, hubId, setId, constantId, newSortOrder }: ReorderConstantParams) => {
            if (hubId) {
                const response = await constantsApi.reorderConstant(metahubId, hubId, setId, constantId, newSortOrder)
                return response.data
            }
            const response = await constantsApi.reorderConstantDirect(metahubId, setId, constantId, newSortOrder)
            return response.data
        },
        onMutate: async (variables) => {
            const listKey = variables.hubId
                ? metahubsQueryKeys.constantsList(variables.metahubId, variables.hubId, variables.setId)
                : metahubsQueryKeys.constantsListDirect(variables.metahubId, variables.setId)

            await queryClient.cancelQueries({ queryKey: listKey })
            const previousQueries = queryClient.getQueriesData<Record<string, unknown>>({ queryKey: listKey })

            queryClient.setQueriesData<Record<string, unknown>>({ queryKey: listKey }, (old) => {
                if (!old || !Array.isArray((old as { items?: unknown[] }).items)) return old
                const items = [...((old as { items: Array<Record<string, unknown>> }).items ?? [])]
                const fromIndex = items.findIndex((item) => item.id === variables.constantId)
                if (fromIndex === -1) return old

                let toIndex = items.findIndex((item) => (item.sortOrder ?? 0) === variables.newSortOrder)
                if (toIndex === -1) toIndex = Math.max(0, Math.min(items.length - 1, variables.newSortOrder - 1))

                const [moved] = items.splice(fromIndex, 1)
                items.splice(toIndex, 0, moved)
                const updated = items.map((item, idx) => ({ ...item, sortOrder: idx + 1 }))
                return { ...old, items: updated }
            })

            return { previousQueries }
        },
        onError: (_error, _variables, context) => {
            if (!context?.previousQueries) return
            for (const [key, data] of context.previousQueries) {
                queryClient.setQueryData(key, data)
            }
        },
        onSettled: async (_data, _error, variables) => {
            await invalidateSetConstantScopes(queryClient, variables)
        }
    })
}

export function useCopyConstant() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, setId, constantId, data }: CopyConstantParams) => {
            if (hubId) {
                const response = await constantsApi.copyConstant(metahubId, hubId, setId, constantId, data)
                return response.data
            }
            const response = await constantsApi.copyConstantDirect(metahubId, setId, constantId, data)
            return response.data
        },
        onSuccess: async (_data, variables) => {
            await invalidateSetConstantScopes(queryClient, variables)
            enqueueSnackbar(t('constants.copySuccess', 'Constant copied'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('constants.copyError', 'Failed to copy constant'), { variant: 'error' })
        }
    })
}
