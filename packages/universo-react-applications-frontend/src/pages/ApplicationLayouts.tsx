import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Box, CircularProgress, FormControl, IconButton, InputLabel, MenuItem, Select, Stack, Typography } from '@mui/material'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import type { DragEndEvent } from '@dnd-kit/core'
import { useTranslation } from 'react-i18next'
import { useSnackbar } from 'notistack'
import { useCommonTranslations } from '@universo-react/i18n'
import {
    LayoutAuthoringList,
    LayoutAuthoringDetails,
    LayoutStateChips,
    ViewHeaderMUI as ViewHeader,
    normalizeSideMenuConfig,
    useConfirm
} from '@universo-react/template-mui'
import type {
    ApplicationLayout,
    ApplicationLayoutCreate,
    ApplicationLayoutScope,
    ApplicationLayoutWidget,
    ApplicationLayoutWidgetMutation,
    ColumnsContainerConfig,
    DashboardLayoutZone,
    ObjectCollectionRuntimeViewConfig,
    MenuWidgetConfig,
    DashboardSideMenuConfig
} from '@universo-react/types'
import { DASHBOARD_LAYOUT_ZONES } from '@universo-react/types'
import {
    extractObjectCollectionLayoutBehaviorConfig,
    extractAxiosError,
    normalizeObjectCollectionRuntimeViewConfig,
    setObjectCollectionLayoutBehaviorConfig
} from '@universo-react/utils'
import { generateUuidV7 } from '@universo-react/utils'
import {
    copyApplicationLayout,
    createApplicationLayout,
    deleteApplicationLayout,
    deleteApplicationLayoutWidget,
    getApplicationLayout,
    listApplicationLayoutScopes,
    listApplicationLayoutWidgetObject,
    listApplicationLayouts,
    moveApplicationLayoutWidget,
    resetApplicationLayoutConfig,
    resetApplicationLayoutWidgetConfigsBatch,
    toggleApplicationLayoutWidget,
    upsertApplicationLayoutWidget,
    updateApplicationLayout,
    updateApplicationLayoutWidgetConfig
} from '../api/applications'
import { applicationsQueryKeys } from '../api/queryKeys'
import type { InterpretationNetworkMatrixSettings } from './application-settings/MatrixSettingsPanel'
import { STORAGE_KEYS } from '../constants/storage'
import { useViewPreference } from '../hooks/useViewPreference'
import { LayoutRuntimeSettingsPanels } from './application-layouts/LayoutRuntimeSettingsPanels'
import { ApplicationLayoutListDialogs } from './application-layouts/ApplicationLayoutListDialogs'
import { ApplicationLayoutWidgetEditors } from './application-layouts/ApplicationLayoutWidgetEditors'
import { ApplicationLayoutListMenu } from './application-layouts/ApplicationLayoutListMenu'
import { ApplicationMarketingAppearancePanel } from './application-layouts/ApplicationMarketingAppearancePanel'
import {
    mergeInterpretationNetworkMatrixSettings,
    parseInterpretationNetworkMatrixSettings
} from './application-layouts/interpretationNetworkWidgetSettings'

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
        return {
            items: [],
            autoShowAllSections: false,
            maxPrimaryItems: 6,
            overflowLabelKey: 'runtime.menu.more',
            startPage: null,
            workspacePlacement: 'primary'
        }
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

const STRUCTURED_BEHAVIOR_WIDGET_KEYS = new Set([
    'detailsTable',
    'detailsTitle',
    'overviewCards',
    'sessionsChart',
    'pageViewsChart',
    'resourcePreview'
])

const isApplicationCustomizedLayoutWidget = (layout: ApplicationLayout): boolean =>
    layout.sourceKind === 'application' || layout.syncState === 'local_modified'

const isCustomizedWidget = (layout: ApplicationLayout, widget: ApplicationLayoutWidget): boolean =>
    widget.sourceConfig !== undefined
        ? widget.sourceConfig !== null && widget.isCustomized === true
        : isApplicationCustomizedLayoutWidget(layout)

const normalizeEditableSideMenuConfig = (value: unknown): DashboardSideMenuConfig => {
    return normalizeSideMenuConfig(
        (value && typeof value === 'object' && !Array.isArray(value) ? value : undefined) as MenuWidgetConfig['sideMenu']
    )
}

type LayoutMenuState = {
    anchorEl: HTMLElement | null
    layout: ApplicationLayout | null
}

const ApplicationLayouts = () => {
    const { applicationId, layoutId } = useParams<{ applicationId: string; layoutId?: string }>()
    const { t, i18n } = useTranslation('applications')
    const { t: tc } = useCommonTranslations()
    const { enqueueSnackbar } = useSnackbar()
    const { confirm } = useConfirm()
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
    const [menuEditorZone, setMenuEditorZone] = useState<DashboardLayoutZone | null>(null)
    const [columnsEditorZone, setColumnsEditorZone] = useState<DashboardLayoutZone | null>(null)
    const [behaviorEditingWidget, setBehaviorEditingWidget] = useState<ApplicationLayoutWidget | null>(null)
    const [interpretationNetworkEditingWidget, setInterpretationNetworkEditingWidget] = useState<ApplicationLayoutWidget | null>(null)
    const [interpretationNetworkInitialSettings, setInterpretationNetworkInitialSettings] =
        useState<InterpretationNetworkMatrixSettings | null>(null)
    const [interpretationNetworkDraft, setInterpretationNetworkDraft] = useState<InterpretationNetworkMatrixSettings | null>(null)
    const [interpretationNetworkDraftHasChanges, setInterpretationNetworkDraftHasChanges] = useState(false)
    const [workspaceSwitcherEditingWidget, setWorkspaceSwitcherEditingWidget] = useState<ApplicationLayoutWidget | null>(null)
    const layoutDetailQueryKey =
        applicationId && layoutId ? applicationsQueryKeys.layoutDetail(applicationId, layoutId) : ['application-layout-detail-empty']

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
                  scopeEntityId: scopeFilter === 'all' ? undefined : scopeFilter === 'global' ? null : scopeFilter
              })
            : ['application-layouts-empty'],
        queryFn: () =>
            listApplicationLayouts(String(applicationId), {
                limit: 100,
                offset: 0,
                scopeEntityId: scopeFilter === 'all' ? undefined : scopeFilter === 'global' ? null : scopeFilter
            }),
        enabled: Boolean(applicationId)
    })

    const detailQuery = useQuery({
        queryKey: layoutDetailQueryKey,
        queryFn: () => getApplicationLayout(String(applicationId), String(layoutId)),
        enabled: Boolean(applicationId && layoutId)
    })

    const widgetObjectQuery = useQuery({
        queryKey:
            applicationId && layoutId
                ? [...applicationsQueryKeys.layoutZoneWidgets(applicationId, layoutId), 'object']
                : ['layout-widget-object-empty'],
        queryFn: () => listApplicationLayoutWidgetObject(String(applicationId), String(layoutId)),
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
        onError: (error) => {
            const apiError = extractAxiosError(error)
            const message =
                apiError.code === 'APPLICATION_LAYOUT_TEMPLATE_IMMUTABLE'
                    ? t('layouts.templateImmutable', 'A layout template cannot be changed after creation.')
                    : apiError.code === 'APPLICATION_LAYOUT_INVALID'
                    ? t('layouts.invalidRequest', 'The layout data is invalid. Review the fields and try again.')
                    : t('layouts.saveError', 'Failed to save layout settings.')
            enqueueSnackbar(message, { variant: 'error' })
        },
        onSuccess: invalidateLayouts
    })

    const resetMarketingAppearanceMutation = useMutation({
        mutationFn: ({ layout }: { layout: ApplicationLayout }) =>
            resetApplicationLayoutConfig(String(applicationId), layout.id, { expectedVersion: layout.version }),
        onError: (error) => {
            const apiError = extractAxiosError(error)
            const errorCode = apiError.code ?? apiError.message
            const message =
                errorCode === 'APPLICATION_LAYOUT_VERSION_CONFLICT'
                    ? t(
                          'layouts.marketing.resetConflict',
                          'Marketing appearance changed while you were editing. Reload the layout and try again.'
                      )
                    : errorCode === 'APPLICATION_LAYOUT_MARKETING_RESET_NOT_SUPPORTED'
                    ? t('layouts.marketing.resetUnsupported', 'Only marketing page layouts can restore marketing appearance defaults.')
                    : t('layouts.marketing.resetError', 'Failed to restore marketing appearance defaults.')
            enqueueSnackbar(message, { variant: 'error' })
        },
        onSuccess: async () => {
            enqueueSnackbar(t('layouts.marketing.resetSuccess', 'Marketing appearance restored to template defaults.'), {
                variant: 'success'
            })
            await invalidateLayouts()
        }
    })

    const requestMarketingAppearanceReset = async (layout: ApplicationLayout) => {
        if (resetMarketingAppearanceMutation.isPending) return
        const confirmed = await confirm({
            title: t('layouts.marketing.resetTitle', 'Restore marketing page defaults?'),
            description: t(
                'layouts.marketing.resetDescription',
                'This restores the theme, colors, and section visibility for this application layout. Workspace content and metahub records will not change.'
            ),
            confirmButtonName: t('layouts.marketing.resetConfirm', 'Restore defaults'),
            cancelButtonName: tc('actions.cancel', 'Cancel')
        })
        if (confirmed) resetMarketingAppearanceMutation.mutate({ layout })
    }

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
        onMutate: async ({ widget, config }) => {
            await queryClient.cancelQueries({ queryKey: layoutDetailQueryKey })
            const previousDetail = queryClient.getQueryData<ApplicationLayoutDetailResponse>(layoutDetailQueryKey)

            if (previousDetail) {
                queryClient.setQueryData<ApplicationLayoutDetailResponse>(layoutDetailQueryKey, {
                    ...previousDetail,
                    widgets: previousDetail.widgets.map((item) => (item.id === widget.id ? { ...item, config } : item))
                })
            }

            return { previousDetail }
        },
        onError: (error, _variables, context) => {
            if (context?.previousDetail) {
                queryClient.setQueryData(layoutDetailQueryKey, context.previousDetail)
            }
            const apiError = extractAxiosError(error)
            const message =
                apiError.code === 'APPLICATION_INTERPRETATION_NETWORK_NON_SYSTEM_STRUCTURES_EXIST'
                    ? t(
                          'settings.matrix.singleSystemStructuresExist',
                          'Single-system mode cannot be enabled while ordinary Structures exist. Delete them first.'
                      )
                    : apiError.code === 'APPLICATION_INTERPRETATION_NETWORK_METADATA_MISSING'
                    ? t(
                          'settings.matrix.singleSystemMetadataMissing',
                          'Single-system mode cannot be enabled because the Structure metadata is incomplete.'
                      )
                    : t('layouts.interpretationNetworkEditor.saveError', 'Failed to save widget settings')
            enqueueSnackbar(message, { variant: 'error' })
        },
        onSuccess: async () => {
            setEditingWidget(null)
            setBehaviorEditingWidget(null)
            setInterpretationNetworkEditingWidget(null)
            setInterpretationNetworkInitialSettings(null)
            setInterpretationNetworkDraft(null)
            setInterpretationNetworkDraftHasChanges(false)
            await invalidateLayouts()
        }
    })

    const resetWidgetConfigMutation = useMutation({
        mutationFn: (widget: ApplicationLayoutWidget) =>
            resetApplicationLayoutWidgetConfigsBatch(String(applicationId), {
                updates: [
                    {
                        layoutId: String(layoutId),
                        widgetId: widget.id,
                        ...(typeof widget.version === 'number' ? { expectedVersion: widget.version } : {})
                    }
                ]
            }),
        onError: (error) => {
            const apiError = extractAxiosError(error)
            const message =
                apiError.code === 'APPLICATION_INTERPRETATION_NETWORK_NON_SYSTEM_STRUCTURES_EXIST'
                    ? t(
                          'settings.matrix.singleSystemStructuresExist',
                          'Single-system mode cannot be enabled while ordinary Structures exist. Delete them first.'
                      )
                    : apiError.code === 'APPLICATION_INTERPRETATION_NETWORK_METADATA_MISSING'
                    ? t(
                          'settings.matrix.singleSystemMetadataMissing',
                          'Single-system mode cannot be enabled because the Structure metadata is incomplete.'
                      )
                    : apiError.message === 'APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT'
                    ? t(
                          'settings.matrix.resetConflict',
                          'Matrix settings changed while you were editing. Reload the current values and try again.'
                      )
                    : t('settings.matrix.resetError', 'Failed to restore metahub settings')
            enqueueSnackbar(message, { variant: 'error' })
        },
        onSuccess: async () => {
            setInterpretationNetworkEditingWidget(null)
            setInterpretationNetworkInitialSettings(null)
            setInterpretationNetworkDraft(null)
            setInterpretationNetworkDraftHasChanges(false)
            enqueueSnackbar(t('settings.matrix.resetSuccess', 'Metahub settings restored'), { variant: 'success' })
            await invalidateLayouts()
        }
    })

    const layouts = useMemo(() => layoutsQuery.data?.items ?? [], [layoutsQuery.data?.items])
    const applicationTemplateKey = useMemo(
        () =>
            layouts.find((layout) => layout.scopeEntityId == null && layout.isDefault)?.templateKey ??
            layouts.find((layout) => layout.scopeEntityId == null)?.templateKey ??
            layouts[0]?.templateKey ??
            'dashboard',
        [layouts]
    )
    const isLoading = scopesQuery.isLoading || layoutsQuery.isLoading || (Boolean(layoutId) && detailQuery.isLoading)
    const isSchemaNotReady =
        (scopesQuery.error as { response?: { data?: { error?: string } } } | null)?.response?.data?.error === 'APPLICATION_SCHEMA_NOT_READY'

    const filteredLayouts = useMemo(() => {
        const normalizedSearch = searchValue.trim().toLowerCase()
        if (!normalizedSearch) {
            return layouts
        }

        return layouts.filter((layout) => {
            const title = resolveLocalizedText(layout.name, i18n.language, t('layouts.unnamed', 'Untitled layout')).toLowerCase()
            const description = resolveLocalizedText(layout.description ?? {}, i18n.language, '').toLowerCase()
            const scopeName = (scopesById.get(layout.scopeId ?? 'global')?.name ?? t('layouts.globalScope', 'Global')).toLowerCase()
            return title.includes(normalizedSearch) || description.includes(normalizedSearch) || scopeName.includes(normalizedSearch)
        })
    }, [i18n.language, layouts, scopesById, searchValue, t])

    const handleCreate = () => {
        const selectedScope = scopesById.get(scopeId)
        createMutation.mutate({
            templateKey: applicationTemplateKey,
            name: {
                en: name || t('layouts.untitled', 'Untitled layout'),
                ru: name || t('layouts.untitled', 'Untitled layout')
            },
            scopeEntityId: selectedScope?.scopeEntityId ?? null,
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
        const fallbackName = t('layouts.untitled', 'Untitled layout')
        updateMutation.mutate({
            layout: editingLayout,
            data: {
                name: {
                    en: layoutNameEn || layoutNameRu || fallbackName,
                    ru: layoutNameRu || layoutNameEn || fallbackName
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

    const openMenu = (event: React.MouseEvent<HTMLElement>, layout: ApplicationLayout) => {
        event.stopPropagation()
        setMenuState({ anchorEl: event.currentTarget, layout })
    }

    const closeMenu = () => setMenuState({ anchorEl: null, layout: null })

    if (isLoading) {
        return (
            <Stack sx={{ alignItems: 'center', justifyContent: 'center', minHeight: 360 }}>
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
        const widgetObject = widgetObjectQuery.data ?? []
        const widgetLabelByKey = Object.fromEntries(
            widgetObject.map((item) => [item.key, t(`layouts.widgets.${item.key}`, item.key)])
        ) as Record<string, string>
        const sectionOptions = (scopesQuery.data ?? [])
            .filter((scope) => scope.scopeEntityId)
            .map((scope) => ({ id: String(scope.scopeEntityId), label: scope.name }))
        const datasourceSectionOptions = (scopesQuery.data ?? [])
            .filter((scope) => scope.scopeEntityId)
            .map((scope) => ({
                id: String(scope.scopeEntityId),
                label: scope.name,
                codename: resolveLocalizedText(scope.codename ?? {}, 'en', scope.tableName ?? scope.name)
            }))
        const widgetsByZone = DASHBOARD_LAYOUT_ZONES.reduce<Record<DashboardLayoutZone, ApplicationLayoutWidget[]>>((accumulator, zone) => {
            accumulator[zone] = widgets
                .filter((widget) => widget.zone === zone)
                .slice()
                .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))
            return accumulator
        }, {} as Record<DashboardLayoutZone, ApplicationLayoutWidget[]>)

        const objectBehaviorConfig = normalizeObjectCollectionRuntimeViewConfig(extractObjectCollectionLayoutBehaviorConfig(layout.config))
        const sideMenuConfig = normalizeEditableSideMenuConfig(layout.config?.sideMenu)
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

        const handleSideMenuConfigChange = async (patch: Partial<DashboardSideMenuConfig>) => {
            const nextSideMenuConfig = normalizeEditableSideMenuConfig({ ...sideMenuConfig, ...patch })
            await handleViewSettingChange('sideMenu', nextSideMenuConfig)
        }

        const handleObjectBehaviorChange = async (patch: Partial<ObjectCollectionRuntimeViewConfig>) => {
            const currentBehaviorConfig = extractObjectCollectionLayoutBehaviorConfig(layout.config) ?? {}
            await handleLayoutConfigUpdate(
                setObjectCollectionLayoutBehaviorConfig(layout.config ?? {}, { ...currentBehaviorConfig, ...patch })
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
            widgetObject.filter((item) => item.allowedZones.includes(zone) && (item.multiInstance || !allAssignedWidgetKeys.has(item.key)))

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

            if (STRUCTURED_BEHAVIOR_WIDGET_KEYS.has(widget.widgetKey)) {
                setBehaviorEditingWidget(widget)
                return
            }

            if (widget.widgetKey === 'interpretationNetworkWorkspace') {
                const initialSettings = parseInterpretationNetworkMatrixSettings(widget.config)
                setInterpretationNetworkEditingWidget(widget)
                setInterpretationNetworkInitialSettings(initialSettings)
                setInterpretationNetworkDraft(initialSettings)
                setInterpretationNetworkDraftHasChanges(false)
                return
            }

            if (widget.widgetKey === 'workspaceSwitcher') {
                setWorkspaceSwitcherEditingWidget(widget)
                return
            }
        }

        const closeInterpretationNetworkEditor = () => {
            setInterpretationNetworkEditingWidget(null)
            setInterpretationNetworkInitialSettings(null)
            setInterpretationNetworkDraft(null)
            setInterpretationNetworkDraftHasChanges(false)
        }

        const saveInterpretationNetworkEditor = () => {
            if (!interpretationNetworkEditingWidget || !interpretationNetworkDraft) return

            updateWidgetConfigMutation.mutate({
                widget: interpretationNetworkEditingWidget,
                config: mergeInterpretationNetworkMatrixSettings(interpretationNetworkEditingWidget.config, interpretationNetworkDraft)
            })
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
                <ViewHeader
                    title={title}
                    description={
                        layout.templateKey === 'marketing-page'
                            ? t('layouts.marketingDetailDescription', 'Configure the published marketing page appearance.')
                            : t('layouts.detailDescription', 'Configure layout widgets.')
                    }
                    search={false}
                />

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
                            <Typography variant='body2'>{t('layouts.detailSourceLayout', 'Linked to source layout')}</Typography>
                        ) : null}
                    </Stack>
                </Alert>

                <Box data-testid='application-layout-details-content' sx={{ pb: 2, width: '100%' }}>
                    {layout.templateKey === 'marketing-page' ? (
                        <Stack spacing={2}>
                            <ApplicationMarketingAppearancePanel
                                t={t}
                                layout={layout}
                                isSaving={updateMutation.isPending}
                                isResetting={resetMarketingAppearanceMutation.isPending}
                                canManage
                                onChange={(key, value) => void handleViewSettingChange(key, value)}
                                onReset={() => void requestMarketingAppearanceReset(layout)}
                            />
                            <Typography
                                variant='body2'
                                sx={{
                                    color: 'text.secondary'
                                }}
                            >
                                {t(
                                    'layouts.marketing.contentHint',
                                    'Marketing content is edited through standard Object records; dashboard widgets are not used by this template.'
                                )}
                            </Typography>
                        </Stack>
                    ) : (
                        <LayoutAuthoringDetails
                            dragHint={t('layouts.dragHint', 'Drag widgets between zones to change runtime composition.')}
                            emptyZoneLabel={t('layouts.emptyZone', 'No widgets in this zone yet.')}
                            addWidgetLabel={t('layouts.addWidgetAction', 'Add widget')}
                            availableWidgetsLabel={t('layouts.availableWidgets', 'Available widgets')}
                            moveWidgetLabel={t('layouts.moveWidget', 'Move widget')}
                            onDragEnd={handleDragEnd}
                            onAddWidgetRequest={handleAddWidgetRequest}
                            beforeZonesContent={
                                <LayoutRuntimeSettingsPanels
                                    t={t}
                                    layout={layout}
                                    objectBehaviorConfig={objectBehaviorConfig}
                                    sideMenuConfig={sideMenuConfig}
                                    onObjectBehaviorChange={(patch) => void handleObjectBehaviorChange(patch)}
                                    onViewSettingChange={(key, value) => void handleViewSettingChange(key, value)}
                                    onSideMenuConfigChange={(patch) => void handleSideMenuConfigChange(patch)}
                                />
                            }
                            zones={DASHBOARD_LAYOUT_ZONES.map((zone) => ({
                                zone,
                                title: zoneLabels[zone],
                                availableWidgets: getAvailableWidgetsForZone(zone).map((item) => ({
                                    key: item.key,
                                    label: widgetLabelByKey[item.key] ?? item.key
                                })),
                                items: widgetsByZone[zone].map((widget) => {
                                    const label = getWidgetChipLabel(widget)

                                    return {
                                        id: widget.id,
                                        label,
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
                                            : t('layouts.activate', 'Activate'),
                                        editAriaLabel: t('layouts.editWidgetNamed', 'Edit widget: {{label}}', { label }),
                                        removeAriaLabel: t('layouts.removeWidgetNamed', 'Remove widget: {{label}}', { label }),
                                        toggleActiveAriaLabel: widget.isActive
                                            ? t('layouts.deactivateWidgetNamed', 'Deactivate widget: {{label}}', { label })
                                            : t('layouts.activateWidgetNamed', 'Activate widget: {{label}}', { label }),
                                        inheritedLabel:
                                            widget.widgetKey === 'interpretationNetworkWorkspace'
                                                ? isCustomizedWidget(layout, widget)
                                                    ? t('layouts.widgetCustomization.application', 'Customized in application')
                                                    : t('layouts.widgetCustomization.metahub', 'Inherited from metahub')
                                                : undefined
                                    }
                                })
                            }))}
                        />
                    )}
                </Box>

                <ApplicationLayoutWidgetEditors
                    t={t}
                    tc={tc}
                    menuEditorZone={menuEditorZone}
                    columnsEditorZone={columnsEditorZone}
                    editingWidget={editingWidget}
                    behaviorEditingWidget={behaviorEditingWidget}
                    interpretationNetworkEditingWidget={interpretationNetworkEditingWidget}
                    interpretationNetworkInitialSettings={interpretationNetworkInitialSettings}
                    interpretationNetworkDraftHasChanges={interpretationNetworkDraftHasChanges}
                    workspaceSwitcherEditingWidget={workspaceSwitcherEditingWidget}
                    sectionOptions={sectionOptions}
                    datasourceSectionOptions={datasourceSectionOptions}
                    isSavingWidget={updateWidgetConfigMutation.isPending}
                    isResettingWidget={resetWidgetConfigMutation.isPending}
                    isInterpretationNetworkCustomized={
                        interpretationNetworkEditingWidget ? isCustomizedWidget(layout, interpretationNetworkEditingWidget) : false
                    }
                    onSaveMenu={(config) => {
                        if (!menuEditorZone) return
                        if (editingWidget?.widgetKey === 'menuWidget') {
                            updateWidgetConfigMutation.mutate({ widget: editingWidget, config: config as Record<string, unknown> })
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
                    onCancelMenu={() => {
                        setMenuEditorZone(null)
                        setEditingWidget(null)
                    }}
                    onSaveColumns={(config) => {
                        if (!columnsEditorZone) return
                        if (editingWidget?.widgetKey === 'columnsContainer') {
                            updateWidgetConfigMutation.mutate({ widget: editingWidget, config: config as Record<string, unknown> })
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
                    onCancelColumns={() => {
                        setColumnsEditorZone(null)
                        setEditingWidget(null)
                    }}
                    onSaveBehavior={(config) => {
                        if (behaviorEditingWidget) updateWidgetConfigMutation.mutate({ widget: behaviorEditingWidget, config })
                    }}
                    onCancelBehavior={() => setBehaviorEditingWidget(null)}
                    onCloseInterpretationNetwork={closeInterpretationNetworkEditor}
                    onSaveInterpretationNetwork={saveInterpretationNetworkEditor}
                    onSaveInterpretationNetworkSettings={(settings) => {
                        if (!interpretationNetworkEditingWidget) return
                        updateWidgetConfigMutation.mutate({
                            widget: interpretationNetworkEditingWidget,
                            config: mergeInterpretationNetworkMatrixSettings(interpretationNetworkEditingWidget.config, settings)
                        })
                    }}
                    onResetInterpretationNetwork={() => {
                        if (interpretationNetworkEditingWidget) resetWidgetConfigMutation.mutate(interpretationNetworkEditingWidget)
                    }}
                    onInterpretationNetworkDraftChange={(settings, hasChanges) => {
                        setInterpretationNetworkDraft(settings)
                        setInterpretationNetworkDraftHasChanges(hasChanges)
                    }}
                    onCloseWorkspaceSwitcher={() => setWorkspaceSwitcherEditingWidget(null)}
                />
            </Stack>
        )
    }

    const menuLayout = menuState.layout
    const layoutListItems = filteredLayouts.map((layout) => ({
        id: layout.id,
        title: resolveLocalizedText(layout.name, i18n.language, t('layouts.unnamed', 'Untitled layout')),
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

            <ApplicationLayoutListMenu
                t={t}
                tc={tc}
                anchorEl={menuState.anchorEl}
                layout={menuLayout}
                onClose={closeMenu}
                onOpen={(layout) => navigate(`/a/${applicationId}/admin/layouts/${layout.id}`)}
                onEdit={openLayoutEditor}
                onCopy={(layout) => copyMutation.mutate(layout)}
                onMakeDefault={(layout) => updateMutation.mutate({ layout, data: { isDefault: true } })}
                onToggleActive={(layout) => updateMutation.mutate({ layout, data: { isActive: !layout.isActive } })}
                onDelete={(layout) => deleteMutation.mutate(layout)}
            />

            <ApplicationLayoutListDialogs
                t={t}
                tc={tc}
                scopes={scopesQuery.data ?? []}
                templateKey={applicationTemplateKey}
                createOpen={createOpen}
                setCreateOpen={setCreateOpen}
                name={name}
                setName={setName}
                scopeId={scopeId}
                setScopeId={setScopeId}
                onCreate={handleCreate}
                isCreating={createMutation.isPending}
                editingLayout={editingLayout}
                setEditingLayout={setEditingLayout}
                nameEn={layoutNameEn}
                setNameEn={setLayoutNameEn}
                nameRu={layoutNameRu}
                setNameRu={setLayoutNameRu}
                descriptionEn={layoutDescriptionEn}
                setDescriptionEn={setLayoutDescriptionEn}
                descriptionRu={layoutDescriptionRu}
                setDescriptionRu={setLayoutDescriptionRu}
                onSave={handleLayoutSave}
                isSaving={updateMutation.isPending}
            />
        </Stack>
    )
}

export default ApplicationLayouts
