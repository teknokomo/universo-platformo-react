import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Box, CircularProgress, Tab, Tabs } from '@mui/material'
import { RESOURCE_TYPES, collectUnsupportedActiveCapabilityRules, sanitizeApplicationLearningContentSettings } from '@universo-react/types'
import type { ApplicationLearningContentSettings, ResourceType } from '@universo-react/types'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import { extractAxiosError } from '@universo-react/utils'
import {
    TemplateMainCard as MainCard,
    ViewHeaderMUI as ViewHeader,
    PAGE_CONTENT_GUTTER_MX,
    PAGE_TAB_BAR_SX
} from '@universo-react/template-mui'
import {
    AccessSettingsPanel,
    ConnectorsSettingsPanel,
    GeneralSettingsPanel,
    LimitsSettingsPanel,
    type ApplicationCapabilityKey
} from './application-settings/SettingsPanels'
import {
    hasInitializedRuntimeSchema,
    hasLearningContentMaterializedState,
    hasMatrixMaterializedState,
    isActiveMaterializedLayout,
    listInterpretationNetworkWidgets,
    listWritableInterpretationNetworkWidgets,
    normalizeMatrixSettingsForSave,
    parseMatrixSettings,
    sanitizeWidgetConfigForSave,
    type MaterializedApplicationLayoutState
} from './application-settings/applicationLayoutSettingsPolicy'
import { buildRolePoliciesFromMatrix, resolveRolePolicyMatrix } from './application-settings/applicationSettingsRolePolicy'
import { MatrixSettingsPanel, type InterpretationNetworkMatrixSettings } from './application-settings/MatrixSettingsPanel'
import { areInterpretationNetworkMatrixSettingsEqual } from './application-layouts/interpretationNetworkWidgetSettings'
import { ContentSettingsPanel } from './application-settings/ContentSettingsPanel'
import { usePublicEntryWorkspaceSettings } from './application-settings/usePublicEntryWorkspaceSettings'
import { useApplicationDetails } from '../api/useApplicationDetails'
import { applicationsQueryKeys } from '../api/queryKeys'
import {
    getApplicationWorkspaceLimits,
    listApplicationLayoutScopes,
    listApplicationLayouts,
    listApplicationLayoutWidgets,
    resetApplicationLayoutWidgetConfigsBatch,
    updateApplication,
    updateApplicationLayoutWidgetConfigsBatch,
    updateApplicationWorkspaceLimits
} from '../api/applications'
import { DEFAULT_APPLICATION_DIALOG_SETTINGS, sanitizeApplicationDialogSettingsForSave } from '../settings/dialogSettings'
import { toApplicationDisplay, type ApplicationDialogSettings, type ApplicationRole, type ApplicationWorkspaceLimitItem } from '../types'

type SettingsTab = 'general' | 'matrix' | 'learningContent' | 'connectors' | 'access' | 'limits'
type LayoutScopeFilter = string | null | undefined

const loadLayoutsForScope = async (applicationId: string, scopeEntityId: LayoutScopeFilter): Promise<ApplicationLayout[]> => {
    const layouts: ApplicationLayout[] = []
    const limit = 100
    let offset = 0
    let hasMore = true
    while (hasMore) {
        const layoutsResponse = await listApplicationLayouts(applicationId, {
            limit,
            offset,
            sortOrder: 'asc',
            scopeEntityId
        })
        layouts.push(...layoutsResponse.items)
        hasMore = layoutsResponse.pagination.hasMore
        offset += layoutsResponse.items.length
        if (layoutsResponse.items.length === 0) break
    }
    return layouts
}

const ApplicationSettings = () => {
    const { applicationId } = useParams<{ applicationId: string }>()
    const { t, i18n } = useTranslation('applications')
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [activeTab, setActiveTab] = useState<SettingsTab>('general')
    const [generalChanges, setGeneralChanges] = useState<Partial<ApplicationDialogSettings>>({})
    const [visibilityChange, setVisibilityChange] = useState<boolean | undefined>(undefined)
    const [localLimits, setLocalLimits] = useState<Record<string, string>>({})
    const [matrixSettingsOverride, setMatrixSettingsOverride] = useState<InterpretationNetworkMatrixSettings | null>(null)
    const [lastMaterializedLayoutState, setLastMaterializedLayoutState] = useState<MaterializedApplicationLayoutState | undefined>(
        undefined
    )

    const applicationQuery = useApplicationDetails(applicationId || '', {
        enabled: Boolean(applicationId)
    })
    const applicationDisplay = applicationQuery.data ? toApplicationDisplay(applicationQuery.data, i18n.language) : null
    const runtimeSchemaReady = hasInitializedRuntimeSchema(applicationQuery.data?.schemaName, applicationQuery.data?.schemaStatus)
    const supportsWorkspaceLimits = runtimeSchemaReady && applicationQuery.data?.workspacesEnabled === true
    const supportsPublicEntryWorkspace = runtimeSchemaReady && applicationQuery.data?.workspacesEnabled === true
    const publicEntryWorkspace = usePublicEntryWorkspaceSettings({
        applicationId,
        enabled: supportsPublicEntryWorkspace,
        locale: i18n.language
    })

    const materializedLayoutsQuery = useQuery({
        queryKey: applicationId
            ? ['applications', applicationId, 'settings', 'materialized-layouts']
            : ['applications', 'settings', 'missing'],
        queryFn: async (): Promise<MaterializedApplicationLayoutState> => {
            const scopes = await listApplicationLayoutScopes(applicationId!, i18n.language)
            const scopeFilters: LayoutScopeFilter[] = [
                null,
                ...scopes
                    .map((scope) => scope.scopeEntityId)
                    .filter((scopeEntityId): scopeEntityId is string => typeof scopeEntityId === 'string' && scopeEntityId.length > 0)
            ]
            const layoutPages = await Promise.all(scopeFilters.map((scopeEntityId) => loadLayoutsForScope(applicationId!, scopeEntityId)))
            const layouts = [...new Map(layoutPages.flat().map((layout) => [layout.id, layout])).values()]
            const activeLayouts = layouts.filter(isActiveMaterializedLayout)
            const widgetGroups = await Promise.all(
                activeLayouts.map(async (layout) => {
                    const widgets = await listApplicationLayoutWidgets(applicationId!, layout.id)
                    return widgets.map((widget) => ({ ...widget, layout }))
                })
            )
            return {
                layouts,
                widgets: widgetGroups.flat()
            }
        },
        placeholderData: (previous) => previous,
        enabled: Boolean(applicationId) && runtimeSchemaReady
    })
    const layoutCapabilitiesLoading =
        runtimeSchemaReady &&
        (materializedLayoutsQuery.isLoading || materializedLayoutsQuery.isFetching || materializedLayoutsQuery.isPending)
    const materializedLayoutState = materializedLayoutsQuery.data ?? (layoutCapabilitiesLoading ? lastMaterializedLayoutState : undefined)

    const limitsQuery = useQuery({
        queryKey: applicationId
            ? applicationsQueryKeys.settingsLimits(applicationId, i18n.language)
            : ['applications', 'settings', 'missing'],
        queryFn: () => getApplicationWorkspaceLimits(applicationId!, i18n.language),
        enabled: Boolean(applicationId) && activeTab === 'limits' && supportsWorkspaceLimits
    })

    const saveLimitsMutation = useMutation({
        mutationKey: ['applications', 'settings', 'limits', 'update'],
        mutationFn: async (items: ApplicationWorkspaceLimitItem[]) =>
            updateApplicationWorkspaceLimits(
                applicationId!,
                items.map((item) => ({
                    objectId: item.objectId,
                    maxRows:
                        localLimits[item.objectId] === ''
                            ? null
                            : localLimits[item.objectId] !== undefined
                            ? Number(localLimits[item.objectId])
                            : item.maxRows
                }))
            ),
        onSuccess: async () => {
            if (!applicationId) return
            await queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.settingsLimits(applicationId, i18n.language) })
            enqueueSnackbar(t('settings.limitsSaved', 'Limits saved'), { variant: 'success' })
            setLocalLimits({})
        },
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('settings.limitsSaveError', 'Failed to save limits'), { variant: 'error' })
        }
    })

    const saveMatrixMutation = useMutation({
        mutationKey: ['applications', 'settings', 'matrix', 'update'],
        mutationFn: async (settings: InterpretationNetworkMatrixSettings) => {
            const widgets = listWritableInterpretationNetworkWidgets(materializedLayoutState)
            if (widgets.length === 0) {
                throw new Error(t('settings.matrix.widgetMissing', 'Matrix workspace widget is not installed in this application.'))
            }
            const normalizedSettings = normalizeMatrixSettingsForSave(settings)
            const savedWidgets = await updateApplicationLayoutWidgetConfigsBatch(applicationId!, {
                updates: widgets.map((widget) => ({
                    layoutId: widget.layout.id,
                    widgetId: widget.id,
                    config: {
                        ...sanitizeWidgetConfigForSave(widget.config),
                        structureMode: normalizedSettings.structureMode,
                        matrixMode: normalizedSettings.matrixMode,
                        allowedMatrixViews: normalizedSettings.allowedMatrixViews,
                        defaultMatrixView: normalizedSettings.defaultMatrixView,
                        tableProjection: normalizedSettings.tableProjection,
                        breadcrumbDepth: normalizedSettings.breadcrumbDepth,
                        toolbarLayout: normalizedSettings.toolbarLayout,
                        showHierarchicalTableHeaders: normalizedSettings.showHierarchicalTableHeaders,
                        showHierarchicalTableHeaderCard: normalizedSettings.showHierarchicalTableHeaderCard,
                        showMatrixTreeTotalCells: normalizedSettings.showMatrixTreeTotalCells,
                        colorBreadcrumbsByCell: normalizedSettings.colorBreadcrumbsByCell,
                        hierarchyRowMode: normalizedSettings.hierarchyRowMode,
                        positionNumbering: normalizedSettings.positionNumbering,
                        allowNewAxesInCellDialog: normalizedSettings.allowNewAxesInCellDialog,
                        cellStylePolicy: normalizedSettings.cellStylePolicy,
                        splitPane: normalizedSettings.splitPane,
                        templatePanel: normalizedSettings.templatePanel
                    },
                    expectedVersion: widget.version
                }))
            })

            return { savedWidgets, savedSettings: normalizedSettings }
        },
        onSuccess: async ({ savedWidgets, savedSettings }) => {
            if (!applicationId) return
            setMatrixSettingsOverride(savedSettings)
            const savedWidgetsByIdentity = new Map(
                savedWidgets.map((savedWidget) => [`${savedWidget.layoutId ?? ''}:${savedWidget.id}`, savedWidget])
            )
            const savedWidgetsById = new Map(savedWidgets.map((savedWidget) => [savedWidget.id, savedWidget]))
            queryClient.setQueryData<MaterializedApplicationLayoutState>(
                ['applications', applicationId, 'settings', 'materialized-layouts'],
                (current) =>
                    current
                        ? {
                              ...current,
                              widgets: current.widgets.map((widget) => {
                                  const savedWidget =
                                      savedWidgetsByIdentity.get(`${widget.layout.id}:${widget.id}`) ?? savedWidgetsById.get(widget.id)
                                  return savedWidget
                                      ? {
                                            ...widget,
                                            ...savedWidget,
                                            isCustomized: savedWidget.isCustomized ?? true,
                                            config: {
                                                ...widget.config,
                                                ...(savedWidget.config ?? {}),
                                                matrixMode: savedSettings.matrixMode,
                                                allowedMatrixViews: savedSettings.allowedMatrixViews,
                                                defaultMatrixView: savedSettings.defaultMatrixView,
                                                tableProjection: savedSettings.tableProjection,
                                                breadcrumbDepth: savedSettings.breadcrumbDepth,
                                                toolbarLayout: savedSettings.toolbarLayout,
                                                showHierarchicalTableHeaders: savedSettings.showHierarchicalTableHeaders,
                                                showHierarchicalTableHeaderCard: savedSettings.showHierarchicalTableHeaderCard,
                                                showMatrixTreeTotalCells: savedSettings.showMatrixTreeTotalCells,
                                                colorBreadcrumbsByCell: savedSettings.colorBreadcrumbsByCell,
                                                hierarchyRowMode: savedSettings.hierarchyRowMode,
                                                positionNumbering: savedSettings.positionNumbering,
                                                allowNewAxesInCellDialog: savedSettings.allowNewAxesInCellDialog,
                                                cellStylePolicy: savedSettings.cellStylePolicy,
                                                splitPane: savedSettings.splitPane,
                                                templatePanel: savedSettings.templatePanel
                                            },
                                            layout: widget.layout
                                        }
                                      : widget
                              })
                          }
                        : current
            )
            await queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.runtimeAll(applicationId) })
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspace'] })
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspaceMatrix'] })
            enqueueSnackbar(t('settings.matrix.saved', 'Matrix settings saved'), { variant: 'success' })
        },
        onError: async (error: unknown) => {
            setMatrixSettingsOverride(null)
            await materializedLayoutsQuery.refetch({ throwOnError: false }).catch(() => undefined)
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
                    : t('settings.matrix.saveError', 'Failed to save matrix settings')
            enqueueSnackbar(message, { variant: 'error' })
        }
    })

    const resetMatrixMutation = useMutation({
        mutationKey: ['applications', 'settings', 'matrix', 'reset'],
        mutationFn: async () => {
            const widgets = listWritableInterpretationNetworkWidgets(materializedLayoutState).filter(
                (widget) => widget.sourceConfig !== null
            )
            if (widgets.length === 0) {
                throw new Error(t('settings.matrix.resetUnavailable', 'No inherited metahub settings are available.'))
            }
            return resetApplicationLayoutWidgetConfigsBatch(applicationId!, {
                updates: widgets.map((widget) => ({
                    layoutId: widget.layout.id,
                    widgetId: widget.id,
                    expectedVersion: widget.version
                }))
            })
        },
        onSuccess: async () => {
            if (!applicationId) return
            setMatrixSettingsOverride(null)
            await queryClient.invalidateQueries({ queryKey: ['applications', applicationId, 'settings', 'materialized-layouts'] })
            await queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.layouts(applicationId) })
            await queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.runtimeAll(applicationId) })
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspace'] })
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspaceMatrix'] })
            enqueueSnackbar(t('settings.matrix.resetSuccess', 'Metahub settings restored'), { variant: 'success' })
        },
        onError: async (error: unknown) => {
            await materializedLayoutsQuery.refetch({ throwOnError: false }).catch(() => undefined)
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
        }
    })

    const effectiveGeneralSettings = useMemo<ApplicationDialogSettings>(
        () => ({
            ...DEFAULT_APPLICATION_DIALOG_SETTINGS,
            ...(applicationQuery.data?.settings ?? {}),
            ...generalChanges
        }),
        [applicationQuery.data?.settings, generalChanges]
    )
    const effectiveVisibility = visibilityChange ?? applicationQuery.data?.isPublic ?? false
    const hasVisibilityChange = visibilityChange !== undefined && visibilityChange !== applicationQuery.data?.isPublic
    const rolePolicyMatrix = useMemo(
        () => resolveRolePolicyMatrix(effectiveGeneralSettings.rolePolicies),
        [effectiveGeneralSettings.rolePolicies]
    )
    const unsupportedActiveRoleRules = useMemo(
        () => collectUnsupportedActiveCapabilityRules(effectiveGeneralSettings.rolePolicies),
        [effectiveGeneralSettings.rolePolicies]
    )
    const hasLearningContentCapability = hasLearningContentMaterializedState(materializedLayoutState)
    const hasMatrixCapability = hasMatrixMaterializedState(materializedLayoutState)
    const hasLearningContentTab = hasLearningContentCapability || (layoutCapabilitiesLoading && activeTab === 'learningContent')
    const hasMatrixTab = hasMatrixCapability || (layoutCapabilitiesLoading && activeTab === 'matrix')
    const matrixWidgets = listInterpretationNetworkWidgets(materializedLayoutState)
    const matrixWidget = matrixWidgets[0]
    const matrixWidgetSettings = parseMatrixSettings(matrixWidget?.config)
    const hasDivergentMatrixSettings = matrixWidgets
        .slice(1)
        .some((widget) => !areInterpretationNetworkMatrixSettingsEqual(matrixWidgetSettings, parseMatrixSettings(widget.config)))
    const matrixWidgetIdentity = matrixWidget ? `${matrixWidget.layout.id}:${matrixWidget.id}:${matrixWidget.version ?? 'unknown'}` : null
    const matrixSettings = matrixSettingsOverride ?? matrixWidgetSettings
    const shouldStripHiddenLearningContent = materializedLayoutsQuery.isSuccess && !hasLearningContentCapability
    const buildGeneralSettingsSavePayload = (settings: ApplicationDialogSettings): ApplicationDialogSettings => {
        const sanitized = sanitizeApplicationDialogSettingsForSave(settings)
        if (!shouldStripHiddenLearningContent) return sanitized

        const { learningContent: _hiddenLearningContent, ...withoutHiddenLearningContent } = sanitized
        return withoutHiddenLearningContent
    }

    useEffect(() => {
        if (layoutCapabilitiesLoading) return
        if (
            (activeTab === 'learningContent' && !hasLearningContentTab) ||
            (activeTab === 'matrix' && !hasMatrixTab) ||
            (activeTab === 'limits' && !supportsWorkspaceLimits)
        ) {
            setActiveTab('general')
        }
    }, [activeTab, hasLearningContentTab, hasMatrixTab, layoutCapabilitiesLoading, supportsWorkspaceLimits])

    useEffect(() => {
        if (materializedLayoutsQuery.data) {
            setLastMaterializedLayoutState(materializedLayoutsQuery.data)
        }
    }, [materializedLayoutsQuery.data])

    useEffect(() => {
        setMatrixSettingsOverride(null)
    }, [matrixWidgetIdentity])

    const updateRoleCapability = (role: ApplicationRole, capability: ApplicationCapabilityKey, checked: boolean) => {
        const nextMatrix = resolveRolePolicyMatrix(effectiveGeneralSettings.rolePolicies)
        nextMatrix[role] = {
            ...nextMatrix[role],
            [capability]: checked
        }
        setGeneralChanges((prev) => ({
            ...prev,
            rolePolicies: buildRolePoliciesFromMatrix(effectiveGeneralSettings.rolePolicies, nextMatrix)
        }))
    }

    const updateLearningContentSettings = (
        updater: (current: ApplicationLearningContentSettings) => ApplicationLearningContentSettings
    ) => {
        const current = sanitizeApplicationLearningContentSettings(effectiveGeneralSettings.learningContent)
        setGeneralChanges((prev) => ({
            ...prev,
            learningContent: sanitizeApplicationLearningContentSettings(updater(current))
        }))
    }

    const updateLearningContentResourceType = (
        resourceType: ResourceType,
        patch: Partial<ApplicationLearningContentSettings['supportedResourceTypes'][number]>
    ) => {
        updateLearningContentSettings((current) => {
            const existing = current.supportedResourceTypes
            const next = RESOURCE_TYPES.map((candidate) => {
                const currentItem = existing.find((item) => item.resourceType === candidate) ?? {
                    resourceType: candidate,
                    enabled: true,
                    deferred: candidate === 'scorm' || candidate === 'xapi' || candidate === 'file'
                }
                return candidate === resourceType ? { ...currentItem, ...patch, resourceType: candidate } : currentItem
            })

            return {
                ...current,
                supportedResourceTypes: next
            }
        })
    }

    const saveGeneralMutation = useMutation({
        mutationKey: ['applications', 'settings', 'general', 'update'],
        mutationFn: async (input: { settings: ApplicationDialogSettings; isPublic?: boolean }) => {
            const settings = buildGeneralSettingsSavePayload(input.settings)
            const response = await updateApplication(applicationId!, {
                settings,
                ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
                expectedVersion: applicationQuery.data?.version ?? 1
            })
            return response.data
        },
        onMutate: async (input) => {
            if (!applicationId) return { previousApplication: undefined }

            await queryClient.cancelQueries({ queryKey: applicationsQueryKeys.detail(applicationId) })
            const previousApplication = queryClient.getQueryData(applicationsQueryKeys.detail(applicationId))
            if (previousApplication && typeof previousApplication === 'object') {
                queryClient.setQueryData(applicationsQueryKeys.detail(applicationId), {
                    ...previousApplication,
                    settings: buildGeneralSettingsSavePayload(input.settings),
                    ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {})
                })
            }

            return { previousApplication }
        },
        onSuccess: async (saved) => {
            if (!applicationId) return
            queryClient.setQueryData(applicationsQueryKeys.detail(applicationId), saved)
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.detail(applicationId) }),
                queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.lists() }),
                queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.runtimeAll(applicationId) })
            ])
            enqueueSnackbar(t('settings.generalSaved', 'Application settings saved'), { variant: 'success' })
            setGeneralChanges({})
            setVisibilityChange(undefined)
        },
        onError: (error: Error, _input, context) => {
            if (applicationId && context?.previousApplication) {
                queryClient.setQueryData(applicationsQueryKeys.detail(applicationId), context.previousApplication)
            }
            enqueueSnackbar(error.message || t('settings.generalSaveError', 'Failed to save application settings'), {
                variant: 'error'
            })
        }
    })

    const effectiveLimits = useMemo(
        () =>
            (limitsQuery.data ?? []).map((item) => ({
                ...item,
                inputValue: localLimits[item.objectId] ?? (item.maxRows === null ? '' : String(item.maxRows))
            })),
        [limitsQuery.data, localLimits]
    )

    if (!applicationId) {
        return <Alert severity='error'>{t('settings.missingApplicationId', 'Application ID is missing in URL')}</Alert>
    }

    if (applicationQuery.isLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240 }}>
                <CircularProgress />
            </Box>
        )
    }

    if (applicationQuery.isError || !applicationDisplay) {
        return <Alert severity='error'>{t('settings.loadError', 'Failed to load application settings')}</Alert>
    }

    const hasGeneralChanges = Object.keys(generalChanges).length > 0 || hasVisibilityChange

    return (
        <MainCard disableHeader border={false} shadow={false} contentSX={{ px: 0, py: 0 }} disableContentPadding>
            <ViewHeader title={t('settings.title', 'Application Settings')} search={false} />

            <Box data-testid='application-settings-tabs' sx={PAGE_TAB_BAR_SX}>
                <Tabs
                    value={activeTab}
                    onChange={(_, value: SettingsTab) => setActiveTab(value)}
                    aria-label={t('settings.tabs.ariaLabel', 'Application settings sections')}
                >
                    <Tab
                        value='general'
                        id='application-settings-tab-general'
                        aria-controls='application-settings-panel-general'
                        label={t('settings.tabs.general', 'General')}
                    />
                    {hasMatrixTab ? (
                        <Tab
                            value='matrix'
                            id='application-settings-tab-matrix'
                            aria-controls='application-settings-panel-matrix'
                            label={t('settings.tabs.matrix', 'Matrix')}
                            disabled={layoutCapabilitiesLoading}
                        />
                    ) : null}
                    {hasLearningContentTab ? (
                        <Tab
                            value='learningContent'
                            id='application-settings-tab-learningContent'
                            aria-controls='application-settings-panel-learningContent'
                            label={t('settings.tabs.learningContent', 'Learning Content')}
                            disabled={layoutCapabilitiesLoading}
                        />
                    ) : null}
                    <Tab
                        value='connectors'
                        id='application-settings-tab-connectors'
                        aria-controls='application-settings-panel-connectors'
                        label={t('settings.tabs.connectors', 'Connectors')}
                    />
                    <Tab
                        value='access'
                        id='application-settings-tab-access'
                        aria-controls='application-settings-panel-access'
                        label={t('settings.tabs.access', 'Access')}
                    />
                    {supportsWorkspaceLimits ? (
                        <Tab
                            value='limits'
                            id='application-settings-tab-limits'
                            aria-controls='application-settings-panel-limits'
                            label={t('settings.tabs.limits', 'Limits')}
                        />
                    ) : null}
                </Tabs>
            </Box>

            <Box
                data-testid='application-settings-content'
                role='tabpanel'
                id={`application-settings-panel-${activeTab}`}
                aria-labelledby={`application-settings-tab-${activeTab}`}
                tabIndex={0}
                sx={{ py: 2, mx: PAGE_CONTENT_GUTTER_MX }}
            >
                {activeTab === 'general' ? (
                    <GeneralSettingsPanel
                        t={t}
                        effectiveVisibility={effectiveVisibility}
                        currentVisibility={applicationQuery.data?.isPublic}
                        workspacesEnabled={applicationQuery.data?.workspacesEnabled}
                        publicEntryWorkspaceSupported={supportsPublicEntryWorkspace}
                        publicEntryWorkspaceId={publicEntryWorkspace.workspaceId}
                        publicEntryWorkspaceOptions={publicEntryWorkspace.workspaceOptions}
                        publicEntryWorkspaceLoading={publicEntryWorkspace.isLoading}
                        publicEntryWorkspaceError={publicEntryWorkspace.isError}
                        publicEntryWorkspaceSaving={publicEntryWorkspace.isSaving}
                        publicEntryWorkspaceHasMore={publicEntryWorkspace.hasMore}
                        publicEntryWorkspaceLoadingMore={publicEntryWorkspace.isLoadingMore}
                        settings={effectiveGeneralSettings}
                        hasChanges={hasGeneralChanges}
                        isSaving={saveGeneralMutation.isPending}
                        onVisibilityChange={setVisibilityChange}
                        onPublicEntryWorkspaceChange={publicEntryWorkspace.onChange}
                        onPublicEntryWorkspaceLoadMore={publicEntryWorkspace.loadMore}
                        onPublicEntryWorkspaceRetry={publicEntryWorkspace.retry}
                        onSettingsChange={(patch) => setGeneralChanges((prev) => ({ ...prev, ...patch }))}
                        onSave={() =>
                            saveGeneralMutation.mutate({
                                settings: effectiveGeneralSettings,
                                ...(hasVisibilityChange ? { isPublic: effectiveVisibility } : {})
                            })
                        }
                    />
                ) : activeTab === 'matrix' && hasMatrixCapability ? (
                    <MatrixSettingsPanel
                        t={t}
                        settings={matrixSettings}
                        hasDivergentSettings={hasDivergentMatrixSettings}
                        isSaving={saveMatrixMutation.isPending}
                        onSave={(settings) => saveMatrixMutation.mutate(settings)}
                        showResetButton={matrixWidgets.some((widget) => widget.isCustomized && widget.sourceConfig !== null)}
                        isResetting={resetMatrixMutation.isPending}
                        onReset={() => resetMatrixMutation.mutate()}
                    />
                ) : activeTab === 'learningContent' && hasLearningContentCapability ? (
                    <ContentSettingsPanel
                        t={t}
                        settings={sanitizeApplicationLearningContentSettings(effectiveGeneralSettings.learningContent)}
                        hasChanges={hasGeneralChanges}
                        isSaving={saveGeneralMutation.isPending}
                        onUpdateSettings={updateLearningContentSettings}
                        onUpdateResourceType={updateLearningContentResourceType}
                        onSave={() =>
                            saveGeneralMutation.mutate({
                                settings: effectiveGeneralSettings,
                                ...(hasVisibilityChange ? { isPublic: effectiveVisibility } : {})
                            })
                        }
                    />
                ) : (activeTab === 'matrix' || activeTab === 'learningContent') && layoutCapabilitiesLoading ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
                        <CircularProgress size={28} />
                    </Box>
                ) : activeTab === 'connectors' ? (
                    <ConnectorsSettingsPanel
                        t={t}
                        settings={effectiveGeneralSettings}
                        hasChanges={hasGeneralChanges}
                        isSaving={saveGeneralMutation.isPending}
                        onSettingsChange={(patch) => setGeneralChanges((prev) => ({ ...prev, ...patch }))}
                        onSave={() =>
                            saveGeneralMutation.mutate({
                                settings: effectiveGeneralSettings,
                                ...(hasVisibilityChange ? { isPublic: effectiveVisibility } : {})
                            })
                        }
                    />
                ) : activeTab === 'access' ? (
                    <AccessSettingsPanel
                        t={t}
                        unsupportedActiveRoleRulesCount={unsupportedActiveRoleRules.length}
                        rolePolicyMatrix={rolePolicyMatrix}
                        settings={effectiveGeneralSettings}
                        interpretationNetworkWidgets={matrixWidgets.map((widget) => ({
                            instanceKey: widget.instanceKey,
                            zone: widget.zone,
                            templateKey: widget.layout.templateKey
                        }))}
                        hasChanges={hasGeneralChanges}
                        isSaving={saveGeneralMutation.isPending}
                        onUpdateRoleCapability={updateRoleCapability}
                        onSettingsChange={(patch) => setGeneralChanges((prev) => ({ ...prev, ...patch }))}
                        onSave={() =>
                            saveGeneralMutation.mutate({
                                settings: effectiveGeneralSettings,
                                ...(hasVisibilityChange ? { isPublic: effectiveVisibility } : {})
                            })
                        }
                    />
                ) : activeTab === 'limits' && supportsWorkspaceLimits ? (
                    <LimitsSettingsPanel
                        t={t}
                        runtimeSchemaReady={runtimeSchemaReady}
                        workspacesEnabled={applicationQuery.data?.workspacesEnabled}
                        isLoading={limitsQuery.isLoading}
                        isError={limitsQuery.isError}
                        limits={effectiveLimits}
                        isSaving={saveLimitsMutation.isPending}
                        onLimitChange={(objectId, value) => setLocalLimits((prev) => ({ ...prev, [objectId]: value }))}
                        onSave={() => saveLimitsMutation.mutate(limitsQuery.data ?? [])}
                    />
                ) : null}
            </Box>
        </MainCard>
    )
}

export default ApplicationSettings
