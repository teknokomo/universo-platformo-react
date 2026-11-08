import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Paper, Stack, Typography } from '@mui/material'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import {
    ThemeAppearancePanel,
    ThemePresetManagerDialog,
    generatePresetCodename,
    toManagerItem,
    toPresetOption,
    type ThemePresetManagerItem
} from '@universo-react/template-mui'
import { extractAxiosError } from '@universo-react/utils'
import { resolveEffectiveThemeTokens } from '@universo-react/theme'
import { themeAppearanceSchema, type ApplicationLayout, type ThemeAppearanceDraft, type ThemePresetRef } from '@universo-react/types'

import {
    applyLatestLayoutAppearance,
    applyLayoutAppearance,
    copyApplicationThemePreset,
    createApplicationThemePreset,
    deleteApplicationThemePreset,
    exportApplicationThemePreset,
    listApplicationThemePresets,
    resetLayoutAppearance,
    type ApplicationLayoutAppearanceMutationResult
} from '../../api/applications'
import { applicationsQueryKeys, invalidateApplicationLayoutsQueries, invalidateApplicationRuntimeQueries } from '../../api/queryKeys'

type AppearanceSectionProps = {
    applicationId: string
    layout: ApplicationLayout
    canManage: boolean
}

const TEST_ID_PREFIX = 'application-appearance'

/**
 * Authoring surface for the cross-template layout appearance. Inherited
 * metahub presets render read-only resolved tokens; re-resolution requires the
 * copy-to-application action (Pinned Decision 14).
 */
export function AppearanceSection({ applicationId, layout, canManage }: AppearanceSectionProps) {
    const { t } = useTranslation('applications')
    const { t: tAppearance } = useTranslation('appearance')
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()

    const appearance = useMemo(() => {
        const parsed = themeAppearanceSchema.safeParse(layout.config?.appearance)
        return parsed.success ? parsed.data : null
    }, [layout.config])

    // Recreate the editable draft only when the persisted appearance itself
    // changes, so refetches do not wipe in-progress overrides.
    const appearanceDraftKey = useMemo(
        () => (appearance ? JSON.stringify({ mode: appearance.mode, preset: appearance.preset, overrides: appearance.overrides }) : ''),
        [appearance]
    )
    const [draft, setDraft] = useState<ThemeAppearanceDraft | null>(null)
    useEffect(() => {
        setDraft(appearance ? { mode: appearance.mode, preset: appearance.preset, overrides: appearance.overrides } : null)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [appearanceDraftKey])

    const [managerOpen, setManagerOpen] = useState(false)

    const presetsQuery = useQuery({
        queryKey: applicationsQueryKeys.themePresets(applicationId),
        queryFn: () => listApplicationThemePresets(applicationId),
        enabled: Boolean(applicationId)
    })

    const resolveActionError = (error: unknown, fallback: string): string => {
        const apiError = extractAxiosError(error)
        if (apiError.code === 'THEME_PRESET_VERSION_CONFLICT' || apiError.code === 'CONFLICT') {
            return tAppearance('errors.versionConflict')
        }
        if (apiError.code === 'THEME_PRESET_SOURCE_UNAVAILABLE') {
            return tAppearance('sourceUnavailable.warning')
        }
        return apiError.message || fallback
    }

    const invalidateAfterAppearanceChange = async () => {
        await invalidateApplicationLayoutsQueries.all(queryClient, applicationId)
        await queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.applicationDiff(applicationId) })
        await invalidateApplicationRuntimeQueries.all(queryClient, applicationId)
    }

    const patchLayoutDetailCache = (result: ApplicationLayoutAppearanceMutationResult) => {
        queryClient.setQueryData<{ item: ApplicationLayout; widgets: unknown[] }>(
            applicationsQueryKeys.layoutDetail(applicationId, layout.id),
            (previous) => {
                if (!previous?.item) return previous
                const { appearance: nextAppearance } = result
                const nextConfig = { ...previous.item.config }
                if (nextAppearance) nextConfig.appearance = nextAppearance
                else delete nextConfig.appearance
                return { ...previous, item: { ...previous.item, version: result.version, config: nextConfig } }
            }
        )
    }

    const applyAppearanceMutation = useMutation({
        mutationFn: (data: { appearance: ThemeAppearanceDraft; expectedVersion: number }) =>
            applyLayoutAppearance(applicationId, layout.id, data),
        onSuccess: (result) => {
            patchLayoutDetailCache(result)
            enqueueSnackbar(t('layouts.appearance.saveSuccess'), { variant: 'success' })
        },
        onError: (error: unknown) => {
            enqueueSnackbar(resolveActionError(error, t('layouts.appearance.actionError')), { variant: 'error' })
        },
        onSettled: () => {
            void invalidateAfterAppearanceChange()
        }
    })

    const resetAppearanceMutation = useMutation({
        mutationFn: () => resetLayoutAppearance(applicationId, layout.id, layout.version),
        onSuccess: (result) => {
            patchLayoutDetailCache(result)
            enqueueSnackbar(t('layouts.appearance.resetSuccess'), { variant: 'success' })
        },
        onError: (error: unknown) => {
            enqueueSnackbar(resolveActionError(error, t('layouts.appearance.actionError')), { variant: 'error' })
        },
        onSettled: () => {
            void invalidateAfterAppearanceChange()
        }
    })

    const applyLatestMutation = useMutation({
        mutationFn: () => applyLatestLayoutAppearance(applicationId, layout.id, layout.version),
        onSuccess: (result) => {
            patchLayoutDetailCache(result)
            enqueueSnackbar(t('layouts.appearance.applyLatestSuccess'), { variant: 'success' })
        },
        onError: (error: unknown) => {
            enqueueSnackbar(resolveActionError(error, t('layouts.appearance.actionError')), { variant: 'error' })
        },
        onSettled: () => {
            void invalidateAfterAppearanceChange()
        }
    })

    /** Pinned Decision 14: snapshot the inherited resolved tokens as an application preset, then rebind. */
    const copyToApplicationMutation = useMutation({
        mutationFn: async () => {
            if (!appearance?.resolved.tokens) throw new Error('THEME_APPEARANCE_RESOLVED_UNAVAILABLE')
            const created = await createApplicationThemePreset(applicationId, {
                codename: generatePresetCodename(`layout-${layout.id.slice(0, 8)}-copy`),
                name: {
                    en: t('layouts.appearance.copyPresetName', { lng: 'en', defaultValue: 'Layout theme copy' }),
                    ru: t('layouts.appearance.copyPresetName', { lng: 'ru', defaultValue: 'Копия темы макета' })
                },
                tokens: appearance.resolved.tokens,
                // Pinned Decision 14 provenance: the source is the inherited
                // metahub preset — recorded as a string (no cross-schema FK).
                basePresetCodename: `metahub:${appearance.preset.id}`
            })
            const presetRef: ThemePresetRef = { source: 'application', id: created.id, version: created.version }
            return applyLayoutAppearance(applicationId, layout.id, {
                appearance: { mode: appearance.mode, preset: presetRef, overrides: {} },
                expectedVersion: layout.version
            })
        },
        onSuccess: (result) => {
            patchLayoutDetailCache(result)
            enqueueSnackbar(t('layouts.appearance.copySuccess'), { variant: 'success' })
        },
        onError: (error: unknown) => {
            enqueueSnackbar(resolveActionError(error, t('layouts.appearance.copyError')), { variant: 'error' })
        },
        onSettled: () => {
            void invalidateAfterAppearanceChange()
            void queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.themePresets(applicationId) })
        }
    })

    const createPresetMutation = useMutation({
        mutationFn: (data: { codename: string; name: Record<string, string>; tokens: unknown }) =>
            createApplicationThemePreset(applicationId, data),
        onSuccess: () => {
            enqueueSnackbar(t('layouts.appearance.createSuccess'), { variant: 'success' })
        },
        onError: (error: unknown) => {
            enqueueSnackbar(resolveActionError(error, t('layouts.appearance.actionError')), { variant: 'error' })
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.themePresets(applicationId) })
        }
    })

    const copyPresetMutation = useMutation({
        mutationFn: ({ presetId, codename }: { presetId: string; codename: string }) =>
            copyApplicationThemePreset(applicationId, presetId, { presetId, codename }),
        onSuccess: () => {
            enqueueSnackbar(t('layouts.appearance.createSuccess'), { variant: 'success' })
        },
        onError: (error: unknown) => {
            enqueueSnackbar(resolveActionError(error, t('layouts.appearance.actionError')), { variant: 'error' })
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.themePresets(applicationId) })
        }
    })

    const deletePresetMutation = useMutation({
        mutationFn: ({ presetId, expectedVersion }: { presetId: string; expectedVersion: number }) =>
            deleteApplicationThemePreset(applicationId, presetId, expectedVersion),
        onSuccess: () => {
            enqueueSnackbar(t('layouts.appearance.deleteSuccess'), { variant: 'success' })
        },
        onError: (error: unknown) => {
            const apiError = extractAxiosError(error)
            enqueueSnackbar(
                apiError.code === 'THEME_PRESET_IN_USE'
                    ? tAppearance('errors.inUse')
                    : resolveActionError(error, t('layouts.appearance.actionError')),
                { variant: 'error' }
            )
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.themePresets(applicationId) })
        }
    })

    const presetOptions = useMemo(() => {
        const fileOptions = (presetsQuery.data?.file ?? []).map((preset) => toPresetOption(preset, 'file'))
        const dbOptions = (presetsQuery.data?.presets ?? []).map((preset) => toPresetOption(preset, 'application'))
        return [...fileOptions, ...dbOptions]
    }, [presetsQuery.data])

    const managerItems = useMemo(() => {
        const fileItems = (presetsQuery.data?.file ?? []).map((preset) => toManagerItem(preset, 'file'))
        const dbItems = (presetsQuery.data?.presets ?? []).map((preset) => toManagerItem(preset, 'application'))
        return [...fileItems, ...dbItems]
    }, [presetsQuery.data])

    const saving = applyAppearanceMutation.isPending || resetAppearanceMutation.isPending || applyLatestMutation.isPending
    const managerBusy = createPresetMutation.isPending || copyPresetMutation.isPending || deletePresetMutation.isPending
    const sourceUnavailable = appearance?.preset.source === 'metahub'

    const handleSave = () => {
        if (!draft) return
        applyAppearanceMutation.mutate({
            appearance: { mode: draft.mode, preset: draft.preset, overrides: draft.overrides },
            expectedVersion: layout.version
        })
    }

    const handleExportPreset = async (item: ThemePresetManagerItem) => {
        try {
            await exportApplicationThemePreset(applicationId, item.id)
            enqueueSnackbar(t('layouts.appearance.exportSuccess'), { variant: 'success' })
        } catch {
            enqueueSnackbar(t('layouts.appearance.exportError'), { variant: 'error' })
        }
    }

    return (
        <Paper variant='outlined' sx={{ p: 2 }} data-testid={`${TEST_ID_PREFIX}-section`}>
            <Typography variant='subtitle1' sx={{ mb: 1.5 }}>
                {tAppearance('title')}
            </Typography>
            <ThemeAppearancePanel
                testIdPrefix={TEST_ID_PREFIX}
                presets={presetOptions}
                appearance={appearance}
                draft={draft}
                onDraftChange={setDraft}
                saving={saving}
                disabled={!canManage}
                showApplyLatest={Boolean(appearance)}
                sourceUnavailable={sourceUnavailable}
                onSave={handleSave}
                onReset={() => resetAppearanceMutation.mutate()}
                onApplyLatest={() => applyLatestMutation.mutate()}
                onManagePresets={() => setManagerOpen(true)}
            />
            {sourceUnavailable && canManage ? (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 2, alignItems: { sm: 'center' } }}>
                    <Button
                        variant='outlined'
                        size='small'
                        disabled={copyToApplicationMutation.isPending}
                        onClick={() => copyToApplicationMutation.mutate()}
                        data-testid={`${TEST_ID_PREFIX}-copy-to-application`}
                    >
                        {tAppearance('actions.copyToApplication')}
                    </Button>
                </Stack>
            ) : null}
            <ThemePresetManagerDialog
                open={managerOpen}
                onClose={() => setManagerOpen(false)}
                testIdPrefix={TEST_ID_PREFIX}
                items={managerItems}
                loading={presetsQuery.isLoading}
                loadError={presetsQuery.isError}
                busy={managerBusy}
                onCreate={() => {
                    // The layout always renders an effective theme — the applied
                    // snapshot or the built-in universo-default fallback — so
                    // capturing it as a new theme always has a truthful source.
                    const tokens = resolveEffectiveThemeTokens(appearance?.resolved.tokens)
                    if (!tokens) {
                        enqueueSnackbar(t('layouts.appearance.actionError'), { variant: 'error' })
                        return
                    }
                    createPresetMutation.mutate({
                        codename: generatePresetCodename(`layout-${layout.id.slice(0, 8)}-theme`),
                        name: {
                            en: t('layouts.appearance.newPresetName', { lng: 'en', defaultValue: 'Custom theme' }),
                            ru: t('layouts.appearance.newPresetName', { lng: 'ru', defaultValue: 'Своя тема' })
                        },
                        tokens
                    })
                }}
                onCopy={(item) =>
                    copyPresetMutation.mutate({
                        presetId: item.id,
                        codename: generatePresetCodename(`${item.codename}-copy`)
                    })
                }
                onArchive={(item) => deletePresetMutation.mutate({ presetId: item.id, expectedVersion: item.version })}
                onDelete={(item) => deletePresetMutation.mutate({ presetId: item.id, expectedVersion: item.version })}
                onExport={(item) => void handleExportPreset(item)}
                onRetry={() => void presetsQuery.refetch()}
            />
        </Paper>
    )
}

export default AppearanceSection
