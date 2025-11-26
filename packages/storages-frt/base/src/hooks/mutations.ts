/**
 * Storage mutations hooks
 *
 * This file contains all mutation hooks for the storages module.
 * Uses @tanstack/react-query useMutation for proper cache management and loading states.
 *
 * Following the colocation principle - mutations are kept close to their feature.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import type { AssignableRole } from '@universo/template-mui'

import * as storagesApi from '../api/storages'
import * as containersApi from '../api/containers'
import * as slotsApi from '../api/slots'
import { storagesQueryKeys, containersQueryKeys, slotsQueryKeys } from '../api/queryKeys'

// ============================================================================
// Types
// ============================================================================

interface UpdateStorageParams {
    id: string
    data: { name: string; description?: string }
}

interface UpdateContainerParams {
    id: string
    data: { name: string; description?: string }
}

interface CreateContainerParams {
    name: string
    description?: string
    storageId: string
}

interface UpdateSlotParams {
    id: string
    data: { name: string; description?: string }
}

interface CreateSlotParams {
    name: string
    description?: string
    containerId: string
}

interface UpdateMemberRoleParams {
    storageId: string
    memberId: string
    data: { role: AssignableRole; comment?: string }
}

interface RemoveMemberParams {
    storageId: string
    memberId: string
}

interface InviteMemberParams {
    storageId: string
    data: { email: string; role: AssignableRole; comment?: string }
}

// ============================================================================
// Storage Mutations
// ============================================================================

/**
 * Hook for creating a storage
 */
export function useCreateStorage() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('storages')

    return useMutation({
        mutationFn: async (data: { name: string; description?: string }) => {
            const response = await storagesApi.createStorage(data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: storagesQueryKeys.lists() })
            enqueueSnackbar(t('createSuccess', 'Storage created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('createError', 'Failed to create storage'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating a storage
 */
export function useUpdateStorage() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('storages')

    return useMutation({
        mutationFn: async ({ id, data }: UpdateStorageParams) => {
            const response = await storagesApi.updateStorage(id, data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: storagesQueryKeys.lists() })
            enqueueSnackbar(t('updateSuccess', 'Storage updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('updateError', 'Failed to update storage'), { variant: 'error' })
        }
    })
}

/**
 * Hook for deleting a storage
 */
export function useDeleteStorage() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('storages')

    return useMutation({
        mutationFn: async (id: string) => {
            await storagesApi.deleteStorage(id)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: storagesQueryKeys.lists() })
            enqueueSnackbar(t('deleteSuccess', 'Storage deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('deleteError', 'Failed to delete storage'), { variant: 'error' })
        }
    })
}

// ============================================================================
// Container Mutations
// ============================================================================

/**
 * Hook for creating a container
 */
export function useCreateContainer() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('storages')

    return useMutation({
        mutationFn: async (data: CreateContainerParams) => {
            const response = await containersApi.createContainer(data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: containersQueryKeys.lists() })
            enqueueSnackbar(t('containers.createSuccess', 'Container created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('containers.saveError', 'Failed to create container'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating a container
 */
export function useUpdateContainer() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('storages')

    return useMutation({
        mutationFn: async ({ id, data }: UpdateContainerParams) => {
            const response = await containersApi.updateContainer(id, data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: containersQueryKeys.lists() })
            enqueueSnackbar(t('containers.updateSuccess', 'Container updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('containers.updateError', 'Failed to update container'), { variant: 'error' })
        }
    })
}

/**
 * Hook for deleting a container
 */
export function useDeleteContainer() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('storages')

    return useMutation({
        mutationFn: async (id: string) => {
            await containersApi.deleteContainer(id)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: containersQueryKeys.lists() })
            enqueueSnackbar(t('containers.deleteSuccess', 'Container deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('containers.deleteError', 'Failed to delete container'), { variant: 'error' })
        }
    })
}

// ============================================================================
// Slot Mutations
// ============================================================================

/**
 * Hook for creating a slot
 */
export function useCreateSlot() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('storages')

    return useMutation({
        mutationFn: async (data: CreateSlotParams) => {
            const response = await slotsApi.createSlot(data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: slotsQueryKeys.lists() })
            enqueueSnackbar(t('slots.createSuccess', 'Slot created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('slots.saveError', 'Failed to create slot'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating a slot
 */
export function useUpdateSlot() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('storages')

    return useMutation({
        mutationFn: async ({ id, data }: UpdateSlotParams) => {
            const response = await slotsApi.updateSlot(id, data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: slotsQueryKeys.lists() })
            enqueueSnackbar(t('slots.updateSuccess', 'Slot updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('slots.updateError', 'Failed to update slot'), { variant: 'error' })
        }
    })
}

/**
 * Hook for deleting a slot
 */
export function useDeleteSlot() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('storages')

    return useMutation({
        mutationFn: async (id: string) => {
            await slotsApi.deleteSlot(id)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: slotsQueryKeys.lists() })
            enqueueSnackbar(t('slots.deleteSuccess', 'Slot deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('slots.deleteError', 'Failed to delete slot'), { variant: 'error' })
        }
    })
}

// ============================================================================
// Member Mutations
// ============================================================================

/**
 * Hook for inviting a new storage member
 */
export function useInviteMember() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useCommonTranslations()

    return useMutation({
        mutationFn: async ({ storageId, data }: InviteMemberParams) => {
            const response = await storagesApi.inviteStorageMember(storageId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: storagesQueryKeys.members(variables.storageId) })
            enqueueSnackbar(t('members.inviteSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('members.inviteError'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating a storage member's role
 */
export function useUpdateMemberRole() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useCommonTranslations()

    return useMutation({
        mutationFn: async ({ storageId, memberId, data }: UpdateMemberRoleParams) => {
            const response = await storagesApi.updateStorageMemberRole(storageId, memberId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: storagesQueryKeys.members(variables.storageId) })
            enqueueSnackbar(t('members.updateSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('members.updateError'), { variant: 'error' })
        }
    })
}

/**
 * Hook for removing a storage member
 */
export function useRemoveMember() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useCommonTranslations()

    return useMutation({
        mutationFn: async ({ storageId, memberId }: RemoveMemberParams) => {
            await storagesApi.removeStorageMember(storageId, memberId)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: storagesQueryKeys.members(variables.storageId) })
            enqueueSnackbar(t('members.removeSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('members.removeError'), { variant: 'error' })
        }
    })
}

/**
 * Combined hook for storage member mutations
 * Provides a unified interface for member operations within a specific storage
 */
export function useMemberMutations(storageId: string) {
    const inviteMutation = useInviteMember()
    const updateMutation = useUpdateMemberRole()
    const removeMutation = useRemoveMember()

    return {
        // Invite
        inviteMember: async (data: { email: string; role: AssignableRole; comment?: string }) => {
            return inviteMutation.mutateAsync({ storageId, data })
        },
        isInviting: inviteMutation.isPending,
        inviteError: inviteMutation.error,

        // Update role
        updateMemberRole: async (memberId: string, data: { role: AssignableRole; comment?: string }) => {
            return updateMutation.mutateAsync({ storageId, memberId, data })
        },
        isUpdating: updateMutation.isPending,
        updateError: updateMutation.error,

        // Remove
        removeMember: async (memberId: string) => {
            return removeMutation.mutateAsync({ storageId, memberId })
        },
        isRemoving: removeMutation.isPending,
        removeError: removeMutation.error,

        // Combined state
        isPending: inviteMutation.isPending || updateMutation.isPending || removeMutation.isPending
    }
}
