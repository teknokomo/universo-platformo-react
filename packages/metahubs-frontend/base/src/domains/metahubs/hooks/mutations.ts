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
    cleanupBreadcrumbCache,
    safeInvalidateQueries,
    safeInvalidateQueriesInactive,
    confirmOptimisticUpdate,
    confirmOptimisticCreate,
    getCurrentLanguageKey
} from '@universo/template-mui'
import { makePendingMarkers, extractAxiosError, isApiError, isHttpStatus } from '@universo/utils'
import { getVLCString } from '@universo/utils/vlc'
import type { MetahubLocalizedPayload, SimpleLocalizedInput } from '../../../types'
import { normalizeLocale } from '../../../utils/localizedInput'
import { sanitizeCodenameForStyle, isValidCodenameForStyle } from '../../../utils/codename'
import { useCodenameConfig } from '../../settings/hooks/useCodenameConfig'
import { metahubsQueryKeys } from '../../shared'
import * as metahubsApi from '../api'
import type { MetahubInput } from '../api'

type LegacyMetahubInput = { name: string; description?: string }

interface UpdateMetahubParams {
    id: string
    data: LegacyMetahubInput | MetahubLocalizedPayload
    expectedVersion?: number
}

interface CopyMetahubParams {
    id: string
    data?: metahubsApi.MetahubCopyInput
}

interface UpdateMemberRoleParams {
    metahubId: string
    memberId: string
    data: { role: AssignableRole; comment?: SimpleLocalizedInput | null; commentPrimaryLocale?: string }
}

interface RemoveMemberParams {
    metahubId: string
    memberId: string
}

interface InviteMemberParams {
    metahubId: string
    data: { email: string; role: AssignableRole; comment?: SimpleLocalizedInput | null; commentPrimaryLocale?: string }
}

const buildLocalizedInput = (value: string | undefined, locale: string): SimpleLocalizedInput | undefined => {
    if (!value) return undefined
    return { [locale]: value }
}

const ownerPermissions = {
    manageMembers: true,
    manageMetahub: true,
    createContent: true,
    editContent: true,
    deleteContent: true
} as const

export function useCreateMetahub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t, i18n } = useTranslation('metahubs')
    const codenameConfig = useCodenameConfig()

    return useMutation({
        mutationKey: ['metahubs', 'create'],
        mutationFn: async (data: LegacyMetahubInput | MetahubInput) => {
            const locale = normalizeLocale(i18n.language)
            const payload: MetahubInput =
                typeof data.name === 'string'
                    ? {
                          codename: (() => {
                              const normalized = sanitizeCodenameForStyle(data.name, codenameConfig.style, codenameConfig.alphabet)
                              if (
                                  !normalized ||
                                  !isValidCodenameForStyle(
                                      normalized,
                                      codenameConfig.style,
                                      codenameConfig.alphabet,
                                      codenameConfig.allowMixed
                                  )
                              ) {
                                  throw new Error(t('validation.codenameInvalid', 'Codename contains invalid characters'))
                              }
                              return normalized
                          })(),
                          name: buildLocalizedInput(data.name, locale) ?? { [locale]: '' },
                          description: buildLocalizedInput(data.description, locale),
                          namePrimaryLocale: locale,
                          descriptionPrimaryLocale: data.description ? locale : undefined
                      }
                    : data
            const response = await metahubsApi.createMetahub(payload)
            return response.data
        },
        onMutate: async (data) => {
            const optimisticId = generateOptimisticId()
            const lang = getCurrentLanguageKey()
            const displayName = getVLCString(data.name, lang)
            const isLocalized = typeof data.name !== 'string'

            const optimisticEntity = {
                id: optimisticId,
                codename: isLocalized ? (data as MetahubLocalizedPayload).codename || '' : '',
                name: isLocalized ? data.name : { [lang]: data.name },
                description: isLocalized ? (data as MetahubLocalizedPayload).description : undefined,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                hubsCount: 0,
                catalogsCount: 0,
                membersCount: 1,
                role: 'owner',
                accessType: 'member',
                permissions: ownerPermissions,
                ...makePendingMarkers('create')
            }

            const breadcrumbKey = ['breadcrumb', 'metahub', optimisticId, lang] as const

            console.info('[metahub:create] onMutate', { optimisticId, displayName })

            const context = await applyOptimisticCreate({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.lists(),
                optimisticEntity,
                insertPosition: 'prepend',
                breadcrumb: { queryKey: breadcrumbKey, name: displayName }
            })

            return { ...context, breadcrumbKey }
        },
        onError: (error: Error, _variables, context) => {
            console.info('[metahub:create] onError', { error: error.message })
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            if (context?.breadcrumbKey) {
                cleanupBreadcrumbCache(queryClient, context.breadcrumbKey)
            }
            enqueueSnackbar(error.message || t('createError', 'Failed to create metahub'), { variant: 'error' })
        },
        onSuccess: (data, _variables, context) => {
            console.info('[metahub:create] onSuccess', {
                optimisticId: context?.optimisticId,
                realId: data?.id
            })
            // Replace optimistic entity (client ID) with server-confirmed entity (real ID)
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(queryClient, metahubsQueryKeys.lists(), context.optimisticId, data.id, {
                    serverEntity: data
                })
            }
            enqueueSnackbar(t('createSuccess', 'Metahub created'), { variant: 'success' })
        },
        onSettled: () => {
            console.info('[metahub:create] onSettled')
            // NOTE: We intentionally do NOT invalidate here.
            // confirmOptimisticCreate in onSuccess already provides the full server entity.
            // Invalidating marks the query stale, which triggers a background refetch that
            // can overwrite optimistic entries from a SUBSEQUENT mutation (e.g. copy started
            // right after create). Eventual consistency is handled by staleTime.
        }
    })
}

export function useUpdateMetahub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t, i18n } = useTranslation('metahubs')
    const codenameConfig = useCodenameConfig()

    return useMutation({
        mutationKey: ['metahubs', 'update'],
        mutationFn: async ({ id, data, expectedVersion }: UpdateMetahubParams) => {
            const locale = normalizeLocale(i18n.language)
            const payload: MetahubLocalizedPayload & { expectedVersion?: number } =
                typeof data.name === 'string'
                    ? {
                          codename: (() => {
                              const normalized = sanitizeCodenameForStyle(data.name, codenameConfig.style, codenameConfig.alphabet)
                              if (
                                  !normalized ||
                                  !isValidCodenameForStyle(
                                      normalized,
                                      codenameConfig.style,
                                      codenameConfig.alphabet,
                                      codenameConfig.allowMixed
                                  )
                              ) {
                                  throw new Error(t('validation.codenameInvalid', 'Codename contains invalid characters'))
                              }
                              return normalized
                          })(),
                          name: buildLocalizedInput(data.name, locale) ?? { [locale]: '' },
                          description: buildLocalizedInput(data.description, locale),
                          namePrimaryLocale: locale,
                          descriptionPrimaryLocale: data.description ? locale : undefined,
                          expectedVersion
                      }
                    : { ...data, expectedVersion }
            const response = await metahubsApi.updateMetahub(id, payload)
            return response.data
        },
        onMutate: async ({ id, data }) => {
            const lang = getCurrentLanguageKey()
            const displayName = getVLCString(data.name, lang)
            const isLocalized = typeof data.name !== 'string'

            const updater = {
                name: isLocalized ? data.name : { [lang]: data.name },
                description: isLocalized ? (data as MetahubLocalizedPayload).description : undefined,
                codename: isLocalized ? (data as MetahubLocalizedPayload).codename : undefined,
                updatedAt: new Date().toISOString()
            }

            console.info('[metahub:update] onMutate', { id, displayName })

            const context = await applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.lists(),
                entityId: id,
                updater,
                moveToFront: true,
                detailQueryKey: metahubsQueryKeys.detail(id),
                breadcrumb: displayName ? { queryKey: ['breadcrumb', 'metahub', id, lang], name: displayName } : undefined
            })

            return context
        },
        onError: (error: Error, _variables, context) => {
            console.info('[metahub:update] onError', { error: error.message })
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('updateError', 'Failed to update metahub'), { variant: 'error' })
        },
        onSuccess: async (data, variables) => {
            console.info('[metahub:update] onSuccess', { id: variables.id, hasData: !!data })
            // Await cancel to ensure no in-flight list refetch can overwrite our cache
            // between this point and confirmOptimisticUpdate's setQueriesData
            await queryClient.cancelQueries({ queryKey: metahubsQueryKeys.lists() })
            // Strip pending markers + move to front + merge server data
            confirmOptimisticUpdate(queryClient, metahubsQueryKeys.lists(), variables.id, {
                serverEntity: data ?? null,
                moveToFront: true
            })
            // Seed detail cache with authoritative server response — prevents
            // the brief old→new flicker during the onSettled refetch window.
            if (data) {
                queryClient.setQueryData(metahubsQueryKeys.detail(variables.id), data)
            }
            enqueueSnackbar(t('updateSuccess', 'Metahub updated'), { variant: 'success' })
        },
        onSettled: (_data, _error, variables) => {
            console.info('[metahub:update] onSettled', { id: variables.id })
            // NOTE: We intentionally do NOT invalidate here.
            // confirmOptimisticUpdate in onSuccess already provides the full server entity
            // and seeds the detail cache. Invalidating marks the query stale, triggering a
            // background refetch that briefly shows old list order (front→back→front flicker).
            // Eventual consistency is handled by staleTime.
        }
    })
}

export function useDeleteMetahub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['metahubs', 'delete'],
        mutationFn: async (id: string) => {
            await metahubsApi.deleteMetahub(id)
        },
        onMutate: async (id) => {
            console.info('[metahub:delete] onMutate', { id })
            return applyOptimisticDelete({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.lists(),
                entityId: id,
                strategy: 'remove'
            })
        },
        onError: (error: Error, _id, context) => {
            console.info('[metahub:delete] onError', { error: error.message })
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('deleteError', 'Failed to delete metahub'), { variant: 'error' })
        },
        onSuccess: (_data, id) => {
            console.info('[metahub:delete] onSuccess', { id })
            enqueueSnackbar(t('deleteSuccess', 'Metahub deleted'), { variant: 'success' })
        },
        onSettled: () => {
            console.info('[metahub:delete] onSettled')
            // Use active refetch to ensure the deleted entity is gone from the list
            safeInvalidateQueries(queryClient, ['metahubs'], metahubsQueryKeys.lists())
        }
    })
}

export function useCopyMetahub() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: ['metahubs', 'copy'],
        mutationFn: async ({ id, data }: CopyMetahubParams) => {
            const response = await metahubsApi.copyMetahub(id, data ?? {})
            return response.data
        },
        onMutate: async ({ id, data }) => {
            const optimisticId = generateOptimisticId()
            const queryKeyPrefix = metahubsQueryKeys.lists()
            const lang = getCurrentLanguageKey()
            const existingMetahub = queryClient
                .getQueriesData<{ items?: Array<Record<string, unknown>> }>({ queryKey: queryKeyPrefix })
                .flatMap(([, value]) => (Array.isArray(value?.items) ? value.items : []))
                .find((item) => item.id === id)

            const optimisticEntity = {
                ...(existingMetahub ?? {}),
                id: optimisticId,
                codename: data?.codename || (typeof existingMetahub?.codename === 'string' ? existingMetahub.codename : ''),
                name: data?.name || existingMetahub?.name || { [lang]: t('copyInProgress', 'Copying…') },
                description: data?.description ?? existingMetahub?.description,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                role: 'owner',
                accessType: 'member',
                permissions: ownerPermissions,
                ...makePendingMarkers('copy')
            }

            console.info('[metahub:copy] onMutate', { sourceId: id, optimisticId, codename: optimisticEntity.codename })

            const context = await applyOptimisticCreate({
                queryClient,
                queryKeyPrefix,
                optimisticEntity,
                insertPosition: 'prepend'
            })

            return context
        },
        onError: (error: Error, _variables, context) => {
            console.info('[metahub:copy] onError', { error: error.message })
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('copyError', 'Failed to copy metahub'), { variant: 'error' })
        },
        onSuccess: (data, _variables, context) => {
            console.info('[metahub:copy] onSuccess', {
                optimisticId: context?.optimisticId,
                realId: data?.id,
                codename: data?.codename
            })
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(queryClient, metahubsQueryKeys.lists(), context.optimisticId, data.id, {
                    serverEntity: data
                })
            }
            enqueueSnackbar(t('copySuccess', 'Metahub copied'), { variant: 'success' })
        },
        onSettled: (_data, _error) => {
            console.info('[metahub:copy] onSettled', { hasError: !!_error })
            // Use active refetch after copy to ensure the list shows the real entity.
            // The copy is synchronous on the backend — by the time onSettled fires,
            // the server has the entity.
            safeInvalidateQueries(queryClient, ['metahubs'], metahubsQueryKeys.lists())
        }
    })
}

export function useInviteMember() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useCommonTranslations()

    return useMutation({
        mutationKey: ['metahubs', 'inviteMember'],
        mutationFn: async ({ metahubId, data }: InviteMemberParams) => {
            const response = await metahubsApi.inviteMetahubMember(metahubId, data)
            return response.data
        },
        onMutate: async ({ metahubId, data }) => {
            return applyOptimisticCreate({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.members(metahubId),
                optimisticEntity: {
                    id: generateOptimisticId(),
                    userId: generateOptimisticId(),
                    email: data.email,
                    nickname: null,
                    role: data.role,
                    comment: undefined,
                    commentVlc: data.comment ?? null,
                    createdAt: new Date().toISOString(),
                    ...makePendingMarkers('create')
                },
                insertPosition: 'prepend'
            })
        },
        onSuccess: (data, variables, context) => {
            if (context?.optimisticId && data?.id) {
                confirmOptimisticCreate(queryClient, metahubsQueryKeys.members(variables.metahubId), context.optimisticId, data.id)
            }
            enqueueSnackbar(t('members.inviteSuccess'), { variant: 'success' })
        },
        onError: (error: Error, variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            let message = t('members.inviteError')

            if (isHttpStatus(error, 404)) {
                message = t('members.userNotFound', { email: variables.data.email })
            } else if (isHttpStatus(error, 409) && isApiError(error, 'METAHUB_MEMBER_EXISTS')) {
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
                ['metahubs'],
                metahubsQueryKeys.members(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
        }
    })
}

export function useUpdateMemberRole() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useCommonTranslations()

    return useMutation({
        mutationKey: ['metahubs', 'updateMemberRole'],
        mutationFn: async ({ metahubId, memberId, data }: UpdateMemberRoleParams) => {
            const response = await metahubsApi.updateMetahubMemberRole(metahubId, memberId, data)
            return response.data
        },
        onMutate: async ({ metahubId, memberId, data }) => {
            return applyOptimisticUpdate({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.members(metahubId),
                entityId: memberId,
                updater: {
                    role: data.role,
                    comment: undefined,
                    commentVlc: data.comment ?? null
                }
            })
        },
        onSuccess: (_data, variables) => {
            confirmOptimisticUpdate(queryClient, metahubsQueryKeys.members(variables.metahubId), variables.memberId)
            enqueueSnackbar(t('members.updateSuccess'), { variant: 'success' })
        },
        onError: (error: Error, _variables, context) => {
            rollbackOptimisticSnapshots(queryClient, context?.previousSnapshots)
            enqueueSnackbar(error.message || t('members.updateError'), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(
                queryClient,
                ['metahubs'],
                metahubsQueryKeys.members(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
        }
    })
}

export function useRemoveMember() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useCommonTranslations()

    return useMutation({
        mutationKey: ['metahubs', 'removeMember'],
        mutationFn: async ({ metahubId, memberId }: RemoveMemberParams) => {
            await metahubsApi.removeMetahubMember(metahubId, memberId)
        },
        onMutate: async ({ metahubId, memberId }) => {
            return applyOptimisticDelete({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.members(metahubId),
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
            safeInvalidateQueriesInactive(
                queryClient,
                ['metahubs'],
                metahubsQueryKeys.members(variables.metahubId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
        }
    })
}

export function useMemberMutations(metahubId: string) {
    const inviteMutation = useInviteMember()
    const updateMutation = useUpdateMemberRole()
    const removeMutation = useRemoveMember()

    return {
        inviteMember: async (data: {
            email: string
            role: AssignableRole
            comment?: SimpleLocalizedInput | null
            commentPrimaryLocale?: string
        }) => {
            return inviteMutation.mutateAsync({ metahubId, data })
        },
        isInviting: inviteMutation.isPending,
        inviteError: inviteMutation.error,

        updateMemberRole: async (
            memberId: string,
            data: { role: AssignableRole; comment?: SimpleLocalizedInput | null; commentPrimaryLocale?: string }
        ) => {
            return updateMutation.mutateAsync({ metahubId, memberId, data })
        },
        isUpdating: updateMutation.isPending,
        updateError: updateMutation.error,

        removeMember: async (memberId: string) => {
            return removeMutation.mutateAsync({ metahubId, memberId })
        },
        isRemoving: removeMutation.isPending,
        removeError: removeMutation.error,

        isPending: inviteMutation.isPending || updateMutation.isPending || removeMutation.isPending
    }
}
