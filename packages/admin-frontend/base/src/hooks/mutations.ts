import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import apiClient from '../api/apiClient'
import { createAdminApi, type GrantRolePayload, type UpdateRolePayload } from '../api/adminApi'
import { adminQueryKeys } from '../api/queryKeys'
import type { GlobalAssignableRole } from '../types'

// Re-export queryKeys for backward compatibility
export { adminQueryKeys }

// Singleton instance of adminApi
const adminApi = createAdminApi(apiClient)

/**
 * Hook to grant global role (invite member by email)
 */
export function useGrantGlobalRole() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('admin')

    return useMutation({
        mutationFn: (payload: GrantRolePayload) => adminApi.grantRole(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: adminQueryKeys.globalUsers() })
            queryClient.invalidateQueries({ queryKey: adminQueryKeys.stats() })
            enqueueSnackbar(t('access.grantSuccess', 'Global access granted successfully'), { variant: 'success' })
        },
        onError: () => {
            // Error is handled in component for special cases (404, 409)
        }
    })
}

/**
 * Hook to update global user's role and/or comment
 */
export function useUpdateGlobalRole() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('admin')

    return useMutation({
        mutationFn: ({ memberId, role, comment }: { memberId: string; role?: GlobalAssignableRole; comment?: string }) =>
            adminApi.updateRole(memberId, { role, comment } as UpdateRolePayload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: adminQueryKeys.globalUsers() })
            enqueueSnackbar(t('access.updateSuccess', 'Role updated successfully'), { variant: 'success' })
        },
        onError: (error: unknown) => {
            const message =
                error && typeof error === 'object' && 'response' in error
                    ? (error as { response?: { data?: { error?: string } } })?.response?.data?.error ??
                      t('access.updateError', 'Failed to update role')
                    : t('access.updateError', 'Failed to update role')
            enqueueSnackbar(message, { variant: 'error' })
        }
    })
}

/**
 * Hook to revoke global role
 */
export function useRevokeGlobalRole() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('admin')

    return useMutation({
        mutationFn: (memberId: string) => adminApi.revokeRole(memberId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: adminQueryKeys.globalUsers() })
            queryClient.invalidateQueries({ queryKey: adminQueryKeys.stats() })
            enqueueSnackbar(t('access.revokeSuccess', 'Global access revoked successfully'), { variant: 'success' })
        },
        onError: (error: unknown) => {
            const message =
                error && typeof error === 'object' && 'response' in error
                    ? (error as { response?: { data?: { error?: string } } })?.response?.data?.error ??
                      t('access.revokeError', 'Failed to revoke access')
                    : t('access.revokeError', 'Failed to revoke access')
            enqueueSnackbar(message, { variant: 'error' })
        }
    })
}
