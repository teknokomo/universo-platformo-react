/**
 * Universo Platformo | Metahub Settings Page
 *
 * Tabbed UI for managing metahub settings.
 * Reuses TemplateMainCard, ViewHeaderMUI, useDebouncedSearch
 * from @universo-react/template-mui.
 */

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Tabs, Tab, Typography, Stack, Button, Divider, Skeleton, IconButton, Tooltip, Alert, Chip } from '@mui/material'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import SaveIcon from '@mui/icons-material/Save'
import { useTranslation } from 'react-i18next'
import { useSnackbar } from 'notistack'
import { buildEntitySurfaceSettingKey, DASHBOARD_LAYOUT_WIDGETS, METAHUB_SETTINGS_TABS } from '@universo-react/types'
import type { DashboardLayoutWidgetKey } from '@universo-react/types'

// project imports
import { TemplateMainCard as MainCard, EmptyListState, APIEmptySVG, useDebouncedSearch, useConfirm } from '@universo-react/template-mui'
import { ViewHeaderMUI as ViewHeader } from '@universo-react/template-mui'

import { useSettings, useUpdateSettings, useResetSetting } from '../hooks/useSettings'
import type { SettingResponse, SettingsRegistryEntry } from '../api/settingsApi'
import SettingControl from './SettingControl'
import CodenameStylePreview from './CodenameStylePreview'
import { getLocalizedContentText } from '../../../utils/localizedInput'
import { listLayoutZoneWidgets, listLayouts, updateLayoutZoneWidgetConfig } from '../../layouts/api'
import InterpretationNetworkWorkspaceWidgetEditorDialog from '../../layouts/ui/InterpretationNetworkWorkspaceWidgetEditorDialog'
import { metahubsQueryKeys } from '../../shared'
import type { MetahubLayout, MetahubLayoutZoneWidget } from '../../../types'

// ─── Constants ───────────────────────────────────────────────────────────────

const SETTING_TABS = [...METAHUB_SETTINGS_TABS, 'layouts']
type SettingTab = string
type LayoutWidgetSettingsItem = {
    layout: MetahubLayout
    widget: MetahubLayoutZoneWidget
}

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

const resolveBaseEntitySettingKey = (key: string): string => {
    const parts = key.split('.')
    if (parts.length < 3 || parts[0] !== 'entity') {
        return key
    }

    const suffix = parts.slice(2).join('.')
    if (suffix.includes('Constant')) {
        return `entity.set.${suffix}`
    }
    if (suffix === 'allowCopy' || suffix === 'allowDelete') {
        return `entity.object.${suffix}`
    }
    if (
        suffix.includes('Component') ||
        suffix.includes('Element') ||
        suffix === 'componentCodenameScope' ||
        suffix === 'allowedComponentTypes'
    ) {
        return `entity.object.${suffix}`
    }

    return key
}

const widgetDefinitionsByKey = new Map(DASHBOARD_LAYOUT_WIDGETS.map((widget) => [widget.key, widget]))

const resolveWidgetLabel = (t: ReturnType<typeof useTranslation<'metahubs'>>['t'], widgetKey: DashboardLayoutWidgetKey): string =>
    t(`layouts.widgets.${widgetKey}`, {
        defaultValue: widgetDefinitionsByKey.has(widgetKey)
            ? widgetKey.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (value) => value.toUpperCase())
            : t('settings.layoutWidgets.unknownWidget', 'Unknown widget')
    })

const extractWidgetSettingsSummary = (widget: MetahubLayoutZoneWidget, t: ReturnType<typeof useTranslation<'metahubs'>>['t']): string => {
    if (widget.widgetKey !== 'interpretationNetworkWorkspace') {
        return t('settings.layoutWidgets.openContextualEditor', 'Open the layout widget editor to change this widget.')
    }

    const config = widget.config ?? {}
    const matrixMode = config.matrixMode === 'independentRows' ? 'independentRows' : 'hierarchicalCells'
    const defaultView = typeof config.defaultMatrixView === 'string' ? config.defaultMatrixView : 'table'
    return t('settings.layoutWidgets.interpretationNetworkSummary', 'Matrix mode: {{matrixMode}}. Default view: {{defaultView}}.', {
        matrixMode: t(`settings.matrix.modes.${matrixMode}`, { defaultValue: matrixMode }),
        defaultView: t(`settings.matrix.views.${defaultView}`, { defaultValue: defaultView })
    })
}

// ─── Component ───────────────────────────────────────────────────────────────

const SettingsPage = () => {
    const { metahubId } = useParams<{ metahubId: string }>()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const { t, i18n } = useTranslation('metahubs')
    const { enqueueSnackbar } = useSnackbar()

    // Data fetching
    const { data, isLoading, isError } = useSettings()
    const updateMutation = useUpdateSettings()
    const resetMutation = useResetSetting()

    // Tabs
    const [activeTab, setActiveTab] = useState<SettingTab>('general')
    const handleTabChange = useCallback((_: React.SyntheticEvent, newValue: SettingTab) => {
        setActiveTab(newValue)
    }, [])

    const layoutsQuery = useQuery({
        queryKey: metahubId
            ? [...metahubsQueryKeys.layoutsList(metahubId, { limit: 100, offset: 0 }), 'settings-aggregate']
            : ['metahub-layout-settings-empty'],
        queryFn: async () => {
            const layoutsResponse = await listLayouts(metahubId!, { limit: 100, offset: 0 })
            const activeLayouts = layoutsResponse.items.filter((layout) => layout.isActive)
            const widgetGroups = await Promise.all(
                activeLayouts.map(async (layout) => {
                    const widgets = await listLayoutZoneWidgets(metahubId!, layout.id)
                    return widgets
                        .filter((widget) => widget.isActive)
                        .map(
                            (widget): LayoutWidgetSettingsItem => ({
                                layout,
                                widget
                            })
                        )
                })
            )
            return widgetGroups.flat()
        },
        enabled: Boolean(metahubId) && activeTab === 'layouts',
        staleTime: 60 * 1000
    })

    const updateWidgetConfigMutation = useMutation({
        mutationFn: async ({ layoutId, widgetId, config }: { layoutId: string; widgetId: string; config: Record<string, unknown> }) => {
            const response = await updateLayoutZoneWidgetConfig(metahubId!, layoutId, widgetId, config)
            return response.data.item
        },
        onSuccess: async (_data, variables) => {
            if (!metahubId) return
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.layoutZoneWidgets(metahubId, variables.layoutId) }),
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.layoutsRoot(metahubId) })
            ])
            await layoutsQuery.refetch()
            enqueueSnackbar(t('settings.layoutWidgets.saved', 'Widget settings saved'), { variant: 'success' })
        },
        onError: () => {
            enqueueSnackbar(t('settings.layoutWidgets.saveError', 'Failed to save widget settings'), { variant: 'error' })
        }
    })

    // Local form state — tracks user modifications (key → new value)
    const [localChanges, setLocalChanges] = useState<Record<string, unknown>>({})

    // Search — client-side filtering with debounce
    const [searchFilter, setSearchFilter] = useState('')
    const [editingLayoutWidget, setEditingLayoutWidget] = useState<LayoutWidgetSettingsItem | null>(null)
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
        registryTabs.add('layouts')
        const orderedTabs = data.meta?.tabOrder?.length ? data.meta.tabOrder : SETTING_TABS
        return [
            ...orderedTabs.filter((tab): tab is SettingTab => registryTabs.has(tab)),
            ...SETTING_TABS.filter((tab) => !orderedTabs.includes(tab) && registryTabs.has(tab))
        ]
    }, [data?.registry, data?.meta?.tabOrder])

    const resolveTabLabel = useCallback(
        (tab: string): string => {
            const metadataLabel = data?.meta?.tabLabels?.[tab]
            const resolvedLabel = getLocalizedContentText(metadataLabel as Parameters<typeof getLocalizedContentText>[0], i18n.language, '')
            if (resolvedLabel) {
                return resolvedLabel
            }

            return t(`settings.tabs.${tab}`, { defaultValue: tab })
        },
        [data?.meta?.tabLabels, i18n.language, t]
    )

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
        const effectiveAllowComponentDelete = effectiveVal(buildEntitySurfaceSettingKey('objectCollection', 'allowComponentDelete'), true)
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

        // Show allowDeleteLastDisplayComponent only when component deletion is enabled
        if (effectiveAllowComponentDelete !== true) {
            entries = entries.filter(
                (entry) => entry.key !== buildEntitySurfaceSettingKey('objectCollection', 'allowDeleteLastDisplayComponent')
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
            const baseKey = resolveBaseEntitySettingKey(entry.key)
            const label = t(`settings.keys.${entry.key}`, {
                defaultValue: t(`settings.keys.${baseKey}`, { defaultValue: entry.key })
            }).toLowerCase()
            const description = t(`settings.keys.${entry.key}.description`, {
                defaultValue: t(`settings.keys.${baseKey}.description`, { defaultValue: '' })
            }).toLowerCase()
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

    const handleOpenWidgetEditor = useCallback(
        (item: LayoutWidgetSettingsItem) => {
            navigate(`/metahub/${metahubId}/resources/layouts/${item.layout.id}`)
        },
        [metahubId, navigate]
    )

    const handleToggleInterpretationNetworkSplitPane = useCallback(
        (item: LayoutWidgetSettingsItem, enabled: boolean) => {
            updateWidgetConfigMutation.mutate({
                layoutId: item.layout.id,
                widgetId: item.widget.id,
                config: {
                    ...(item.widget.config ?? {}),
                    splitPane: { enabled }
                }
            })
        },
        [updateWidgetConfigMutation]
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
                        <Tab key={tab} label={resolveTabLabel(tab)} value={tab} />
                    ))}
                </Tabs>
            </Box>

            {/* Content */}
            <Box data-testid='metahub-settings-content' sx={{ py: 2 }}>
                {activeTab === 'layouts' ? (
                    layoutsQuery.isLoading ? (
                        <Stack spacing={2}>
                            {[1, 2, 3].map((i) => (
                                <Skeleton key={i} variant='rectangular' height={84} sx={{ borderRadius: 1 }} />
                            ))}
                        </Stack>
                    ) : layoutsQuery.isError ? (
                        <Alert severity='error'>{t('settings.layoutWidgets.loadError', 'Failed to load layout widget settings.')}</Alert>
                    ) : (layoutsQuery.data ?? []).length === 0 ? (
                        <Alert severity='info'>
                            {t('settings.layoutWidgets.empty', 'No active layout widgets with configurable settings were found.')}
                        </Alert>
                    ) : (
                        <Stack spacing={0} divider={<Divider />}>
                            {(layoutsQuery.data ?? []).map((item) => {
                                const layoutTitle = getLocalizedContentText(item.layout.name, i18n.language, item.layout.id)
                                const widgetLabel = resolveWidgetLabel(t, item.widget.widgetKey)
                                const splitPaneEnabled =
                                    item.widget.widgetKey === 'interpretationNetworkWorkspace'
                                        ? (item.widget.config?.splitPane as { enabled?: boolean } | undefined)?.enabled ?? true
                                        : null

                                return (
                                    <Box
                                        key={`${item.layout.id}:${item.widget.id}`}
                                        sx={{
                                            py: 2,
                                            display: 'flex',
                                            alignItems: { xs: 'stretch', md: 'center' },
                                            flexDirection: { xs: 'column', md: 'row' },
                                            gap: 2
                                        }}
                                    >
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Stack direction='row' spacing={1} alignItems='center' sx={{ mb: 0.5, flexWrap: 'wrap' }}>
                                                <Typography variant='subtitle2'>{widgetLabel}</Typography>
                                                <Chip
                                                    size='small'
                                                    label={t(`layouts.zones.${item.widget.zone}`, {
                                                        defaultValue: item.widget.zone
                                                    })}
                                                />
                                            </Stack>
                                            <Typography variant='body2' color='text.secondary'>
                                                {t('settings.layoutWidgets.layoutLabel', 'Layout: {{layout}}', { layout: layoutTitle })}
                                            </Typography>
                                            <Typography variant='body2' color='text.secondary'>
                                                {extractWidgetSettingsSummary(item.widget, t)}
                                            </Typography>
                                        </Box>

                                        <Stack
                                            direction={{ xs: 'column', sm: 'row' }}
                                            spacing={1}
                                            alignItems={{ xs: 'stretch', sm: 'center' }}
                                        >
                                            {splitPaneEnabled !== null ? (
                                                <SettingControl
                                                    settingKey={`layout.widget.${item.widget.id}.splitPane`}
                                                    valueType='boolean'
                                                    value={splitPaneEnabled}
                                                    onChange={(value) => handleToggleInterpretationNetworkSplitPane(item, value === true)}
                                                    disabled={updateWidgetConfigMutation.isPending}
                                                />
                                            ) : null}
                                            {item.widget.widgetKey === 'interpretationNetworkWorkspace' ? (
                                                <Button variant='contained' onClick={() => setEditingLayoutWidget(item)}>
                                                    {t('settings.layoutWidgets.editSettings', 'Edit settings')}
                                                </Button>
                                            ) : null}
                                            <Button variant='outlined' onClick={() => handleOpenWidgetEditor(item)}>
                                                {t('settings.layoutWidgets.openEditor', 'Open in layout')}
                                            </Button>
                                        </Stack>
                                    </Box>
                                )
                            })}
                        </Stack>
                    )
                ) : isLoading ? (
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
                                            <Typography variant='subtitle2'>
                                                {t(`settings.keys.${entry.key}`, {
                                                    defaultValue: t(`settings.keys.${resolveBaseEntitySettingKey(entry.key)}`, {
                                                        defaultValue: entry.key
                                                    })
                                                })}
                                            </Typography>
                                            {isLocallyModified && (
                                                <Typography variant='caption' color='info.main' sx={{ fontStyle: 'italic' }}>
                                                    •
                                                </Typography>
                                            )}
                                        </Stack>
                                        <Typography variant='body2' color='text.secondary'>
                                            {t(`settings.keys.${entry.key}.description`, {
                                                defaultValue: t(`settings.keys.${resolveBaseEntitySettingKey(entry.key)}.description`, {
                                                    defaultValue: ''
                                                })
                                            })}
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

                {editingLayoutWidget?.widget.widgetKey === 'interpretationNetworkWorkspace' ? (
                    <InterpretationNetworkWorkspaceWidgetEditorDialog
                        open
                        config={editingLayoutWidget.widget.config}
                        metahubId={metahubId}
                        layoutId={editingLayoutWidget.layout.id}
                        widgetId={editingLayoutWidget.widget.id}
                        showSharedBehavior={false}
                        showScopeVisibility={false}
                        onSave={(config) => {
                            updateWidgetConfigMutation.mutate({
                                layoutId: editingLayoutWidget.layout.id,
                                widgetId: editingLayoutWidget.widget.id,
                                config: config as Record<string, unknown>
                            })
                            setEditingLayoutWidget(null)
                        }}
                        onCancel={() => setEditingLayoutWidget(null)}
                    />
                ) : null}

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
