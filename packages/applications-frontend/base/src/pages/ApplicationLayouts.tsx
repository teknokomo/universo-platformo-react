import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    FormControlLabel,
    IconButton,
    InputLabel,
    Menu,
    MenuItem,
    Select,
    Stack,
    Switch,
    TextField,
    Typography
} from '@mui/material'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import ToggleOnRoundedIcon from '@mui/icons-material/ToggleOnRounded'
import ToggleOffRoundedIcon from '@mui/icons-material/ToggleOffRounded'
import type { DragEndEvent } from '@dnd-kit/core'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import { LayoutAuthoringList, LayoutAuthoringDetails, LayoutStateChips, ViewHeaderMUI as ViewHeader } from '@universo/template-mui'
import type {
    ApplicationLayout,
    ApplicationLayoutCreate,
    ApplicationLayoutScope,
    ApplicationLayoutWidget,
    ApplicationLayoutWidgetMutation,
    ColumnsContainerConfig,
    DashboardLayoutZone,
    LinkedCollectionRuntimeViewConfig,
    MenuWidgetConfig
} from '@universo/types'
import { DASHBOARD_LAYOUT_ZONES } from '@universo/types'
import {
    extractLinkedCollectionLayoutBehaviorConfig,
    normalizeLinkedCollectionRuntimeViewConfig,
    setLinkedCollectionLayoutBehaviorConfig
} from '@universo/utils'
import { generateUuidV7 } from '@universo/utils'
import {
    copyApplicationLayout,
    createApplicationLayout,
    deleteApplicationLayout,
    deleteApplicationLayoutWidget,
    getApplicationLayout,
    listApplicationLayoutScopes,
    listApplicationLayoutWidgetCatalog,
    listApplicationLayouts,
    moveApplicationLayoutWidget,
    toggleApplicationLayoutWidget,
    upsertApplicationLayoutWidget,
    updateApplicationLayout,
    updateApplicationLayoutWidgetConfig
} from '../api/applications'
import { applicationsQueryKeys } from '../api/queryKeys'
import ApplicationColumnsContainerEditorDialog from '../components/layouts/ApplicationColumnsContainerEditorDialog'
import ApplicationMenuWidgetEditorDialog from '../components/layouts/ApplicationMenuWidgetEditorDialog'
import ApplicationWidgetBehaviorEditorDialog from '../components/layouts/ApplicationWidgetBehaviorEditorDialog'
import { STORAGE_KEYS } from '../constants/storage'
import { useViewPreference } from '../hooks/useViewPreference'

const resolveLocalizedText = (value: unknown, locale: string, fallback: string): string => {
    if (!value || typeof value !== 'object') return fallback
    const record = value as { _primary?: string; locales?: Record<string, { content?: string }>; en?: string; ru?: string }
    const direct = record[locale as 'en' | 'ru']
    if (typeof direct === 'string' && direct.trim()) return direct
    const primary = record._primary ?? 'en'
    return record.locales?.[locale]?.content ?? record.locales?.[primary]?.content ?? record.locales?.en?.content ?? fallback
}

const buildInitialWidgetConfig = (widgetKey: string): Record<string, unknown> => {
    if (widgetKey === 'menuWidget') {
        return { items: [] }
    }

    if (widgetKey === 'columnsContainer') {
        return {
            columns: [
                { id: generateUuidV7(), width: 6, widgets: [{ widgetKey: 'sessionsChart' }] },
                { id: generateUuidV7(), width: 6, widgets: [{ widgetKey: 'pageViewsChart' }] }
            ]
        }
    }

    return {}
}

type LayoutMenuState = {
    anchorEl: HTMLElement | null
    layout: ApplicationLayout | null
}

const ApplicationLayouts = () => {
    const { applicationId, layoutId } = useParams<{ applicationId: string; layoutId?: string }>()
    const { t, i18n } = useTranslation('applications')
    const { t: tc } = useCommonTranslations()
    const queryClient = useQueryClient()
    const navigate = useNavigate()

    const [view, setView] = useViewPreference(STORAGE_KEYS.LAYOUT_DISPLAY_STYLE)
    const [scopeFilter, setScopeFilter] = useState<string>('all')
    const [searchValue, setSearchValue] = useState('')
    const [menuState, setMenuState] = useState<LayoutMenuState>({ anchorEl: null, layout: null })
    const [createOpen, setCreateOpen] = useState(false)
    const [name, setName] = useState('')
    const [scopeId, setScopeId] = useState<string>('global')
    const [editingLayout, setEditingLayout] = useState<ApplicationLayout | null>(null)
    const [layoutNameEn, setLayoutNameEn] = useState('')
    const [layoutNameRu, setLayoutNameRu] = useState('')
    const [layoutDescriptionEn, setLayoutDescriptionEn] = useState('')
    const [layoutDescriptionRu, setLayoutDescriptionRu] = useState('')
    const [editingWidget, setEditingWidget] = useState<ApplicationLayoutWidget | null>(null)
    const [widgetConfigValue, setWidgetConfigValue] = useState('{}')
    const [widgetConfigError, setWidgetConfigError] = useState<string | null>(null)
    const [menuEditorZone, setMenuEditorZone] = useState<DashboardLayoutZone | null>(null)
    const [columnsEditorZone, setColumnsEditorZone] = useState<DashboardLayoutZone | null>(null)
    const [behaviorEditingWidget, setBehaviorEditingWidget] = useState<ApplicationLayoutWidget | null>(null)

    const scopesQuery = useQuery({
        queryKey: applicationId ? applicationsQueryKeys.layoutScopes(applicationId, i18n.language) : ['application-layout-scopes-empty'],
        queryFn: () => listApplicationLayoutScopes(String(applicationId), i18n.language),
        enabled: Boolean(applicationId)
    })

    const layoutsQuery = useQuery({
        queryKey: applicationId
            ? applicationsQueryKeys.layoutsList(applicationId, {
                  limit: 100,
                  offset: 0,
                  linkedCollectionId: scopeFilter === 'all' ? undefined : scopeFilter === 'global' ? null : scopeFilter
              })
            : ['application-layouts-empty'],
        queryFn: () =>
            listApplicationLayouts(String(applicationId), {
                limit: 100,
                offset: 0,
                linkedCollectionId: scopeFilter === 'all' ? undefined : scopeFilter === 'global' ? null : scopeFilter
            }),
        enabled: Boolean(applicationId)
    })

    const detailQuery = useQuery({
        queryKey:
            applicationId && layoutId ? applicationsQueryKeys.layoutDetail(applicationId, layoutId) : ['application-layout-detail-empty'],
        queryFn: () => getApplicationLayout(String(applicationId), String(layoutId)),
        enabled: Boolean(applicationId && layoutId)
    })

    const widgetCatalogQuery = useQuery({
        queryKey:
            applicationId && layoutId
                ? [...applicationsQueryKeys.layoutZoneWidgets(applicationId, layoutId), 'catalog']
                : ['layout-widget-catalog-empty'],
        queryFn: () => listApplicationLayoutWidgetCatalog(String(applicationId), String(layoutId)),
        enabled: Boolean(applicationId && layoutId)
    })

    const scopesById = useMemo(() => {
        const map = new Map<string, ApplicationLayoutScope>()
        for (const scope of scopesQuery.data ?? []) {
            map.set(scope.id, scope)
        }
        return map
    }, [scopesQuery.data])

    const invalidateLayouts = async () => {
        if (!applicationId) return
        await queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.layouts(applicationId) })
        await queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.applicationDiff(applicationId) })
        await queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.runtimeAll(applicationId) })
        if (layoutId) {
            await queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.layoutDetail(applicationId, layoutId) })
        }
    }

    const createMutation = useMutation({
        mutationFn: (payload: ApplicationLayoutCreate) => createApplicationLayout(String(applicationId), payload),
        onSuccess: async () => {
            setCreateOpen(false)
            setName('')
            await invalidateLayouts()
        }
    })

    const updateMutation = useMutation({
        mutationFn: ({ layout, data }: { layout: ApplicationLayout; data: Partial<ApplicationLayout> }) =>
            updateApplicationLayout(String(applicationId), layout.id, { ...data, expectedVersion: layout.version }),
        onSuccess: invalidateLayouts
    })

    const deleteMutation = useMutation({
        mutationFn: (layout: ApplicationLayout) => deleteApplicationLayout(String(applicationId), layout.id, layout.version),
        onSuccess: invalidateLayouts
    })

    const copyMutation = useMutation({
        mutationFn: (layout: ApplicationLayout) => copyApplicationLayout(String(applicationId), layout.id),
        onSuccess: invalidateLayouts
    })

    const toggleWidgetMutation = useMutation({
        mutationFn: ({ widgetId, isActive }: { widgetId: string; isActive: boolean }) =>
            toggleApplicationLayoutWidget(String(applicationId), String(layoutId), widgetId, { isActive }),
        onSuccess: async () => {
            await invalidateLayouts()
        }
    })

    const addWidgetMutation = useMutation({
        mutationFn: ({
            zone,
            widgetKey,
            config
        }: {
            zone: ApplicationLayoutWidgetMutation['zone']
            widgetKey: ApplicationLayoutWidgetMutation['widgetKey']
            config?: Record<string, unknown>
        }) => upsertApplicationLayoutWidget(String(applicationId), String(layoutId), { zone, widgetKey, config: config ?? {} }),
        onSuccess: async () => {
            await invalidateLayouts()
        }
    })

    const moveWidgetMutation = useMutation({
        mutationFn: ({
            widget,
            targetZone,
            targetIndex
        }: {
            widget: ApplicationLayoutWidget
            targetZone: ApplicationLayoutWidget['zone']
            targetIndex: number
        }) =>
            moveApplicationLayoutWidget(String(applicationId), String(layoutId), {
                widgetId: widget.id,
                targetZone,
                targetIndex,
                expectedVersion: widget.version
            }),
        onSuccess: async () => {
            await invalidateLayouts()
        }
    })

    const deleteWidgetMutation = useMutation({
        mutationFn: (widgetId: string) => deleteApplicationLayoutWidget(String(applicationId), String(layoutId), widgetId),
        onSuccess: async () => {
            await invalidateLayouts()
        }
    })

    const updateWidgetConfigMutation = useMutation({
        mutationFn: ({ widget, config }: { widget: ApplicationLayoutWidget; config: Record<string, unknown> }) =>
            updateApplicationLayoutWidgetConfig(String(applicationId), String(layoutId), widget.id, {
                config,
                expectedVersion: widget.version
            }),
        onSuccess: async () => {
            setEditingWidget(null)
            setWidgetConfigError(null)
            await invalidateLayouts()
        }
    })

    const layouts = useMemo(() => layoutsQuery.data?.items ?? [], [layoutsQuery.data?.items])
    const isLoading = scopesQuery.isLoading || layoutsQuery.isLoading || (Boolean(layoutId) && detailQuery.isLoading)
    const isSchemaNotReady =
        (scopesQuery.error as { response?: { data?: { error?: string } } } | null)?.response?.data?.error === 'APPLICATION_SCHEMA_NOT_READY'

    const filteredLayouts = useMemo(() => {
        const normalizedSearch = searchValue.trim().toLowerCase()
        if (!normalizedSearch) {
            return layouts
        }

        return layouts.filter((layout) => {
            const title = resolveLocalizedText(layout.name, i18n.language, layout.id).toLowerCase()
            const description = resolveLocalizedText(layout.description ?? {}, i18n.language, '').toLowerCase()
            const scopeName = (scopesById.get(layout.scopeId ?? 'global')?.name ?? t('layouts.globalScope', 'Global')).toLowerCase()
            return title.includes(normalizedSearch) || description.includes(normalizedSearch) || scopeName.includes(normalizedSearch)
        })
    }, [i18n.language, layouts, scopesById, searchValue, t])

    const handleCreate = () => {
        const selectedScope = scopesById.get(scopeId)
        createMutation.mutate({
            templateKey: 'dashboard',
            name: { en: name || 'Layout', ru: name || 'Макет' },
            linkedCollectionId: selectedScope?.linkedCollectionId ?? null,
            isActive: true,
            isDefault: false,
            sortOrder: layouts.length + 1,
            config: {}
        })
    }

    const openLayoutEditor = (layout: ApplicationLayout) => {
        setEditingLayout(layout)
        setLayoutNameEn(resolveLocalizedText(layout.name, 'en', ''))
        setLayoutNameRu(resolveLocalizedText(layout.name, 'ru', ''))
        setLayoutDescriptionEn(resolveLocalizedText(layout.description ?? {}, 'en', ''))
        setLayoutDescriptionRu(resolveLocalizedText(layout.description ?? {}, 'ru', ''))
    }

    const handleLayoutSave = () => {
        if (!editingLayout) return
        updateMutation.mutate({
            layout: editingLayout,
            data: {
                name: {
                    en: layoutNameEn || layoutNameRu || editingLayout.id,
                    ru: layoutNameRu || layoutNameEn || editingLayout.id
                },
                description:
                    layoutDescriptionEn || layoutDescriptionRu
                        ? {
                              en: layoutDescriptionEn || layoutDescriptionRu,
                              ru: layoutDescriptionRu || layoutDescriptionEn
                          }
                        : null
            }
        })
        setEditingLayout(null)
    }

    const openWidgetConfigEditor = (widget: ApplicationLayoutWidget) => {
        setEditingWidget(widget)
        setWidgetConfigError(null)
        setWidgetConfigValue(JSON.stringify(widget.config ?? {}, null, 2))
    }

    const handleWidgetConfigSave = () => {
        if (!editingWidget) return
        try {
            const parsed = JSON.parse(widgetConfigValue) as Record<string, unknown>
            setWidgetConfigError(null)
            updateWidgetConfigMutation.mutate({ widget: editingWidget, config: parsed })
        } catch {
            setWidgetConfigError(t('layouts.widgetConfigInvalid', 'Widget configuration must be valid JSON.'))
        }
    }

    const openMenu = (event: React.MouseEvent<HTMLElement>, layout: ApplicationLayout) => {
        event.stopPropagation()
        setMenuState({ anchorEl: event.currentTarget, layout })
    }

    const closeMenu = () => setMenuState({ anchorEl: null, layout: null })

    if (isLoading) {
        return (
            <Stack alignItems='center' justifyContent='center' minHeight={360}>
                <CircularProgress />
            </Stack>
        )
    }

    if (isSchemaNotReady) {
        return (
            <Stack spacing={2} sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto', px: 2 }}>
                <ViewHeader title={t('layouts.title', 'Layouts')} search={false} />
                <Alert severity='info'>
                    {t('layouts.schemaNotReady', 'Create or sync the application schema before managing layouts.')}
                </Alert>
            </Stack>
        )
    }

    if (layoutId && detailQuery.data) {
        const layout = detailQuery.data.item
        const title = resolveLocalizedText(layout.name, i18n.language, layout.id)
        const widgets = detailQuery.data.widgets
        const widgetCatalog = widgetCatalogQuery.data ?? []
        const widgetLabelByKey = Object.fromEntries(
            widgetCatalog.map((item) => [item.key, t(`layouts.widgets.${item.key}`, item.key)])
        ) as Record<string, string>
        const catalogOptions = (scopesQuery.data ?? [])
            .filter((scope) => scope.linkedCollectionId)
            .map((scope) => ({ id: String(scope.linkedCollectionId), label: scope.name }))
        const widgetsByZone = DASHBOARD_LAYOUT_ZONES.reduce<Record<DashboardLayoutZone, ApplicationLayoutWidget[]>>((accumulator, zone) => {
            accumulator[zone] = widgets
                .filter((widget) => widget.zone === zone)
                .slice()
                .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))
            return accumulator
        }, {} as Record<DashboardLayoutZone, ApplicationLayoutWidget[]>)

        const catalogBehaviorConfig = normalizeLinkedCollectionRuntimeViewConfig(extractLinkedCollectionLayoutBehaviorConfig(layout.config))
        const allAssignedWidgetKeys = new Set(widgets.map((item) => item.widgetKey))
        const zoneLabels: Record<DashboardLayoutZone, string> = {
            top: t('layouts.zones.top', 'Top'),
            left: t('layouts.zones.left', 'Left'),
            center: t('layouts.zones.center', 'Center'),
            right: t('layouts.zones.right', 'Right'),
            bottom: t('layouts.zones.bottom', 'Bottom')
        }

        const handleLayoutConfigUpdate = async (nextConfig: Record<string, unknown>) => {
            await updateMutation.mutateAsync({
                layout,
                data: { config: nextConfig }
            })
        }

        const handleViewSettingChange = async (key: string, value: unknown) => {
            await handleLayoutConfigUpdate({ ...(layout.config ?? {}), [key]: value })
        }

        const handleCatalogBehaviorChange = async (patch: Partial<LinkedCollectionRuntimeViewConfig>) => {
            const currentBehaviorConfig = extractLinkedCollectionLayoutBehaviorConfig(layout.config) ?? {}
            await handleLayoutConfigUpdate(
                setLinkedCollectionLayoutBehaviorConfig(layout.config ?? {}, { ...currentBehaviorConfig, ...patch })
            )
        }

        const handleDragEnd = async (event: DragEndEvent) => {
            const { active, over } = event
            if (!active.id || !over?.id) return

            const activeWidgetId = String(active.id)
            const overId = String(over.id)
            if (activeWidgetId === overId) return

            const currentItem = widgets.find((item) => item.id === activeWidgetId)
            if (!currentItem) return

            let targetZone = currentItem.zone
            let targetIndex = 0

            if (overId.startsWith('zone:')) {
                targetZone = overId.replace('zone:', '') as DashboardLayoutZone
                targetIndex = widgetsByZone[targetZone].length
            } else {
                const overItem = widgets.find((item) => item.id === overId)
                if (!overItem) return
                targetZone = overItem.zone
                targetIndex = widgetsByZone[targetZone].findIndex((item) => item.id === overItem.id)
                if (targetIndex < 0) {
                    targetIndex = widgetsByZone[targetZone].length
                }
            }

            const sourceIndex = widgetsByZone[currentItem.zone].findIndex((item) => item.id === currentItem.id)
            if (currentItem.zone === targetZone && sourceIndex === targetIndex) {
                return
            }

            await moveWidgetMutation.mutateAsync({
                widget: currentItem,
                targetZone,
                targetIndex
            })
        }

        const getAvailableWidgetsForZone = (zone: DashboardLayoutZone) =>
            widgetCatalog.filter((item) => item.allowedZones.includes(zone) && (item.multiInstance || !allAssignedWidgetKeys.has(item.key)))

        const getWidgetChipLabel = (widget: ApplicationLayoutWidget): string => {
            const base = widgetLabelByKey[widget.widgetKey] ?? t(`layouts.widgets.${widget.widgetKey}`, widget.widgetKey)

            if (widget.widgetKey === 'menuWidget') {
                const config = widget.config as MenuWidgetConfig | undefined
                const titleValue = config?.title ? resolveLocalizedText(config.title, i18n.language, '') : ''
                return titleValue ? `${base}: ${titleValue}` : base
            }

            if (widget.widgetKey === 'columnsContainer') {
                const config = widget.config as ColumnsContainerConfig | undefined
                if (!config?.columns?.length) return base
                const nestedWidgets = config.columns
                    .flatMap((column) =>
                        (column.widgets ?? []).map((columnWidget) => widgetLabelByKey[columnWidget.widgetKey] ?? columnWidget.widgetKey)
                    )
                    .join(', ')
                return nestedWidgets ? `${base}: ${nestedWidgets}` : base
            }

            if (
                widget.widgetKey === 'moduleViewerWidget' ||
                widget.widgetKey === 'statsViewerWidget' ||
                widget.widgetKey === 'qrCodeWidget'
            ) {
                const config = widget.config as { scriptCodename?: unknown } | undefined
                const scriptCodename = typeof config?.scriptCodename === 'string' ? config.scriptCodename.trim() : ''
                return scriptCodename ? `${base}: ${scriptCodename}` : base
            }

            return base
        }

        const openStructuredWidgetEditor = (widget: ApplicationLayoutWidget) => {
            if (widget.widgetKey === 'menuWidget') {
                setMenuEditorZone(widget.zone)
                setEditingWidget(widget)
                return
            }

            if (widget.widgetKey === 'columnsContainer') {
                setColumnsEditorZone(widget.zone)
                setEditingWidget(widget)
                return
            }

            if (widget.widgetKey === 'detailsTable' || widget.widgetKey === 'detailsTitle') {
                setBehaviorEditingWidget(widget)
                return
            }

            openWidgetConfigEditor(widget)
        }

        const handleAddWidgetRequest = (zone: DashboardLayoutZone, widgetKey: ApplicationLayoutWidgetMutation['widgetKey']) => {
            if (widgetKey === 'menuWidget') {
                setMenuEditorZone(zone)
                setEditingWidget(null)
                return
            }

            if (widgetKey === 'columnsContainer') {
                setColumnsEditorZone(zone)
                setEditingWidget(null)
                return
            }

            addWidgetMutation.mutate({
                zone,
                widgetKey,
                config: buildInitialWidgetConfig(widgetKey)
            })
        }

        return (
            <Stack spacing={2} sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto', px: { xs: 1.5, md: 2 } }}>
                <ViewHeader title={title} description={t('layouts.detailDescription', 'Configure layout widgets.')} search={false} />

                <LayoutStateChips
                    isActive={layout.isActive}
                    isDefault={layout.isDefault}
                    sourceKind={layout.sourceKind}
                    syncState={layout.syncState}
                    labels={{
                        active: t('layouts.active', 'Active'),
                        inactive: t('layouts.inactive', 'Inactive'),
                        default: t('layouts.default', 'Default'),
                        source: {
                            application: t('layouts.source.application', 'Application'),
                            metahub: t('layouts.source.metahub', 'Metahub')
                        },
                        syncState: {
                            clean: t('layouts.state.clean', 'Clean'),
                            local_modified: t('layouts.state.local_modified', 'Modified'),
                            source_updated: t('layouts.state.source_updated', 'Source updated'),
                            conflict: t('layouts.state.conflict', 'Conflict'),
                            source_removed: t('layouts.state.source_removed', 'Source removed'),
                            source_excluded: t('layouts.state.source_excluded', 'Excluded')
                        }
                    }}
                />

                <Alert severity={layout.syncState === 'conflict' ? 'warning' : 'info'}>
                    <Stack spacing={0.5}>
                        <Typography variant='body2'>
                            {t('layouts.detailSourceKind', 'Source: {{source}}', { source: t(`layouts.source.${layout.sourceKind}`) })}
                        </Typography>
                        <Typography variant='body2'>
                            {t('layouts.detailSyncState', 'Sync state: {{state}}', { state: t(`layouts.state.${layout.syncState}`) })}
                        </Typography>
                        {layout.sourceLayoutId ? (
                            <Typography variant='body2'>
                                {t('layouts.detailSourceLayout', 'Source layout id: {{id}}', { id: layout.sourceLayoutId })}
                            </Typography>
                        ) : null}
                    </Stack>
                </Alert>

                <Box data-testid='application-layout-details-content' sx={{ pb: 2, width: '100%' }}>
                    <LayoutAuthoringDetails
                        dragHint={t('layouts.dragHint', 'Drag widgets between zones to change runtime composition.')}
                        emptyZoneLabel={t('layouts.emptyZone', 'No widgets in this zone yet.')}
                        addWidgetLabel={t('layouts.addWidgetAction', 'Add widget')}
                        availableWidgetsLabel={t('layouts.availableWidgets', 'Available widgets')}
                        moveWidgetLabel={t('layouts.moveWidget', 'Move widget')}
                        onDragEnd={handleDragEnd}
                        onAddWidgetRequest={handleAddWidgetRequest}
                        beforeZonesContent={
                            <Stack spacing={2}>
                                <PaperSection
                                    title={
                                        layout.linkedCollectionId
                                            ? t('layouts.catalogBehaviorTitleCatalog', 'Catalog runtime behavior')
                                            : t('layouts.catalogBehaviorTitleGlobal', 'Default catalog runtime behavior')
                                    }
                                    description={
                                        layout.linkedCollectionId
                                            ? t(
                                                  'layouts.catalogBehaviorDescriptionCatalog',
                                                  'This catalog layout overrides the create/search behavior inherited from its global base layout.'
                                              )
                                            : t(
                                                  'layouts.catalogBehaviorDescriptionGlobal',
                                                  'These settings define the default create/search behavior for linkedCollections that use this global layout until a catalog-specific layout overrides it.'
                                              )
                                    }
                                >
                                    <Stack spacing={1.5}>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={catalogBehaviorConfig.showCreateButton}
                                                    onChange={(_, checked) =>
                                                        void handleCatalogBehaviorChange({ showCreateButton: checked })
                                                    }
                                                />
                                            }
                                            label={t('layouts.showCreateButton', 'Show create button')}
                                        />
                                        <FormControl size='small' sx={{ minWidth: 220 }}>
                                            <InputLabel>{t('layouts.searchMode', 'Search mode')}</InputLabel>
                                            <Select
                                                value={catalogBehaviorConfig.searchMode}
                                                label={t('layouts.searchMode', 'Search mode')}
                                                onChange={(event) =>
                                                    void handleCatalogBehaviorChange({
                                                        searchMode: event.target.value as LinkedCollectionRuntimeViewConfig['searchMode']
                                                    })
                                                }
                                            >
                                                <MenuItem value='page-local'>{t('layouts.searchModePageLocal', 'Page-local')}</MenuItem>
                                                <MenuItem value='server'>{t('layouts.searchModeServer', 'Server')}</MenuItem>
                                            </Select>
                                        </FormControl>
                                        <FormControl size='small' sx={{ minWidth: 220 }}>
                                            <InputLabel>{t('layouts.createSurface', 'Create form type')}</InputLabel>
                                            <Select
                                                value={catalogBehaviorConfig.createSurface}
                                                label={t('layouts.createSurface', 'Create form type')}
                                                onChange={(event) =>
                                                    void handleCatalogBehaviorChange({
                                                        createSurface: event.target
                                                            .value as LinkedCollectionRuntimeViewConfig['createSurface']
                                                    })
                                                }
                                            >
                                                <MenuItem value='dialog'>{t('layouts.surfaceDialog', 'Dialog')}</MenuItem>
                                                <MenuItem value='page'>{t('layouts.surfacePage', 'Page')}</MenuItem>
                                            </Select>
                                        </FormControl>
                                        <FormControl size='small' sx={{ minWidth: 220 }}>
                                            <InputLabel>{t('layouts.editSurface', 'Edit form type')}</InputLabel>
                                            <Select
                                                value={catalogBehaviorConfig.editSurface}
                                                label={t('layouts.editSurface', 'Edit form type')}
                                                onChange={(event) =>
                                                    void handleCatalogBehaviorChange({
                                                        editSurface: event.target.value as LinkedCollectionRuntimeViewConfig['editSurface']
                                                    })
                                                }
                                            >
                                                <MenuItem value='dialog'>{t('layouts.surfaceDialog', 'Dialog')}</MenuItem>
                                                <MenuItem value='page'>{t('layouts.surfacePage', 'Page')}</MenuItem>
                                            </Select>
                                        </FormControl>
                                        <FormControl size='small' sx={{ minWidth: 220 }}>
                                            <InputLabel>{t('layouts.copySurface', 'Copy form type')}</InputLabel>
                                            <Select
                                                value={catalogBehaviorConfig.copySurface}
                                                label={t('layouts.copySurface', 'Copy form type')}
                                                onChange={(event) =>
                                                    void handleCatalogBehaviorChange({
                                                        copySurface: event.target.value as LinkedCollectionRuntimeViewConfig['copySurface']
                                                    })
                                                }
                                            >
                                                <MenuItem value='dialog'>{t('layouts.surfaceDialog', 'Dialog')}</MenuItem>
                                                <MenuItem value='page'>{t('layouts.surfacePage', 'Page')}</MenuItem>
                                            </Select>
                                        </FormControl>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={catalogBehaviorConfig.enableRowReordering}
                                                    onChange={(_, checked) =>
                                                        void handleCatalogBehaviorChange({
                                                            enableRowReordering: checked
                                                        })
                                                    }
                                                />
                                            }
                                            label={t('layouts.enableRowReordering', 'Enable row reordering')}
                                        />
                                    </Stack>
                                </PaperSection>

                                <PaperSection
                                    title={t('layouts.viewSettings', 'Application View Settings')}
                                    description={t(
                                        'layouts.viewSettingsDescription',
                                        'Control how the runtime list view behaves for this layout.'
                                    )}
                                >
                                    <Stack spacing={1.5}>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={Boolean(layout.config?.showViewToggle)}
                                                    onChange={(_, checked) => void handleViewSettingChange('showViewToggle', checked)}
                                                />
                                            }
                                            label={t('layouts.showViewToggle', 'Card/table view toggle')}
                                        />
                                        <FormControl size='small' sx={{ minWidth: 180 }}>
                                            <InputLabel>{t('layouts.defaultViewMode', 'Default view mode')}</InputLabel>
                                            <Select
                                                value={(layout.config?.defaultViewMode as string) || 'table'}
                                                label={t('layouts.defaultViewMode', 'Default view mode')}
                                                onChange={(event) => void handleViewSettingChange('defaultViewMode', event.target.value)}
                                            >
                                                <MenuItem value='table'>{t('layouts.viewModeTable', 'Table')}</MenuItem>
                                                <MenuItem value='card'>{t('layouts.viewModeCard', 'Card')}</MenuItem>
                                            </Select>
                                        </FormControl>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={Boolean(layout.config?.showFilterBar)}
                                                    onChange={(_, checked) => void handleViewSettingChange('showFilterBar', checked)}
                                                />
                                            }
                                            label={t('layouts.showFilterBar', 'Search/filter bar')}
                                        />
                                        <FormControl size='small' sx={{ minWidth: 180 }}>
                                            <InputLabel>{t('layouts.cardColumns', 'Card columns')}</InputLabel>
                                            <Select
                                                value={Number(layout.config?.cardColumns) || 3}
                                                label={t('layouts.cardColumns', 'Card columns')}
                                                onChange={(event) =>
                                                    void handleViewSettingChange('cardColumns', Number(event.target.value))
                                                }
                                            >
                                                <MenuItem value={2}>2</MenuItem>
                                                <MenuItem value={3}>3</MenuItem>
                                                <MenuItem value={4}>4</MenuItem>
                                            </Select>
                                        </FormControl>
                                        <FormControl size='small' sx={{ minWidth: 180 }}>
                                            <InputLabel>{t('layouts.rowHeight', 'Row height')}</InputLabel>
                                            <Select
                                                value={String(layout.config?.rowHeight ?? 'compact')}
                                                label={t('layouts.rowHeight', 'Row height')}
                                                onChange={(event) => {
                                                    const value = event.target.value
                                                    const nextValue =
                                                        value === 'compact' ? undefined : value === 'auto' ? 'auto' : Number(value)
                                                    void handleViewSettingChange('rowHeight', nextValue)
                                                }}
                                            >
                                                <MenuItem value='compact'>{t('layouts.rowHeightCompact', 'Compact (default)')}</MenuItem>
                                                <MenuItem value='52'>{t('layouts.rowHeightNormal', 'Normal (52px)')}</MenuItem>
                                                <MenuItem value='auto'>{t('layouts.rowHeightAuto', 'Auto (multi-line)')}</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Stack>
                                </PaperSection>
                            </Stack>
                        }
                        zones={DASHBOARD_LAYOUT_ZONES.map((zone) => ({
                            zone,
                            title: zoneLabels[zone],
                            availableWidgets: getAvailableWidgetsForZone(zone).map((item) => ({
                                key: item.key,
                                label: widgetLabelByKey[item.key] ?? item.key
                            })),
                            items: widgetsByZone[zone].map((widget) => ({
                                id: widget.id,
                                label: getWidgetChipLabel(widget),
                                isActive: widget.isActive,
                                draggable: !moveWidgetMutation.isPending,
                                moveActions: DASHBOARD_LAYOUT_ZONES.filter((targetZone) => targetZone !== widget.zone).map(
                                    (targetZone) => ({
                                        key: `${widget.id}-${targetZone}`,
                                        testId: `layout-widget-move-${widget.id}-${targetZone}`,
                                        label: t('layouts.moveToZone', 'Move to {{zone}}', { zone: zoneLabels[targetZone] }),
                                        onClick: () =>
                                            moveWidgetMutation.mutate({
                                                widget,
                                                targetZone,
                                                targetIndex: widgetsByZone[targetZone].length
                                            })
                                    })
                                ),
                                onEdit: () => openStructuredWidgetEditor(widget),
                                onClick: () => openStructuredWidgetEditor(widget),
                                onRemove: () => deleteWidgetMutation.mutate(widget.id),
                                onToggleActive: (active) =>
                                    toggleWidgetMutation.mutate({
                                        widgetId: widget.id,
                                        isActive: active
                                    }),
                                editTooltip: tc('actions.edit', 'Edit'),
                                removeTooltip: tc('actions.delete', 'Delete'),
                                toggleActiveTooltip: widget.isActive
                                    ? t('layouts.deactivate', 'Deactivate')
                                    : t('layouts.activate', 'Activate')
                            }))
                        }))}
                    />
                </Box>

                <ApplicationMenuWidgetEditorDialog
                    open={Boolean(menuEditorZone)}
                    config={editingWidget?.widgetKey === 'menuWidget' ? (editingWidget.config as MenuWidgetConfig) : null}
                    catalogOptions={catalogOptions}
                    onSave={(config) => {
                        if (!menuEditorZone) return
                        if (editingWidget?.widgetKey === 'menuWidget') {
                            updateWidgetConfigMutation.mutate({
                                widget: editingWidget,
                                config: config as Record<string, unknown>
                            })
                        } else {
                            addWidgetMutation.mutate({
                                zone: menuEditorZone,
                                widgetKey: 'menuWidget',
                                config: config as Record<string, unknown>
                            })
                        }
                        setMenuEditorZone(null)
                        setEditingWidget(null)
                    }}
                    onCancel={() => {
                        setMenuEditorZone(null)
                        setEditingWidget(null)
                    }}
                />

                <ApplicationColumnsContainerEditorDialog
                    open={Boolean(columnsEditorZone)}
                    config={editingWidget?.widgetKey === 'columnsContainer' ? (editingWidget.config as ColumnsContainerConfig) : null}
                    onSave={(config) => {
                        if (!columnsEditorZone) return
                        if (editingWidget?.widgetKey === 'columnsContainer') {
                            updateWidgetConfigMutation.mutate({
                                widget: editingWidget,
                                config: config as Record<string, unknown>
                            })
                        } else {
                            addWidgetMutation.mutate({
                                zone: columnsEditorZone,
                                widgetKey: 'columnsContainer',
                                config: config as Record<string, unknown>
                            })
                        }
                        setColumnsEditorZone(null)
                        setEditingWidget(null)
                    }}
                    onCancel={() => {
                        setColumnsEditorZone(null)
                        setEditingWidget(null)
                    }}
                />

                <ApplicationWidgetBehaviorEditorDialog
                    open={Boolean(behaviorEditingWidget)}
                    config={behaviorEditingWidget?.config as Record<string, unknown> | undefined}
                    onSave={(config) => {
                        if (!behaviorEditingWidget) return
                        updateWidgetConfigMutation.mutate({
                            widget: behaviorEditingWidget,
                            config
                        })
                        setBehaviorEditingWidget(null)
                    }}
                    onCancel={() => setBehaviorEditingWidget(null)}
                />
            </Stack>
        )
    }

    const menuLayout = menuState.layout
    const layoutListItems = filteredLayouts.map((layout) => ({
        id: layout.id,
        title: resolveLocalizedText(layout.name, i18n.language, layout.id),
        description: resolveLocalizedText(layout.description ?? {}, i18n.language, ''),
        meta: scopesById.get(layout.scopeId ?? 'global')?.name ?? t('layouts.globalScope', 'Global'),
        statusContent: (
            <LayoutStateChips
                isActive={layout.isActive}
                isDefault={layout.isDefault}
                sourceKind={layout.sourceKind}
                syncState={layout.syncState}
                labels={{
                    active: t('layouts.active', 'Active'),
                    inactive: t('layouts.inactive', 'Inactive'),
                    default: t('layouts.default', 'Default'),
                    source: {
                        application: t('layouts.source.application', 'Application'),
                        metahub: t('layouts.source.metahub', 'Metahub')
                    },
                    syncState: {
                        clean: t('layouts.state.clean', 'Clean'),
                        local_modified: t('layouts.state.local_modified', 'Modified'),
                        source_updated: t('layouts.state.source_updated', 'Source updated'),
                        conflict: t('layouts.state.conflict', 'Conflict'),
                        source_removed: t('layouts.state.source_removed', 'Source removed'),
                        source_excluded: t('layouts.state.source_excluded', 'Excluded')
                    }
                }}
            />
        ),
        onClick: () => navigate(`/a/${applicationId}/admin/layouts/${layout.id}`),
        rowHref: `/a/${applicationId}/admin/layouts/${layout.id}`,
        headerAction: (
            <Box onClick={(event) => event.stopPropagation()}>
                <IconButton
                    size='small'
                    sx={{ color: 'text.secondary', width: 28, height: 28, p: 0.25 }}
                    onClick={(event) => openMenu(event, layout)}
                >
                    <MoreVertRoundedIcon fontSize='small' />
                </IconButton>
            </Box>
        ),
        rowAction: (
            <IconButton size='small' onClick={(event) => openMenu(event, layout)}>
                <MoreVertRoundedIcon fontSize='small' />
            </IconButton>
        )
    }))

    return (
        <Stack spacing={2} sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto', px: { xs: 1.5, md: 2 } }}>
            <LayoutAuthoringList
                title={t('layouts.title', 'Layouts')}
                description={t('layouts.description', 'Manage application-specific layout configuration.')}
                searchPlaceholder={t('layouts.searchPlaceholder', 'Search layouts...')}
                onSearchChange={(event) => setSearchValue(event.target.value)}
                headerExtras={
                    <FormControl size='small' sx={{ minWidth: 220 }}>
                        <InputLabel>{t('layouts.scope', 'Scope')}</InputLabel>
                        <Select
                            value={scopeFilter}
                            label={t('layouts.scope', 'Scope')}
                            onChange={(event) => setScopeFilter(event.target.value)}
                        >
                            <MenuItem value='all'>{t('layouts.allScopes', 'All')}</MenuItem>
                            {(scopesQuery.data ?? []).map((scope) => (
                                <MenuItem key={scope.id} value={scope.id}>
                                    {scope.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                }
                primaryAction={{ label: t('layouts.create', 'Create layout'), onClick: () => setCreateOpen(true) }}
                viewMode={view as 'card' | 'list'}
                onViewModeChange={(mode) => setView(mode)}
                cardViewTitle={tc('cardView', 'Card view')}
                listViewTitle={tc('listView', 'List view')}
                loading={false}
                items={layoutListItems}
                error={layoutsQuery.isError}
                errorTitle={t('layouts.loadError', 'Failed to load layouts.')}
                retryLabel={tc('actions.retry', 'Retry')}
                emptyTitle={t('layouts.empty', 'No layouts found')}
                metaColumnLabel={t('layouts.scope', 'Scope')}
                statusColumnLabel={t('layouts.status', 'Status')}
                listContentTestId='application-layouts-list-content'
            />

            <Menu
                open={Boolean(menuState.anchorEl)}
                anchorEl={menuState.anchorEl}
                onClose={closeMenu}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <MenuItem
                    onClick={() => {
                        if (menuLayout) {
                            navigate(`/a/${applicationId}/admin/layouts/${menuLayout.id}`)
                        }
                        closeMenu()
                    }}
                >
                    <SettingsRoundedIcon fontSize='small' style={{ marginRight: 8 }} />
                    {t('actions.open', 'Open')}
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        if (menuLayout) {
                            openLayoutEditor(menuLayout)
                        }
                        closeMenu()
                    }}
                >
                    <EditRoundedIcon fontSize='small' style={{ marginRight: 8 }} />
                    {tc('actions.edit', 'Edit')}
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        if (menuLayout) {
                            copyMutation.mutate(menuLayout)
                        }
                        closeMenu()
                    }}
                >
                    <ContentCopyRoundedIcon fontSize='small' style={{ marginRight: 8 }} />
                    {tc('actions.copy', 'Copy')}
                </MenuItem>
                <Divider />
                <MenuItem
                    disabled={!menuLayout?.isActive || Boolean(menuLayout?.isDefault)}
                    onClick={() => {
                        if (menuLayout) {
                            updateMutation.mutate({
                                layout: menuLayout,
                                data: { isDefault: true }
                            })
                        }
                        closeMenu()
                    }}
                >
                    <StarRoundedIcon fontSize='small' style={{ marginRight: 8 }} />
                    {t('layouts.makeDefault', 'Make default')}
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        if (menuLayout) {
                            updateMutation.mutate({
                                layout: menuLayout,
                                data: { isActive: !menuLayout.isActive }
                            })
                        }
                        closeMenu()
                    }}
                >
                    {menuLayout?.isActive ? (
                        <ToggleOffRoundedIcon fontSize='small' style={{ marginRight: 8 }} />
                    ) : (
                        <ToggleOnRoundedIcon fontSize='small' style={{ marginRight: 8 }} />
                    )}
                    {menuLayout?.isActive ? t('layouts.deactivate', 'Deactivate') : t('layouts.activate', 'Activate')}
                </MenuItem>
                <Divider />
                <MenuItem
                    onClick={() => {
                        if (menuLayout) {
                            deleteMutation.mutate(menuLayout)
                        }
                        closeMenu()
                    }}
                    sx={{ color: 'error.main' }}
                >
                    <DeleteRoundedIcon fontSize='small' style={{ marginRight: 8 }} />
                    {tc('actions.delete', 'Delete')}
                </MenuItem>
            </Menu>

            <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth='sm'>
                <DialogTitle>{t('layouts.create', 'Create layout')}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            label={t('layouts.name', 'Name')}
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            fullWidth
                        />
                        <FormControl fullWidth>
                            <InputLabel>{t('layouts.scope', 'Scope')}</InputLabel>
                            <Select
                                value={scopeId}
                                label={t('layouts.scope', 'Scope')}
                                onChange={(event) => setScopeId(event.target.value)}
                            >
                                {(scopesQuery.data ?? []).map((scope) => (
                                    <MenuItem key={scope.id} value={scope.id}>
                                        {scope.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateOpen(false)}>{tc('actions.cancel', 'Cancel')}</Button>
                    <Button onClick={handleCreate} variant='contained' disabled={createMutation.isPending}>
                        {t('layouts.create', 'Create layout')}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(editingLayout)} onClose={() => setEditingLayout(null)} fullWidth maxWidth='sm'>
                <DialogTitle>{tc('actions.edit', 'Edit')}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            label='Name (EN)'
                            value={layoutNameEn}
                            onChange={(event) => setLayoutNameEn(event.target.value)}
                            fullWidth
                        />
                        <TextField
                            label='Name (RU)'
                            value={layoutNameRu}
                            onChange={(event) => setLayoutNameRu(event.target.value)}
                            fullWidth
                        />
                        <TextField
                            label='Description (EN)'
                            value={layoutDescriptionEn}
                            onChange={(event) => setLayoutDescriptionEn(event.target.value)}
                            fullWidth
                            multiline
                            minRows={2}
                        />
                        <TextField
                            label='Description (RU)'
                            value={layoutDescriptionRu}
                            onChange={(event) => setLayoutDescriptionRu(event.target.value)}
                            fullWidth
                            multiline
                            minRows={2}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditingLayout(null)}>{tc('actions.cancel', 'Cancel')}</Button>
                    <Button onClick={handleLayoutSave} variant='contained' disabled={updateMutation.isPending}>
                        {tc('actions.save', 'Save')}
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(editingWidget)} onClose={() => setEditingWidget(null)} fullWidth maxWidth='md'>
                <DialogTitle>
                    {editingWidget ? `${tc('actions.edit', 'Edit')}: ${editingWidget.widgetKey}` : tc('actions.edit', 'Edit')}
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={1} sx={{ mt: 1 }}>
                        <Typography variant='body2' color='text.secondary'>
                            {t('layouts.widgetEditorDescription', 'Edit the widget configuration for advanced cases.')}
                        </Typography>
                        <TextField
                            multiline
                            minRows={16}
                            fullWidth
                            value={widgetConfigValue}
                            onChange={(event) => setWidgetConfigValue(event.target.value)}
                            error={Boolean(widgetConfigError)}
                            helperText={widgetConfigError}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditingWidget(null)}>{tc('actions.cancel', 'Cancel')}</Button>
                    <Button onClick={handleWidgetConfigSave} variant='contained' disabled={updateWidgetConfigMutation.isPending}>
                        {tc('actions.save', 'Save')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Stack>
    )
}

function PaperSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
    return (
        <Card variant='outlined' sx={{ borderRadius: 1 }}>
            <CardContent>
                <Typography variant='subtitle1' sx={{ mb: 1.5 }}>
                    {title}
                </Typography>
                <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
                    {description}
                </Typography>
                {children}
            </CardContent>
        </Card>
    )
}

export default ApplicationLayouts
