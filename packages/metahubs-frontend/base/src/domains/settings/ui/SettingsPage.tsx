/**
 * Universo Platformo | Metahub Settings Page
 *
 * Tabbed UI for managing metahub settings.
 * Reuses TemplateMainCard, ViewHeaderMUI, useDebouncedSearch
 * from @universo/template-mui.
 */

import { useState, useMemo, useCallback, useEffect } from 'react'
import { Box, Tabs, Tab, Typography, Stack, Button, Divider, Skeleton, IconButton, Tooltip, Alert } from '@mui/material'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import SaveIcon from '@mui/icons-material/Save'
import { useTranslation } from 'react-i18next'
import { useSnackbar } from 'notistack'
import { buildEntitySurfaceSettingKey, METAHUB_SETTINGS_TABS, type SettingsTab as MetahubSettingsTab } from '@universo/types'

// project imports
import { TemplateMainCard as MainCard, EmptyListState, APIEmptySVG, useDebouncedSearch, useConfirm } from '@universo/template-mui'
import { ViewHeaderMUI as ViewHeader } from '@universo/template-mui'

import { useSettings, useUpdateSettings, useResetSetting } from '../hooks/useSettings'
import type { SettingResponse, SettingsRegistryEntry } from '../api/settingsApi'
import SettingControl from './SettingControl'
import CodenameStylePreview from './CodenameStylePreview'

// ─── Constants ───────────────────────────────────────────────────────────────

const SETTING_TABS = METAHUB_SETTINGS_TABS
type SettingTab = MetahubSettingsTab

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract the effective value from the `{ _value: ... }` envelope. */
function extractValue(setting: SettingResponse): unknown {
    const raw = setting.value as Record<string, unknown>
    return '_value' in raw ? raw._value : raw
}

/** Build a `{ _value: ... }` envelope for the backend. */
function wrapValue(val: unknown): Record<string, unknown> {
    return { _value: val }
}

/** Compare values against default to avoid showing "reset" for already-default persisted values. */
function isSameAsDefault(value: unknown, defaultValue: unknown): boolean {
    try {
        return JSON.stringify(value) === JSON.stringify(defaultValue)
    } catch {
        return Object.is(value, defaultValue)
    }
}

// ─── Component ───────────────────────────────────────────────────────────────

const SettingsPage = () => {
    const { t } = useTranslation('metahubs')
    const { enqueueSnackbar } = useSnackbar()

    // Data fetching
    const { data, isLoading, isError } = useSettings()
    const updateMutation = useUpdateSettings()
    const resetMutation = useResetSetting()

    // Local form state — tracks user modifications (key → new value)
    const [localChanges, setLocalChanges] = useState<Record<string, unknown>>({})

    // Tabs
    const [activeTab, setActiveTab] = useState<SettingTab>('general')
    const handleTabChange = useCallback((_: React.SyntheticEvent, newValue: SettingTab) => {
        setActiveTab(newValue)
    }, [])

    // Search — client-side filtering with debounce
    const [searchFilter, setSearchFilter] = useState('')
    const { handleSearchChange } = useDebouncedSearch({
        onSearchChange: setSearchFilter,
        delay: 300
    })

    // Confirmation dialog (Promise-based)
    const { confirm } = useConfirm()

    // ── Derived data ─────────────────────────────────────────────────────

    const visibleTabs = useMemo(() => {
        if (!data?.registry) return SETTING_TABS

        const registryTabs = new Set(data.registry.map((entry) => entry.tab))
        return SETTING_TABS.filter((tab) => registryTabs.has(tab))
    }, [data?.registry])

    useEffect(() => {
        if (visibleTabs.length > 0 && !visibleTabs.includes(activeTab)) {
            setActiveTab(visibleTabs[0])
        }
    }, [activeTab, visibleTabs])

    /** Registry entries for the active tab, sorted by sortOrder */
    const tabRegistry = useMemo(() => {
        if (!data?.registry) return []
        return data.registry.filter((r) => r.tab === activeTab).sort((a, b) => a.sortOrder - b.sortOrder)
    }, [data?.registry, activeTab])

    /** Map of key → SettingResponse for quick lookup */
    const settingsMap = useMemo(() => {
        if (!data?.settings) return new Map<string, SettingResponse>()
        return new Map(data.settings.map((s) => [s.key, s]))
    }, [data?.settings])

    /** Filtered registry entries (client-side search + conditional visibility) */
    const filteredRegistry = useMemo(() => {
        /** Helper: get effective value (local change → DB → provided default). */
        const effectiveVal = (key: string, defaultValue: unknown): unknown => {
            if (key in localChanges) return localChanges[key]
            const setting = settingsMap.get(key)
            if (setting) {
                const raw = setting.value as Record<string, unknown>
                return '_value' in raw ? raw._value : raw
            }
            return defaultValue
        }

        const effectiveAlphabet = effectiveVal('general.codenameAlphabet', 'en-ru')
        const effectiveAllowMixed = effectiveVal('general.codenameAllowMixedAlphabets', false)
        const effectiveAutoReformat = effectiveVal('general.codenameAutoReformat', true)
        const effectiveAllowAttributeDelete = effectiveVal(buildEntitySurfaceSettingKey('linkedCollection', 'allowAttributeDelete'), true)
        const effectiveAllowTreeEntityNesting = effectiveVal(buildEntitySurfaceSettingKey('treeEntity', 'allowNesting'), true)
        const hasHubNesting = data?.meta?.hasHubNesting === true

        let entries = tabRegistry

        // Hide allowMixed when alphabet is not 'en-ru' (mixing is only meaningful for en-ru)
        if (effectiveAlphabet !== 'en-ru') {
            entries = entries.filter(
                (entry) => entry.key !== 'general.codenameAllowMixedAlphabets' && entry.key !== 'general.codenameAutoConvertMixedAlphabets'
            )
        }

        // Hide autoConvertMixed when mixing is already allowed
        if (effectiveAllowMixed === true) {
            entries = entries.filter((entry) => entry.key !== 'general.codenameAutoConvertMixedAlphabets')
        }

        // Hide requireReformat when autoReformat is on (auto-conversion supersedes the requirement)
        if (effectiveAutoReformat === true) {
            entries = entries.filter((entry) => entry.key !== 'general.codenameRequireReformat')
        }

        // Show allowDeleteLastDisplayAttribute only when attribute deletion is enabled
        if (effectiveAllowAttributeDelete !== true) {
            entries = entries.filter(
                (entry) => entry.key !== buildEntitySurfaceSettingKey('linkedCollection', 'allowDeleteLastDisplayAttribute')
            )
        }

        // Show one-shot reset nesting action while nesting is disabled OR any nesting still exists.
        const shouldShowResetNesting =
            effectiveAllowTreeEntityNesting !== true ||
            hasHubNesting ||
            effectiveVal(buildEntitySurfaceSettingKey('treeEntity', 'resetNestingOnce'), false) === true
        if (!shouldShowResetNesting) {
            entries = entries.filter((entry) => entry.key !== buildEntitySurfaceSettingKey('treeEntity', 'resetNestingOnce'))
        }

        if (!searchFilter) return entries
        const lower = searchFilter.toLowerCase()
        return entries.filter((entry) => {
            const label = t(`settings.keys.${entry.key}`, { defaultValue: entry.key }).toLowerCase()
            const description = t(`settings.keys.${entry.key}.description`, { defaultValue: '' }).toLowerCase()
            return label.includes(lower) || description.includes(lower) || entry.key.toLowerCase().includes(lower)
        })
    }, [tabRegistry, searchFilter, t, localChanges, settingsMap, data?.meta?.hasHubNesting])

    /** Effective value for a setting (local change → DB value → default) */
    const getEffectiveValue = useCallback(
        (entry: SettingsRegistryEntry): unknown => {
            if (entry.key in localChanges) return localChanges[entry.key]
            const setting = settingsMap.get(entry.key)
            if (setting) return extractValue(setting)
            return entry.defaultValue
        },
        [localChanges, settingsMap]
    )

    /** Get effective value for any setting by key (local change → DB value → provided default) */
    const getEffectiveValueByKey = useCallback(
        (key: string, defaultValue: unknown): unknown => {
            if (key in localChanges) return localChanges[key]
            const setting = settingsMap.get(key)
            if (setting) return extractValue(setting)
            return defaultValue
        },
        [localChanges, settingsMap]
    )

    /** Check if there are unsaved local changes */
    const hasChanges = Object.keys(localChanges).length > 0

    // ── Handlers ─────────────────────────────────────────────────────────

    const handleValueChange = useCallback((key: string, newValue: unknown) => {
        setLocalChanges((prev) => ({ ...prev, [key]: newValue }))
    }, [])

    const handleSave = useCallback(async () => {
        const entries = Object.entries(localChanges).map(([key, val]) => ({
            key,
            value: wrapValue(val)
        }))
        if (entries.length === 0) return

        try {
            await updateMutation.mutateAsync(entries)
            setLocalChanges({})
            enqueueSnackbar(t('settings.saved'), { variant: 'success' })
        } catch {
            enqueueSnackbar(t('errors.generic', { defaultValue: 'Failed to save settings' }), { variant: 'error' })
        }
    }, [localChanges, updateMutation, enqueueSnackbar, t])

    const handleResetRequest = useCallback(
        async (key: string) => {
            const confirmed = await confirm({
                title: t('settings.resetToDefault'),
                description: t('settings.resetConfirm')
            })
            if (!confirmed) return

            try {
                await resetMutation.mutateAsync(key)
                // Remove from local changes too
                setLocalChanges((prev) => {
                    const next = { ...prev }
                    delete next[key]
                    return next
                })
                enqueueSnackbar(t('settings.resetSuccess', { defaultValue: 'Setting reset to default' }), { variant: 'success' })
            } catch {
                enqueueSnackbar(t('errors.generic', { defaultValue: 'Failed to reset setting' }), { variant: 'error' })
            }
        },
        [confirm, resetMutation, enqueueSnackbar, t]
    )

    // ── Render ───────────────────────────────────────────────────────────

    if (isError) {
        return (
            <MainCard disableHeader border={false} shadow={false} contentSX={{ px: 0, py: 0 }} disableContentPadding>
                <Alert severity='error' sx={{ m: 2 }}>
                    {t('errors.generic', { defaultValue: 'Failed to load settings' })}
                </Alert>
            </MainCard>
        )
    }

    return (
        <MainCard disableHeader border={false} shadow={false} contentSX={{ px: 0, py: 0 }} disableContentPadding>
            {/* Header with search */}
            <ViewHeader search title={t('settings.title')} searchPlaceholder={t('settings.search')} onSearchChange={handleSearchChange} />

            {/* Tabs */}
            <Box data-testid='metahub-settings-tabs' sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs value={activeTab} onChange={handleTabChange} variant='scrollable' scrollButtons='auto'>
                    {visibleTabs.map((tab) => (
                        <Tab key={tab} label={t(`settings.tabs.${tab}`)} value={tab} />
                    ))}
                </Tabs>
            </Box>

            {/* Content */}
            <Box data-testid='metahub-settings-content' sx={{ py: 2 }}>
                {isLoading ? (
                    <Stack spacing={2}>
                        {[1, 2, 3].map((i) => (
                            <Skeleton key={i} variant='rectangular' height={60} sx={{ borderRadius: 1 }} />
                        ))}
                    </Stack>
                ) : activeTab === 'common' && filteredRegistry.length === 0 && !searchFilter ? (
                    <Alert severity='info' sx={{ mt: 1 }}>
                        {t('settings.common.placeholder', { defaultValue: 'Common settings will be available in future versions.' })}
                    </Alert>
                ) : filteredRegistry.length === 0 ? (
                    <EmptyListState
                        image={APIEmptySVG}
                        title={searchFilter ? t('common.noSearchResults', { defaultValue: 'No settings match your search' }) : ''}
                    />
                ) : (
                    <Stack spacing={0} divider={<Divider />}>
                        {filteredRegistry.map((entry) => {
                            const setting = settingsMap.get(entry.key)
                            const isDefault = setting ? setting.isDefault : true
                            const effectiveValue = getEffectiveValue(entry)
                            const isAtDefaultValue = isSameAsDefault(effectiveValue, entry.defaultValue)
                            const canResetToDefault = !isDefault && !isAtDefaultValue
                            const isLocallyModified = entry.key in localChanges

                            return (
                                <Box key={entry.key} sx={{ py: 2, display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                                    {/* Label + description */}
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Stack direction='row' alignItems='center' spacing={1}>
                                            <Typography variant='subtitle2'>{t(`settings.keys.${entry.key}`)}</Typography>
                                            {isLocallyModified && (
                                                <Typography variant='caption' color='info.main' sx={{ fontStyle: 'italic' }}>
                                                    •
                                                </Typography>
                                            )}
                                        </Stack>
                                        <Typography variant='body2' color='text.secondary'>
                                            {t(`settings.keys.${entry.key}.description`)}
                                        </Typography>

                                        {/* Codename style preview */}
                                        {entry.key === 'general.codenameStyle' && (
                                            <CodenameStylePreview
                                                style={String(effectiveValue ?? 'pascal-case')}
                                                alphabet={String(getEffectiveValueByKey('general.codenameAlphabet', 'en-ru'))}
                                                allowMixed={Boolean(getEffectiveValueByKey('general.codenameAllowMixedAlphabets', false))}
                                            />
                                        )}
                                        {entry.key === 'general.codenameAlphabet' && (
                                            <CodenameStylePreview
                                                style={String(getEffectiveValueByKey('general.codenameStyle', 'pascal-case'))}
                                                alphabet={String(effectiveValue ?? 'en-ru')}
                                                allowMixed={Boolean(getEffectiveValueByKey('general.codenameAllowMixedAlphabets', false))}
                                            />
                                        )}
                                        {entry.key === 'general.codenameAllowMixedAlphabets' && (
                                            <CodenameStylePreview
                                                style={String(getEffectiveValueByKey('general.codenameStyle', 'pascal-case'))}
                                                alphabet={String(getEffectiveValueByKey('general.codenameAlphabet', 'en-ru'))}
                                                allowMixed={Boolean(effectiveValue)}
                                                showMixedPreviewOnly
                                            />
                                        )}
                                    </Box>

                                    {/* Control */}
                                    <Box sx={{ flexShrink: 0 }}>
                                        <SettingControl
                                            settingKey={entry.key}
                                            valueType={entry.valueType}
                                            value={effectiveValue}
                                            options={entry.options}
                                            onChange={(val) => handleValueChange(entry.key, val)}
                                            disabled={updateMutation.isPending}
                                        />
                                    </Box>

                                    {/* Reset button */}
                                    {canResetToDefault && (
                                        <Tooltip title={t('settings.resetToDefault')}>
                                            <IconButton
                                                size='small'
                                                onClick={() => handleResetRequest(entry.key)}
                                                disabled={resetMutation.isPending}
                                            >
                                                <RestartAltIcon fontSize='small' />
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                </Box>
                            )
                        })}
                    </Stack>
                )}

                {/* Save button */}
                {hasChanges && (
                    <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                        <Button variant='contained' startIcon={<SaveIcon />} onClick={handleSave} disabled={updateMutation.isPending}>
                            {t('settings.save')}
                        </Button>
                    </Box>
                )}
            </Box>
        </MainCard>
    )
}

export default SettingsPage
