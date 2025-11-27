/**
 * Organization mutations hooks
 *
 * This file contains all mutation hooks for the organizations module.
 * Uses @tanstack/react-query useMutation for proper cache management and loading states.
 *
 * Following the colocation principle - mutations are kept close to their feature.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import type { AssignableRole } from '@universo/template-mui'

import * as organizationsApi from '../api/organizations'
import * as departmentsApi from '../api/departments'
import * as positionsApi from '../api/positions'
import { organizationsQueryKeys, departmentsQueryKeys, positionsQueryKeys } from '../api/queryKeys'

// ============================================================================
// Types
// ============================================================================

interface UpdateOrganizationParams {
    id: string
    data: { name: string; description?: string }
}

interface UpdateDepartmentParams {
    id: string
    data: { name: string; description?: string }
}

interface CreateDepartmentParams {
    name: string
    description?: string
    organizationId: string
}

interface UpdatePositionParams {
    id: string
    data: { name: string; description?: string }
}

interface CreatePositionParams {
    name: string
    description?: string
    departmentId: string
}

interface UpdateMemberRoleParams {
    organizationId: string
    memberId: string
    data: { role: AssignableRole; comment?: string }
}

interface RemoveMemberParams {
    organizationId: string
    memberId: string
}

interface InviteMemberParams {
    organizationId: string
    data: { email: string; role: AssignableRole; comment?: string }
}

// ============================================================================
// Organization Mutations
// ============================================================================

/**
 * Hook for creating an organization
 */
export function useCreateOrganization() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('organizations')

    return useMutation({
        mutationFn: async (data: { name: string; description?: string }) => {
            const response = await organizationsApi.createOrganization(data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: organizationsQueryKeys.lists() })
            enqueueSnackbar(t('createSuccess', 'Organization created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('createError', 'Failed to create organization'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating an organization
 */
export function useUpdateOrganization() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('organizations')

    return useMutation({
        mutationFn: async ({ id, data }: UpdateOrganizationParams) => {
            const response = await organizationsApi.updateOrganization(id, data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: organizationsQueryKeys.lists() })
            enqueueSnackbar(t('updateSuccess', 'Organization updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('updateError', 'Failed to update organization'), { variant: 'error' })
        }
    })
}

/**
 * Hook for deleting an organization
 */
export function useDeleteOrganization() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('organizations')

    return useMutation({
        mutationFn: async (id: string) => {
            await organizationsApi.deleteOrganization(id)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: organizationsQueryKeys.lists() })
            enqueueSnackbar(t('deleteSuccess', 'Organization deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('deleteError', 'Failed to delete organization'), { variant: 'error' })
        }
    })
}

// ============================================================================
// Department Mutations
// ============================================================================

/**
 * Hook for creating a department
 */
export function useCreateDepartment() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('organizations')

    return useMutation({
        mutationFn: async (data: CreateDepartmentParams) => {
            const response = await departmentsApi.createDepartment(data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: departmentsQueryKeys.lists() })
            enqueueSnackbar(t('departments.createSuccess', 'Department created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('departments.saveError', 'Failed to create department'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating a department
 */
export function useUpdateDepartment() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('organizations')

    return useMutation({
        mutationFn: async ({ id, data }: UpdateDepartmentParams) => {
            const response = await departmentsApi.updateDepartment(id, data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: departmentsQueryKeys.lists() })
            enqueueSnackbar(t('departments.updateSuccess', 'Department updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('departments.updateError', 'Failed to update department'), { variant: 'error' })
        }
    })
}

/**
 * Hook for deleting a department
 */
export function useDeleteDepartment() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('organizations')

    return useMutation({
        mutationFn: async (id: string) => {
            await departmentsApi.deleteDepartment(id)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: departmentsQueryKeys.lists() })
            enqueueSnackbar(t('departments.deleteSuccess', 'Department deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('departments.deleteError', 'Failed to delete department'), { variant: 'error' })
        }
    })
}

// ============================================================================
// Position Mutations
// ============================================================================

/**
 * Hook for creating a position
 */
export function useCreatePosition() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('organizations')

    return useMutation({
        mutationFn: async (data: CreatePositionParams) => {
            const response = await positionsApi.createPosition(data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: positionsQueryKeys.lists() })
            enqueueSnackbar(t('positions.createSuccess', 'Position created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('positions.saveError', 'Failed to create position'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating a position
 */
export function useUpdatePosition() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('organizations')

    return useMutation({
        mutationFn: async ({ id, data }: UpdatePositionParams) => {
            const response = await positionsApi.updatePosition(id, data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: positionsQueryKeys.lists() })
            enqueueSnackbar(t('positions.updateSuccess', 'Position updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('positions.updateError', 'Failed to update position'), { variant: 'error' })
        }
    })
}

/**
 * Hook for deleting a position
 */
export function useDeletePosition() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('organizations')

    return useMutation({
        mutationFn: async (id: string) => {
            await positionsApi.deletePosition(id)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: positionsQueryKeys.lists() })
            enqueueSnackbar(t('positions.deleteSuccess', 'Position deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('positions.deleteError', 'Failed to delete position'), { variant: 'error' })
        }
    })
}

// ============================================================================
// Member Mutations
// ============================================================================

/**
 * Hook for inviting a new organization member
 */
export function useInviteMember() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useCommonTranslations()

    return useMutation({
        mutationFn: async ({ organizationId, data }: InviteMemberParams) => {
            const response = await organizationsApi.inviteOrganizationMember(organizationId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: organizationsQueryKeys.members(variables.organizationId) })
            enqueueSnackbar(t('members.inviteSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('members.inviteError'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating an organization member's role
 */
export function useUpdateMemberRole() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useCommonTranslations()

    return useMutation({
        mutationFn: async ({ organizationId, memberId, data }: UpdateMemberRoleParams) => {
            const response = await organizationsApi.updateOrganizationMemberRole(organizationId, memberId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: organizationsQueryKeys.members(variables.organizationId) })
            enqueueSnackbar(t('members.updateSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('members.updateError'), { variant: 'error' })
        }
    })
}

/**
 * Hook for removing an organization member
 */
export function useRemoveMember() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useCommonTranslations()

    return useMutation({
        mutationFn: async ({ organizationId, memberId }: RemoveMemberParams) => {
            await organizationsApi.removeOrganizationMember(organizationId, memberId)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: organizationsQueryKeys.members(variables.organizationId) })
            enqueueSnackbar(t('members.removeSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('members.removeError'), { variant: 'error' })
        }
    })
}

/**
 * Combined hook for organization member mutations
 * Provides a unified interface for member operations within a specific organization
 */
export function useMemberMutations(organizationId: string) {
    const inviteMutation = useInviteMember()
    const updateMutation = useUpdateMemberRole()
    const removeMutation = useRemoveMember()

    return {
        // Invite
        inviteMember: async (data: { email: string; role: AssignableRole; comment?: string }) => {
            return inviteMutation.mutateAsync({ organizationId, data })
        },
        isInviting: inviteMutation.isPending,
        inviteError: inviteMutation.error,

        // Update role
        updateMemberRole: async (memberId: string, data: { role: AssignableRole; comment?: string }) => {
            return updateMutation.mutateAsync({ organizationId, memberId, data })
        },
        isUpdating: updateMutation.isPending,
        updateError: updateMutation.error,

        // Remove
        removeMember: async (memberId: string) => {
            return removeMutation.mutateAsync({ organizationId, memberId })
        },
        isRemoving: removeMutation.isPending,
        removeError: removeMutation.error,

        // Combined state
        isPending: inviteMutation.isPending || updateMutation.isPending || removeMutation.isPending
    }
}
