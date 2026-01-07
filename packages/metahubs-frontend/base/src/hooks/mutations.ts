/**
 * Metahub mutations hooks
 *
 * This file contains all mutation hooks for the metahubs module.
 * Uses @tanstack/react-query useMutation for proper cache management and loading states.
 *
 * Following the colocation principle - mutations are kept close to their feature.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import type { AssignableRole } from '@universo/template-mui'
import type { MetahubLocalizedPayload, SimpleLocalizedInput } from '../types'
import { normalizeLocale } from '../utils/localizedInput'

import * as metahubsApi from '../api/metahubs'
import * as meta_sectionsApi from '../api/metaSections'
import * as meta_entitiesApi from '../api/metaEntities'
import { metahubsQueryKeys, meta_sectionsQueryKeys, meta_entitiesQueryKeys } from '../api/queryKeys'

// ============================================================================
// Types
// ============================================================================

type LegacyMetahubInput = { name: string; description?: string }

interface UpdateMetahubParams {
    id: string
    data: LegacyMetahubInput | MetahubLocalizedPayload
}

interface UpdateSectionParams {
    id: string
    data: { name: string; description?: string }
}

interface CreateSectionParams {
    name: string
    description?: string
    metahubId: string
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
    metahubId: string
    memberId: string
    data: { role: AssignableRole; comment?: string }
}

interface RemoveMemberParams {
    metahubId: string
    memberId: string
}

interface InviteMemberParams {
    metahubId: string
    data: { email: string; role: AssignableRole; comment?: string }
}

// ============================================================================
// Metahub Mutations
// ============================================================================

/**
 * Hook for creating a metahub
 */
const buildLocalizedInput = (value: string | undefined, locale: string): SimpleLocalizedInput | undefined => {
    if (!value) return undefined
    return { [locale]: value }
}

export function useCreateMetahub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t, i18n } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async (data: LegacyMetahubInput | MetahubLocalizedPayload) => {
            const locale = normalizeLocale(i18n.language)
            const payload: MetahubLocalizedPayload =
                typeof data.name === 'string'
                    ? {
                          name: buildLocalizedInput(data.name, locale) ?? { [locale]: '' },
                          description: buildLocalizedInput(data.description, locale),
                          namePrimaryLocale: locale,
                          descriptionPrimaryLocale: data.description ? locale : undefined
                      }
                    : data
            const response = await metahubsApi.createMetahub(payload)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.lists() })
            enqueueSnackbar(t('createSuccess', 'Metahub created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('createError', 'Failed to create metahub'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating a metahub
 */
export function useUpdateMetahub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t, i18n } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ id, data }: UpdateMetahubParams) => {
            const locale = normalizeLocale(i18n.language)
            const payload: MetahubLocalizedPayload =
                typeof data.name === 'string'
                    ? {
                          name: buildLocalizedInput(data.name, locale) ?? { [locale]: '' },
                          description: buildLocalizedInput(data.description, locale),
                          namePrimaryLocale: locale,
                          descriptionPrimaryLocale: data.description ? locale : undefined
                      }
                    : data
            const response = await metahubsApi.updateMetahub(id, payload)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.lists() })
            enqueueSnackbar(t('updateSuccess', 'Metahub updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('updateError', 'Failed to update metahub'), { variant: 'error' })
        }
    })
}

/**
 * Hook for deleting a metahub
 */
export function useDeleteMetahub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async (id: string) => {
            await metahubsApi.deleteMetahub(id)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.lists() })
            enqueueSnackbar(t('deleteSuccess', 'Metahub deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('deleteError', 'Failed to delete metahub'), { variant: 'error' })
        }
    })
}

// ============================================================================
// MetaSection Mutations
// ============================================================================

/**
 * Hook for creating a section
 */
export function useCreateSection() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async (data: CreateSectionParams) => {
            const response = await meta_sectionsApi.createSection(data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: meta_sectionsQueryKeys.lists() })
            enqueueSnackbar(t('meta_sections.createSuccess', 'MetaSection created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('meta_sections.saveError', 'Failed to create section'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating a section
 */
export function useUpdateSection() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ id, data }: UpdateSectionParams) => {
            const response = await meta_sectionsApi.updateSection(id, data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: meta_sectionsQueryKeys.lists() })
            enqueueSnackbar(t('meta_sections.updateSuccess', 'MetaSection updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('meta_sections.updateError', 'Failed to update section'), { variant: 'error' })
        }
    })
}

/**
 * Hook for deleting a section
 */
export function useDeleteSection() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async (id: string) => {
            await meta_sectionsApi.deleteSection(id)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: meta_sectionsQueryKeys.lists() })
            enqueueSnackbar(t('meta_sections.deleteSuccess', 'MetaSection deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('meta_sections.deleteError', 'Failed to delete section'), { variant: 'error' })
        }
    })
}

// ============================================================================
// MetaEntity Mutations
// ============================================================================

/**
 * Hook for creating an entity
 */
export function useCreateEntity() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async (data: CreateEntityParams) => {
            const response = await meta_entitiesApi.createEntity(data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: meta_entitiesQueryKeys.lists() })
            enqueueSnackbar(t('meta_entities.createSuccess', 'MetaEntity created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('meta_entities.saveError', 'Failed to create entity'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating an entity
 */
export function useUpdateEntity() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ id, data }: UpdateEntityParams) => {
            const response = await meta_entitiesApi.updateEntity(id, data)
            return response.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: meta_entitiesQueryKeys.lists() })
            enqueueSnackbar(t('meta_entities.updateSuccess', 'MetaEntity updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('meta_entities.updateError', 'Failed to update entity'), { variant: 'error' })
        }
    })
}

/**
 * Hook for deleting an entity
 */
export function useDeleteEntity() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async (id: string) => {
            await meta_entitiesApi.deleteEntity(id)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: meta_entitiesQueryKeys.lists() })
            enqueueSnackbar(t('meta_entities.deleteSuccess', 'MetaEntity deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('meta_entities.deleteError', 'Failed to delete entity'), { variant: 'error' })
        }
    })
}

// ============================================================================
// Member Mutations
// ============================================================================

/**
 * Hook for inviting a new metahub member
 */
export function useInviteMember() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useCommonTranslations()

    return useMutation({
        mutationFn: async ({ metahubId, data }: InviteMemberParams) => {
            const response = await metahubsApi.inviteMetahubMember(metahubId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.members(variables.metahubId) })
            enqueueSnackbar(t('members.inviteSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('members.inviteError'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating a metahub member's role
 */
export function useUpdateMemberRole() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useCommonTranslations()

    return useMutation({
        mutationFn: async ({ metahubId, memberId, data }: UpdateMemberRoleParams) => {
            const response = await metahubsApi.updateMetahubMemberRole(metahubId, memberId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.members(variables.metahubId) })
            enqueueSnackbar(t('members.updateSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('members.updateError'), { variant: 'error' })
        }
    })
}

/**
 * Hook for removing a metahub member
 */
export function useRemoveMember() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useCommonTranslations()

    return useMutation({
        mutationFn: async ({ metahubId, memberId }: RemoveMemberParams) => {
            await metahubsApi.removeMetahubMember(metahubId, memberId)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.members(variables.metahubId) })
            enqueueSnackbar(t('members.removeSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('members.removeError'), { variant: 'error' })
        }
    })
}

/**
 * Combined hook for metahub member mutations
 * Provides a unified interface for member operations within a specific metahub
 */
export function useMemberMutations(metahubId: string) {
    const inviteMutation = useInviteMember()
    const updateMutation = useUpdateMemberRole()
    const removeMutation = useRemoveMember()

    return {
        // Invite
        inviteMember: async (data: { email: string; role: AssignableRole; comment?: string }) => {
            return inviteMutation.mutateAsync({ metahubId, data })
        },
        isInviting: inviteMutation.isPending,
        inviteError: inviteMutation.error,

        // Update role
        updateMemberRole: async (memberId: string, data: { role: AssignableRole; comment?: string }) => {
            return updateMutation.mutateAsync({ metahubId, memberId, data })
        },
        isUpdating: updateMutation.isPending,
        updateError: updateMutation.error,

        // Remove
        removeMember: async (memberId: string) => {
            return removeMutation.mutateAsync({ metahubId, memberId })
        },
        isRemoving: removeMutation.isPending,
        removeError: removeMutation.error,

        // Combined state
        isPending: inviteMutation.isPending || updateMutation.isPending || removeMutation.isPending
    }
}

// ============================================================================
// NEW ARCHITECTURE: Hub Mutations
// ============================================================================

import * as hubsApi from '../api/hubs'
import * as attributesApi from '../api/attributes'
import * as recordsApi from '../api/records'
import { metahubsQueryKeys as hubQueryKeys } from '../api/queryKeys'

interface CreateHubParams {
    metahubId: string
    data: {
        codename: string
        name?: { en?: string; ru?: string }
        description?: { en?: string; ru?: string }
        sortOrder?: number
    }
}

interface UpdateHubParams {
    metahubId: string
    hubId: string
    data: {
        codename?: string
        name?: { en?: string; ru?: string }
        description?: { en?: string; ru?: string }
        sortOrder?: number
    }
}

interface DeleteHubParams {
    metahubId: string
    hubId: string
}

/**
 * Hook for creating a hub
 */
export function useCreateHub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, data }: CreateHubParams) => {
            const response = await hubsApi.createHub(metahubId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: hubQueryKeys.hubs(variables.metahubId) })
            enqueueSnackbar(t('hubs.createSuccess', 'Hub created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('hubs.createError', 'Failed to create hub'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating a hub
 */
export function useUpdateHub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, data }: UpdateHubParams) => {
            const response = await hubsApi.updateHub(metahubId, hubId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: hubQueryKeys.hubs(variables.metahubId) })
            enqueueSnackbar(t('hubs.updateSuccess', 'Hub updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('hubs.updateError', 'Failed to update hub'), { variant: 'error' })
        }
    })
}

/**
 * Hook for deleting a hub
 */
export function useDeleteHub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId }: DeleteHubParams) => {
            await hubsApi.deleteHub(metahubId, hubId)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: hubQueryKeys.hubs(variables.metahubId) })
            enqueueSnackbar(t('hubs.deleteSuccess', 'Hub deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('hubs.deleteError', 'Failed to delete hub'), { variant: 'error' })
        }
    })
}

// ============================================================================
// NEW ARCHITECTURE: Attribute Mutations
// ============================================================================

interface CreateAttributeParams {
    metahubId: string
    hubId: string
    data: {
        codename: string
        dataType: string
        name?: { en?: string; ru?: string }
        description?: { en?: string; ru?: string }
        targetHubId?: string
        validationRules?: Record<string, unknown>
        uiConfig?: Record<string, unknown>
        isRequired?: boolean
        sortOrder?: number
    }
}

interface UpdateAttributeParams {
    metahubId: string
    hubId: string
    attributeId: string
    data: {
        codename?: string
        dataType?: string
        name?: { en?: string; ru?: string }
        description?: { en?: string; ru?: string }
        targetHubId?: string | null
        validationRules?: Record<string, unknown>
        uiConfig?: Record<string, unknown>
        isRequired?: boolean
        sortOrder?: number
    }
}

interface DeleteAttributeParams {
    metahubId: string
    hubId: string
    attributeId: string
}

/**
 * Hook for creating an attribute
 */
export function useCreateAttribute() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, data }: CreateAttributeParams) => {
            const response = await attributesApi.createAttribute(
                metahubId,
                hubId,
                data as Parameters<typeof attributesApi.createAttribute>[2]
            )
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: hubQueryKeys.attributes(variables.metahubId, variables.hubId) })
            enqueueSnackbar(t('attributes.createSuccess', 'Attribute created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('attributes.createError', 'Failed to create attribute'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating an attribute
 */
export function useUpdateAttribute() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, attributeId, data }: UpdateAttributeParams) => {
            const response = await attributesApi.updateAttribute(
                metahubId,
                hubId,
                attributeId,
                data as Parameters<typeof attributesApi.updateAttribute>[3]
            )
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: hubQueryKeys.attributes(variables.metahubId, variables.hubId) })
            enqueueSnackbar(t('attributes.updateSuccess', 'Attribute updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('attributes.updateError', 'Failed to update attribute'), { variant: 'error' })
        }
    })
}

/**
 * Hook for deleting an attribute
 */
export function useDeleteAttribute() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, attributeId }: DeleteAttributeParams) => {
            await attributesApi.deleteAttribute(metahubId, hubId, attributeId)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: hubQueryKeys.attributes(variables.metahubId, variables.hubId) })
            enqueueSnackbar(t('attributes.deleteSuccess', 'Attribute deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('attributes.deleteError', 'Failed to delete attribute'), { variant: 'error' })
        }
    })
}

// ============================================================================
// NEW ARCHITECTURE: Record Mutations
// ============================================================================

interface CreateRecordParams {
    metahubId: string
    hubId: string
    data: {
        data: Record<string, unknown>
        sortOrder?: number
    }
}

interface UpdateRecordParams {
    metahubId: string
    hubId: string
    recordId: string
    data: {
        data?: Record<string, unknown>
        sortOrder?: number
    }
}

interface DeleteRecordParams {
    metahubId: string
    hubId: string
    recordId: string
}

/**
 * Hook for creating a record
 */
export function useCreateRecord() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, data }: CreateRecordParams) => {
            const response = await recordsApi.createRecord(metahubId, hubId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: hubQueryKeys.records(variables.metahubId, variables.hubId) })
            enqueueSnackbar(t('records.createSuccess', 'Record created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('records.createError', 'Failed to create record'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating a record
 */
export function useUpdateRecord() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, recordId, data }: UpdateRecordParams) => {
            const response = await recordsApi.updateRecord(metahubId, hubId, recordId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: hubQueryKeys.records(variables.metahubId, variables.hubId) })
            enqueueSnackbar(t('records.updateSuccess', 'Record updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('records.updateError', 'Failed to update record'), { variant: 'error' })
        }
    })
}

/**
 * Hook for deleting a record
 */
export function useDeleteRecord() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, recordId }: DeleteRecordParams) => {
            await recordsApi.deleteRecord(metahubId, hubId, recordId)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: hubQueryKeys.records(variables.metahubId, variables.hubId) })
            enqueueSnackbar(t('records.deleteSuccess', 'Record deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('records.deleteError', 'Failed to delete record'), { variant: 'error' })
        }
    })
}
