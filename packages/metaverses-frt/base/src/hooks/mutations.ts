/**
 * Metaverse mutations hooks
 *
 * This file contains all mutation hooks for the metaverses module.
 * Uses @tanstack/react-query useMutation for proper cache management and loading states.
 *
 * Following the colocation principle - mutations are kept close to their feature.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import type { AssignableRole } from '@universo/template-mui'

import * as metaversesApi from '../api/metaverses'
import * as sectionsApi from '../api/sections'
import * as entitiesApi from '../api/entities'
import { metaversesQueryKeys, sectionsQueryKeys, entitiesQueryKeys } from '../api/queryKeys'

// ============================================================================
// Types
// ============================================================================

interface UpdateMetaverseParams {
    id: string
    data: { name: string; description?: string }
}

interface UpdateSectionParams {
    id: string
    data: { name: string; description?: string }
}

interface CreateSectionParams {
    name: string
    description?: string
    metaverseId: string
}

interface UpdateEntityParams {
    id: string
    data: { name: string; description?: string }
}

interface CreateEntityParams {
    name: string
    description?: string
    sectionId: string
}

interface UpdateMemberRoleParams {
    metaverseId: string
    memberId: string
    data: { role: AssignableRole; comment?: string }
}

interface RemoveMemberParams {
    metaverseId: string
    memberId: string
}

interface InviteMemberParams {
    metaverseId: string
    data: { email: string; role: AssignableRole; comment?: string }
}

// ============================================================================
// Metaverse Mutations
// ============================================================================

/**
 * Hook for creating a metaverse
 */
export function useCreateMetaverse() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metaverses')

    return useMutation({
        mutationFn: async (data: { name: string; description?: string }) => {
            const response = await metaversesApi.createMetaverse(data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: metaversesQueryKeys.lists() })
            enqueueSnackbar(t('createSuccess', 'Metaverse created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('createError', 'Failed to create metaverse'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating a metaverse
 */
export function useUpdateMetaverse() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metaverses')

    return useMutation({
        mutationFn: async ({ id, data }: UpdateMetaverseParams) => {
            const response = await metaversesApi.updateMetaverse(id, data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: metaversesQueryKeys.lists() })
            enqueueSnackbar(t('updateSuccess', 'Metaverse updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('updateError', 'Failed to update metaverse'), { variant: 'error' })
        }
    })
}

/**
 * Hook for deleting a metaverse
 */
export function useDeleteMetaverse() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metaverses')

    return useMutation({
        mutationFn: async (id: string) => {
            await metaversesApi.deleteMetaverse(id)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: metaversesQueryKeys.lists() })
            enqueueSnackbar(t('deleteSuccess', 'Metaverse deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('deleteError', 'Failed to delete metaverse'), { variant: 'error' })
        }
    })
}

// ============================================================================
// Section Mutations
// ============================================================================

/**
 * Hook for creating a section
 */
export function useCreateSection() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metaverses')

    return useMutation({
        mutationFn: async (data: CreateSectionParams) => {
            const response = await sectionsApi.createSection(data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: sectionsQueryKeys.lists() })
            enqueueSnackbar(t('sections.createSuccess', 'Section created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('sections.saveError', 'Failed to create section'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating a section
 */
export function useUpdateSection() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metaverses')

    return useMutation({
        mutationFn: async ({ id, data }: UpdateSectionParams) => {
            const response = await sectionsApi.updateSection(id, data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: sectionsQueryKeys.lists() })
            enqueueSnackbar(t('sections.updateSuccess', 'Section updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('sections.updateError', 'Failed to update section'), { variant: 'error' })
        }
    })
}

/**
 * Hook for deleting a section
 */
export function useDeleteSection() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metaverses')

    return useMutation({
        mutationFn: async (id: string) => {
            await sectionsApi.deleteSection(id)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: sectionsQueryKeys.lists() })
            enqueueSnackbar(t('sections.deleteSuccess', 'Section deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('sections.deleteError', 'Failed to delete section'), { variant: 'error' })
        }
    })
}

// ============================================================================
// Entity Mutations
// ============================================================================

/**
 * Hook for creating an entity
 */
export function useCreateEntity() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metaverses')

    return useMutation({
        mutationFn: async (data: CreateEntityParams) => {
            const response = await entitiesApi.createEntity(data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: entitiesQueryKeys.lists() })
            enqueueSnackbar(t('entities.createSuccess', 'Entity created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('entities.saveError', 'Failed to create entity'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating an entity
 */
export function useUpdateEntity() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metaverses')

    return useMutation({
        mutationFn: async ({ id, data }: UpdateEntityParams) => {
            const response = await entitiesApi.updateEntity(id, data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: entitiesQueryKeys.lists() })
            enqueueSnackbar(t('entities.updateSuccess', 'Entity updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('entities.updateError', 'Failed to update entity'), { variant: 'error' })
        }
    })
}

/**
 * Hook for deleting an entity
 */
export function useDeleteEntity() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metaverses')

    return useMutation({
        mutationFn: async (id: string) => {
            await entitiesApi.deleteEntity(id)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: entitiesQueryKeys.lists() })
            enqueueSnackbar(t('entities.deleteSuccess', 'Entity deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('entities.deleteError', 'Failed to delete entity'), { variant: 'error' })
        }
    })
}

// ============================================================================
// Member Mutations
// ============================================================================

/**
 * Hook for inviting a new metaverse member
 */
export function useInviteMember() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useCommonTranslations()

    return useMutation({
        mutationFn: async ({ metaverseId, data }: InviteMemberParams) => {
            const response = await metaversesApi.inviteMetaverseMember(metaverseId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metaversesQueryKeys.members(variables.metaverseId) })
            enqueueSnackbar(t('members.inviteSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('members.inviteError'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating a metaverse member's role
 */
export function useUpdateMemberRole() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useCommonTranslations()

    return useMutation({
        mutationFn: async ({ metaverseId, memberId, data }: UpdateMemberRoleParams) => {
            const response = await metaversesApi.updateMetaverseMemberRole(metaverseId, memberId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metaversesQueryKeys.members(variables.metaverseId) })
            enqueueSnackbar(t('members.updateSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('members.updateError'), { variant: 'error' })
        }
    })
}

/**
 * Hook for removing a metaverse member
 */
export function useRemoveMember() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useCommonTranslations()

    return useMutation({
        mutationFn: async ({ metaverseId, memberId }: RemoveMemberParams) => {
            await metaversesApi.removeMetaverseMember(metaverseId, memberId)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metaversesQueryKeys.members(variables.metaverseId) })
            enqueueSnackbar(t('members.removeSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('members.removeError'), { variant: 'error' })
        }
    })
}

/**
 * Combined hook for metaverse member mutations
 * Provides a unified interface for member operations within a specific metaverse
 */
export function useMemberMutations(metaverseId: string) {
    const inviteMutation = useInviteMember()
    const updateMutation = useUpdateMemberRole()
    const removeMutation = useRemoveMember()

    return {
        // Invite
        inviteMember: async (data: { email: string; role: AssignableRole; comment?: string }) => {
            return inviteMutation.mutateAsync({ metaverseId, data })
        },
        isInviting: inviteMutation.isPending,
        inviteError: inviteMutation.error,

        // Update role
        updateMemberRole: async (memberId: string, data: { role: AssignableRole; comment?: string }) => {
            return updateMutation.mutateAsync({ metaverseId, memberId, data })
        },
        isUpdating: updateMutation.isPending,
        updateError: updateMutation.error,

        // Remove
        removeMember: async (memberId: string) => {
            return removeMutation.mutateAsync({ metaverseId, memberId })
        },
        isRemoving: removeMutation.isPending,
        removeError: removeMutation.error,

        // Combined state
        isPending: inviteMutation.isPending || updateMutation.isPending || removeMutation.isPending
    }
}
