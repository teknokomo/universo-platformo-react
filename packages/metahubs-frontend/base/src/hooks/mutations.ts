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
import type {
    AttributeLocalizedPayload,
    CatalogLocalizedPayload,
    HubLocalizedPayload,
    MetahubLocalizedPayload,
    SimpleLocalizedInput
} from '../types'
import { normalizeLocale } from '../utils/localizedInput'

import * as metahubsApi from '../api/metahubs'
import * as catalogsApi from '../api/catalogs'
import { metahubsQueryKeys } from '../api/queryKeys'

// ============================================================================
// Types
// ============================================================================

type LegacyMetahubInput = { name: string; description?: string }

interface UpdateMetahubParams {
    id: string
    data: LegacyMetahubInput | MetahubLocalizedPayload
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
    data: HubLocalizedPayload & { sortOrder?: number }
}

interface UpdateHubParams {
    metahubId: string
    hubId: string
    data: HubLocalizedPayload & { sortOrder?: number }
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
// NEW ARCHITECTURE: Catalog Mutations
// ============================================================================

interface CreateCatalogParams {
    metahubId: string
    hubId: string
    data: CatalogLocalizedPayload & { sortOrder?: number }
}

interface CreateCatalogAtMetahubParams {
    metahubId: string
    data: CatalogLocalizedPayload & { sortOrder?: number }
}

interface UpdateCatalogParams {
    metahubId: string
    hubId: string
    catalogId: string
    data: CatalogLocalizedPayload & { sortOrder?: number }
}

interface DeleteCatalogParams {
    metahubId: string
    /** Hub ID - optional for catalogs without hub associations */
    hubId?: string
    catalogId: string
    /** If true, deletes catalog completely. If false, only removes from hub (N:M). */
    force?: boolean
}

/**
 * Hook for creating a catalog at metahub level (can have 0+ hubs)
 * Used when creating from global catalogs list
 */
export function useCreateCatalogAtMetahub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, data }: CreateCatalogAtMetahubParams) => {
            const response = await catalogsApi.createCatalogAtMetahub(metahubId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            // Invalidate the "all catalogs" list
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
            // Hub list counters (e.g., catalogsCount) depend on catalogs state
            queryClient.invalidateQueries({ queryKey: hubQueryKeys.hubs(variables.metahubId) })
            // If hubIds were provided, also invalidate those hub-specific lists
            const hubIds = variables.data.hubIds ?? []
            hubIds.forEach((hubId: string) => {
                queryClient.invalidateQueries({ queryKey: hubQueryKeys.catalogs(variables.metahubId, hubId) })
            })
            enqueueSnackbar(t('catalogs.createSuccess', 'Catalog created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('catalogs.createError', 'Failed to create catalog'), { variant: 'error' })
        }
    })
}

/**
 * Hook for creating a catalog within a specific hub context
 */
export function useCreateCatalog() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, data }: CreateCatalogParams) => {
            const response = await catalogsApi.createCatalog(metahubId, hubId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: hubQueryKeys.catalogs(variables.metahubId, variables.hubId) })
            // Also invalidate the "all catalogs" list so it updates when navigating there
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
            // Hub list counters (e.g., catalogsCount) depend on catalogs state
            queryClient.invalidateQueries({ queryKey: hubQueryKeys.hubs(variables.metahubId) })
            enqueueSnackbar(t('catalogs.createSuccess', 'Catalog created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('catalogs.createError', 'Failed to create catalog'), { variant: 'error' })
        }
    })
}

/**
 * Hook for updating a catalog
 */
export function useUpdateCatalog() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, catalogId, data }: UpdateCatalogParams) => {
            const response = await catalogsApi.updateCatalog(metahubId, hubId, catalogId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: hubQueryKeys.catalogs(variables.metahubId, variables.hubId) })
            // Also invalidate the "all catalogs" list
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
            // Hub list counters (e.g., catalogsCount) depend on catalogs state
            queryClient.invalidateQueries({ queryKey: hubQueryKeys.hubs(variables.metahubId) })
            enqueueSnackbar(t('catalogs.updateSuccess', 'Catalog updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('catalogs.updateError', 'Failed to update catalog'), { variant: 'error' })
        }
    })
}

/**
 * Update catalog at metahub level params
 */
interface UpdateCatalogAtMetahubParams {
    metahubId: string
    catalogId: string
    data: CatalogLocalizedPayload & { sortOrder?: number }
}

/**
 * Hook for updating a catalog at metahub level (for catalogs without hub or with multiple hubs)
 */
export function useUpdateCatalogAtMetahub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, catalogId, data }: UpdateCatalogAtMetahubParams) => {
            const response = await catalogsApi.updateCatalogAtMetahub(metahubId, catalogId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            // Invalidate the "all catalogs" list
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
            // Also invalidate hub-scoped queries (catalog lists and hub list counters)
            queryClient.invalidateQueries({ queryKey: hubQueryKeys.hubs(variables.metahubId) })
            enqueueSnackbar(t('catalogs.updateSuccess', 'Catalog updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('catalogs.updateError', 'Failed to update catalog'), { variant: 'error' })
        }
    })
}

/**
 * Hook for deleting a catalog
 * Supports both hub-scoped deletion and direct deletion (for catalogs without hubs)
 */
export function useDeleteCatalog() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, catalogId, force }: DeleteCatalogParams) => {
            if (hubId) {
                // Use hub-scoped deletion
                await catalogsApi.deleteCatalog(metahubId, hubId, catalogId, force)
            } else {
                // Use direct deletion (for catalogs without hubs)
                await catalogsApi.deleteCatalogDirect(metahubId, catalogId)
            }
        },
        onSuccess: (_data, variables) => {
            if (variables.hubId) {
                queryClient.invalidateQueries({ queryKey: hubQueryKeys.catalogs(variables.metahubId, variables.hubId) })
            }
            // Also invalidate the "all catalogs" list
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
            // Hub list counters (e.g., catalogsCount) depend on catalogs state
            queryClient.invalidateQueries({ queryKey: hubQueryKeys.hubs(variables.metahubId) })
            enqueueSnackbar(t('catalogs.deleteSuccess', 'Catalog deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('catalogs.deleteError', 'Failed to delete catalog'), { variant: 'error' })
        }
    })
}

// ============================================================================
// NEW ARCHITECTURE: Attribute Mutations
// ============================================================================

interface CreateAttributeParams {
    metahubId: string
    hubId: string
    catalogId: string
    data: AttributeLocalizedPayload & {
        targetCatalogId?: string
        validationRules?: Record<string, unknown>
        uiConfig?: Record<string, unknown>
        isRequired?: boolean
        sortOrder?: number
    }
}

interface UpdateAttributeParams {
    metahubId: string
    hubId: string
    catalogId: string
    attributeId: string
    data: AttributeLocalizedPayload & {
        targetCatalogId?: string | null
        validationRules?: Record<string, unknown>
        uiConfig?: Record<string, unknown>
        isRequired?: boolean
        sortOrder?: number
    }
}

interface DeleteAttributeParams {
    metahubId: string
    hubId: string
    catalogId: string
    attributeId: string
}

interface MoveAttributeParams {
    metahubId: string
    hubId: string
    catalogId: string
    attributeId: string
    direction: 'up' | 'down'
}

/**
 * Hook for creating an attribute
 */
export function useCreateAttribute() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, catalogId, data }: CreateAttributeParams) => {
            const response = await attributesApi.createAttribute(
                metahubId,
                hubId,
                catalogId,
                data as Parameters<typeof attributesApi.createAttribute>[3]
            )
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: hubQueryKeys.attributes(variables.metahubId, variables.hubId, variables.catalogId) })
            // Catalog list counters depend on attributes
            queryClient.invalidateQueries({ queryKey: hubQueryKeys.catalogs(variables.metahubId, variables.hubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
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
        mutationFn: async ({ metahubId, hubId, catalogId, attributeId, data }: UpdateAttributeParams) => {
            const response = await attributesApi.updateAttribute(
                metahubId,
                hubId,
                catalogId,
                attributeId,
                data as Parameters<typeof attributesApi.updateAttribute>[4]
            )
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: hubQueryKeys.attributes(variables.metahubId, variables.hubId, variables.catalogId) })
            // Catalog list counters depend on attributes
            queryClient.invalidateQueries({ queryKey: hubQueryKeys.catalogs(variables.metahubId, variables.hubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
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
        mutationFn: async ({ metahubId, hubId, catalogId, attributeId }: DeleteAttributeParams) => {
            await attributesApi.deleteAttribute(metahubId, hubId, catalogId, attributeId)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: hubQueryKeys.attributes(variables.metahubId, variables.hubId, variables.catalogId) })
            // Catalog list counters depend on attributes
            queryClient.invalidateQueries({ queryKey: hubQueryKeys.catalogs(variables.metahubId, variables.hubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
            enqueueSnackbar(t('attributes.deleteSuccess', 'Attribute deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('attributes.deleteError', 'Failed to delete attribute'), { variant: 'error' })
        }
    })
}

/**
 * Hook for reordering an attribute
 */
export function useMoveAttribute() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationFn: async ({ metahubId, hubId, catalogId, attributeId, direction }: MoveAttributeParams) => {
            const response = await attributesApi.moveAttribute(metahubId, hubId, catalogId, attributeId, direction)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: hubQueryKeys.attributes(variables.metahubId, variables.hubId, variables.catalogId) })
            // Catalog list counters depend on attributes
            queryClient.invalidateQueries({ queryKey: hubQueryKeys.catalogs(variables.metahubId, variables.hubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
            enqueueSnackbar(t('attributes.moveSuccess', 'Attribute order updated'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('attributes.moveError', 'Failed to update attribute order'), { variant: 'error' })
        }
    })
}

// ============================================================================
// NEW ARCHITECTURE: Record Mutations
// ============================================================================

interface CreateRecordParams {
    metahubId: string
    hubId: string
    catalogId: string
    data: {
        data: Record<string, unknown>
        sortOrder?: number
    }
}

interface UpdateRecordParams {
    metahubId: string
    hubId: string
    catalogId: string
    recordId: string
    data: {
        data?: Record<string, unknown>
        sortOrder?: number
    }
}

interface DeleteRecordParams {
    metahubId: string
    hubId: string
    catalogId: string
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
        mutationFn: async ({ metahubId, hubId, catalogId, data }: CreateRecordParams) => {
            const response = await recordsApi.createRecord(metahubId, hubId, catalogId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: hubQueryKeys.records(variables.metahubId, variables.hubId, variables.catalogId) })
            // Catalog list counters depend on records
            queryClient.invalidateQueries({ queryKey: hubQueryKeys.catalogs(variables.metahubId, variables.hubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
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
        mutationFn: async ({ metahubId, hubId, catalogId, recordId, data }: UpdateRecordParams) => {
            const response = await recordsApi.updateRecord(metahubId, hubId, catalogId, recordId, data)
            return response.data
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: hubQueryKeys.records(variables.metahubId, variables.hubId, variables.catalogId) })
            // Catalog list counters depend on records
            queryClient.invalidateQueries({ queryKey: hubQueryKeys.catalogs(variables.metahubId, variables.hubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
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
        mutationFn: async ({ metahubId, hubId, catalogId, recordId }: DeleteRecordParams) => {
            await recordsApi.deleteRecord(metahubId, hubId, catalogId, recordId)
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: hubQueryKeys.records(variables.metahubId, variables.hubId, variables.catalogId) })
            // Catalog list counters depend on records
            queryClient.invalidateQueries({ queryKey: hubQueryKeys.catalogs(variables.metahubId, variables.hubId) })
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.allCatalogs(variables.metahubId) })
            enqueueSnackbar(t('records.deleteSuccess', 'Record deleted'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('records.deleteError', 'Failed to delete record'), { variant: 'error' })
        }
    })
}
