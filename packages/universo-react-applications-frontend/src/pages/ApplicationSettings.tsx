import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Box, CircularProgress, Tab, Tabs } from '@mui/material'
import { RESOURCE_TYPES, collectUnsupportedActiveCapabilityRules, sanitizeApplicationLearningContentSettings } from '@universo-react/types'
import type {
    ApplicationLearningContentSettings,
    ApplicationLayout,
    ApplicationLayoutWidget,
    ApplicationRolePolicySettings,
    ResourceType,
    RoleCapabilityRule
} from '@universo-react/types'
import { useSnackbar } from 'notistack'
import { useTranslation } from 'react-i18next'
import {
    TemplateMainCard as MainCard,
    ViewHeaderMUI as ViewHeader,
    PAGE_CONTENT_GUTTER_MX,
    PAGE_TAB_BAR_SX
} from '@universo-react/template-mui'
import {
    AccessSettingsPanel,
    APPLICATION_CAPABILITIES,
    APPLICATION_ROLE_ORDER,
    ConnectorsSettingsPanel,
    GeneralSettingsPanel,
    LimitsSettingsPanel,
    MatrixSettingsPanel,
    type ApplicationCapabilityKey,
    type InterpretationNetworkHierarchyLayout,
    type InterpretationNetworkMatrixSettings,
    type InterpretationNetworkMatrixMode
} from './application-settings/SettingsPanels'
import { LearningContentSettingsPanel } from './application-settings/LearningContentSettingsPanel'
import { useApplicationDetails } from '../api/useApplicationDetails'
import { applicationsQueryKeys } from '../api/queryKeys'
import {
    getApplicationWorkspaceLimits,
    listApplicationLayoutScopes,
    listApplicationLayouts,
    listApplicationLayoutWidgets,
    updateApplication,
    updateApplicationLayoutWidgetConfig,
    updateApplicationWorkspaceLimits
} from '../api/applications'
import { DEFAULT_APPLICATION_DIALOG_SETTINGS, sanitizeApplicationDialogSettingsForSave } from '../settings/dialogSettings'
import {
    toApplicationDisplay,
    type ApplicationDialogSettings,
    type ApplicationRole,
    type ApplicationWorkspaceLimitItem,
    type SchemaStatus
} from '../types'

type SettingsTab = 'general' | 'matrix' | 'learningContent' | 'connectors' | 'access' | 'limits'
type MaterializedApplicationLayoutState = {
    layouts: ApplicationLayout[]
    widgets: Array<ApplicationLayoutWidget & { layout: ApplicationLayout }>
}

type LayoutScopeFilter = string | null | undefined

const BASE_ROLE_PERMISSIONS: Record<ApplicationRole, Record<ApplicationCapabilityKey, boolean>> = {
    owner: {
        manageMembers: true,
        manageApplication: true,
        createContent: true,
        editContent: true,
        deleteContent: true,
        readReports: true
    },
    admin: {
        manageMembers: true,
        manageApplication: true,
        createContent: true,
        editContent: true,
        deleteContent: true,
        readReports: true
    },
    editor: {
        manageMembers: false,
        manageApplication: false,
        createContent: true,
        editContent: true,
        deleteContent: false,
        readReports: true
    },
    member: {
        manageMembers: false,
        manageApplication: false,
        createContent: false,
        editContent: false,
        deleteContent: false,
        readReports: false
    }
}

const cloneRoleMatrix = (): Record<ApplicationRole, Record<ApplicationCapabilityKey, boolean>> =>
    Object.fromEntries(
        APPLICATION_ROLE_ORDER.map((role) => [
            role,
            Object.fromEntries(APPLICATION_CAPABILITIES.map((capability) => [capability.key, BASE_ROLE_PERMISSIONS[role][capability.key]]))
        ])
    ) as Record<ApplicationRole, Record<ApplicationCapabilityKey, boolean>>

const roleMatchesTemplate = (template: { codename?: string; baseRole?: ApplicationRole }, role: ApplicationRole): boolean =>
    template.baseRole === role || template.codename === role || template.codename === `${role}Policy`

const capabilityMatchesRule = (rule: RoleCapabilityRule, capability: (typeof APPLICATION_CAPABILITIES)[number]): boolean =>
    capability.aliases.includes(rule.capability)

const resolveRolePolicyMatrix = (
    rolePolicies?: ApplicationRolePolicySettings
): Record<ApplicationRole, Record<ApplicationCapabilityKey, boolean>> => {
    const matrix = cloneRoleMatrix()
    for (const template of rolePolicies?.templates ?? []) {
        for (const role of APPLICATION_ROLE_ORDER) {
            if (!roleMatchesTemplate(template, role)) continue

            for (const rule of template.rules) {
                if (rule.scope !== 'application' && rule.scope !== 'workspace') continue
                for (const capability of APPLICATION_CAPABILITIES) {
                    if (capabilityMatchesRule(rule, capability)) {
                        matrix[role][capability.key] = rule.effect === 'allow'
                    }
                }
            }
        }
    }
    return matrix
}

const buildRolePoliciesFromMatrix = (
    currentPolicies: ApplicationRolePolicySettings | undefined,
    matrix: Record<ApplicationRole, Record<ApplicationCapabilityKey, boolean>>
): ApplicationRolePolicySettings => {
    const unmanagedTemplates = (currentPolicies?.templates ?? []).filter(
        (template) => !APPLICATION_ROLE_ORDER.some((role) => roleMatchesTemplate(template, role))
    )
    const templates = APPLICATION_ROLE_ORDER.map((role) => {
        const existingTemplate = (currentPolicies?.templates ?? []).find((template) => roleMatchesTemplate(template, role))
        const managedRules = APPLICATION_CAPABILITIES.flatMap(
            (capability) => existingTemplate?.rules.filter((rule) => capabilityMatchesRule(rule, capability)) ?? []
        )
        const rulesToReplace = new Set(managedRules)
        const preservedRules = (existingTemplate?.rules ?? []).filter((rule) => !rulesToReplace.has(rule))
        const rules: RoleCapabilityRule[] = [
            ...preservedRules,
            ...APPLICATION_CAPABILITIES.map((capability) => ({
                capability: capability.capability,
                effect: matrix[role][capability.key] ? ('allow' as const) : ('deny' as const),
                scope: 'workspace' as const
            }))
        ]

        return {
            codename: existingTemplate?.codename ?? `${role}Policy`,
            title: existingTemplate?.title ?? `${role} permissions`,
            baseRole: role,
            rules
        }
    })

    return { templates: [...unmanagedTemplates, ...templates] }
}

const RUNTIME_SCHEMA_READY_STATUSES = new Set<SchemaStatus | 'ready'>([
    'synced',
    'outdated',
    'update_available',
    'maintenance',
    'error',
    'ready'
])

const hasInitializedRuntimeSchema = (schemaName?: string | null, schemaStatus?: SchemaStatus | null): boolean => {
    if (!schemaName) {
        return false
    }

    if (!schemaStatus) {
        return false
    }

    return RUNTIME_SCHEMA_READY_STATUSES.has(schemaStatus as SchemaStatus | 'ready')
}

const isActiveMaterializedLayout = (layout: ApplicationLayout): boolean => layout.isActive && !layout.isSourceExcluded

const isActiveMaterializedWidget = (widget: ApplicationLayoutWidget & { layout: ApplicationLayout }): boolean =>
    widget.isActive && isActiveMaterializedLayout(widget.layout)

const hasNestedLearningContentWidget = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') return false
    if (Array.isArray(value)) return value.some(hasNestedLearningContentWidget)

    const record = value as Record<string, unknown>
    if (record.isActive !== false && record.widgetKey === 'learnerPlayer') return true
    if (record.learningContent !== undefined || record.sharedBehavior === 'learningContent') return true
    return Object.values(record).some(hasNestedLearningContentWidget)
}

const hasLearningContentMaterializedState = (state?: MaterializedApplicationLayoutState): boolean =>
    (state?.widgets ?? []).some(
        (widget) =>
            isActiveMaterializedWidget(widget) &&
            (widget.widgetKey === 'learnerPlayer' ||
                widget.config?.learningContent !== undefined ||
                widget.config?.sharedBehavior === 'learningContent' ||
                hasNestedLearningContentWidget(widget.config))
    )

const hasMatrixMaterializedState = (state?: MaterializedApplicationLayoutState): boolean =>
    (state?.widgets ?? []).some((widget) => isActiveMaterializedWidget(widget) && widget.widgetKey === 'interpretationNetworkWorkspace')

const listInterpretationNetworkWidgets = (
    state?: MaterializedApplicationLayoutState
): Array<ApplicationLayoutWidget & { layout: ApplicationLayout }> =>
    (state?.widgets ?? []).filter((widget) => isActiveMaterializedWidget(widget) && widget.widgetKey === 'interpretationNetworkWorkspace')

const listWritableInterpretationNetworkWidgets = (
    state?: MaterializedApplicationLayoutState
): Array<ApplicationLayoutWidget & { layout: ApplicationLayout }> => listInterpretationNetworkWidgets(state)

const parseMatrixMode = (value: unknown): InterpretationNetworkMatrixMode =>
    value === 'independentRows' || value === 'hierarchicalCells' ? value : 'hierarchicalCells'

const parseHierarchyLayout = (value: unknown): InterpretationNetworkHierarchyLayout =>
    value === 'verticalTree' || value === 'horizontalRows' ? value : 'horizontalRows'

const parseHierarchyRowMode = (value: unknown): InterpretationNetworkMatrixSettings['hierarchyRowMode'] =>
    value === 'allNodes' || value === 'focusedPath' ? value : 'focusedPath'

const parsePositionNumbering = (value: unknown): InterpretationNetworkMatrixSettings['positionNumbering'] => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { enabled: true, includeRoot: true, startIndex: 1 }
    }
    const record = value as Record<string, unknown>
    const startIndex = record.startIndex
    return {
        enabled: typeof record.enabled === 'boolean' ? record.enabled : true,
        includeRoot: typeof record.includeRoot === 'boolean' ? record.includeRoot : true,
        startIndex: typeof startIndex === 'number' && Number.isInteger(startIndex) && startIndex >= 0 ? startIndex : 1
    }
}

const parseMatrixSettings = (config: Record<string, unknown> | null | undefined): InterpretationNetworkMatrixSettings => ({
    matrixMode: parseMatrixMode(config?.matrixMode),
    hierarchyLayout: parseHierarchyLayout(config?.hierarchyLayout),
    hierarchyRowMode: parseHierarchyRowMode(config?.hierarchyRowMode),
    positionNumbering: parsePositionNumbering(config?.positionNumbering)
})

const INTERPRETATION_NETWORK_WORKSPACE_CONFIG_KEYS = new Set([
    'moduleCodename',
    'attachedToKind',
    'mountMethodName',
    'emptyStateTitle',
    'emptyStateDescription',
    'visibleFor',
    'sharedBehavior',
    'serverModuleCodename',
    'matrixMode',
    'hierarchyLayout',
    'hierarchyRowMode',
    'positionNumbering',
    'conceptCodename',
    'conceptNameField',
    'conceptDescriptionField',
    'interpretationCodename',
    'interpretationParentField',
    'matrixField',
    'relationCodename',
    'materialCodename',
    'materialTitleField',
    'interpretationTitleField',
    'tableTemplateCodename',
    'tableTemplateNameField',
    'tableTemplateDescriptionField',
    'tableTemplateMatrixField'
])

const sanitizeWidgetConfigForSave = (config: Record<string, unknown> | null | undefined): Record<string, unknown> => {
    return Object.fromEntries(
        Object.entries(config ?? {}).filter(([key, value]) => value !== undefined && INTERPRETATION_NETWORK_WORKSPACE_CONFIG_KEYS.has(key))
    )
}

const loadLayoutsForScope = async (applicationId: string, scopeEntityId: LayoutScopeFilter): Promise<ApplicationLayout[]> => {
    const layouts: ApplicationLayout[] = []
    const limit = 100
    let offset = 0
    let hasMore = true
    while (hasMore) {
        const layoutsResponse = await listApplicationLayouts(applicationId, { limit, offset, scopeEntityId })
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
            return Promise.all(
                widgets.map(async (widget) => ({
                    layoutId: widget.layout.id,
                    widgetId: widget.id,
                    savedWidget: await updateApplicationLayoutWidgetConfig(applicationId!, widget.layout.id, widget.id, {
                        config: {
                            ...sanitizeWidgetConfigForSave(widget.config),
                            matrixMode: settings.matrixMode,
                            hierarchyLayout: settings.hierarchyLayout,
                            hierarchyRowMode: settings.hierarchyRowMode,
                            positionNumbering: settings.positionNumbering
                        },
                        ...(typeof widget.version === 'number' ? { expectedVersion: widget.version } : {})
                    })
                }))
            )
        },
        onSuccess: async (savedWidgets, savedSettings) => {
            if (!applicationId) return
            setMatrixSettingsOverride(savedSettings)
            const savedWidgetsByIdentity = new Map(
                savedWidgets.map(({ layoutId, widgetId, savedWidget }) => [
                    `${savedWidget.layoutId ?? layoutId}:${savedWidget.id ?? widgetId}`,
                    savedWidget
                ])
            )
            queryClient.setQueryData<MaterializedApplicationLayoutState>(
                ['applications', applicationId, 'settings', 'materialized-layouts'],
                (current) =>
                    current
                        ? {
                              ...current,
                              widgets: current.widgets.map((widget) => {
                                  const savedWidget = savedWidgetsByIdentity.get(`${widget.layout.id}:${widget.id}`)
                                  return savedWidget
                                      ? {
                                            ...widget,
                                            ...savedWidget,
                                            config: {
                                                ...widget.config,
                                                ...(savedWidget.config ?? {}),
                                                matrixMode: savedSettings.matrixMode,
                                                hierarchyLayout: savedSettings.hierarchyLayout,
                                                hierarchyRowMode: savedSettings.hierarchyRowMode,
                                                positionNumbering: savedSettings.positionNumbering
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
        onError: (error: Error) => {
            enqueueSnackbar(error.message || t('settings.matrix.saveError', 'Failed to save matrix settings'), { variant: 'error' })
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
    const matrixWidget = listInterpretationNetworkWidgets(materializedLayoutState)[0]
    const matrixWidgetSettings = parseMatrixSettings(matrixWidget?.config)
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
                <Tabs value={activeTab} onChange={(_, value: SettingsTab) => setActiveTab(value)}>
                    <Tab value='general' label={t('settings.tabs.general', 'General')} />
                    {hasMatrixTab ? (
                        <Tab value='matrix' label={t('settings.tabs.matrix', 'Matrix')} disabled={layoutCapabilitiesLoading} />
                    ) : null}
                    {hasLearningContentTab ? (
                        <Tab
                            value='learningContent'
                            label={t('settings.tabs.learningContent', 'Learning Content')}
                            disabled={layoutCapabilitiesLoading}
                        />
                    ) : null}
                    <Tab value='connectors' label={t('settings.tabs.connectors', 'Connectors')} />
                    <Tab value='access' label={t('settings.tabs.access', 'Access')} />
                    {supportsWorkspaceLimits ? <Tab value='limits' label={t('settings.tabs.limits', 'Limits')} /> : null}
                </Tabs>
            </Box>

            <Box data-testid='application-settings-content' sx={{ py: 2, mx: PAGE_CONTENT_GUTTER_MX }}>
                {activeTab === 'general' ? (
                    <GeneralSettingsPanel
                        t={t}
                        effectiveVisibility={effectiveVisibility}
                        currentVisibility={applicationQuery.data?.isPublic}
                        workspacesEnabled={applicationQuery.data?.workspacesEnabled}
                        settings={effectiveGeneralSettings}
                        hasChanges={hasGeneralChanges}
                        isSaving={saveGeneralMutation.isPending}
                        onVisibilityChange={setVisibilityChange}
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
                        isSaving={saveMatrixMutation.isPending}
                        onSave={(settings) => saveMatrixMutation.mutate(settings)}
                    />
                ) : activeTab === 'learningContent' && hasLearningContentCapability ? (
                    <LearningContentSettingsPanel
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
                        hasChanges={hasGeneralChanges}
                        isSaving={saveGeneralMutation.isPending}
                        onUpdateRoleCapability={updateRoleCapability}
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
