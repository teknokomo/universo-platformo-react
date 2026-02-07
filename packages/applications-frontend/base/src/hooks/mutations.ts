/**
 * Application mutations hooks
 *
 * This file contains all mutation hooks for the applications module.
 * Uses @tanstack/react-query useMutation for proper cache management and loading states.
 *
 * Structure:
 * - Applications (top-level containers)
 * - Connectors (child items within applications)
 * - Members (application access control)
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import type { AssignableRole } from '@universo/template-mui'
import type { ConnectorLocalizedPayload, ApplicationLocalizedPayload, SimpleLocalizedInput } from '../types'
import { normalizeLocale } from '../utils/localizedInput'

import * as applicationsApi from '../api/applications'
import * as connectorsApi from '../api/connectors'
import { applicationsQueryKeys } from '../api/queryKeys'

// ============================================================================
// Types
// ============================================================================

type LegacyApplicationInput = { name: string; description?: string }

interface UpdateApplicationParams {
    id: string
    data: LegacyApplicationInput | ApplicationLocalizedPayload
}

interface CopyApplicationParams {
    id: string
    data?: applicationsApi.ApplicationCopyInput
}

interface UpdateMemberRoleParams {
    applicationId: string
    memberId: string
    data: { role: AssignableRole; comment?: string }
}

interface RemoveMemberParams {
    applicationId: string
    memberId: string
}

interface InviteMemberParams {
    applicationId: string
    data: { email: string; role: AssignableRole; comment?: string }
}

interface CreateConnectorParams {
    applicationId: string
    data: ConnectorLocalizedPayload & { sortOrder?: number }
}

interface UpdateConnectorParams {
    applicationId: string
    connectorId: string
    data: ConnectorLocalizedPayload & { sortOrder?: number }
}

interface DeleteConnectorParams {
    applicationId: string
    connectorId: string
}

interface SyncConnectorParams {
    applicationId: string
    confirmDestructive?: boolean
}

// ============================================================================
// Helpers
// ============================================================================

const buildLocalizedInput = (value: string | undefined, locale: string): SimpleLocalizedInput | undefined => {
    if (!value) return undefined
    return { [locale]: value }
}

// ============================================================================
// Application Mutations
// ============================================================================

/**
 * Hook for creating an application
 */
export function useCreateApplication() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t, i18n } = useTranslation('applications')

    return useMutation({
        mutationFn: async (data: LegacyApplicationInput | ApplicationLocalizedPayload) => {
            const locale = normalizeLocale(i18n.language)
            const payload: ApplicationLocalizedPayload =
                typeof data.name === 'string'
                    ? {
                          name: buildLocalizedInput(data.name, locale) ?? { [locale]: '' },
                          description: buildLocalizedInput(data.description, locale),
                          namePrimaryLocale: locale,
                          descriptionPrimaryLocale: data.description ? locale : undefined
                      }
                    : data
            const response = await applicationsApi.createApplication(payload)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.lists() })
            enqueueSnackbar(t('createSuccess', 'Application created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('createError', 'Failed to create application'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating an application
 */
export function useUpdateApplication() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t, i18n } = useTranslation('applications')

    return useMutation({
        mutationFn: async ({ id, data }: UpdateApplicationParams) => {
            const locale = normalizeLocale(i18n.language)
            const payload: ApplicationLocalizedPayload =
                typeof data.name === 'string'
                    ? {
                          name: buildLocalizedInput(data.name, locale) ?? { [locale]: '' },
                          description: buildLocalizedInput(data.description, locale),
                          namePrimaryLocale: locale,
                          descriptionPrimaryLocale: data.description ? locale : undefined
                      }
                    : data
            const response = await applicationsApi.updateApplication(id, payload)
            return response.data
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.lists() })
            queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.detail(variables.id) })
            enqueueSnackbar(t('updateSuccess', 'Application updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('updateError', 'Failed to update application'), { variant: 'error' })
        }
    })
}

/**
 * Hook for deleting an application
 */
export function useDeleteApplication() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('applications')

    return useMutation({
        mutationFn: async (id: string) => {
            await applicationsApi.deleteApplication(id)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.lists() })
            enqueueSnackbar(t('deleteSuccess', 'Application deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('deleteError', 'Failed to delete application'), { variant: 'error' })
        }
    })
}

/**
 * Hook for copying an application
 */
export function useCopyApplication() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('applications')

    return useMutation({
        mutationFn: async ({ id, data }: CopyApplicationParams) => {
            const response = await applicationsApi.copyApplication(id, data ?? {})
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.lists() })
            enqueueSnackbar(t('copySuccess', 'Application copied'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('copyError', 'Failed to copy application'), { variant: 'error' })
        }
    })
}

// ============================================================================
// Member Mutations
// ============================================================================

/**
 * Hook for inviting a new application member
 */
export function useInviteMember() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useCommonTranslations()

    return useMutation({
        mutationFn: async ({ applicationId, data }: InviteMemberParams) => {
            const response = await applicationsApi.inviteApplicationMember(applicationId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.members(variables.applicationId) })
            enqueueSnackbar(t('members.inviteSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('members.inviteError'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating an application member's role
 */
export function useUpdateMemberRole() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useCommonTranslations()

    return useMutation({
        mutationFn: async ({ applicationId, memberId, data }: UpdateMemberRoleParams) => {
            const response = await applicationsApi.updateApplicationMemberRole(applicationId, memberId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.members(variables.applicationId) })
            enqueueSnackbar(t('members.updateSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('members.updateError'), { variant: 'error' })
        }
    })
}

/**
 * Hook for removing an application member
 */
export function useRemoveMember() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useCommonTranslations()

    return useMutation({
        mutationFn: async ({ applicationId, memberId }: RemoveMemberParams) => {
            await applicationsApi.removeApplicationMember(applicationId, memberId)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.members(variables.applicationId) })
            enqueueSnackbar(t('members.removeSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('members.removeError'), { variant: 'error' })
        }
    })
}

/**
 * Combined hook for application member mutations
 * Provides a unified interface for member operations within a specific application
 */
export function useMemberMutations(applicationId: string) {
    const inviteMutation = useInviteMember()
    const updateMutation = useUpdateMemberRole()
    const removeMutation = useRemoveMember()

    return {
        // Invite
        inviteMember: async (data: { email: string; role: AssignableRole; comment?: string }) => {
            return inviteMutation.mutateAsync({ applicationId, data })
        },
        isInviting: inviteMutation.isPending,
        inviteError: inviteMutation.error,

        // Update role
        updateMemberRole: async (memberId: string, data: { role: AssignableRole; comment?: string }) => {
            return updateMutation.mutateAsync({ applicationId, memberId, data })
        },
        isUpdating: updateMutation.isPending,
        updateError: updateMutation.error,

        // Remove
        removeMember: async (memberId: string) => {
            return removeMutation.mutateAsync({ applicationId, memberId })
        },
        isRemoving: removeMutation.isPending,
        removeError: removeMutation.error,

        // Combined state
        isPending: inviteMutation.isPending || updateMutation.isPending || removeMutation.isPending
    }
}

// ============================================================================
// Connector Mutations
// ============================================================================

/**
 * Hook for creating a connector
 */
export function useCreateConnector() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('applications')

    return useMutation({
        mutationFn: async ({ applicationId, data }: CreateConnectorParams) => {
            const response = await connectorsApi.createConnector(applicationId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.connectors(variables.applicationId) })
            enqueueSnackbar(t('connectors.createSuccess', 'Connector created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('connectors.createError', 'Failed to create connector'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating a connector
 */
export function useUpdateConnector() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('applications')

    return useMutation({
        mutationFn: async ({ applicationId, connectorId, data }: UpdateConnectorParams) => {
            const response = await connectorsApi.updateConnector(applicationId, connectorId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.connectors(variables.applicationId) })
            queryClient.invalidateQueries({
                queryKey: applicationsQueryKeys.connectorDetail(variables.applicationId, variables.connectorId)
            })
            enqueueSnackbar(t('connectors.updateSuccess', 'Connector updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('connectors.updateError', 'Failed to update connector'), { variant: 'error' })
        }
    })
}

/**
 * Hook for deleting a connector
 */
export function useDeleteConnector() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('applications')

    return useMutation({
        mutationFn: async ({ applicationId, connectorId }: DeleteConnectorParams) => {
            await connectorsApi.deleteConnector(applicationId, connectorId)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.connectors(variables.applicationId) })
            enqueueSnackbar(t('connectors.deleteSuccess', 'Connector deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('connectors.deleteError', 'Failed to delete connector'), { variant: 'error' })
        }
    })
}

/**
 * Hook for syncing application schema with linked Metahub configuration
 */
export function useSyncConnector() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('applications')

    return useMutation({
        mutationFn: async ({ applicationId, confirmDestructive = false }: SyncConnectorParams) => {
            return connectorsApi.syncApplication(applicationId, confirmDestructive)
        },
        onSuccess: (data, variables) => {
            // Invalidate application-related queries
            queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.detail(variables.applicationId) })
            queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.applicationDiff(variables.applicationId) })

            if (data.status === 'pending_confirmation') {
                enqueueSnackbar(t('connectors.syncPending', 'Destructive changes detected. Confirm to proceed.'), { variant: 'warning' })
            } else {
                enqueueSnackbar(t('connectors.syncSuccess', 'Schema synchronized'), { variant: 'success' })
            }
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('connectors.syncError', 'Schema sync failed'), { variant: 'error' })
        }
    })
}

/**
 * Combined hook for connector mutations
 * Provides a unified interface for connector operations within a specific application
 */
export function useConnectorMutations(applicationId: string) {
    const createMutation = useCreateConnector()
    const updateMutation = useUpdateConnector()
    const deleteMutation = useDeleteConnector()

    return {
        // Create
        createConnector: async (data: ConnectorLocalizedPayload & { sortOrder?: number }) => {
            return createMutation.mutateAsync({ applicationId, data })
        },
        isCreating: createMutation.isPending,
        createError: createMutation.error,

        // Update
        updateConnector: async (connectorId: string, data: ConnectorLocalizedPayload & { sortOrder?: number }) => {
            return updateMutation.mutateAsync({ applicationId, connectorId, data })
        },
        isUpdating: updateMutation.isPending,
        updateError: updateMutation.error,

        // Delete
        deleteConnector: async (connectorId: string) => {
            return deleteMutation.mutateAsync({ applicationId, connectorId })
        },
        isDeleting: deleteMutation.isPending,
        deleteError: deleteMutation.error,

        // Combined state
        isPending: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending
    }
}
