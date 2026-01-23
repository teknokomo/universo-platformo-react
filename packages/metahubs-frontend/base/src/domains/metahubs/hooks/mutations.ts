import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import type { AssignableRole } from '@universo/template-mui'
import type { MetahubLocalizedPayload, SimpleLocalizedInput } from '../../../types'
import { normalizeLocale } from '../../../utils/localizedInput'
import { sanitizeCodename, isValidCodename } from '../../../utils/codename'
import { metahubsQueryKeys } from '../../shared'
import * as metahubsApi from '../api'

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
                          codename: (() => {
                              const normalized = sanitizeCodename(data.name)
                              if (!normalized || !isValidCodename(normalized)) {
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
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.lists() })
            enqueueSnackbar(t('createSuccess', 'Metahub created'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('createError', 'Failed to create metahub'), { variant: 'error' })
        }
    })
}

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
                          codename: (() => {
                              const normalized = sanitizeCodename(data.name)
                              if (!normalized || !isValidCodename(normalized)) {
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

export function useMemberMutations(metahubId: string) {
    const inviteMutation = useInviteMember()
    const updateMutation = useUpdateMemberRole()
    const removeMutation = useRemoveMember()

    return {
        inviteMember: async (data: { email: string; role: AssignableRole; comment?: string }) => {
            return inviteMutation.mutateAsync({ metahubId, data })
        },
        isInviting: inviteMutation.isPending,
        inviteError: inviteMutation.error,

        updateMemberRole: async (memberId: string, data: { role: AssignableRole; comment?: string }) => {
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
