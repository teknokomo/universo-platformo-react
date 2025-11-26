/**
 * Consolidated mutations for uniks-frt package
 * Following @tanstack/react-query v5 useMutation pattern
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'

import * as uniksApi from '../api/uniks'
import { uniksQueryKeys } from '../api/queryKeys'
import type { Unik, UnikMember, UnikAssignableRole } from '../types'

// ============================================================================
// Unik Mutations
// ============================================================================

/**
 * Hook for creating a new unik
 */
export function useCreateUnik() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('uniks')

    return useMutation({
        mutationFn: (data: { name: string; description?: string }) => uniksApi.createUnik(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: uniksQueryKeys.lists() })
            enqueueSnackbar(t('createSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('errors.saveFailed'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating an existing unik
 */
export function useUpdateUnik() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('uniks')

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: { name: string; description?: string } }) => uniksApi.updateUnik(id, data),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: uniksQueryKeys.lists() })
            queryClient.invalidateQueries({ queryKey: uniksQueryKeys.detail(variables.id) })
            enqueueSnackbar(t('updateSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('errors.saveFailed'), { variant: 'error' })
        }
    })
}

/**
 * Hook for deleting a unik
 */
export function useDeleteUnik() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('uniks')

    return useMutation({
        mutationFn: (id: string) => uniksApi.deleteUnik(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: uniksQueryKeys.lists() })
            enqueueSnackbar(t('deleteSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('deleteError'), { variant: 'error' })
        }
    })
}

// ============================================================================
// Member Mutations
// ============================================================================

/**
 * Hook for inviting a member to a unik
 */
export function useInviteMember() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t: tc } = useCommonTranslations()

    return useMutation({
        mutationFn: ({ unikId, data }: { unikId: string; data: { email: string; role: UnikAssignableRole; comment?: string } }) =>
            uniksApi.inviteUnikMember(unikId, data),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: uniksQueryKeys.members(variables.unikId) })
            enqueueSnackbar(tc('members.inviteSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || tc('members.inviteError'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating a member's role
 */
export function useUpdateMemberRole() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t: tc } = useCommonTranslations()

    return useMutation({
        mutationFn: ({
            unikId,
            memberId,
            data
        }: {
            unikId: string
            memberId: string
            data: { role: UnikAssignableRole; comment?: string }
        }) => uniksApi.updateUnikMemberRole(unikId, memberId, data),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: uniksQueryKeys.members(variables.unikId) })
            enqueueSnackbar(tc('members.updateSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || tc('members.updateError'), { variant: 'error' })
        }
    })
}

/**
 * Hook for removing a member from a unik
 */
export function useRemoveMember() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t: tc } = useCommonTranslations()

    return useMutation({
        mutationFn: ({ unikId, memberId }: { unikId: string; memberId: string }) => uniksApi.removeUnikMember(unikId, memberId),
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: uniksQueryKeys.members(variables.unikId) })
            enqueueSnackbar(tc('members.removeSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || tc('members.removeError'), { variant: 'error' })
        }
    })
}

/**
 * Combined hook for unik member mutations
 * Provides a unified interface for member operations within a specific unik
 */
export function useMemberMutations(unikId: string) {
    const inviteMutation = useInviteMember()
    const updateMutation = useUpdateMemberRole()
    const removeMutation = useRemoveMember()

    return {
        // Invite
        inviteMember: async (data: { email: string; role: UnikAssignableRole; comment?: string }) => {
            return inviteMutation.mutateAsync({ unikId, data })
        },
        isInviting: inviteMutation.isPending,
        inviteError: inviteMutation.error,

        // Update role
        updateMemberRole: async (memberId: string, data: { role: UnikAssignableRole; comment?: string }) => {
            return updateMutation.mutateAsync({ unikId, memberId, data })
        },
        isUpdating: updateMutation.isPending,
        updateError: updateMutation.error,

        // Remove
        removeMember: async (memberId: string) => {
            return removeMutation.mutateAsync({ unikId, memberId })
        },
        isRemoving: removeMutation.isPending,
        removeError: removeMutation.error,

        // Combined state
        isPending: inviteMutation.isPending || updateMutation.isPending || removeMutation.isPending
    }
}

// ============================================================================
// Type Exports
// ============================================================================

export type { Unik, UnikMember, UnikAssignableRole }
