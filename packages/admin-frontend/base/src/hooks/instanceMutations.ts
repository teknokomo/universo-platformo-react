import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import * as instancesApi from '../api/instancesApi'
import { instancesQueryKeys } from '../api/queryKeys'
import type { UpdateInstancePayload } from '../types'

// ============================================================================
// Types
// ============================================================================

interface UpdateInstanceParams {
    id: string
    data: UpdateInstancePayload
}

// ============================================================================
// Instance Mutations
// ============================================================================

/**
 * Hook to update instance (name, description)
 */
export function useUpdateInstance() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('admin')

    return useMutation({
        mutationFn: async ({ id, data }: UpdateInstanceParams) => {
            return instancesApi.updateInstance(id, data)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: instancesQueryKeys.lists() })
            queryClient.invalidateQueries({ queryKey: instancesQueryKeys.detail(variables.id) })
            enqueueSnackbar(t('instances.updateSuccess', 'Instance updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('instances.updateError', 'Failed to update instance'), { variant: 'error' })
        }
    })
}
