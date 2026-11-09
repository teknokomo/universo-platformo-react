import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Paper, Typography } from '@mui/material'
import { useSnackbar } from 'notistack'
import { resolveEffectiveThemeTokens } from '@universo-react/theme'
import { useTranslation } from 'react-i18next'
import {
    ThemeAppearancePanel,
    ThemePresetManagerDialog,
    generatePresetCodename,
    toManagerItem,
    toPresetOption,
    type ThemePresetManagerItem
} from '@universo-react/template-mui'
import { themeAppearanceSchema, type ThemeAppearanceDraft } from '@universo-react/types'

import type { MetahubLayout } from '../../../types'
import { metahubsQueryKeys } from '../../shared'
import {
    useApplyLatestLayoutAppearance,
    useApplyLayoutAppearance,
    useCopyThemePreset,
    useCreateThemePreset,
    useDeleteThemePreset,
    useResetLayoutAppearance,
    useThemePresetsQuery
} from '../hooks/useThemePresets'
import { exportThemePreset } from '../api/themePresets'

type LayoutAppearanceSectionProps = {
    metahubId: string
    layoutId: string
    layout?: MetahubLayout
    canManageLayouts: boolean
}

const TEST_ID_PREFIX = 'metahub-appearance'

/**
 * Authoring surface for the cross-template layout appearance (mode, preset,
 * overrides). Saves through the dedicated appearance PATCH so the server
 * re-resolves tokens; the preset library dialog manages metahub-scoped presets.
 */
export function LayoutAppearanceSection({ metahubId, layoutId, layout, canManageLayouts }: LayoutAppearanceSectionProps) {
    const { t } = useTranslation('metahubs')
    const { t: tAppearance } = useTranslation('appearance')
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()

    const appearance = useMemo(() => {
        const parsed = themeAppearanceSchema.safeParse(layout?.config?.appearance)
        return parsed.success ? parsed.data : null
    }, [layout?.config?.appearance])

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

    const presetsQuery = useThemePresetsQuery(metahubId)
    const applyAppearanceMutation = useApplyLayoutAppearance()
    const resetAppearanceMutation = useResetLayoutAppearance()
    const applyLatestMutation = useApplyLatestLayoutAppearance()
    const createPresetMutation = useCreateThemePreset()
    const copyPresetMutation = useCopyThemePreset()
    const deletePresetMutation = useDeleteThemePreset()

    const presetOptions = useMemo(() => {
        const fileOptions = (presetsQuery.data?.file ?? []).map((preset) => toPresetOption(preset, 'file'))
        const dbOptions = (presetsQuery.data?.presets ?? []).map((preset) => toPresetOption(preset, 'metahub'))
        return [...fileOptions, ...dbOptions]
    }, [presetsQuery.data])

    const managerItems = useMemo(() => {
        const fileItems = (presetsQuery.data?.file ?? []).map((preset) => toManagerItem(preset, 'file'))
        const dbItems = (presetsQuery.data?.presets ?? []).map((preset) => toManagerItem(preset, 'metahub'))
        return [...fileItems, ...dbItems]
    }, [presetsQuery.data])

    if (!layout) return null

    const saving = applyAppearanceMutation.isPending || resetAppearanceMutation.isPending || applyLatestMutation.isPending
    const managerBusy = createPresetMutation.isPending || copyPresetMutation.isPending || deletePresetMutation.isPending

    const handleSave = () => {
        if (!draft) return
        applyAppearanceMutation.mutate({
            metahubId,
            layoutId,
            data: { appearance: { mode: draft.mode, preset: draft.preset, overrides: draft.overrides }, expectedVersion: layout.version }
        })
    }

    const handleCreatePreset = () => {
        // The layout always renders an effective theme — the applied snapshot
        // or the built-in universo-default fallback (TZ §11.4) — so capturing
        // it as a new theme always has a truthful token source.
        const tokens = resolveEffectiveThemeTokens(appearance?.resolved.tokens)
        if (!tokens) {
            enqueueSnackbar(t('layouts.appearance.actionError'), { variant: 'error' })
            return
        }
        createPresetMutation.mutate({
            metahubId,
            data: {
                codename: generatePresetCodename(`layout-${appearance?.preset?.id ?? 'universo-default'}`),
                name: {
                    en: t('layouts.appearance.newPresetName', { lng: 'en', defaultValue: 'Custom theme' }),
                    ru: t('layouts.appearance.newPresetName', { lng: 'ru', defaultValue: 'Своя тема' })
                },
                tokens
            }
        })
    }

    const handleExportPreset = async (item: ThemePresetManagerItem) => {
        try {
            await exportThemePreset(metahubId, item.id)
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
                disabled={!canManageLayouts}
                showApplyLatest={Boolean(appearance)}
                sourceUnavailable={false}
                onSave={handleSave}
                onReset={() => resetAppearanceMutation.mutate({ metahubId, layoutId, expectedVersion: layout.version })}
                onApplyLatest={() => applyLatestMutation.mutate({ metahubId, layoutId, expectedVersion: layout.version })}
                onManagePresets={() => setManagerOpen(true)}
            />
            <ThemePresetManagerDialog
                open={managerOpen}
                onClose={() => setManagerOpen(false)}
                testIdPrefix={TEST_ID_PREFIX}
                items={managerItems}
                loading={presetsQuery.isLoading}
                loadError={presetsQuery.isError}
                busy={managerBusy}
                onCreate={handleCreatePreset}
                onCopy={(item) =>
                    copyPresetMutation.mutate({
                        metahubId,
                        presetId: item.id,
                        data: { presetId: item.id, codename: generatePresetCodename(`${item.codename}-copy`) }
                    })
                }
                onArchive={(item) => deletePresetMutation.mutate({ metahubId, presetId: item.id, expectedVersion: item.version })}
                onDelete={(item) => deletePresetMutation.mutate({ metahubId, presetId: item.id, expectedVersion: item.version })}
                onExport={(item) => void handleExportPreset(item)}
                onRetry={() => {
                    void presetsQuery.refetch()
                    void queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.themePresets(metahubId) })
                }}
            />
        </Paper>
    )
}

export default LayoutAppearanceSection
