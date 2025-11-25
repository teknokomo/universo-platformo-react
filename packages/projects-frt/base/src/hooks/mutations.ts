/**
 * Project mutations hooks
 *
 * This file contains all mutation hooks for the projects module.
 * Uses @tanstack/react-query useMutation for proper cache management and loading states.
 *
 * Following the colocation principle - mutations are kept close to their feature.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import type { AssignableRole } from '@universo/template-mui'

import * as ProjectsApi from '../api/projects'
import * as MilestonesApi from '../api/milestones'
import * as TasksApi from '../api/tasks'
import { ProjectsQueryKeys, MilestonesQueryKeys, TasksQueryKeys } from '../api/queryKeys'

// ============================================================================
// Types
// ============================================================================

interface UpdateProjectParams {
    id: string
    data: { name: string; description?: string }
}

interface UpdateMilestoneParams {
    id: string
    data: { name: string; description?: string }
}

interface CreateMilestoneParams {
    name: string
    description?: string
    projectId: string
}

interface UpdateTaskParams {
    id: string
    data: { name: string; description?: string }
}

interface CreateTaskParams {
    name: string
    description?: string
    milestoneId: string
}

interface UpdateMemberRoleParams {
    projectId: string
    memberId: string
    data: { role: AssignableRole; comment?: string }
}

interface RemoveMemberParams {
    projectId: string
    memberId: string
}

interface InviteMemberParams {
    projectId: string
    data: { email: string; role: AssignableRole; comment?: string }
}

// ============================================================================
// Project Mutations
// ============================================================================

/**
 * Hook for creating a project
 */
export function useCreateProject() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('projects')

    return useMutation({
        mutationFn: async (data: { name: string; description?: string }) => {
            const response = await ProjectsApi.createProject(data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ProjectsQueryKeys.lists() })
            enqueueSnackbar(t('createSuccess', 'Project created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('createError', 'Failed to create project'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating a project
 */
export function useUpdateProject() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('projects')

    return useMutation({
        mutationFn: async ({ id, data }: UpdateProjectParams) => {
            const response = await ProjectsApi.updateProject(id, data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ProjectsQueryKeys.lists() })
            enqueueSnackbar(t('updateSuccess', 'Project updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('updateError', 'Failed to update project'), { variant: 'error' })
        }
    })
}

/**
 * Hook for deleting a project
 */
export function useDeleteProject() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('projects')

    return useMutation({
        mutationFn: async (id: string) => {
            await ProjectsApi.deleteProject(id)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ProjectsQueryKeys.lists() })
            enqueueSnackbar(t('deleteSuccess', 'Project deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('deleteError', 'Failed to delete project'), { variant: 'error' })
        }
    })
}

// ============================================================================
// Milestone Mutations
// ============================================================================

/**
 * Hook for creating a milestone
 */
export function useCreateMilestone() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('projects')

    return useMutation({
        mutationFn: async (data: CreateMilestoneParams) => {
            const response = await MilestonesApi.createMilestone(data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: MilestonesQueryKeys.lists() })
            enqueueSnackbar(t('milestones.createSuccess', 'Milestone created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('milestones.saveError', 'Failed to create milestone'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating a milestone
 */
export function useUpdateMilestone() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('projects')

    return useMutation({
        mutationFn: async ({ id, data }: UpdateMilestoneParams) => {
            const response = await MilestonesApi.updateMilestone(id, data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: MilestonesQueryKeys.lists() })
            enqueueSnackbar(t('milestones.updateSuccess', 'Milestone updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('milestones.updateError', 'Failed to update milestone'), { variant: 'error' })
        }
    })
}

/**
 * Hook for deleting a milestone
 */
export function useDeleteMilestone() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('projects')

    return useMutation({
        mutationFn: async (id: string) => {
            await MilestonesApi.deleteMilestone(id)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: MilestonesQueryKeys.lists() })
            enqueueSnackbar(t('milestones.deleteSuccess', 'Milestone deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('milestones.deleteError', 'Failed to delete milestone'), { variant: 'error' })
        }
    })
}

// ============================================================================
// Task Mutations
// ============================================================================

/**
 * Hook for creating a task
 */
export function useCreateTask() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('projects')

    return useMutation({
        mutationFn: async (data: CreateTaskParams) => {
            const response = await TasksApi.createTask(data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: TasksQueryKeys.lists() })
            enqueueSnackbar(t('tasks.createSuccess', 'Task created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('tasks.saveError', 'Failed to create task'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating a task
 */
export function useUpdateTask() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('projects')

    return useMutation({
        mutationFn: async ({ id, data }: UpdateTaskParams) => {
            const response = await TasksApi.updateTask(id, data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: TasksQueryKeys.lists() })
            enqueueSnackbar(t('tasks.updateSuccess', 'Task updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('tasks.updateError', 'Failed to update task'), { variant: 'error' })
        }
    })
}

/**
 * Hook for deleting a task
 */
export function useDeleteTask() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('projects')

    return useMutation({
        mutationFn: async (id: string) => {
            await TasksApi.deleteTask(id)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: TasksQueryKeys.lists() })
            enqueueSnackbar(t('tasks.deleteSuccess', 'Task deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('tasks.deleteError', 'Failed to delete task'), { variant: 'error' })
        }
    })
}

// ============================================================================
// Member Mutations
// ============================================================================

/**
 * Hook for inviting a new project member
 */
export function useInviteMember() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useCommonTranslations()

    return useMutation({
        mutationFn: async ({ projectId, data }: InviteMemberParams) => {
            const response = await ProjectsApi.inviteProjectMember(projectId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ProjectsQueryKeys.members(variables.projectId) })
            enqueueSnackbar(t('members.inviteSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('members.inviteError'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating a project member's role
 */
export function useUpdateMemberRole() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useCommonTranslations()

    return useMutation({
        mutationFn: async ({ projectId, memberId, data }: UpdateMemberRoleParams) => {
            const response = await ProjectsApi.updateProjectMemberRole(projectId, memberId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ProjectsQueryKeys.members(variables.projectId) })
            enqueueSnackbar(t('members.updateSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('members.updateError'), { variant: 'error' })
        }
    })
}

/**
 * Hook for removing a project member
 */
export function useRemoveMember() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useCommonTranslations()

    return useMutation({
        mutationFn: async ({ projectId, memberId }: RemoveMemberParams) => {
            await ProjectsApi.removeProjectMember(projectId, memberId)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ProjectsQueryKeys.members(variables.projectId) })
            enqueueSnackbar(t('members.removeSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('members.removeError'), { variant: 'error' })
        }
    })
}

/**
 * Combined hook for project member mutations
 * Provides a unified interface for member operations within a specific project
 */
export function useMemberMutations(projectId: string) {
    const inviteMutation = useInviteMember()
    const updateMutation = useUpdateMemberRole()
    const removeMutation = useRemoveMember()

    return {
        // Invite
        inviteMember: async (data: { email: string; role: AssignableRole; comment?: string }) => {
            return inviteMutation.mutateAsync({ projectId, data })
        },
        isInviting: inviteMutation.isPending,
        inviteError: inviteMutation.error,

        // Update role
        updateMemberRole: async (memberId: string, data: { role: AssignableRole; comment?: string }) => {
            return updateMutation.mutateAsync({ projectId, memberId, data })
        },
        isUpdating: updateMutation.isPending,
        updateError: updateMutation.error,

        // Remove
        removeMember: async (memberId: string) => {
            return removeMutation.mutateAsync({ projectId, memberId })
        },
        isRemoving: removeMutation.isPending,
        removeError: removeMutation.error,

        // Combined state
        isPending: inviteMutation.isPending || updateMutation.isPending || removeMutation.isPending
    }
}
