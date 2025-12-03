/**
 * Cluster mutations hooks
 *
 * This file contains all mutation hooks for the clusters module.
 * Uses @tanstack/react-query useMutation for proper cache management and loading states.
 *
 * Following the colocation principle - mutations are kept close to their feature.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import type { AssignableRole } from '@universo/template-mui'

import * as clustersApi from '../api/clusters'
import * as domainsApi from '../api/domains'
import * as resourcesApi from '../api/resources'
import { clustersQueryKeys, domainsQueryKeys, resourcesQueryKeys } from '../api/queryKeys'

// ============================================================================
// Types
// ============================================================================

interface UpdateClusterParams {
    id: string
    data: { name: string; description?: string }
}

interface UpdateDomainParams {
    id: string
    data: { name: string; description?: string }
}

interface CreateDomainParams {
    name: string
    description?: string
    clusterId: string
}

interface UpdateResourceParams {
    id: string
    data: { name: string; description?: string }
}

interface CreateResourceParams {
    name: string
    description?: string
    domainId: string
}

interface UpdateMemberRoleParams {
    clusterId: string
    memberId: string
    data: { role: AssignableRole; comment?: string }
}

interface RemoveMemberParams {
    clusterId: string
    memberId: string
}

interface InviteMemberParams {
    clusterId: string
    data: { email: string; role: AssignableRole; comment?: string }
}

// ============================================================================
// Cluster Mutations
// ============================================================================

/**
 * Hook for creating a cluster
 */
export function useCreateCluster() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('clusters')

    return useMutation({
        mutationFn: async (data: { name: string; description?: string }) => {
            const response = await clustersApi.createCluster(data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: clustersQueryKeys.lists() })
            enqueueSnackbar(t('createSuccess', 'Cluster created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('createError', 'Failed to create cluster'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating a cluster
 */
export function useUpdateCluster() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('clusters')

    return useMutation({
        mutationFn: async ({ id, data }: UpdateClusterParams) => {
            const response = await clustersApi.updateCluster(id, data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: clustersQueryKeys.lists() })
            enqueueSnackbar(t('updateSuccess', 'Cluster updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('updateError', 'Failed to update cluster'), { variant: 'error' })
        }
    })
}

/**
 * Hook for deleting a cluster
 */
export function useDeleteCluster() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('clusters')

    return useMutation({
        mutationFn: async (id: string) => {
            await clustersApi.deleteCluster(id)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: clustersQueryKeys.lists() })
            enqueueSnackbar(t('deleteSuccess', 'Cluster deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('deleteError', 'Failed to delete cluster'), { variant: 'error' })
        }
    })
}

// ============================================================================
// Domain Mutations
// ============================================================================

/**
 * Hook for creating a domain
 */
export function useCreateDomain() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('clusters')

    return useMutation({
        mutationFn: async (data: CreateDomainParams) => {
            const response = await domainsApi.createDomain(data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: domainsQueryKeys.lists() })
            enqueueSnackbar(t('domains.createSuccess', 'Domain created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('domains.saveError', 'Failed to create domain'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating a domain
 */
export function useUpdateDomain() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('clusters')

    return useMutation({
        mutationFn: async ({ id, data }: UpdateDomainParams) => {
            const response = await domainsApi.updateDomain(id, data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: domainsQueryKeys.lists() })
            enqueueSnackbar(t('domains.updateSuccess', 'Domain updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('domains.updateError', 'Failed to update domain'), { variant: 'error' })
        }
    })
}

/**
 * Hook for deleting a domain
 */
export function useDeleteDomain() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('clusters')

    return useMutation({
        mutationFn: async (id: string) => {
            await domainsApi.deleteDomain(id)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: domainsQueryKeys.lists() })
            enqueueSnackbar(t('domains.deleteSuccess', 'Domain deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('domains.deleteError', 'Failed to delete domain'), { variant: 'error' })
        }
    })
}

// ============================================================================
// Resource Mutations
// ============================================================================

/**
 * Hook for creating a resource
 */
export function useCreateResource() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('clusters')

    return useMutation({
        mutationFn: async (data: CreateResourceParams) => {
            const response = await resourcesApi.createResource(data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.lists() })
            enqueueSnackbar(t('resources.createSuccess', 'Resource created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('resources.saveError', 'Failed to create resource'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating a resource
 */
export function useUpdateResource() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('clusters')

    return useMutation({
        mutationFn: async ({ id, data }: UpdateResourceParams) => {
            const response = await resourcesApi.updateResource(id, data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.lists() })
            enqueueSnackbar(t('resources.updateSuccess', 'Resource updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('resources.updateError', 'Failed to update resource'), { variant: 'error' })
        }
    })
}

/**
 * Hook for deleting a resource
 */
export function useDeleteResource() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('clusters')

    return useMutation({
        mutationFn: async (id: string) => {
            await resourcesApi.deleteResource(id)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.lists() })
            enqueueSnackbar(t('resources.deleteSuccess', 'Resource deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('resources.deleteError', 'Failed to delete resource'), { variant: 'error' })
        }
    })
}

// ============================================================================
// Member Mutations
// ============================================================================

/**
 * Hook for inviting a new cluster member
 */
export function useInviteMember() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useCommonTranslations()

    return useMutation({
        mutationFn: async ({ clusterId, data }: InviteMemberParams) => {
            const response = await clustersApi.inviteClusterMember(clusterId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: clustersQueryKeys.members(variables.clusterId) })
            enqueueSnackbar(t('members.inviteSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('members.inviteError'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating a cluster member's role
 */
export function useUpdateMemberRole() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useCommonTranslations()

    return useMutation({
        mutationFn: async ({ clusterId, memberId, data }: UpdateMemberRoleParams) => {
            const response = await clustersApi.updateClusterMemberRole(clusterId, memberId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: clustersQueryKeys.members(variables.clusterId) })
            enqueueSnackbar(t('members.updateSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('members.updateError'), { variant: 'error' })
        }
    })
}

/**
 * Hook for removing a cluster member
 */
export function useRemoveMember() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useCommonTranslations()

    return useMutation({
        mutationFn: async ({ clusterId, memberId }: RemoveMemberParams) => {
            await clustersApi.removeClusterMember(clusterId, memberId)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: clustersQueryKeys.members(variables.clusterId) })
            enqueueSnackbar(t('members.removeSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('members.removeError'), { variant: 'error' })
        }
    })
}

/**
 * Combined hook for cluster member mutations
 * Provides a unified interface for member operations within a specific cluster
 */
export function useMemberMutations(clusterId: string) {
    const inviteMutation = useInviteMember()
    const updateMutation = useUpdateMemberRole()
    const removeMutation = useRemoveMember()

    return {
        // Invite
        inviteMember: async (data: { email: string; role: AssignableRole; comment?: string }) => {
            return inviteMutation.mutateAsync({ clusterId, data })
        },
        isInviting: inviteMutation.isPending,
        inviteError: inviteMutation.error,

        // Update role
        updateMemberRole: async (memberId: string, data: { role: AssignableRole; comment?: string }) => {
            return updateMutation.mutateAsync({ clusterId, memberId, data })
        },
        isUpdating: updateMutation.isPending,
        updateError: updateMutation.error,

        // Remove
        removeMember: async (memberId: string) => {
            return removeMutation.mutateAsync({ clusterId, memberId })
        },
        isRemoving: removeMutation.isPending,
        removeError: removeMutation.error,

        // Combined state
        isPending: inviteMutation.isPending || updateMutation.isPending || removeMutation.isPending
    }
}
