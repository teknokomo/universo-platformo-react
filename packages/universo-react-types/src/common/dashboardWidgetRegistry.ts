import { z } from 'zod'

import { layoutWidgetPresentationFieldSchema } from './widgetBindings'
import { interpretationNetworkWorkspaceWidgetConfigSchema } from './interpretationNetworkLayout'
import {
    dashboardLayoutWidgetRegistrySchema,
    placementLineageStateSchema,
    type DashboardLayoutWidgetDefinition,
    type DashboardWidgetConfigFieldOwner,
    type PlacementLineageState,
    type PlacementSourcePolicy
} from './dashboardWidgetOwnership'
import { DASHBOARD_WIDGET_CONFIG_SCHEMAS, type DashboardLayoutWidgetKey } from './dashboardWidgetConfigSchemas'
import {
    DASHBOARD_SEMANTIC_KEY_PATTERN,
    component,
    makeBindingSlot,
    contentSlot,
    metricSetSlot,
    seriesSlot,
    rowsSlot,
    libraryRowsSlot,
    learnerEnrollmentRowsSlot,
    menuItemsSlot,
    numberField,
    switchField,
    selectField,
    sourceOptional,
    sourceRequired,
    sourceSpecialized,
    sourceManagedAuthoring,
    registerWidget,
    hostPolicy,
    structuralPolicy,
    boundPolicy,
    specializedPolicy
} from './dashboardWidgetPolicyHelpers'

export * from './dashboardWidgetOwnership'
export * from './dashboardWidgetConfigSchemas'

const commonPresentationOverrides = { active: true, order: 'root-only', zone: false, parentSlot: false } as const
const noApplicationPlacementOverrides = { active: false, order: 'none', zone: false, parentSlot: false } as const
const noPlacementCopy = { placement: 'none', binding: 'none' } as const

const panelSlot = makeBindingSlot(
    'panel',
    'relation-set',
    [
        component('parent', 'Parent', 'ref', false, true, { allowServerOwnedRead: true }),
        component('title', 'Title', 'string', true, true, { maxLength: 255 }),
        component('order', 'SortOrder', 'number', false, true, { allowServerOwnedRead: true })
    ],
    {
        required: false,
        maxResolvedRecords: 500,
        relation: { field: 'parent', parentSlot: 'parent' },
        orderByField: 'order'
    }
)

const dashboardWidgetRegistry = [
    registerWidget(
        'workspaceSwitcher',
        ['left'],
        true,
        hostPolicy(['shell'], {
            presentationFields: [selectField('variant', 'Workspace switcher style', ['compact', 'wide'])],
            configFields: [{ path: 'variant', owner: 'presentation' }],
            applicationPlacementOverrides: commonPresentationOverrides
        })
    ),
    registerWidget(
        'divider',
        ['left', 'top', 'bottom', 'right'],
        true,
        structuralPolicy(['shell', 'optional'], {
            presentationFields: [
                selectField('orientation', 'Divider direction', ['horizontal', 'vertical']),
                numberField('spacing', 'Divider spacing', 8, 0, 32)
            ],
            configFields: [
                { path: 'orientation', owner: 'presentation' },
                { path: 'spacing', owner: 'presentation' }
            ],
            applicationPlacementOverrides: commonPresentationOverrides
        })
    ),
    registerWidget(
        'menuWidget',
        ['left'],
        true,
        boundPolicy('entity', sourceOptional, 'share-bindings', 'record-set', [], ['shell'], {
            initialBindingVariantKey: 'generated',
            sourcePolicy: { ...sourceOptional, sourceMode: 'optional' },
            bindingVariants: {
                generated: [],
                manual: [
                    menuItemsSlot(),
                    makeBindingSlot(
                        'heading',
                        'semantic-key',
                        [
                            component('key', 'Key', 'string', false, true, {
                                semanticKey: true,
                                maxLength: 128,
                                pattern: DASHBOARD_SEMANTIC_KEY_PATTERN
                            }),
                            component('title', 'Title', 'string', true, true, { maxLength: 255 })
                        ],
                        {
                            required: false,
                            entityKinds: ['object']
                        }
                    )
                ]
            },
            configFields: [{ path: 'variant', owner: 'host-runtime' }],
            copyPolicy: { placement: 'copy', binding: 'share-bindings' },
            capabilities: ['dashboard.host', 'dashboard.content']
        })
    ),
    registerWidget(
        'spacer',
        ['left', 'right'],
        true,
        structuralPolicy(['shell', 'optional'], {
            presentationFields: [numberField('flex', 'Spacer size', 1, 0, 8), numberField('minSize', 'Minimum spacer size', 0, 0, 256)],
            configFields: [
                { path: 'flex', owner: 'presentation' },
                { path: 'minSize', owner: 'presentation' }
            ],
            applicationPlacementOverrides: commonPresentationOverrides
        })
    ),
    registerWidget(
        'infoCard',
        ['left', 'right'],
        true,
        boundPolicy('entity', sourceRequired, 'clone-record', 'single-record', [contentSlot()], ['optional', 'demo'], {
            presentationFields: [selectField('severity', 'Information card style', ['info', 'success', 'warning', 'error'])],
            configFields: [{ path: 'severity', owner: 'presentation' }]
        })
    ),
    registerWidget(
        'userProfile',
        ['left'],
        true,
        hostPolicy(['shell'], {
            presentationFields: [selectField('variant', 'Profile style', ['compact', 'wide'])],
            configFields: [{ path: 'variant', owner: 'presentation' }],
            applicationPlacementOverrides: commonPresentationOverrides
        })
    ),
    registerWidget(
        'appNavbar',
        ['top'],
        false,
        hostPolicy(['shell'], {
            copyPolicy: noPlacementCopy,
            applicationPlacementOverrides: noApplicationPlacementOverrides
        })
    ),
    registerWidget(
        'header',
        ['top'],
        false,
        hostPolicy(['shell'], {
            copyPolicy: noPlacementCopy,
            applicationPlacementOverrides: noApplicationPlacementOverrides
        })
    ),
    registerWidget(
        'breadcrumbs',
        ['top'],
        true,
        hostPolicy(['shell'], {
            presentationFields: [
                numberField('maxItems', 'Maximum breadcrumb items', 5, 1, 32),
                selectField('overflow', 'Breadcrumb overflow', ['collapse', 'scroll'])
            ],
            configFields: [
                { path: 'maxItems', owner: 'presentation' },
                { path: 'overflow', owner: 'presentation' }
            ],
            applicationPlacementOverrides: commonPresentationOverrides
        })
    ),
    registerWidget(
        'search',
        ['top'],
        true,
        hostPolicy(['shell', 'optional'], {
            presentationFields: [selectField('width', 'Search width', ['compact', 'standard', 'wide'])],
            configFields: [
                { path: 'width', owner: 'presentation' },
                { path: 'placeholder', owner: 'presentation' }
            ],
            applicationPlacementOverrides: commonPresentationOverrides
        })
    ),
    registerWidget(
        'datePicker',
        ['top'],
        true,
        hostPolicy(['optional'], {
            presentationFields: [
                selectField('selection', 'Date selection', ['single', 'range']),
                switchField('showPresets', 'Show date presets', true)
            ],
            configFields: [
                { path: 'selection', owner: 'presentation' },
                { path: 'showPresets', owner: 'presentation' }
            ],
            applicationPlacementOverrides: commonPresentationOverrides
        })
    ),
    registerWidget(
        'optionsMenu',
        ['top'],
        true,
        hostPolicy(['shell'], {
            presentationFields: [selectField('density', 'Actions menu density', ['compact', 'standard'])],
            configFields: [
                { path: 'density', owner: 'presentation' },
                { path: 'visibleActions', owner: 'host-runtime' }
            ],
            applicationPlacementOverrides: commonPresentationOverrides
        })
    ),
    registerWidget(
        'languageSwitcher',
        ['top'],
        false,
        hostPolicy(['shell'], {
            requiredHostCapabilities: ['locale.state', 'locale.change', 'keyboard.focus', 'accessibility.label', 'theme.safe'],
            copyPolicy: noPlacementCopy,
            applicationPlacementOverrides: noApplicationPlacementOverrides
        })
    ),
    registerWidget(
        'colorModeSwitcher',
        ['top'],
        false,
        hostPolicy(['shell'], {
            requiredHostCapabilities: ['keyboard.focus', 'accessibility.label', 'theme.safe'],
            copyPolicy: noPlacementCopy,
            applicationPlacementOverrides: noApplicationPlacementOverrides
        })
    ),
    registerWidget(
        'overviewTitle',
        ['center'],
        true,
        boundPolicy('entity', sourceRequired, 'clone-record', 'single-record', [contentSlot()], ['optional', 'demo'], {
            presentationFields: [
                selectField('align', 'Heading alignment', ['left', 'center', 'right']),
                selectField('level', 'Heading level', ['h1', 'h2', 'h3'])
            ],
            configFields: [
                { path: 'align', owner: 'presentation' },
                { path: 'level', owner: 'presentation' }
            ]
        })
    ),
    registerWidget(
        'overviewCards',
        ['center'],
        true,
        boundPolicy(
            'bounded-data',
            sourceRequired,
            'share-bindings',
            'record-set',
            [metricSetSlot()],
            ['optional', 'demo', 'specialized'],
            {
                presentationFields: [
                    numberField('maxCards', 'Maximum metric cards', 4, 1, 8),
                    selectField('density', 'Metric card density', ['compact', 'standard', 'comfortable'])
                ],
                configFields: [
                    { path: 'maxCards', owner: 'presentation' },
                    { path: 'density', owner: 'presentation' },
                    { path: 'trendDisplay', owner: 'presentation' }
                ]
            }
        )
    ),
    registerWidget(
        'sessionsChart',
        ['center'],
        true,
        boundPolicy('bounded-data', sourceRequired, 'share-bindings', 'record-set', [seriesSlot()], ['optional', 'demo', 'specialized'], {
            presentationFields: [
                selectField('interval', 'Chart interval', ['hour', 'day', 'week', 'month', 'quarter']),
                numberField('maxPoints', 'Maximum chart points', 90, 1, 366)
            ],
            configFields: [
                { path: 'title', owner: 'presentation' },
                { path: 'interval', owner: 'presentation' },
                { path: 'chartStyle', owner: 'presentation' },
                { path: 'maxPoints', owner: 'presentation' }
            ]
        })
    ),
    registerWidget(
        'pageViewsChart',
        ['center'],
        true,
        boundPolicy('bounded-data', sourceRequired, 'share-bindings', 'record-set', [seriesSlot()], ['optional', 'demo', 'specialized'], {
            presentationFields: [
                selectField('interval', 'Chart interval', ['hour', 'day', 'week', 'month', 'quarter']),
                numberField('maxPoints', 'Maximum chart points', 90, 1, 366)
            ],
            configFields: [
                { path: 'title', owner: 'presentation' },
                { path: 'interval', owner: 'presentation' },
                { path: 'chartStyle', owner: 'presentation' },
                { path: 'maxPoints', owner: 'presentation' }
            ]
        })
    ),
    registerWidget(
        'detailsTitle',
        ['center'],
        true,
        boundPolicy('entity', sourceRequired, 'clone-record', 'single-record', [contentSlot()], ['optional', 'demo'], {
            presentationFields: [
                selectField('align', 'Heading alignment', ['left', 'center', 'right']),
                selectField('level', 'Heading level', ['h1', 'h2', 'h3'])
            ],
            configFields: [
                { path: 'align', owner: 'presentation' },
                { path: 'level', owner: 'presentation' }
            ]
        })
    ),
    registerWidget(
        'detailsTable',
        ['center'],
        true,
        boundPolicy('entity', sourceRequired, 'share-bindings', 'record-set', [rowsSlot()], ['optional', 'demo', 'specialized'], {
            bindingVariants: {
                records: [rowsSlot()],
                library: [libraryRowsSlot()],
                'learner-enrollments': [learnerEnrollmentRowsSlot()],
                report: []
            },
            initialBindingVariantKey: 'records',
            variantOverrides: {
                report: {
                    sourceClass: 'specialized-runtime',
                    sourcePolicy: sourceSpecialized,
                    presentationFields: [],
                    configFields: [
                        { path: 'rowHeight', owner: 'presentation' },
                        { path: 'reportCodename', owner: 'specialized-runtime' },
                        { path: 'variant', owner: 'specialized-runtime' }
                    ],
                    authoring: sourceManagedAuthoring('none', 'none'),
                    copyPolicy: { placement: 'copy', binding: 'none' },
                    capabilities: ['dashboard.runtime']
                },
                'learner-enrollments': {
                    sourcePolicy: sourceRequired,
                    presentationFields: [],
                    configFields: [
                        { path: 'rowHeight', owner: 'presentation' },
                        { path: 'maxRows', owner: 'presentation' },
                        { path: 'variant', owner: 'specialized-runtime' }
                    ],
                    authoring: sourceManagedAuthoring('none', 'none'),
                    copyPolicy: { placement: 'copy', binding: 'share-bindings' },
                    capabilities: ['dashboard.content', 'dashboard.runtime']
                }
            },
            presentationFields: [
                switchField('showSearch', 'Show search', true),
                switchField('showViewToggle', 'Show view toggle', false),
                selectField('defaultViewMode', 'Default view', ['table', 'card']),
                switchField('enableRowReordering', 'Allow row reordering', false),
                numberField('maxRows', 'Maximum visible rows', 50, 1, 500)
            ],
            configFields: [
                { path: 'showSearch', owner: 'presentation' },
                { path: 'showViewToggle', owner: 'presentation' },
                { path: 'defaultViewMode', owner: 'presentation' },
                { path: 'showFilterBar', owner: 'presentation' },
                { path: 'enableRowReordering', owner: 'presentation' },
                { path: 'cardColumns', owner: 'presentation' },
                { path: 'rowHeight', owner: 'presentation' },
                { path: 'maxRows', owner: 'presentation' },
                { path: 'libraryView', owner: 'specialized-runtime' },
                { path: 'lifecycleState', owner: 'specialized-runtime' },
                { path: 'targetFilters[]', owner: 'specialized-runtime' },
                { path: 'createTargets[]', owner: 'specialized-runtime' },
                { path: 'rowActions[]', owner: 'specialized-runtime' },
                { path: 'restoreTarget', owner: 'specialized-runtime' },
                { path: 'rowCountWarning', owner: 'presentation' },
                { path: 'sequencePolicy', owner: 'specialized-runtime' },
                { path: 'reportCodename', owner: 'specialized-runtime' },
                { path: 'variant', owner: 'specialized-runtime' },
                { path: 'workflowActions[]', owner: 'specialized-runtime' }
            ]
        })
    ),
    registerWidget(
        'relationBuilder',
        ['center'],
        true,
        boundPolicy(
            'entity',
            sourceOptional,
            'share-bindings',
            'multi-slot',
            [
                makeBindingSlot(
                    'parent',
                    'record-set',
                    [
                        component('title', 'Title', 'string', true, true, { maxLength: 255 }),
                        component('order', 'SortOrder', 'number', false, true, { allowServerOwnedRead: true })
                    ],
                    { required: false, maxResolvedRecords: 100, orderByField: 'order' }
                ),
                panelSlot
            ],
            ['optional', 'specialized'],
            {
                bindingSlotFamilies: [
                    {
                        familyKey: 'panel',
                        slotPrefix: 'panel:',
                        memberKeyPattern: '^[A-Za-z][A-Za-z0-9._-]{0,63}$',
                        selectorKinds: ['relation-set'],
                        cardinality: { min: 0, max: 16 },
                        maxMembers: 16,
                        requirements: panelSlot.requirements,
                        relation: { field: 'parent', parentSlot: 'parent' }
                    }
                ],
                presentationFields: [
                    switchField('wizardMode', 'Use guided relation editing', false),
                    switchField('enableRowReordering', 'Allow row reordering', false)
                ],
                configFields: [
                    { path: 'wizardMode', owner: 'presentation' },
                    { path: 'enableRowReordering', owner: 'presentation' },
                    { path: 'panels[].slotKey', owner: 'composition' },
                    { path: 'panels[].title', owner: 'presentation' },
                    { path: 'panels[].width', owner: 'presentation' },
                    { path: 'panels[].order', owner: 'composition' },
                    { path: 'panels[].parentFieldCodename', owner: 'specialized-runtime' },
                    { path: 'panels[].sortOrderFieldCodename', owner: 'specialized-runtime' },
                    { path: 'panels[].displayFields[]', owner: 'specialized-runtime' },
                    { path: 'panels[].enableRowReordering', owner: 'presentation' },
                    { path: 'panels[].createDefaults[]', owner: 'specialized-runtime' },
                    { path: 'panels[].createWizard.steps[]', owner: 'specialized-runtime' },
                    { path: 'panels[].rowCountWarning', owner: 'presentation' },
                    { path: 'parentLabel', owner: 'presentation' },
                    { path: 'parentTitleFieldCodename', owner: 'specialized-runtime' },
                    { path: 'emptyParentMessage', owner: 'presentation' }
                ]
            }
        )
    ),
    registerWidget(
        'columnsContainer',
        ['center'],
        true,
        structuralPolicy(['optional', 'demo', 'specialized'], {
            composition: {
                sourceOwned: true,
                container: {
                    kind: 'columns',
                    slots: [
                        {
                            slotPrefix: 'column:',
                            slotKeyPattern: '^[A-Za-z][A-Za-z0-9._-]{0,63}$',
                            minSlots: 1,
                            maxSlots: 12,
                            allowedChildCapabilities: ['dashboard.content', 'dashboard.host', 'dashboard.runtime']
                        }
                    ],
                    childrenAreFirstClassPlacements: true
                }
            },
            presentationFields: [],
            configFields: [
                { path: 'columns[].slotKey', owner: 'composition' },
                { path: 'columns[].width', owner: 'presentation' }
            ]
        })
    ),
    registerWidget(
        'detailsTabs',
        ['center'],
        true,
        structuralPolicy(['optional', 'demo', 'specialized'], {
            composition: {
                sourceOwned: true,
                container: {
                    kind: 'tabs',
                    slots: [
                        {
                            slotPrefix: 'tab:',
                            slotKeyPattern: '^[A-Za-z][A-Za-z0-9._-]{0,63}$',
                            minSlots: 1,
                            maxSlots: 8,
                            allowedChildCapabilities: ['dashboard.content', 'dashboard.host', 'dashboard.runtime']
                        }
                    ],
                    childrenAreFirstClassPlacements: true
                }
            },
            configFields: [
                { path: 'tabs[].slotKey', owner: 'composition' },
                { path: 'tabs[].label', owner: 'presentation' },
                { path: 'tabs[].isDefault', owner: 'presentation' }
            ]
        })
    ),
    registerWidget(
        'interpretationNetworkWorkspace',
        ['center'],
        true,
        specializedPolicy(['specialized'], {
            applicationPlacementOverrides: commonPresentationOverrides,
            configFields: Object.keys(interpretationNetworkWorkspaceWidgetConfigSchema.innerType().shape).map((path) => ({
                path,
                owner: [
                    'structureMode',
                    'matrixMode',
                    'allowedMatrixViews',
                    'defaultMatrixView',
                    'tableProjection',
                    'breadcrumbDepth',
                    'toolbarLayout',
                    'showHierarchicalTableHeaders',
                    'showHierarchicalTableHeaderCard',
                    'showMatrixTreeTotalCells',
                    'colorBreadcrumbsByCell',
                    'splitPane',
                    'templatePanel',
                    'hierarchyRowMode',
                    'positionNumbering',
                    'allowNewAxesInCellDialog'
                ].includes(path)
                    ? 'presentation'
                    : 'specialized-runtime'
            }))
        })
    ),
    registerWidget(
        'quizWidget',
        ['center', 'right'],
        true,
        specializedPolicy(['specialized'], {
            configFields: [
                { path: 'moduleCodename', owner: 'specialized-runtime' },
                { path: 'attachedToKind', owner: 'specialized-runtime' },
                { path: 'serverModuleCodename', owner: 'specialized-runtime' },
                { path: 'mountMethodName', owner: 'specialized-runtime' },
                { path: 'submitMethodName', owner: 'specialized-runtime' }
            ]
        })
    ),
    registerWidget(
        'playcanvasCanvas',
        ['center'],
        true,
        specializedPolicy(['specialized'], {
            presentationFields: [
                numberField('minHeight', 'Minimum canvas height', 480, 320, 1200),
                selectField('heightMode', 'Canvas height mode', ['fixed', 'fitViewport'])
            ],
            configFields: [
                { path: 'title', owner: 'presentation' },
                { path: 'moduleCodename', owner: 'specialized-runtime' },
                { path: 'attachedToKind', owner: 'specialized-runtime' },
                { path: 'mountMethodName', owner: 'specialized-runtime' },
                { path: 'serverModuleCodename', owner: 'specialized-runtime' },
                { path: 'emptyStateTitle', owner: 'presentation' },
                { path: 'emptyStateDescription', owner: 'presentation' },
                { path: 'runtimeManifest', owner: 'specialized-runtime' },
                { path: 'minHeight', owner: 'presentation' },
                { path: 'heightMode', owner: 'presentation' },
                { path: 'camera.distance', owner: 'presentation' },
                { path: 'camera.minDistance', owner: 'presentation' },
                { path: 'camera.maxDistance', owner: 'presentation' },
                { path: 'scene', owner: 'specialized-runtime' }
            ]
        })
    ),
    registerWidget(
        'resourcePreview',
        ['center', 'right'],
        true,
        boundPolicy(
            'entity',
            sourceOptional,
            'share-bindings',
            'single-record',
            [
                makeBindingSlot(
                    'resource',
                    'semantic-key',
                    [component('title', 'Title', 'string', true, false), component('resource', 'Resource', 'string')],
                    { required: false, entityKinds: ['object', 'page'] }
                )
            ],
            ['optional', 'specialized'],
            {
                presentationFields: [selectField('displayMode', 'Resource preview style', ['card', 'compact', 'embedded'])],
                configFields: [
                    { path: 'displayMode', owner: 'presentation' },
                    { path: 'titleOverride', owner: 'presentation' }
                ]
            }
        )
    ),
    registerWidget(
        'learnerPlayer',
        ['center'],
        true,
        boundPolicy(
            'bounded-data',
            sourceRequired,
            'share-bindings',
            'multi-slot',
            [
                makeBindingSlot(
                    'parent',
                    'record-set',
                    [component('title', 'Title', 'string', true, true, { maxLength: 255 }), component('order', 'SortOrder', 'number')],
                    { maxResolvedRecords: 100, orderByField: 'order' }
                ),
                makeBindingSlot(
                    'items',
                    'relation-set',
                    [
                        component('parent', 'Parent', 'ref'),
                        component('title', 'Title', 'string', true, true, { maxLength: 255 }),
                        component('targetObjectCodename', 'TargetObjectCodename', 'string'),
                        component('targetRecordId', 'TargetRecordId', 'string'),
                        component('order', 'SortOrder', 'number')
                    ],
                    {
                        maxResolvedRecords: 100,
                        relation: { field: 'parent', parentSlot: 'parent' },
                        orderByField: 'order'
                    }
                )
            ],
            ['specialized'],
            {
                bindingVariants: {
                    course: [
                        makeBindingSlot(
                            'parent',
                            'record-set',
                            [
                                component('title', 'Title', 'string', true, true, { maxLength: 255 }),
                                component('order', 'SortOrder', 'number', false, true, { allowServerOwnedRead: true })
                            ],
                            { maxResolvedRecords: 100, orderByField: 'order' }
                        ),
                        makeBindingSlot(
                            'items',
                            'relation-set',
                            [
                                component('parent', 'CourseId', 'ref', false, true, { allowServerOwnedRead: true }),
                                component('title', 'Title', 'string', true, true, { maxLength: 255 }),
                                component('targetObjectCodename', 'TargetObjectCodename', 'string'),
                                component('targetRecordId', 'TargetRecordId', 'string'),
                                component('order', 'SortOrder', 'number', false, true, { allowServerOwnedRead: true })
                            ],
                            {
                                maxResolvedRecords: 100,
                                relation: { field: 'parent', parentSlot: 'parent' },
                                orderByField: 'order'
                            }
                        )
                    ],
                    track: [
                        makeBindingSlot(
                            'parent',
                            'record-set',
                            [
                                component('title', 'Title', 'string', true, true, { maxLength: 255 }),
                                component('order', 'SortOrder', 'number', false, true, { allowServerOwnedRead: true })
                            ],
                            { maxResolvedRecords: 100, orderByField: 'order' }
                        ),
                        makeBindingSlot(
                            'items',
                            'relation-set',
                            [
                                component('parent', 'TrackId', 'ref', false, true, { allowServerOwnedRead: true }),
                                component('title', 'Title', 'string', true, true, { maxLength: 255 }),
                                component('targetRecordId', 'CourseId', 'ref'),
                                component('order', 'SortOrder', 'number', false, true, { allowServerOwnedRead: true })
                            ],
                            {
                                maxResolvedRecords: 100,
                                relation: { field: 'parent', parentSlot: 'parent' },
                                orderByField: 'order'
                            }
                        )
                    ]
                },
                initialBindingVariantKey: 'course',
                presentationFields: [
                    selectField('displayMode', 'Player presentation', ['list', 'player']),
                    selectField('sequenceMode', 'Sequence behavior', ['strict', 'flexible'])
                ],
                configFields: [
                    { path: 'variant', owner: 'specialized-runtime' },
                    { path: 'displayMode', owner: 'presentation' },
                    { path: 'sequenceMode', owner: 'specialized-runtime' }
                ]
            }
        )
    ),
    registerWidget(
        'footer',
        ['bottom'],
        true,
        hostPolicy(['shell', 'optional'], {
            presentationFields: [
                selectField('alignment', 'Footer alignment', ['left', 'center', 'right']),
                selectField('spacing', 'Footer spacing', ['compact', 'standard', 'spacious'])
            ],
            configFields: [
                { path: 'alignment', owner: 'presentation' },
                { path: 'spacing', owner: 'presentation' },
                { path: 'showLegalLinks', owner: 'presentation' },
                { path: 'showContact', owner: 'presentation' }
            ],
            applicationPlacementOverrides: commonPresentationOverrides
        })
    )
] as const satisfies readonly DashboardLayoutWidgetDefinition[]

/** Canonical serializable registry for every retained Dashboard widget. */
export const DASHBOARD_LAYOUT_WIDGET_REGISTRY = dashboardWidgetRegistry
export const DASHBOARD_LAYOUT_WIDGETS: typeof DASHBOARD_LAYOUT_WIDGET_REGISTRY = DASHBOARD_LAYOUT_WIDGET_REGISTRY
export const dashboardWidgetRegistrySchema = dashboardLayoutWidgetRegistrySchema
export type DashboardLayoutWidgetKeyFromRegistry = (typeof DASHBOARD_LAYOUT_WIDGET_REGISTRY)[number]['key']

export const dashboardWidgetConfigSchemaByKey = DASHBOARD_WIDGET_CONFIG_SCHEMAS satisfies Readonly<
    Record<DashboardLayoutWidgetKey, z.ZodTypeAny>
>

/** Resolve one retained Dashboard widget without falling back for retired keys. */
export const getDashboardWidgetDefinition = (key: string): DashboardLayoutWidgetDefinition | undefined =>
    DASHBOARD_LAYOUT_WIDGET_REGISTRY.find((definition) => definition.key === key)

export const getPlacementSourcePolicy = (definition: Pick<DashboardLayoutWidgetDefinition, 'sourcePolicy'>): PlacementSourcePolicy =>
    definition.sourcePolicy

export const getPlacementLineageState = (placement: { sourceBaseWidgetId: string | null }): PlacementLineageState =>
    placementLineageStateSchema.parse({ kind: placement.sourceBaseWidgetId === null ? 'unlinked' : 'source-linked' })

export const getDashboardWidgetConfigFields = (
    key: DashboardLayoutWidgetKey
): readonly { path: string; owner: DashboardWidgetConfigFieldOwner }[] => getDashboardWidgetDefinition(key)?.configFields ?? []

export const dashboardWidgetPresentationFieldSchema = layoutWidgetPresentationFieldSchema
