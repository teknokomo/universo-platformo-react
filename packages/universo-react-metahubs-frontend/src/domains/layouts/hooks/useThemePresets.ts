import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { safeInvalidateQueriesInactive } from '@universo-react/template-mui'
import { resolveApiErrorMessage } from '@universo-react/utils'
import type { MetahubLayout } from '../../../types'
import { metahubsQueryKeys } from '../../shared'
import * as themePresetsApi from '../api/themePresets'
import type { ApplyLayoutAppearanceInput, CopyThemePresetInput, CreateThemePresetInput } from '../api/themePresets'

const APPEARANCE_MUTATION_KEY = ['theme-presets', 'appearance'] as const
const PRESET_MUTATION_KEY = ['theme-presets', 'presets'] as const

/** Query key for the theme-presets feature flag exposed through /auth/permissions. */
export const THEME_PRESETS_FLAG_QUERY_KEY = ['auth', 'permissions', 'themePresets'] as const

/**
 * Server-side theme-presets feature flag (GET /auth/permissions →
 * `themePresets.themePresetsEnabled`). `undefined` while loading or when the
 * flag endpoint fails, so callers hide theme authoring until confirmed enabled.
 */
export function useThemePresetsFlag() {
    return useQuery({
        queryKey: THEME_PRESETS_FLAG_QUERY_KEY,
        queryFn: themePresetsApi.fetchThemePresetsFlag,
        staleTime: Infinity
    })
}

const isVersionConflict = (error: unknown): boolean => {
    const apiError = error as { response?: { data?: { code?: string } }; code?: string }
    const code = apiError?.response?.data?.code ?? apiError?.code
    return code === 'THEME_PRESET_VERSION_CONFLICT' || code === 'CONFLICT'
}

/** File and metahub-scoped DB presets available for layout appearance selection. */
export function useThemePresetsQuery(metahubId: string | undefined) {
    return useQuery({
        queryKey: metahubId ? metahubsQueryKeys.themePresets(metahubId) : ['metahub-theme-presets-empty'],
        queryFn: () => themePresetsApi.listThemePresets(String(metahubId)),
        enabled: Boolean(metahubId)
    })
}

export interface ApplyLayoutAppearanceParams {
    metahubId: string
    layoutId: string
    data: ApplyLayoutAppearanceInput
}

/** Apply a draft appearance through the dedicated PATCH; the server resolves tokens. */
export function useApplyLayoutAppearance() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')
    const { t: tAppearance } = useTranslation('appearance')

    return useMutation({
        mutationKey: [...APPEARANCE_MUTATION_KEY, 'apply'],
        mutationFn: async ({ metahubId, layoutId, data }: ApplyLayoutAppearanceParams) =>
            themePresetsApi.applyLayoutAppearance(metahubId, layoutId, data),
        onSuccess: (result, variables) => {
            queryClient.setQueryData<MetahubLayout>(metahubsQueryKeys.layoutDetail(variables.metahubId, variables.layoutId), (previous) =>
                previous
                    ? {
                          ...previous,
                          version: result.version,
                          config: { ...previous.config, appearance: result.appearance ?? undefined }
                      }
                    : previous
            )
            enqueueSnackbar(t('metahubs:layouts.appearance.saveSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            const message = isVersionConflict(error)
                ? tAppearance('errors.versionConflict')
                : resolveApiErrorMessage(error, t('metahubs:layouts.appearance.actionError'))
            enqueueSnackbar(message, { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(
                queryClient,
                APPEARANCE_MUTATION_KEY,
                metahubsQueryKeys.layouts(variables.metahubId),
                metahubsQueryKeys.layoutDetail(variables.metahubId, variables.layoutId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
        }
    })
}

export interface ResetLayoutAppearanceParams {
    metahubId: string
    layoutId: string
    expectedVersion: number
}

/** Remove the appearance block from the layout config through the dedicated reset endpoint. */
export function useResetLayoutAppearance() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')
    const { t: tAppearance } = useTranslation('appearance')

    return useMutation({
        mutationKey: [...APPEARANCE_MUTATION_KEY, 'reset'],
        mutationFn: async ({ metahubId, layoutId, expectedVersion }: ResetLayoutAppearanceParams) =>
            themePresetsApi.resetLayoutAppearance(metahubId, layoutId, expectedVersion),
        onSuccess: (result, variables) => {
            queryClient.setQueryData<MetahubLayout>(metahubsQueryKeys.layoutDetail(variables.metahubId, variables.layoutId), (previous) => {
                if (!previous) return previous
                const { appearance: _removed, ...restConfig } = previous.config
                return { ...previous, version: result.version, config: restConfig }
            })
            enqueueSnackbar(t('metahubs:layouts.appearance.resetSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            const message = isVersionConflict(error)
                ? tAppearance('errors.versionConflict')
                : resolveApiErrorMessage(error, t('metahubs:layouts.appearance.actionError'))
            enqueueSnackbar(message, { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(
                queryClient,
                APPEARANCE_MUTATION_KEY,
                metahubsQueryKeys.layouts(variables.metahubId),
                metahubsQueryKeys.layoutDetail(variables.metahubId, variables.layoutId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
        }
    })
}

/** Re-resolve the persisted appearance against the current preset version. */
export function useApplyLatestLayoutAppearance() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')
    const { t: tAppearance } = useTranslation('appearance')

    return useMutation({
        mutationKey: [...APPEARANCE_MUTATION_KEY, 'apply-latest'],
        mutationFn: async ({ metahubId, layoutId, expectedVersion }: ResetLayoutAppearanceParams) =>
            themePresetsApi.applyLatestLayoutAppearance(metahubId, layoutId, expectedVersion),
        onSuccess: (result, variables) => {
            queryClient.setQueryData<MetahubLayout>(metahubsQueryKeys.layoutDetail(variables.metahubId, variables.layoutId), (previous) =>
                previous
                    ? { ...previous, version: result.version, config: { ...previous.config, appearance: result.appearance } }
                    : previous
            )
            enqueueSnackbar(t('metahubs:layouts.appearance.applyLatestSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            const message = isVersionConflict(error)
                ? tAppearance('errors.versionConflict')
                : resolveApiErrorMessage(error, t('metahubs:layouts.appearance.actionError'))
            enqueueSnackbar(message, { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(
                queryClient,
                APPEARANCE_MUTATION_KEY,
                metahubsQueryKeys.layouts(variables.metahubId),
                metahubsQueryKeys.layoutDetail(variables.metahubId, variables.layoutId),
                metahubsQueryKeys.detail(variables.metahubId)
            )
        }
    })
}

export interface CreateThemePresetParams {
    metahubId: string
    data: CreateThemePresetInput
}

export function useCreateThemePreset() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: [...PRESET_MUTATION_KEY, 'create'],
        mutationFn: async ({ metahubId, data }: CreateThemePresetParams) => themePresetsApi.createThemePreset(metahubId, data),
        onSuccess: () => {
            enqueueSnackbar(t('metahubs:layouts.appearance.createSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(resolveApiErrorMessage(error, t('metahubs:layouts.appearance.actionError')), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(queryClient, PRESET_MUTATION_KEY, metahubsQueryKeys.themePresets(variables.metahubId))
        }
    })
}

export interface CopyThemePresetParams {
    metahubId: string
    presetId: string
    data: CopyThemePresetInput
}

export function useCopyThemePreset() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')

    return useMutation({
        mutationKey: [...PRESET_MUTATION_KEY, 'copy'],
        mutationFn: async ({ metahubId, presetId, data }: CopyThemePresetParams) =>
            themePresetsApi.copyThemePreset(metahubId, presetId, data),
        onSuccess: () => {
            enqueueSnackbar(t('metahubs:layouts.appearance.copySuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            enqueueSnackbar(resolveApiErrorMessage(error, t('metahubs:layouts.appearance.actionError')), { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(queryClient, PRESET_MUTATION_KEY, metahubsQueryKeys.themePresets(variables.metahubId))
        }
    })
}

/** Archive (active preset) or delete (archived preset) through the DELETE route. */
export function useDeleteThemePreset() {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const { t } = useTranslation('metahubs')
    const { t: tAppearance } = useTranslation('appearance')

    return useMutation({
        mutationKey: [...PRESET_MUTATION_KEY, 'delete'],
        mutationFn: async ({ metahubId, presetId, expectedVersion }: { metahubId: string; presetId: string; expectedVersion: number }) =>
            themePresetsApi.deleteThemePreset(metahubId, presetId, expectedVersion),
        onSuccess: () => {
            enqueueSnackbar(t('metahubs:layouts.appearance.deleteSuccess'), { variant: 'success' })
        },
        onError: (error: Error) => {
            const apiError = error as { response?: { data?: { code?: string } } }
            const message =
                apiError?.response?.data?.code === 'THEME_PRESET_IN_USE'
                    ? tAppearance('errors.inUse')
                    : resolveApiErrorMessage(error, t('metahubs:layouts.appearance.actionError'))
            enqueueSnackbar(message, { variant: 'error' })
        },
        onSettled: (_data, _error, variables) => {
            safeInvalidateQueriesInactive(queryClient, PRESET_MUTATION_KEY, metahubsQueryKeys.themePresets(variables.metahubId))
        }
    })
}
