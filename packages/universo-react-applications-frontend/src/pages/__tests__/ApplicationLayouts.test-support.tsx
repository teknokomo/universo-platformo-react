import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ComponentType } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import enApplicationsLocale from '../../i18n/locales/en/applications.json'
import ruApplicationsLocale from '../../i18n/locales/ru/applications.json'

const layoutLocales = {
    en: enApplicationsLocale.applications.layouts,
    ru: ruApplicationsLocale.applications.layouts
} as const

const getResetLocaleString = (language: 'en' | 'ru', key: string): string | undefined => {
    if (!key.startsWith('layouts.widgetResetToSource')) return undefined
    let value: unknown = layoutLocales[language]
    for (const segment of key.split('.').slice(1)) {
        if (!value || typeof value !== 'object') return undefined
        value = (value as Record<string, unknown>)[segment]
    }
    return typeof value === 'string' ? value : undefined
}

const getApplicationLocaleString = (language: 'en' | 'ru', key: string): string | undefined => {
    const locale = language === 'ru' ? ruApplicationsLocale : enApplicationsLocale
    const resourceKey = key.split(':').at(-1) ?? key
    let value: unknown = locale.applications
    for (const segment of resourceKey.split('.')) {
        if (!value || typeof value !== 'object') return undefined
        value = (value as Record<string, unknown>)[segment]
    }
    return typeof value === 'string' ? value : undefined
}

const resourceBackedTestKeys = new Set([
    'layouts.widgetCustomization.application',
    'layouts.widgetCustomization.metahub',
    'layouts.state.conflict',
    'layouts.state.source_removed'
])

vi.setConfig({ testTimeout: 15_000 })

const hoistedMocks = vi.hoisted(() => ({
    apiMocks: {
        listApplicationLayoutScopes: vi.fn(),
        listApplicationLayouts: vi.fn(),
        getApplicationLayout: vi.fn(),
        listApplicationLayoutWidgetObject: vi.fn(),
        moveApplicationLayoutWidget: vi.fn(),
        toggleApplicationLayoutWidget: vi.fn(),
        upsertApplicationLayoutWidget: vi.fn(),
        deleteApplicationLayoutWidget: vi.fn(),
        resetApplicationLayoutWidgetConfigsBatch: vi.fn(),
        resetApplicationLayoutConfig: vi.fn(),
        updateApplicationLayoutZoneSetting: vi.fn(),
        resetApplicationLayoutZoneSetting: vi.fn(),
        updateApplicationLayoutWidgetConfig: vi.fn(),
        createApplicationLayout: vi.fn(),
        updateApplicationLayout: vi.fn(),
        deleteApplicationLayout: vi.fn(),
        copyApplicationLayout: vi.fn()
    },
    snackbarMocks: {
        enqueueSnackbar: vi.fn()
    },
    confirmMocks: {
        confirm: vi.fn()
    },
    localeMocks: {
        language: 'en' as 'en' | 'ru'
    }
}))
export const { apiMocks, snackbarMocks, confirmMocks, localeMocks } = hoistedMocks

vi.mock('notistack', () => ({
    useSnackbar: () => ({ enqueueSnackbar: snackbarMocks.enqueueSnackbar })
}))

vi.mock('react-i18next', () => ({
    initReactI18next: { type: '3rdParty', init: vi.fn() },
    useTranslation: () => ({
        t: (key: string, fallback?: string | { defaultValue?: string }, params?: Record<string, unknown>) => {
            const dictionary: Record<string, string> = {
                'layouts.widgets.menuWidget': 'Menu',
                'layouts.widgets.overviewCards': 'Overview cards',
                'layouts.widgets.interpretationNetworkWorkspace': 'Interpretation network workspace',
                'layouts.widgets.workspaceSwitcher': 'Workspace switcher',
                'layouts.widgets.languageSwitcher': 'Language switcher',
                'layouts.widgets.marketing.hero': 'Hero',
                'layouts.widgets.marketing.collection': 'Collection',
                'layouts.zones.marketingHeader': 'Marketing header',
                'layouts.zones.marketingMain': 'Marketing content',
                'layouts.zones.marketingFooter': 'Marketing footer',
                'layouts.widgets.recordsTable': 'Records table',
                'layouts.interpretationNetworkEditor.title': 'Interpretation network workspace',
                'layouts.workspaceSwitcherEditor.title': 'Workspace switcher',
                'layouts.workspaceSwitcherEditor.readOnly':
                    'The workspace switcher uses the published application workspace state and has no widget-specific settings yet.',
                'layouts.workspaceSwitcherEditor.hint':
                    'Use application settings to control which workspace settings can be changed inside workspaces.',
                'layouts.widgetCustomization.application': 'Customized in application',
                'layouts.widgetCustomization.metahub': 'Inherited from metahub',
                'layouts.state.conflict': localeMocks.language === 'ru' ? 'Конфликт' : 'Conflict',
                'layouts.state.source_removed': localeMocks.language === 'ru' ? 'Источник удалён' : 'Source removed',
                'layouts.interpretationNetworkEditor.saveError': 'Failed to save widget settings',
                'settings.matrix.singleSystemStructuresExist':
                    'Single-system mode cannot be enabled while ordinary Structures exist. Delete them first.',
                'settings.matrix.reset': 'Restore metahub settings',
                'settings.matrix.singleSystemMetadataMissing':
                    'Single-system mode cannot be enabled because the Structure metadata is incomplete.',
                'layouts.marketing.reset': 'Restore template defaults',
                'layouts.marketing.resetTitle': 'Restore marketing page defaults?',
                'layouts.marketing.resetDescription':
                    'This restores the theme, colors, and action policy for this application layout. Widget composition and content records will not change.',
                'layouts.marketing.resetConfirm': 'Restore defaults',
                'layouts.marketing.heroActionIntegrityConflict':
                    localeMocks.language === 'ru'
                        ? 'Этот раздел используется в действии первого экрана. Измените действие или оставьте раздел включённым.'
                        : 'This section is used by a Hero action. Change that action or keep the section active.',
                'layouts.marketing.resetSuccess': 'Marketing appearance restored to template defaults.'
            }
            if (localeMocks.language === 'ru') {
                dictionary['layouts.widgetCustomization.application'] = 'Настроено в приложении'
                dictionary['layouts.widgetCustomization.metahub'] = 'Унаследовано из метахаба'
            }
            const fallbackValue = typeof fallback === 'string' ? fallback : fallback?.defaultValue
            const localizedTestValue = resourceBackedTestKeys.has(key) ? getApplicationLocaleString(localeMocks.language, key) : undefined
            const template =
                localizedTestValue ?? dictionary[key] ?? getResetLocaleString(localeMocks.language, key) ?? fallbackValue ?? key
            const interpolationParams = {
                ...(typeof fallback === 'object' ? fallback : {}),
                ...(params ?? {})
            }
            return Object.entries(interpolationParams).reduce(
                (message, [paramKey, value]) => message.replace(`{{${paramKey}}}`, String(value)),
                template
            )
        },
        i18n: { language: localeMocks.language }
    })
}))

vi.mock('@universo-react/template-mui', async () => {
    const actual = await vi.importActual<typeof import('@universo-react/template-mui')>('@universo-react/template-mui')
    return {
        ...actual,
        EDITABLE_SIDE_MENU_MODES: ['wide', 'compact', 'overlay'],
        ViewHeaderMUI: ({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) => (
            <div>
                <h1>{title}</h1>
                {description ? <p>{description}</p> : null}
                {children}
            </div>
        ),
        ToolbarControls: ({ onViewModeChange }: { onViewModeChange?: (mode: string) => void }) => (
            <div>
                <button type='button' onClick={() => onViewModeChange?.('card')}>
                    card-view
                </button>
                <button type='button' onClick={() => onViewModeChange?.('list')}>
                    list-view
                </button>
            </div>
        ),
        FlowListTable: ({
            data,
            customColumns
        }: {
            data?: Array<Record<string, unknown>>
            customColumns?: Array<Record<string, unknown>>
        }) => (
            <div data-testid='flow-list-table'>
                {Array.isArray(data) && Array.isArray(customColumns)
                    ? data.map((row, index) => (
                          <div key={String(row.id ?? index)}>
                              {customColumns.map((column) => (
                                  <div key={String(column.id)}>{typeof column.render === 'function' ? column.render(row) : null}</div>
                              ))}
                          </div>
                      ))
                    : null}
            </div>
        ),
        LayoutAuthoringList: ({ items, viewMode, listContentTestId }: any) => (
            <div data-testid={listContentTestId}>
                <div>{viewMode}</div>
                {(items ?? []).map((item: any) => (
                    <div key={item.id}>
                        <div>{item.title}</div>
                        <div>{item.meta}</div>
                        <div>{item.statusContent}</div>
                    </div>
                ))}
                {viewMode === 'list' ? <div data-testid='flow-list-table' /> : null}
            </div>
        ),
        LayoutAuthoringDetails: ({ zones, onDragEnd, onAddWidgetRequest, beforeZonesContent }: any) => (
            <div data-testid='layout-authoring-details'>
                {beforeZonesContent}
                {Array.isArray(zones)
                    ? zones.map((zone: any) => (
                          <div key={zone.zone}>
                              <h2>{zone.title}</h2>
                              {zone.settingsAction ? (
                                  <button
                                      type='button'
                                      data-testid={`layout-zone-settings-${zone.zone}`}
                                      aria-label={zone.settingsAction.label}
                                      disabled={zone.settingsAction.disabled}
                                      onClick={zone.settingsAction.onClick}
                                  >
                                      {zone.settingsAction.label}
                                  </button>
                              ) : null}
                              {(zone.availableWidgets ?? []).map((widget: any) => (
                                  <button
                                      key={`${zone.zone}-${widget.key}`}
                                      type='button'
                                      onClick={() => onAddWidgetRequest?.(zone.zone, widget.key)}
                                  >
                                      add-{widget.label}
                                  </button>
                              ))}
                              {(zone.items ?? []).map((item: any) => (
                                  <div key={item.id}>
                                      {item.onClick ? (
                                          <button
                                              type='button'
                                              data-testid={`layout-widget-edit-${item.id}`}
                                              aria-label={item.editAriaLabel}
                                              onClick={item.onClick}
                                          >
                                              {item.label}
                                          </button>
                                      ) : (
                                          <span>{item.label}</span>
                                      )}
                                      {item.draggable ? (
                                          <button
                                              type='button'
                                              data-testid={`layout-widget-drag-${item.id}`}
                                              onClick={() => onDragEnd?.({ active: { id: item.id }, over: { id: `zone:${zone.zone}` } })}
                                          >
                                              reorder-{item.label}
                                          </button>
                                      ) : null}
                                      {item.toggleActiveAriaLabel ? (
                                          <button
                                              type='button'
                                              data-testid={`layout-widget-toggle-${item.id}`}
                                              aria-label={item.toggleActiveAriaLabel}
                                              onClick={() => item.onToggleActive?.(!item.isActive)}
                                          >
                                              toggle-{item.label}
                                          </button>
                                      ) : null}
                                      {item.onRemove ? (
                                          <button
                                              type='button'
                                              data-testid={`layout-widget-remove-${item.id}`}
                                              aria-label={item.removeAriaLabel}
                                              onClick={item.onRemove}
                                          >
                                              remove-{item.label}
                                          </button>
                                      ) : null}
                                      {item.inheritedLabel ? <span>{item.inheritedLabel}</span> : null}
                                      {item.onDuplicate ? (
                                          <button
                                              type='button'
                                              data-testid={`layout-widget-duplicate-${item.id}`}
                                              aria-label={item.duplicateAriaLabel ?? item.duplicateTooltip}
                                              onClick={item.onDuplicate}
                                          >
                                              duplicate-{item.label}
                                          </button>
                                      ) : null}
                                      {item.onReset ? (
                                          <button
                                              type='button'
                                              data-testid={`layout-widget-reset-${item.id}`}
                                              aria-label={item.resetAriaLabel ?? item.resetTooltip}
                                              onClick={item.onReset}
                                          >
                                              reset-{item.label}
                                          </button>
                                      ) : null}
                                      {(item.moveActions ?? []).map((action: any) => (
                                          <button key={action.key} type='button' data-testid={action.testId} onClick={action.onClick}>
                                              {action.testId}
                                          </button>
                                      ))}
                                  </div>
                              ))}
                          </div>
                      ))
                    : null}
                <button type='button' onClick={() => onDragEnd?.({ active: { id: 'widget-divider-1' }, over: { id: 'zone:top' } })}>
                    move-widget-divider-to-top
                </button>
            </div>
        ),
        LayoutZoneSettingsDialog: actual.LayoutZoneSettingsDialog,
        LayoutWidgetPresentationDialog: ({ open, title, widgetKey, initialConfig, onSave, onCancel }: any) =>
            open ? (
                <div
                    role='dialog'
                    aria-label={title}
                    data-testid='layout-widget-presentation-dialog-mock'
                    data-widget-key={widgetKey}
                    data-renderer-config-has-instance-key={String(Object.prototype.hasOwnProperty.call(initialConfig ?? {}, 'instanceKey'))}
                >
                    <h2>{title}</h2>
                    <button
                        type='button'
                        onClick={() => {
                            void Promise.resolve(
                                onSave({
                                    ...(widgetKey === 'marketing.hero' ? { showLeadForm: false } : {}),
                                    ...(widgetKey === 'marketing.collection' ? { variant: 'features' } : {}),
                                    ...(widgetKey === 'overviewCards' ? { maxCards: 6, density: 'comfortable' } : {})
                                })
                            ).catch(() => undefined)
                        }}
                    >
                        save-widget-presentation
                    </button>
                    <button type='button' onClick={onCancel}>
                        cancel-widget-presentation
                    </button>
                </div>
            ) : null,
        LayoutStateChips: ({ labels, isDefault, sourceKind, syncState, isActive }: any) => (
            <div>
                <span>{isActive ? labels.active : labels.inactive}</span>
                {isDefault ? <span>{labels.default}</span> : null}
                {sourceKind ? <span>{labels.source?.[sourceKind]}</span> : null}
                {syncState ? <span>{labels.syncState?.[syncState]}</span> : null}
            </div>
        ),
        normalizeSideMenuConfig: (value: any) => ({
            availableModes:
                Array.isArray(value?.availableModes) && value.availableModes.length > 0
                    ? value.availableModes
                    : ['wide', 'compact', 'overlay'],
            primaryMode: typeof value?.primaryMode === 'string' ? value.primaryMode : 'wide',
            rememberUserChoice: typeof value?.rememberUserChoice === 'boolean' ? value.rememberUserChoice : true
        }),
        EntityFormDialog: ({ open, title, extraFields, onSave }: any) =>
            open ? (
                <div data-testid='entity-form-dialog'>
                    <h3>{title}</h3>
                    {typeof extraFields === 'function' ? extraFields() : null}
                    <button type='button' onClick={onSave}>
                        Save
                    </button>
                </div>
            ) : null,
        StandardDialog: ({ open, title, children, actions }: any) =>
            open ? (
                <div role='dialog' aria-label={title}>
                    <h2>{title}</h2>
                    <div>{children}</div>
                    {actions ? <div data-testid='standard-dialog-actions'>{actions}</div> : null}
                </div>
            ) : null,
        LocalizedInlineField: ({ label }: { label: string }) => <div>{label}</div>,
        EmptyListState: ({ title }: { title: string }) => <div>{title}</div>,
        APIEmptySVG: 'api-empty',
        useConfirm: () => ({ confirm: confirmMocks.confirm })
    }
})

vi.mock('../../api/applications', () => ({
    listApplicationLayoutScopes: apiMocks.listApplicationLayoutScopes,
    listApplicationLayouts: apiMocks.listApplicationLayouts,
    getApplicationLayout: apiMocks.getApplicationLayout,
    listApplicationLayoutWidgetObject: apiMocks.listApplicationLayoutWidgetObject,
    moveApplicationLayoutWidget: apiMocks.moveApplicationLayoutWidget,
    toggleApplicationLayoutWidget: apiMocks.toggleApplicationLayoutWidget,
    upsertApplicationLayoutWidget: apiMocks.upsertApplicationLayoutWidget,
    deleteApplicationLayoutWidget: apiMocks.deleteApplicationLayoutWidget,
    resetApplicationLayoutWidgetConfigsBatch: apiMocks.resetApplicationLayoutWidgetConfigsBatch,
    resetApplicationLayoutConfig: apiMocks.resetApplicationLayoutConfig,
    updateApplicationLayoutZoneSetting: apiMocks.updateApplicationLayoutZoneSetting,
    resetApplicationLayoutZoneSetting: apiMocks.resetApplicationLayoutZoneSetting,
    updateApplicationLayoutWidgetConfig: apiMocks.updateApplicationLayoutWidgetConfig,
    createApplicationLayout: apiMocks.createApplicationLayout,
    updateApplicationLayout: apiMocks.updateApplicationLayout,
    deleteApplicationLayout: apiMocks.deleteApplicationLayout,
    copyApplicationLayout: apiMocks.copyApplicationLayout
}))

import { applicationsQueryKeys } from '../../api/queryKeys'

let ApplicationLayoutsPage: ComponentType | undefined

export const initializeApplicationLayouts = async () => {
    ApplicationLayoutsPage = (await import('../ApplicationLayouts')).default
}

export const renderPage = (initialEntry = '/a/app-1/admin/layouts/layout-1') => {
    const Page = ApplicationLayoutsPage
    if (!Page) throw new Error('ApplicationLayouts was not initialized for this suite')

    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    })
    queryClient.setQueryData(applicationsQueryKeys.detail('app-1'), {
        id: 'app-1',
        role: 'owner',
        permissions: { manageApplication: true }
    })

    const result = render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[initialEntry]}>
                <Routes>
                    <Route path='/a/:applicationId/admin/layouts' element={<Page />} />
                    <Route path='/a/:applicationId/admin/layouts/:layoutId' element={<Page />} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>
    )

    return { ...result, queryClient }
}

export const createMarketingLayout = (config: Record<string, unknown> = {}) => ({
    id: 'layout-1',
    scopeId: 'global',
    scopeKind: 'global',
    scopeEntityId: null,
    templateKey: 'marketing-page',
    name: { en: 'Marketing' },
    description: null,
    config: {
        themeMode: 'dark',
        primaryColor: '#1976d2',
        accentColor: '#9c27b0',
        allowEmailActions: true,
        allowTelephoneActions: true,
        externalLinkTarget: 'new-tab',
        ...config
    },
    isActive: true,
    isDefault: true,
    sortOrder: 0,
    sourceKind: 'application',
    sourceLayoutId: null,
    sourceSnapshotHash: null,
    sourceContentHash: null,
    localContentHash: null,
    syncState: 'clean',
    isSourceExcluded: false,
    version: 7
})

const marketingWidgetDefinitions = [
    {
        key: 'marketing.hero',
        allowedZones: ['marketing-main'],
        allowedZonesByTemplate: { 'marketing-page': ['marketing-main'] },
        multiInstance: true,
        templateKey: 'marketing-page',
        supportedTemplates: ['marketing-page'],
        labelKey: 'layouts.widgets.marketing.hero',
        defaultLabel: 'Hero',
        sourcePolicy: { authority: 'metahub-source', sourceMode: 'required', inheritBindings: true, inheritComposition: false },
        applicationPlacementOverrides: { active: true, order: 'root-only', zone: false, parentSlot: false }
    },
    {
        key: 'marketing.collection',
        allowedZones: ['marketing-main'],
        allowedZonesByTemplate: { 'marketing-page': ['marketing-main'] },
        multiInstance: true,
        templateKey: 'marketing-page',
        supportedTemplates: ['marketing-page'],
        labelKey: 'layouts.widgets.marketing.collection',
        defaultLabel: 'Collection',
        sourcePolicy: { authority: 'metahub-source', sourceMode: 'required', inheritBindings: true, inheritComposition: false },
        applicationPlacementOverrides: { active: true, order: 'root-only', zone: false, parentSlot: false }
    },
    {
        key: 'marketing.image',
        allowedZones: ['marketing-main'],
        allowedZonesByTemplate: { 'marketing-page': ['marketing-main'] },
        multiInstance: true,
        templateKey: 'marketing-page',
        supportedTemplates: ['marketing-page'],
        labelKey: 'layouts.widgets.marketing.image',
        defaultLabel: 'Image',
        sourcePolicy: { authority: 'metahub-source', sourceMode: 'optional', inheritBindings: true, inheritComposition: false },
        applicationPlacementOverrides: { active: true, order: 'root-only', zone: false, parentSlot: false }
    },
    {
        key: 'languageSwitcher',
        allowedZones: ['top'],
        allowedZonesByTemplate: { dashboard: ['top'], 'marketing-page': ['marketing-header'] },
        multiInstance: false,
        templateKey: 'dashboard',
        supportedTemplates: ['dashboard', 'marketing-page'],
        shared: true,
        labelKey: 'layouts.widgets.languageSwitcher',
        defaultLabel: 'Language switcher'
    }
]

export const prepareMarketingLayout = (
    widgets: Array<Record<string, unknown>>,
    syncState: 'clean' | 'conflict' | 'source_removed' = 'clean'
) => {
    const item = {
        ...createMarketingLayout(),
        sourceKind: 'metahub' as const,
        sourceLayoutId: 'source-layout-1',
        syncState
    }
    apiMocks.listApplicationLayouts.mockResolvedValue({
        items: [item],
        pagination: { total: 1, limit: 100, offset: 0, count: 1, hasMore: false }
    })
    apiMocks.getApplicationLayout.mockResolvedValue({ item, widgets })
    apiMocks.listApplicationLayoutWidgetObject.mockResolvedValue(marketingWidgetDefinitions)
    return item
}

export const marketingResetLocaleCases = [
    {
        language: 'en',
        label: enApplicationsLocale.applications.layouts.widgetResetToSource,
        namedLabel: enApplicationsLocale.applications.layouts.widgetResetToSourceNamed.replace('{{label}}', 'Collection: Collection'),
        pending: enApplicationsLocale.applications.layouts.widgetResetToSourcePending,
        success: enApplicationsLocale.applications.layouts.widgetResetToSourceSuccess,
        error: enApplicationsLocale.applications.layouts.widgetResetToSourceError,
        conflict: enApplicationsLocale.applications.layouts.widgetResetToSourceConflict
    },
    {
        language: 'ru',
        label: ruApplicationsLocale.applications.layouts.widgetResetToSource,
        namedLabel: ruApplicationsLocale.applications.layouts.widgetResetToSourceNamed.replace('{{label}}', 'Collection: Collection'),
        pending: ruApplicationsLocale.applications.layouts.widgetResetToSourcePending,
        success: ruApplicationsLocale.applications.layouts.widgetResetToSourceSuccess,
        error: ruApplicationsLocale.applications.layouts.widgetResetToSourceError,
        conflict: ruApplicationsLocale.applications.layouts.widgetResetToSourceConflict
    }
] as const

export const resetApplicationLayoutsMocks = () => {
    vi.clearAllMocks()
    localStorage.clear()
    localeMocks.language = 'en'

    apiMocks.listApplicationLayoutScopes.mockResolvedValue([
        { id: 'global', scopeKind: 'global', scopeEntityId: null, kind: null, tableName: null, codename: {}, name: 'Global' }
    ])
    apiMocks.listApplicationLayouts.mockResolvedValue({
        items: [
            {
                id: 'layout-1',
                scopeId: 'global',
                scopeKind: 'global',
                scopeEntityId: null,
                templateKey: 'dashboard',
                name: { en: 'Homepage' },
                description: null,
                config: {},
                isActive: true,
                isDefault: true,
                sortOrder: 0,
                sourceKind: 'application',
                sourceLayoutId: null,
                sourceSnapshotHash: null,
                sourceContentHash: null,
                localContentHash: null,
                syncState: 'clean',
                isSourceExcluded: false,
                version: 1
            }
        ],
        pagination: { total: 1, limit: 100, offset: 0, count: 1, hasMore: false }
    })
    apiMocks.getApplicationLayout.mockResolvedValue({
        item: {
            id: 'layout-1',
            scopeId: 'global',
            scopeKind: 'global',
            scopeEntityId: null,
            templateKey: 'dashboard',
            name: { en: 'Homepage' },
            description: null,
            config: {},
            isActive: true,
            isDefault: true,
            sortOrder: 0,
            sourceKind: 'application',
            sourceLayoutId: null,
            sourceSnapshotHash: null,
            sourceContentHash: null,
            localContentHash: null,
            syncState: 'clean',
            isSourceExcluded: false,
            version: 1
        },
        widgets: [
            {
                id: 'widget-top-1',
                layoutId: 'layout-1',
                zone: 'top',
                widgetKey: 'overviewCards',
                instanceKey: 'overview-cards-main',
                parentWidgetId: null,
                slotKey: null,
                sortOrder: 0,
                config: {},
                isActive: true,
                version: 1
            },
            {
                id: 'widget-center-1',
                layoutId: 'layout-1',
                zone: 'center',
                widgetKey: 'menuWidget',
                instanceKey: 'menu-main',
                parentWidgetId: null,
                slotKey: null,
                sortOrder: 0,
                config: { variant: 'generated' },
                isActive: true,
                version: 3
            },
            {
                id: 'widget-bottom-1',
                layoutId: 'layout-1',
                zone: 'bottom',
                widgetKey: 'footer',
                instanceKey: 'footer-inactive',
                parentWidgetId: null,
                slotKey: null,
                sortOrder: 0,
                config: {},
                isActive: false,
                version: 1
            },
            {
                id: 'widget-matrix-1',
                layoutId: 'layout-1',
                zone: 'center',
                widgetKey: 'interpretationNetworkWorkspace',
                instanceKey: 'interpretation-main',
                parentWidgetId: null,
                slotKey: null,
                sortOrder: 1,
                config: {
                    matrixMode: 'hierarchicalCells',
                    allowedMatrixViews: ['table', 'horizontalRows'],
                    defaultMatrixView: 'table',
                    splitPane: { enabled: true }
                },
                sourceConfig: {
                    matrixMode: 'hierarchicalCells',
                    allowedMatrixViews: ['table'],
                    defaultMatrixView: 'table',
                    splitPane: { enabled: false }
                },
                isCustomized: true,
                isActive: true,
                version: 2
            },
            {
                id: 'widget-workspace-switcher-1',
                layoutId: 'layout-1',
                zone: 'left',
                widgetKey: 'workspaceSwitcher',
                instanceKey: 'workspace-switcher-main',
                parentWidgetId: null,
                slotKey: null,
                sortOrder: 1,
                config: {},
                isActive: true,
                version: 1
            },
            {
                id: 'widget-divider-1',
                layoutId: 'layout-1',
                zone: 'left',
                widgetKey: 'divider',
                instanceKey: 'divider-main',
                parentWidgetId: null,
                slotKey: null,
                sortOrder: 2,
                config: {},
                isActive: true,
                version: 1
            }
        ]
    })
    apiMocks.listApplicationLayoutWidgetObject.mockResolvedValue([
        {
            key: 'menuWidget',
            allowedZones: ['left', 'center'],
            allowedZonesByTemplate: { dashboard: ['left', 'center'] },
            multiInstance: true,
            templateKey: 'dashboard',
            supportedTemplates: ['dashboard'],
            labelKey: 'layouts.widgets.menuWidget',
            defaultLabel: 'Menu'
        },
        {
            key: 'overviewCards',
            allowedZones: ['top', 'right'],
            allowedZonesByTemplate: { dashboard: ['top', 'right'] },
            multiInstance: true,
            templateKey: 'dashboard',
            supportedTemplates: ['dashboard'],
            labelKey: 'layouts.widgets.overviewCards',
            defaultLabel: 'Overview cards',
            sourcePolicy: { authority: 'metahub-source', sourceMode: 'required', inheritBindings: true, inheritComposition: false },
            applicationPlacementOverrides: { active: true, order: 'root-only', zone: false, parentSlot: false }
        },
        {
            key: 'interpretationNetworkWorkspace',
            allowedZones: ['center'],
            allowedZonesByTemplate: { dashboard: ['center'] },
            multiInstance: true,
            templateKey: 'dashboard',
            supportedTemplates: ['dashboard'],
            labelKey: 'layouts.widgets.interpretationNetworkWorkspace',
            defaultLabel: 'Interpretation network workspace'
        },
        {
            key: 'workspaceSwitcher',
            allowedZones: ['left'],
            allowedZonesByTemplate: { dashboard: ['left'] },
            multiInstance: true,
            templateKey: 'dashboard',
            supportedTemplates: ['dashboard'],
            labelKey: 'layouts.widgets.workspaceSwitcher',
            defaultLabel: 'Workspace switcher'
        },
        {
            key: 'divider',
            allowedZones: ['left', 'top', 'bottom', 'right'],
            allowedZonesByTemplate: { dashboard: ['left', 'top', 'bottom', 'right'] },
            multiInstance: true,
            templateKey: 'dashboard',
            supportedTemplates: ['dashboard'],
            labelKey: 'layouts.widgets.divider',
            defaultLabel: 'Divider'
        }
    ])
    apiMocks.moveApplicationLayoutWidget.mockResolvedValue({
        id: 'widget-divider-1',
        layoutId: 'layout-1',
        zone: 'top',
        widgetKey: 'divider',
        instanceKey: 'divider-main',
        parentWidgetId: null,
        slotKey: null,
        sortOrder: 1,
        config: {},
        isActive: true,
        version: 2
    })
    apiMocks.toggleApplicationLayoutWidget.mockResolvedValue({})
    apiMocks.upsertApplicationLayoutWidget.mockResolvedValue({})
    apiMocks.deleteApplicationLayoutWidget.mockResolvedValue(undefined)
    apiMocks.resetApplicationLayoutWidgetConfigsBatch.mockResolvedValue([])
    apiMocks.resetApplicationLayoutConfig.mockResolvedValue({})
    confirmMocks.confirm.mockResolvedValue(true)
    apiMocks.updateApplicationLayoutWidgetConfig.mockResolvedValue({})
    apiMocks.createApplicationLayout.mockResolvedValue({})
    apiMocks.updateApplicationLayout.mockResolvedValue({})
    apiMocks.deleteApplicationLayout.mockResolvedValue(undefined)
    apiMocks.copyApplicationLayout.mockResolvedValue({})
}
