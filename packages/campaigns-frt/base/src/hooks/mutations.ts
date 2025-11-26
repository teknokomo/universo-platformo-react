/**
 * Campaign mutations hooks
 *
 * This file contains all mutation hooks for the campaigns module.
 * Uses @tanstack/react-query useMutation for proper cache management and loading states.
 *
 * Following the colocation principle - mutations are kept close to their feature.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'

import * as campaignsApi from '../api/campaigns'
import * as eventsApi from '../api/events'
import * as activitiesApi from '../api/activities'
import { campaignsQueryKeys, eventsQueryKeys, activitiesQueryKeys } from '../api/queryKeys'
import type { CampaignAssignableRole } from '../types'

// ============================================================================
// Types
// ============================================================================

interface UpdateCampaignParams {
    id: string
    data: { name: string; description?: string }
}

interface UpdateEventParams {
    id: string
    data: { name: string; description?: string }
}

interface CreateEventParams {
    name: string
    description?: string
    campaignId: string
}

interface UpdateActivityParams {
    id: string
    data: { name: string; description?: string }
}

interface CreateActivityParams {
    name: string
    description?: string
    campaignId?: string
    eventId: string
}

interface UpdateMemberRoleParams {
    campaignId: string
    memberId: string
    data: { role: CampaignAssignableRole; comment?: string }
}

interface RemoveMemberParams {
    campaignId: string
    memberId: string
}

interface InviteMemberParams {
    campaignId: string
    data: { email: string; role: CampaignAssignableRole; comment?: string }
}

// ============================================================================
// Campaign Mutations
// ============================================================================

/**
 * Hook for creating a campaign
 */
export function useCreateCampaign() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('campaigns')

    return useMutation({
        mutationFn: async (data: { name: string; description?: string }) => {
            const response = await campaignsApi.createCampaign(data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: campaignsQueryKeys.lists() })
            enqueueSnackbar(t('createSuccess', 'Campaign created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('createError', 'Failed to create campaign'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating a campaign
 */
export function useUpdateCampaign() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('campaigns')

    return useMutation({
        mutationFn: async ({ id, data }: UpdateCampaignParams) => {
            const response = await campaignsApi.updateCampaign(id, data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: campaignsQueryKeys.lists() })
            enqueueSnackbar(t('updateSuccess', 'Campaign updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('updateError', 'Failed to update campaign'), { variant: 'error' })
        }
    })
}

/**
 * Hook for deleting a campaign
 */
export function useDeleteCampaign() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('campaigns')

    return useMutation({
        mutationFn: async (id: string) => {
            await campaignsApi.deleteCampaign(id)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: campaignsQueryKeys.lists() })
            enqueueSnackbar(t('deleteSuccess', 'Campaign deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('deleteError', 'Failed to delete campaign'), { variant: 'error' })
        }
    })
}

// ============================================================================
// Event Mutations
// ============================================================================

/**
 * Hook for creating an event
 */
export function useCreateEvent() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('campaigns')

    return useMutation({
        mutationFn: async (data: CreateEventParams) => {
            const response = await eventsApi.createEvent(data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: eventsQueryKeys.lists() })
            enqueueSnackbar(t('events.createSuccess', 'Event created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('events.createError', 'Failed to create event'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating an event
 */
export function useUpdateEvent() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('campaigns')

    return useMutation({
        mutationFn: async ({ id, data }: UpdateEventParams) => {
            const response = await eventsApi.updateEvent(id, data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: eventsQueryKeys.lists() })
            enqueueSnackbar(t('events.updateSuccess', 'Event updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('events.updateError', 'Failed to update event'), { variant: 'error' })
        }
    })
}

/**
 * Hook for deleting an event
 */
export function useDeleteEvent() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('campaigns')

    return useMutation({
        mutationFn: async (id: string) => {
            await eventsApi.deleteEvent(id)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: eventsQueryKeys.lists() })
            enqueueSnackbar(t('events.deleteSuccess', 'Event deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('events.deleteError', 'Failed to delete event'), { variant: 'error' })
        }
    })
}

// ============================================================================
// Activity Mutations
// ============================================================================

/**
 * Hook for creating an activity
 */
export function useCreateActivity() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('campaigns')

    return useMutation({
        mutationFn: async (data: CreateActivityParams) => {
            const response = await activitiesApi.createActivity(data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: activitiesQueryKeys.lists() })
            enqueueSnackbar(t('activities.createSuccess', 'Activity created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('activities.createError', 'Failed to create activity'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating an activity
 */
export function useUpdateActivity() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('campaigns')

    return useMutation({
        mutationFn: async ({ id, data }: UpdateActivityParams) => {
            const response = await activitiesApi.updateActivity(id, data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: activitiesQueryKeys.lists() })
            enqueueSnackbar(t('activities.updateSuccess', 'Activity updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('activities.updateError', 'Failed to update activity'), { variant: 'error' })
        }
    })
}

/**
 * Hook for deleting an activity
 */
export function useDeleteActivity() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('campaigns')

    return useMutation({
        mutationFn: async (id: string) => {
            await activitiesApi.deleteActivity(id)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: activitiesQueryKeys.lists() })
            enqueueSnackbar(t('activities.deleteSuccess', 'Activity deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('activities.deleteError', 'Failed to delete activity'), { variant: 'error' })
        }
    })
}

// ============================================================================
// Member Mutations
// ============================================================================

/**
 * Hook for inviting a new campaign member
 */
export function useInviteMember() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useCommonTranslations()

    return useMutation({
        mutationFn: async ({ campaignId, data }: InviteMemberParams) => {
            const response = await campaignsApi.inviteCampaignMember(campaignId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: campaignsQueryKeys.members(variables.campaignId) })
            enqueueSnackbar(t('members.inviteSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('members.inviteError'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating a campaign member's role
 */
export function useUpdateMemberRole() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useCommonTranslations()

    return useMutation({
        mutationFn: async ({ campaignId, memberId, data }: UpdateMemberRoleParams) => {
            const response = await campaignsApi.updateCampaignMemberRole(campaignId, memberId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: campaignsQueryKeys.members(variables.campaignId) })
            enqueueSnackbar(t('members.updateSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('members.updateError'), { variant: 'error' })
        }
    })
}

/**
 * Hook for removing a campaign member
 */
export function useRemoveMember() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useCommonTranslations()

    return useMutation({
        mutationFn: async ({ campaignId, memberId }: RemoveMemberParams) => {
            await campaignsApi.removeCampaignMember(campaignId, memberId)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: campaignsQueryKeys.members(variables.campaignId) })
            enqueueSnackbar(t('members.removeSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('members.removeError'), { variant: 'error' })
        }
    })
}

/**
 * Combined hook for campaign member mutations
 * Provides a unified interface for member operations within a specific campaign
 */
export function useMemberMutations(campaignId: string) {
    const inviteMutation = useInviteMember()
    const updateMutation = useUpdateMemberRole()
    const removeMutation = useRemoveMember()

    return {
        // Invite
        inviteMember: async (data: { email: string; role: CampaignAssignableRole; comment?: string }) => {
            return inviteMutation.mutateAsync({ campaignId, data })
        },
        isInviting: inviteMutation.isPending,
        inviteError: inviteMutation.error,

        // Update role
        updateMemberRole: async (memberId: string, data: { role: CampaignAssignableRole; comment?: string }) => {
            return updateMutation.mutateAsync({ campaignId, memberId, data })
        },
        isUpdating: updateMutation.isPending,
        updateError: updateMutation.error,

        // Remove
        removeMember: async (memberId: string) => {
            return removeMutation.mutateAsync({ campaignId, memberId })
        },
        isRemoving: removeMutation.isPending,
        removeError: removeMutation.error,

        // Combined state
        isPending: inviteMutation.isPending || updateMutation.isPending || removeMutation.isPending
    }
}
