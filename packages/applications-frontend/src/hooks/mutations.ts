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
import {
    applyOptimisticCreate,
    applyOptimisticUpdate,
    applyOptimisticDelete,
    rollbackOptimisticSnapshots,
    generateOptimisticId,
    getNextOptimisticSortOrderFromQueries,
    safeInvalidateQueries,
    safeInvalidateQueriesInactive,
    confirmOptimisticUpdate,
    confirmOptimisticCreate,
    makePendingMarkers
} from '@universo/template-mui'
import {
    normalizeApplicationCopyOptions,
    getVLCString,
    extractAxiosError,
    isApiError,
    isHttpStatus,
    isOptimisticLockConflict
} from '@universo/utils'
import type { Application, ApplicationMember, Connector, ConnectorLocalizedPayload, SimpleLocalizedInput } from '../types'
import { normalizeLocale } from '../utils/localizedInput'
import * as applicationsApi from '../api/applications'
import * as connectorsApi from '../api/connectors'
import { applicationsQueryKeys } from '../api/queryKeys'
import type {
    UpdateApplicationParams,
    CopyApplicationParams,
    JoinApplicationParams,
    LeaveApplicationParams,
    UpdateMemberRoleParams,
    RemoveMemberParams,
    InviteMemberParams,
    CreateConnectorParams,
    UpdateConnectorParams,
    DeleteConnectorParams,
    SyncConnectorParams
} from './mutationTypes'
import { CopySyncStepError } from './mutationTypes'

// ============================================================================
// Helpers
// ============================================================================

const toOptimisticRecord = <T extends { id: string }>(entity: T): T & Record<string, unknown> => entity as T & Record<string, unknown>

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
        mutationKey: ['applications', 'create'],
        mutationFn: async (data: applicationsApi.ApplicationCreateInput) => {
            const response = await applicationsApi.createApplication(data)
            return response.data
        },
        onMutate: async (data) => {
            const locale = normalizeLocale(i18n.language)
            const optimisticId = generateOptimisticId()
            const displayName = getVLCString(data.name, locale)

            const context = await applyOptimisticCreate({
                queryClient,
                queryKeyPrefix: applicationsQueryKeys.lists(),
                optimisticEntity: toOptimisticRecord({
                    id: optimisticId,
                    name: data.name,
                    description: data.description,
                    displayName: displayName || '',
                    isPublic: data.isPublic === true,
                    workspacesEnabled: false,
                    role: 'owner',
                    accessType: 'member',
                    connectorsCount: 0,
                    ...makePendingMarkers('create')
                })
            })

            return context
        },
        onError: (error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('createError', 'Failed to create application'), { variant: 'error' })
        },
        onSuccess: (data, _variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(queryClient, applicationsQueryKeys.lists(), context.optimisticId, data.id, {
                    serverEntity: toOptimisticRecord(data as Application)
                })
            }
            enqueueSnackbar(t('createSuccess', 'Application created'), { variant: 'success' })
        },
        onSettled: () => {
            safeInvalidateQueriesInactive(queryClient, ['applications'], applicationsQueryKeys.lists())
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
        mutationKey: ['applications', 'update'],
        mutationFn: async ({ id, data }: UpdateApplicationParams) => {
            const response = await applicationsApi.updateApplication(id, data)
            return response.data
        },
        onMutate: async ({ id, data }) => {
            const locale = normalizeLocale(i18n.language)
            const displayName = getVLCString(data.name, locale)

            const context = await applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: applicationsQueryKeys.lists(),
                entityId: id,
                updater: {
                    name: data.name,
                    description: data.description,
                    ...(displayName ? { displayName } : {})
                },
                detailQueryKey: applicationsQueryKeys.detail(id)
            })

            return context
        },
        onError: (error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            if (isOptimisticLockConflict(error)) {
                return
            }
            enqueueSnackbar(error.message || t('updateError', 'Failed to update application'), { variant: 'error' })
        },
        onSuccess: async (data, variables) => {
            await queryClient.cancelQueries({ queryKey: applicationsQueryKeys.lists() })
            confirmOptimisticUpdate(queryClient, applicationsQueryKeys.lists(), variables.id, {
                serverEntity: data ? toOptimisticRecord(data as Application) : null
            })
            if (data) {
                queryClient.setQueryData(applicationsQueryKeys.detail(variables.id), data)
            }
            enqueueSnackbar(t('updateSuccess', 'Application updated'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(
                queryClient,
                ['applications'],
                applicationsQueryKeys.lists(),
                applicationsQueryKeys.detail(variables.id)
            )
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
        mutationKey: ['applications', 'delete'],
        mutationFn: async (id: string) => {
            await applicationsApi.deleteApplication(id)
        },
        onMutate: async (id) => {
            const context = await applyOptimisticDelete({
                queryClient,
                queryKeyPrefix: applicationsQueryKeys.lists(),
                entityId: id,
                strategy: 'remove'
            })
            return context
        },
        onError: (error, _id, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('deleteError', 'Failed to delete application'), { variant: 'error' })
        },
        onSuccess: () => {
            enqueueSnackbar(t('deleteSuccess', 'Application deleted'), { variant: 'success' })
        },
        onSettled: () => {
            safeInvalidateQueries(queryClient, ['applications'], applicationsQueryKeys.lists())
        }
    })
}

/**
 * Hook for copying an application
 */
export function useCopyApplication() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t, i18n } = useTranslation('applications')

    return useMutation({
        mutationKey: ['applications', 'copy'],
        mutationFn: async ({ id, data }: CopyApplicationParams) => {
            const copyOptions = normalizeApplicationCopyOptions(data ?? {})
            const response = await applicationsApi.copyApplication(id, {
                ...(data ?? {}),
                ...copyOptions
            })
            const copiedApplication = response.data

            if (copyOptions.createSchema) {
                try {
                    await connectorsApi.syncApplication(copiedApplication.id, false)
                } catch (error: unknown) {
                    throw new CopySyncStepError(copiedApplication.id, error)
                }
            }

            return copiedApplication
        },
        onMutate: async ({ id, data }) => {
            const optimisticId = generateOptimisticId()
            const locale = normalizeLocale(i18n.language)
            const queryKeyPrefix = applicationsQueryKeys.lists()

            // Clone source entity from cache for realistic optimistic display
            const existingApp = queryClient
                .getQueriesData<{ items?: Array<Record<string, unknown>> }>({ queryKey: queryKeyPrefix })
                .flatMap(([, value]) => (Array.isArray(value?.items) ? value.items : []))
                .find((item) => item.id === id)

            const context = await applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity: {
                    ...(existingApp ?? {}),
                    id: optimisticId,
                    name: existingApp?.name ?? { [locale]: t('copyInProgress', 'Copying…') },
                    description: existingApp?.description,
                    displayName: typeof existingApp?.displayName === 'string' ? existingApp.displayName : '',
                    isPublic: data?.isPublic ?? existingApp?.isPublic ?? false,
                    workspacesEnabled: existingApp?.workspacesEnabled ?? false,
                    role: 'owner',
                    accessType: 'member',
                    connectorsCount: 0,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    ...makePendingMarkers('copy')
                }
            })

            return context
        },
        onError: (error, _variables, context) => {
            if (error instanceof CopySyncStepError) {
                // Copy succeeded but sync failed — do NOT rollback the copy itself
                queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.lists() })
                queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.detail(error.copiedApplicationId) })
                enqueueSnackbar(
                    t(
                        'copy.syncFailed',
                        'Application was copied, but schema creation failed. You can retry schema sync from the application panel.'
                    ),
                    { variant: 'warning' }
                )
                return
            }
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('copyError', 'Failed to copy application'), { variant: 'error' })
        },
        onSuccess: (data, _variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(queryClient, applicationsQueryKeys.lists(), context.optimisticId, data.id, {
                    serverEntity: toOptimisticRecord(data as Application)
                })
            }
            enqueueSnackbar(t('copySuccess', 'Application copied'), { variant: 'success' })
        },
        onSettled: () => {
            safeInvalidateQueriesInactive(queryClient, ['applications'], applicationsQueryKeys.lists())
        }
    })
}

export function useJoinApplication() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('applications')

    return useMutation({
        mutationKey: ['applications', 'join'],
        mutationFn: async ({ id }: JoinApplicationParams) => {
            const response = await applicationsApi.joinApplication(id)
            return response.data
        },
        onSuccess: async (_data, variables) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.lists() }),
                queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.detail(variables.id) })
            ])
            enqueueSnackbar(t('join.success', 'You joined the application'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('join.error', 'Failed to join the application'), { variant: 'error' })
        }
    })
}

export function useLeaveApplication() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('applications')

    return useMutation({
        mutationKey: ['applications', 'leave'],
        mutationFn: async ({ id }: LeaveApplicationParams) => {
            const response = await applicationsApi.leaveApplication(id)
            return response.data
        },
        onSuccess: async (_data, variables) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.lists() }),
                queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.detail(variables.id) }),
                queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.runtimeAll(variables.id) })
            ])
            enqueueSnackbar(t('leave.success', 'You left the application'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('leave.error', 'Failed to leave the application'), { variant: 'error' })
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
        mutationKey: ['applicationMembers', 'invite'],
        mutationFn: async ({ applicationId, data }: InviteMemberParams) => {
            const response = await applicationsApi.inviteApplicationMember(applicationId, data)
            return response.data
        },
        onMutate: async ({ applicationId, data }) => {
            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix: applicationsQueryKeys.members(applicationId),
                optimisticEntity: toOptimisticRecord({
                    id: generateOptimisticId(),
                    userId: generateOptimisticId(),
                    email: data.email,
                    nickname: null,
                    role: data.role,
                    comment: undefined,
                    commentVlc: data.comment ?? null,
                    createdAt: new Date().toISOString(),
                    ...makePendingMarkers('create')
                }),
                insertPosition: 'prepend'
            })
        },
        onSuccess: (data, variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(
                    queryClient,
                    applicationsQueryKeys.members(variables.applicationId),
                    context.optimisticId,
                    data.id,
                    {
                        serverEntity: toOptimisticRecord(data as ApplicationMember)
                    }
                )
            }
            enqueueSnackbar(t('members.inviteSuccess'), { variant: 'success' })
        },
        onError: (error: Error, variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            let message = t('members.inviteError')

            if (isHttpStatus(error, 404)) {
                message = t('members.userNotFound', { email: variables.data.email })
            } else if (isHttpStatus(error, 409) && isApiError(error, 'APPLICATION_MEMBER_EXISTS')) {
                message = t('members.userAlreadyMember', { email: variables.data.email })
            } else {
                const apiError = extractAxiosError(error) as { message?: string } | undefined
                if (apiError?.message) {
                    message = apiError.message
                } else if (error.message) {
                    message = error.message
                }
            }

            enqueueSnackbar(message, { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(
                queryClient,
                ['applicationMembers'],
                applicationsQueryKeys.members(variables.applicationId),
                applicationsQueryKeys.detail(variables.applicationId)
            )
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
        mutationKey: ['applicationMembers', 'updateRole'],
        mutationFn: async ({ applicationId, memberId, data }: UpdateMemberRoleParams) => {
            const response = await applicationsApi.updateApplicationMemberRole(applicationId, memberId, data)
            return response.data
        },
        onMutate: async ({ applicationId, memberId, data }) => {
            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: applicationsQueryKeys.members(applicationId),
                entityId: memberId,
                updater: {
                    role: data.role,
                    comment: undefined,
                    commentVlc: data.comment ?? null
                }
            })
        },
        onSuccess: async (data, variables) => {
            await queryClient.cancelQueries({ queryKey: applicationsQueryKeys.members(variables.applicationId) })
            confirmOptimisticUpdate(queryClient, applicationsQueryKeys.members(variables.applicationId), variables.memberId, {
                serverEntity: data ? toOptimisticRecord(data as ApplicationMember) : null
            })
            enqueueSnackbar(t('members.updateSuccess'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('members.updateError'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(
                queryClient,
                ['applicationMembers'],
                applicationsQueryKeys.members(variables.applicationId),
                applicationsQueryKeys.detail(variables.applicationId)
            )
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
        mutationKey: ['applicationMembers', 'remove'],
        mutationFn: async ({ applicationId, memberId }: RemoveMemberParams) => {
            await applicationsApi.removeApplicationMember(applicationId, memberId)
        },
        onMutate: async ({ applicationId, memberId }) => {
            return applyOptimisticDelete({
                queryClient,
                queryKeyPrefix: applicationsQueryKeys.members(applicationId),
                entityId: memberId,
                strategy: 'remove'
            })
        },
        onSuccess: () => {
            enqueueSnackbar(t('members.removeSuccess'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('members.removeError'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueries(
                queryClient,
                ['applicationMembers'],
                applicationsQueryKeys.members(variables.applicationId),
                applicationsQueryKeys.detail(variables.applicationId)
            )
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
        inviteMember: async (data: {
            email: string
            role: AssignableRole
            comment?: SimpleLocalizedInput | null
            commentPrimaryLocale?: string
        }) => {
            return inviteMutation.mutateAsync({ applicationId, data })
        },
        isInviting: inviteMutation.isPending,
        inviteError: inviteMutation.error,

        // Update role
        updateMemberRole: async (
            memberId: string,
            data: { role: AssignableRole; comment?: SimpleLocalizedInput | null; commentPrimaryLocale?: string }
        ) => {
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
    const { t, i18n } = useTranslation('applications')

    return useMutation({
        mutationKey: ['connectors', 'create'],
        mutationFn: async ({ applicationId, data }: CreateConnectorParams) => {
            const response = await connectorsApi.createConnector(applicationId, data)
            return response.data
        },
        onMutate: async ({ applicationId, data }) => {
            const optimisticId = generateOptimisticId()
            const lang = normalizeLocale(i18n.language)
            const displayName = getVLCString(data.name, lang) || t('connectors.copyInProgress', 'Creating…')
            const queryKeyPrefix = applicationsQueryKeys.connectors(applicationId)
            const optimisticSortOrder = data.sortOrder ?? getNextOptimisticSortOrderFromQueries(queryClient, queryKeyPrefix)

            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity: toOptimisticRecord({
                    id: optimisticId,
                    applicationId,
                    name: data.name,
                    description: data.description,
                    sortOrder: optimisticSortOrder,
                    isSinglePublication: false,
                    isRequiredPublication: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    ...makePendingMarkers('create')
                }),
                insertPosition: 'append',
                breadcrumb: { queryKey: ['breadcrumb', 'connector', applicationId, optimisticId, lang], name: displayName }
            })
        },
        onSuccess: (data, variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(
                    queryClient,
                    applicationsQueryKeys.connectors(variables.applicationId),
                    context.optimisticId,
                    data.id,
                    { serverEntity: toOptimisticRecord(data as Connector) }
                )
            }
            enqueueSnackbar(t('connectors.createSuccess', 'Connector created'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('connectors.createError', 'Failed to create connector'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(
                queryClient,
                ['connectors'],
                applicationsQueryKeys.connectors(variables.applicationId),
                applicationsQueryKeys.detail(variables.applicationId)
            )
        }
    })
}

/**
 * Hook for updating a connector
 */
export function useUpdateConnector() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t, i18n } = useTranslation('applications')

    return useMutation({
        mutationKey: ['connectors', 'update'],
        mutationFn: async ({ applicationId, connectorId, data }: UpdateConnectorParams) => {
            const response = await connectorsApi.updateConnector(applicationId, connectorId, data)
            return response.data
        },
        onMutate: async ({ applicationId, connectorId, data }) => {
            const lang = normalizeLocale(i18n.language)
            const displayName = data.name ? getVLCString(data.name, lang) : undefined

            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: applicationsQueryKeys.connectors(applicationId),
                entityId: connectorId,
                updater: {
                    ...data,
                    updatedAt: new Date().toISOString()
                },
                detailQueryKey: applicationsQueryKeys.connectorDetail(applicationId, connectorId),
                breadcrumb: displayName
                    ? { queryKey: ['breadcrumb', 'connector', applicationId, connectorId, lang], name: displayName }
                    : undefined
            })
        },
        onSuccess: async (data, variables) => {
            await queryClient.cancelQueries({ queryKey: applicationsQueryKeys.connectors(variables.applicationId) })
            confirmOptimisticUpdate(queryClient, applicationsQueryKeys.connectors(variables.applicationId), variables.connectorId, {
                serverEntity: data ? toOptimisticRecord(data as Connector) : null
            })
            if (data) {
                queryClient.setQueryData(applicationsQueryKeys.connectorDetail(variables.applicationId, variables.connectorId), data)
            }
            enqueueSnackbar(t('connectors.updateSuccess', 'Connector updated'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            if (isOptimisticLockConflict(error)) {
                return
            }
            enqueueSnackbar(error.message || t('connectors.updateError', 'Failed to update connector'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(
                queryClient,
                ['connectors'],
                applicationsQueryKeys.connectors(variables.applicationId),
                applicationsQueryKeys.connectorDetail(variables.applicationId, variables.connectorId),
                applicationsQueryKeys.detail(variables.applicationId),
                ['breadcrumb', 'connector', variables.applicationId, variables.connectorId]
            )
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
        mutationKey: ['connectors', 'delete'],
        mutationFn: async ({ applicationId, connectorId }: DeleteConnectorParams) => {
            await connectorsApi.deleteConnector(applicationId, connectorId)
        },
        onMutate: async ({ applicationId, connectorId }) => {
            return applyOptimisticDelete({
                queryClient,
                queryKeyPrefix: applicationsQueryKeys.connectors(applicationId),
                entityId: connectorId,
                strategy: 'remove'
            })
        },
        onSuccess: () => {
            enqueueSnackbar(t('connectors.deleteSuccess', 'Connector deleted'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('connectors.deleteError', 'Failed to delete connector'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueries(
                queryClient,
                ['connectors'],
                applicationsQueryKeys.connectors(variables.applicationId),
                applicationsQueryKeys.connectorDetail(variables.applicationId, variables.connectorId),
                applicationsQueryKeys.detail(variables.applicationId)
            )
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
        mutationFn: async ({ applicationId, confirmDestructive = false, layoutResolutionPolicy, schemaOptions }: SyncConnectorParams) => {
            return connectorsApi.syncApplication(applicationId, confirmDestructive, layoutResolutionPolicy, schemaOptions)
        },
        onSuccess: (data, variables) => {
            // Invalidate application-related queries
            queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.detail(variables.applicationId) })
            queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.applicationDiff(variables.applicationId) })
            queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.connectors(variables.applicationId) })

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
