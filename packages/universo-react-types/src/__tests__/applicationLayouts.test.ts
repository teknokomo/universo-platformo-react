import { describe, expect, it } from 'vitest'

import {
    applicationLayoutCompositionSchema,
    applicationLayoutConfigResetMutationSchema,
    applicationLayoutContractSchema,
    applicationLayoutMutationSchema,
    applicationLayoutScopeSchema,
    applicationLayoutSnapshotSchema,
    applicationLayoutWidgetConfigBatchMutationSchema,
    applicationLayoutWidgetResetBatchMutationSchema,
    applicationLayoutWidgetMoveMutationSchema,
    applicationLayoutWidgetSchema,
    effectiveLayoutWidgetSchema,
    effectiveLayoutResultSchema,
    INTERPRETATION_NETWORK_SPLIT_PANE_DEFAULT,
    INTERPRETATION_NETWORK_SPLIT_PANE_MAX_PERCENT,
    INTERPRETATION_NETWORK_SPLIT_PANE_MIN_PERCENT,
    normalizeInterpretationNetworkSplitPaneSettings,
    normalizeInterpretationNetworkTableSettings,
    normalizeInterpretationNetworkMatrixViewSettings,
    parseApplicationLayoutWidgetConfig,
    runtimeTargetSchema
} from '../common/applicationLayouts'
import {
    LAYOUT_SEMANTIC_ZONE_MAPPINGS,
    LAYOUT_WIDGET_DEFINITIONS,
    LAYOUT_ZONE_DEFINITIONS,
    layoutWidgetMetadataResponseSchema
} from '../common/layoutWidgetDefinitions'
import { APPLICATION_TEMPLATE_REGISTRY } from '../common/applicationTemplates'
import { marketingLayoutWidgetReferenceSchema } from '../common/marketingPage'

describe('application layout widget config contracts', () => {
    it('keeps one complete widget metadata registry for metahub and application authoring', () => {
        const marketingWidgets = LAYOUT_WIDGET_DEFINITIONS.filter((widget) => widget.templateKey === 'marketing-page')

        expect(marketingWidgets.map((widget) => widget.key)).toEqual([
            'marketing.navigation',
            'marketing.hero',
            'marketing.collection',
            'marketing.pricing',
            'marketing.footer'
        ])
        expect(LAYOUT_WIDGET_DEFINITIONS.every((widget) => widget.labelKey && widget.defaultLabel)).toBe(true)
        expect(marketingWidgets.every((widget) => widget.labelKey === `layouts.widgets.${widget.key}`)).toBe(true)

        const languageSwitcher = LAYOUT_WIDGET_DEFINITIONS.find((widget) => widget.key === 'languageSwitcher')
        expect(languageSwitcher).toMatchObject({
            shared: true,
            supportedTemplates: ['dashboard', 'marketing-page'],
            allowedZonesByTemplate: {
                dashboard: ['top'],
                'marketing-page': ['marketing-header']
            },
            requiredHostCapabilities: ['locale.state', 'locale.change', 'keyboard.focus', 'accessibility.label', 'theme.safe']
        })
    })

    it('validates the complete widget metadata transport envelope', () => {
        const dashboardWidget = LAYOUT_WIDGET_DEFINITIONS.find((widget) => widget.key === 'languageSwitcher')
        if (!dashboardWidget) throw new Error('languageSwitcher metadata is missing')

        const response = {
            items: [dashboardWidget],
            templates: [
                {
                    ...APPLICATION_TEMPLATE_REGISTRY.dashboard,
                    zones: LAYOUT_ZONE_DEFINITIONS.filter((zone) => zone.templateKey === 'dashboard'),
                    widgets: [dashboardWidget]
                }
            ]
        }

        expect(layoutWidgetMetadataResponseSchema.safeParse(response).success).toBe(true)
        expect(
            layoutWidgetMetadataResponseSchema.safeParse({
                ...response,
                items: [{ key: 'languageSwitcher', templateKey: 'dashboard' }]
            }).success
        ).toBe(false)
    })

    it('keeps canonical localized metadata for every layout zone', () => {
        expect(LAYOUT_ZONE_DEFINITIONS).toEqual([
            { key: 'left', templateKey: 'dashboard', semanticRegion: 'sidebar', labelKey: 'layouts.zones.left', defaultLabel: 'Left' },
            { key: 'top', templateKey: 'dashboard', semanticRegion: 'header', labelKey: 'layouts.zones.top', defaultLabel: 'Top' },
            { key: 'right', templateKey: 'dashboard', semanticRegion: 'auxiliary', labelKey: 'layouts.zones.right', defaultLabel: 'Right' },
            { key: 'bottom', templateKey: 'dashboard', semanticRegion: 'footer', labelKey: 'layouts.zones.bottom', defaultLabel: 'Bottom' },
            { key: 'center', templateKey: 'dashboard', semanticRegion: 'main', labelKey: 'layouts.zones.center', defaultLabel: 'Center' },
            {
                key: 'marketing-header',
                templateKey: 'marketing-page',
                semanticRegion: 'header',
                labelKey: 'layouts.zones.marketingHeader',
                defaultLabel: 'Marketing header'
            },
            {
                key: 'marketing-main',
                templateKey: 'marketing-page',
                semanticRegion: 'main',
                labelKey: 'layouts.zones.marketingMain',
                defaultLabel: 'Marketing content'
            },
            {
                key: 'marketing-footer',
                templateKey: 'marketing-page',
                semanticRegion: 'footer',
                labelKey: 'layouts.zones.marketingFooter',
                defaultLabel: 'Marketing footer'
            }
        ])
        expect(LAYOUT_SEMANTIC_ZONE_MAPPINGS.filter((mapping) => mapping.semanticRegion === 'main')).toEqual([
            { semanticRegion: 'main', templateKey: 'dashboard', physicalZone: 'center' },
            { semanticRegion: 'main', templateKey: 'marketing-page', physicalZone: 'marketing-main' }
        ])
    })

    it('keeps the target selector strict and excludes record identity', () => {
        const applicationId = '0190a9b5-3cde-7abc-8def-0123456789a1'
        const entityTypeId = '0190a9b5-3cde-7abc-8def-0123456789a2'

        expect(
            runtimeTargetSchema.safeParse({
                applicationId,
                targetKind: 'page',
                entityTypeId,
                locale: 'en-US',
                themeVariant: 'system'
            }).success
        ).toBe(true)
        expect(
            runtimeTargetSchema.safeParse({
                applicationId,
                targetKind: 'object',
                entityTypeCodename: 'ContentObject',
                locale: 'en'
            }).success
        ).toBe(true)
        expect(
            runtimeTargetSchema.safeParse({
                applicationId,
                targetKind: 'page',
                entityTypeId,
                entityTypeCodename: 'ContentPage',
                locale: 'en'
            }).success
        ).toBe(false)
        expect(
            runtimeTargetSchema.safeParse({
                applicationId,
                targetKind: null,
                locale: 'en',
                recordKey: 'hero'
            }).success
        ).toBe(false)
        expect(
            runtimeTargetSchema.safeParse({
                applicationId: '550e8400-e29b-41d4-a716-446655440000',
                targetKind: null,
                locale: 'en'
            }).success
        ).toBe(false)
    })

    it('requires explicit scoped composition mode and preserves mixed-template snapshots', () => {
        const dashboardId = '0190a9b5-3cde-7abc-8def-0123456789a1'
        const marketingGlobalId = '0190a9b5-3cde-7abc-8def-0123456789a2'
        const marketingScopedId = '0190a9b5-3cde-7abc-8def-0123456789a3'
        const scopeEntityId = '0190a9b5-3cde-7abc-8def-0123456789a4'

        expect(applicationLayoutCompositionSchema.safeParse({ compositionMode: 'overlay', baseLayoutId: marketingGlobalId }).success).toBe(
            true
        )
        expect(applicationLayoutCompositionSchema.safeParse({ compositionMode: 'independent', baseLayoutId: null }).success).toBe(true)
        expect(applicationLayoutCompositionSchema.safeParse({ compositionMode: 'overlay', baseLayoutId: null }).success).toBe(false)
        expect(
            applicationLayoutCompositionSchema.safeParse({ compositionMode: 'independent', baseLayoutId: marketingGlobalId }).success
        ).toBe(false)
        expect(
            applicationLayoutCompositionSchema.safeParse({
                compositionMode: 'overlay',
                baseLayoutId: '550e8400-e29b-41d4-a716-446655440000'
            }).success
        ).toBe(false)

        const layout = (overrides: Record<string, unknown>, includeComposition = true) => ({
            id: dashboardId,
            templateKey: 'dashboard',
            scopeKind: 'global',
            scopeEntityId: null,
            sourceKind: 'metahub',
            sourceLayoutId: null,
            ...(includeComposition ? { compositionMode: 'independent', baseLayoutId: null } : {}),
            widgets: [],
            ...overrides
        })

        const parsed = applicationLayoutSnapshotSchema.safeParse({
            layouts: [
                layout({ id: dashboardId, templateKey: 'dashboard' }),
                layout({ id: marketingGlobalId, templateKey: 'marketing-page' })
            ],
            scopedLayouts: [
                layout({
                    id: marketingScopedId,
                    templateKey: 'marketing-page',
                    scopeKind: 'entity',
                    scopeEntityId,
                    compositionMode: 'overlay',
                    baseLayoutId: marketingGlobalId
                }),
                layout({
                    id: '0190a9b5-3cde-7abc-8def-0123456789a5',
                    templateKey: 'marketing-page',
                    scopeKind: 'entity',
                    scopeEntityId: '0190a9b5-3cde-7abc-8def-0123456789a6',
                    compositionMode: 'independent',
                    baseLayoutId: null
                })
            ]
        })

        expect(parsed.success).toBe(true)
        expect(
            applicationLayoutContractSchema.safeParse(
                layout(
                    {
                        id: marketingScopedId,
                        templateKey: 'marketing-page',
                        scopeKind: 'entity',
                        scopeEntityId,
                        widgets: []
                    },
                    false
                )
            ).success
        ).toBe(false)
        expect(
            applicationLayoutContractSchema.safeParse(
                layout({
                    id: marketingScopedId,
                    templateKey: 'marketing-page',
                    scopeKind: 'entity',
                    scopeEntityId,
                    widgets: []
                })
            ).success
        ).toBe(true)
        expect(
            applicationLayoutSnapshotSchema.safeParse({
                layouts: [
                    layout({
                        id: marketingGlobalId,
                        templateKey: 'marketing-page',
                        compositionMode: 'overlay',
                        baseLayoutId: dashboardId
                    })
                ]
            }).success
        ).toBe(false)
    })

    it('accepts languageSwitcher only in its template-aware mapped zones', () => {
        const baseLayout = {
            id: '0190a9b5-3cde-7abc-8def-0123456789a1',
            templateKey: 'marketing-page' as const,
            scopeKind: 'global' as const,
            scopeEntityId: null,
            sourceKind: 'metahub' as const,
            sourceLayoutId: null,
            compositionMode: 'independent' as const,
            baseLayoutId: null,
            widgets: []
        }
        const languageSwitcher = {
            id: '0190a9b5-3cde-7abc-8def-0123456789a2',
            widgetKey: 'languageSwitcher' as const,
            zone: 'marketing-header' as const,
            semanticRegion: 'header' as const,
            instanceKey: 'language-switcher',
            sortOrder: 0,
            isActive: true
        }

        expect(applicationLayoutContractSchema.safeParse({ ...baseLayout, widgets: [languageSwitcher] }).success).toBe(true)
        expect(
            applicationLayoutContractSchema.safeParse({
                ...baseLayout,
                widgets: [{ ...languageSwitcher, zone: 'marketing-main', semanticRegion: 'main' }]
            }).success
        ).toBe(false)
    })

    it('preserves repeated marketing widget identities in neutral references and layout contracts', () => {
        const baseLayout = {
            id: '0190a9b5-3cde-7abc-8def-0123456789a1',
            templateKey: 'marketing-page' as const,
            scopeKind: 'global' as const,
            scopeEntityId: null,
            sourceKind: 'application' as const,
            sourceLayoutId: null,
            compositionMode: 'independent' as const,
            baseLayoutId: null
        }
        const widgets = [
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789a2',
                widgetKey: 'marketing.collection' as const,
                zone: 'marketing-main' as const,
                semanticRegion: 'main' as const,
                instanceKey: 'collection-primary',
                sortOrder: 0,
                isActive: true
            },
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789a3',
                widgetKey: 'marketing.collection' as const,
                zone: 'marketing-main' as const,
                semanticRegion: 'main' as const,
                instanceKey: 'collection-secondary',
                sortOrder: 1,
                isActive: true
            }
        ]

        const references = marketingLayoutWidgetReferenceSchema.array().parse(
            widgets.map(({ id, widgetKey, zone, instanceKey, sortOrder, isActive }) => ({
                id,
                widgetKey,
                zone,
                instanceKey,
                sortOrder,
                isActive
            }))
        )

        expect(references.map((widget) => widget.instanceKey)).toEqual(['collection-primary', 'collection-secondary'])
        expect(applicationLayoutContractSchema.safeParse({ ...baseLayout, widgets }).success).toBe(true)
        expect(
            applicationLayoutContractSchema.safeParse({
                ...baseLayout,
                widgets: [...widgets, { ...widgets[1], id: '0190a9b5-3cde-7abc-8def-0123456789a4', sortOrder: 2 }]
            }).success
        ).toBe(false)
    })

    it('validates the effective-layout success and typed failure envelopes', () => {
        const result = effectiveLayoutResultSchema.safeParse({
            status: 'ok',
            target: {
                applicationId: '0190a9b5-3cde-7abc-8def-0123456789a1',
                targetKind: 'page',
                entityTypeCodename: 'ContentPage',
                locale: 'en'
            },
            scope: 'entity',
            layout: {
                id: '0190a9b5-3cde-7abc-8def-0123456789a2',
                templateKey: 'marketing-page',
                sourceKind: 'application',
                sourceLayoutId: null,
                scopeKind: 'entity',
                scopeEntityId: '0190a9b5-3cde-7abc-8def-0123456789a3',
                compositionMode: 'independent',
                baseLayoutId: null
            },
            widgets: [],
            precedence: ['application-entity'],
            publicationIdentity: null,
            effectiveHash: 'a'.repeat(64)
        })

        expect(result.success).toBe(true)
        expect(
            effectiveLayoutResultSchema.safeParse({
                status: 'failed',
                error: { code: 'LAYOUT_TARGET_NOT_FOUND', httpStatus: 404 }
            }).success
        ).toBe(true)
        expect(
            effectiveLayoutResultSchema.safeParse({
                status: 'failed',
                error: { code: 'LAYOUT_TARGET_NOT_FOUND', httpStatus: 400 }
            }).success
        ).toBe(false)
        expect(
            effectiveLayoutResultSchema.safeParse({
                ...(result.success ? result.data : {}),
                unexpected: true
            }).success
        ).toBe(false)
    })

    it('validates the application-level marketing appearance reset payload', () => {
        expect(applicationLayoutConfigResetMutationSchema.parse({ expectedVersion: 3 })).toEqual({ expectedVersion: 3 })
        expect(applicationLayoutConfigResetMutationSchema.safeParse({}).success).toBe(false)
        expect(applicationLayoutConfigResetMutationSchema.safeParse({ expectedVersion: 0 }).success).toBe(false)
        expect(applicationLayoutConfigResetMutationSchema.safeParse({ unexpected: true }).success).toBe(false)
    })

    it('parses source-aware widget customization fields with safe defaults', () => {
        const baseWidget = {
            id: '018f8a78-7b8f-7c1d-a111-2222333344a1',
            layoutId: '018f8a78-7b8f-7c1d-a111-2222333345a1',
            zone: 'center',
            widgetKey: 'interpretationNetworkWorkspace',
            sortOrder: 1,
            config: { structureMode: 'multiple' },
            isActive: true,
            version: 1
        }

        expect(
            applicationLayoutWidgetSchema.parse({
                ...baseWidget,
                sourceConfig: null,
                sourceWidgetId: null,
                sourceBaseWidgetId: null,
                isCustomized: false
            })
        ).toMatchObject({
            sourceConfig: null,
            sourceWidgetId: null,
            sourceBaseWidgetId: null,
            isCustomized: false
        })
        expect(applicationLayoutWidgetSchema.safeParse({ ...baseWidget, id: '550e8400-e29b-41d4-a716-446655440000' }).success).toBe(false)
        expect(
            applicationLayoutWidgetSchema.parse({
                ...baseWidget,
                sourceConfig: { structureMode: 'multiple' },
                sourceWidgetId: '0190a9b5-3cde-7abc-8def-0123456789a2',
                sourceBaseWidgetId: '0190a9b5-3cde-7abc-8def-0123456789a3',
                isCustomized: false
            })
        ).toMatchObject({
            sourceConfig: { structureMode: 'multiple' },
            sourceWidgetId: '0190a9b5-3cde-7abc-8def-0123456789a2',
            sourceBaseWidgetId: '0190a9b5-3cde-7abc-8def-0123456789a3',
            isCustomized: false
        })
        expect(
            applicationLayoutWidgetSchema.parse({
                ...baseWidget,
                sourceConfig: { structureMode: 'singleSystem' },
                sourceWidgetId: '0190a9b5-3cde-7abc-8def-0123456789a2',
                sourceBaseWidgetId: '0190a9b5-3cde-7abc-8def-0123456789a3',
                isCustomized: true
            })
        ).toMatchObject({
            sourceConfig: { structureMode: 'singleSystem' },
            sourceWidgetId: '0190a9b5-3cde-7abc-8def-0123456789a2',
            sourceBaseWidgetId: '0190a9b5-3cde-7abc-8def-0123456789a3',
            isCustomized: true
        })
    })

    it('keeps effective widget identity UUID v7 strict', () => {
        const widget = {
            id: '0190a9b5-3cde-7abc-8def-0123456789a1',
            layoutId: '0190a9b5-3cde-7abc-8def-0123456789a2',
            zone: 'center' as const,
            semanticRegion: 'main' as const,
            widgetKey: 'overviewTitle' as const,
            instanceKey: 'overview-title',
            sortOrder: 0,
            config: {},
            isActive: true
        }

        expect(effectiveLayoutWidgetSchema.safeParse(widget).success).toBe(true)
        expect(effectiveLayoutWidgetSchema.safeParse({ ...widget, sortOrder: -200 }).success).toBe(true)
        expect(
            effectiveLayoutWidgetSchema.safeParse({
                ...widget,
                sourceWidgetId: '550e8400-e29b-41d4-a716-446655440000'
            }).success
        ).toBe(false)
    })

    it('validates scoped reset batches and rejects duplicate widgets', () => {
        const update = {
            layoutId: '018f8a78-7b8f-7c1d-a111-2222333345a1',
            widgetId: '018f8a78-7b8f-7c1d-a111-2222333344a1',
            expectedVersion: 2
        }

        expect(applicationLayoutWidgetResetBatchMutationSchema.parse({ updates: [update] })).toEqual({ updates: [update] })
        expect(
            applicationLayoutWidgetResetBatchMutationSchema.safeParse({
                updates: [update, { ...update, layoutId: '018f8a78-7b8f-7c1d-a111-2222333345a2' }]
            }).success
        ).toBe(false)
        expect(
            applicationLayoutWidgetResetBatchMutationSchema.safeParse({
                updates: [{ ...update, layoutId: 'not-a-uuid' }]
            }).success
        ).toBe(false)
        expect(applicationLayoutWidgetResetBatchMutationSchema.safeParse({ updates: [] }).success).toBe(false)
        expect(
            applicationLayoutWidgetResetBatchMutationSchema.safeParse({
                updates: [{ ...update, widgetId: 'not-a-uuid' }]
            }).success
        ).toBe(false)
        expect(
            applicationLayoutWidgetResetBatchMutationSchema.safeParse({
                updates: [{ ...update, expectedVersion: 0 }]
            }).success
        ).toBe(false)
        expect(
            applicationLayoutWidgetResetBatchMutationSchema.safeParse({
                updates: [{ ...update, unexpected: true }]
            }).success
        ).toBe(false)
    })

    it('rejects non-UUID layout IDs in widget config batch mutations', () => {
        const result = applicationLayoutWidgetConfigBatchMutationSchema.safeParse({
            updates: [
                {
                    layoutId: 'layout-global',
                    widgetId: '018f8a78-7b8f-7c1d-a111-2222333344a1',
                    config: { matrixMode: 'hierarchicalCells' },
                    expectedVersion: 1
                }
            ]
        })

        expect(result.success).toBe(false)
        expect(result.error?.issues[0]).toMatchObject({
            validation: 'uuid',
            path: ['updates', 0, 'layoutId']
        })
    })

    it('requires UUID v7 identifiers at the application layout mutation boundary', () => {
        const validId = '0190a9b5-3cde-7abc-8def-0123456789a1'
        const legacyUuid = '550e8400-e29b-41d4-a716-446655440000'

        expect(applicationLayoutMutationSchema.safeParse({ scopeEntityId: validId }).success).toBe(true)
        expect(applicationLayoutMutationSchema.safeParse({ scopeEntityId: legacyUuid }).success).toBe(false)
        expect(
            applicationLayoutWidgetMoveMutationSchema.safeParse({
                widgetId: validId,
                targetZone: 'center',
                targetIndex: 0,
                expectedVersion: 1
            }).success
        ).toBe(true)
        expect(
            applicationLayoutWidgetMoveMutationSchema.safeParse({
                widgetId: legacyUuid,
                targetZone: 'center',
                targetIndex: 0,
                expectedVersion: 1
            }).success
        ).toBe(false)
    })

    it('keeps the logical global scope key distinct from physical UUID identities', () => {
        expect(
            applicationLayoutScopeSchema.safeParse({
                id: 'global',
                scopeKind: 'global',
                scopeEntityId: null,
                name: 'Global'
            }).success
        ).toBe(true)
        expect(
            applicationLayoutScopeSchema.safeParse({
                id: 'global',
                scopeKind: 'entity',
                scopeEntityId: '550e8400-e29b-41d4-a716-446655440000',
                name: 'Legacy entity'
            }).success
        ).toBe(false)
    })

    it('rejects duplicate widget IDs in widget config batch mutations', () => {
        const result = applicationLayoutWidgetConfigBatchMutationSchema.safeParse({
            updates: [
                {
                    layoutId: '018f8a78-7b8f-7c1d-a111-2222333345a1',
                    widgetId: '018f8a78-7b8f-7c1d-a111-2222333344a1',
                    config: { matrixMode: 'hierarchicalCells' },
                    expectedVersion: 1
                },
                {
                    layoutId: '018f8a78-7b8f-7c1d-a111-2222333345a1',
                    widgetId: '018f8a78-7b8f-7c1d-a111-2222333344a1',
                    config: { matrixMode: 'independentRows' },
                    expectedVersion: 1
                }
            ]
        })

        expect(result.success).toBe(false)
        expect(result.error?.issues[0]).toMatchObject({
            message: 'Duplicate widgetId',
            path: ['updates', 1, 'widgetId']
        })
    })

    it('accepts typed Interpretation Network workspace matrix mode configuration', () => {
        expect(
            parseApplicationLayoutWidgetConfig('interpretationNetworkWorkspace', {
                visibleFor: {
                    sectionCodenames: ['Structure'],
                    objectCollectionCodenames: ['Structure']
                },
                structureMode: 'singleSystem',
                templatePanel: {
                    showInStructureList: true,
                    showInMatrix: false
                },
                matrixMode: 'hierarchicalCells',
                allowedMatrixViews: ['table', 'horizontalRows', 'verticalTree'],
                defaultMatrixView: 'table',
                tableProjection: 'hierarchicalPath',
                breadcrumbDepth: { mode: 'full' },
                toolbarLayout: 'horizontal',
                showHierarchicalTableHeaders: false,
                colorBreadcrumbsByCell: true,
                splitPane: { enabled: true },
                hierarchyRowMode: 'focusedPath',
                positionNumbering: {
                    enabled: true,
                    includeRoot: true,
                    startIndex: 1
                },
                allowNewAxesInCellDialog: false,
                sharedBehavior: {
                    canDeactivate: true,
                    canExclude: false,
                    positionLocked: true
                },
                serverModuleCodename: 'interpretation-runtime',
                conceptCodename: 'Structure',
                conceptNameField: 'Name',
                conceptDescriptionField: 'Description',
                interpretationCodename: 'Interpretation',
                interpretationParentField: 'ParentStructure',
                matrixField: 'InterpretationMatrix',
                relationCodename: 'Relation',
                materialCodename: 'Material',
                materialTitleField: 'Title',
                interpretationTitleField: 'Title',
                tableTemplateCodename: 'TableTemplate',
                tableTemplateNameField: 'Name',
                tableTemplateDescriptionField: 'Description',
                tableTemplateMatrixField: 'TemplateMatrix'
            })
        ).toMatchObject({
            structureMode: 'singleSystem',
            templatePanel: {
                showInStructureList: true,
                showInMatrix: false
            },
            matrixMode: 'hierarchicalCells',
            allowedMatrixViews: ['table', 'horizontalRows', 'verticalTree'],
            defaultMatrixView: 'table',
            tableProjection: 'hierarchicalPath',
            breadcrumbDepth: { mode: 'full' },
            toolbarLayout: 'horizontal',
            showHierarchicalTableHeaders: false,
            colorBreadcrumbsByCell: true,
            splitPane: { enabled: true },
            hierarchyRowMode: 'focusedPath',
            positionNumbering: {
                enabled: true,
                includeRoot: true,
                startIndex: 1
            },
            allowNewAxesInCellDialog: false,
            sharedBehavior: {
                canDeactivate: true,
                canExclude: false,
                positionLocked: true
            },
            conceptCodename: 'Structure',
            serverModuleCodename: 'interpretation-runtime',
            matrixField: 'InterpretationMatrix',
            materialTitleField: 'Title',
            interpretationTitleField: 'Title',
            tableTemplateNameField: 'Name',
            tableTemplateDescriptionField: 'Description',
            visibleFor: {
                sectionCodenames: ['Structure'],
                objectCollectionCodenames: ['Structure']
            }
        })
        expect(() =>
            parseApplicationLayoutWidgetConfig('interpretationNetworkWorkspace', {
                matrixMode: 'hierarchicalCells',
                structureMode: 'oneMainStructure'
            })
        ).toThrow()

        expect(() =>
            parseApplicationLayoutWidgetConfig('interpretationNetworkWorkspace', {
                matrixMode: 'hierarchicalCells',
                hierarchyLayout: 'verticalTree'
            })
        ).toThrow()

        expect(() =>
            parseApplicationLayoutWidgetConfig('interpretationNetworkWorkspace', {
                matrixMode: 'legacyGrid'
            })
        ).toThrow()

        expect(() =>
            parseApplicationLayoutWidgetConfig('interpretationNetworkWorkspace', {
                matrixMode: 'hierarchicalCells',
                allowedMatrixViews: ['diagonal'],
                positionNumbering: { enabled: true, includeRoot: true, startIndex: 1 }
            })
        ).toThrow()

        expect(() =>
            parseApplicationLayoutWidgetConfig('interpretationNetworkWorkspace', {
                matrixMode: 'hierarchicalCells',
                hierarchyRowMode: 'allBranches'
            })
        ).toThrow()

        expect(() =>
            parseApplicationLayoutWidgetConfig('interpretationNetworkWorkspace', {
                matrixMode: 'hierarchicalCells',
                positionNumbering: { enabled: true, includeRoot: true, startIndex: -1 }
            })
        ).toThrow()

        expect(() =>
            parseApplicationLayoutWidgetConfig('interpretationNetworkWorkspace', {
                matrixMode: 'independentRows',
                unexpectedFlag: true
            })
        ).toThrow()

        expect(() =>
            parseApplicationLayoutWidgetConfig('interpretationNetworkWorkspace', {
                matrixMode: 'hierarchicalCells',
                defaultRootTitleField: 'CellValue'
            })
        ).toThrow()

        expect(() =>
            parseApplicationLayoutWidgetConfig('interpretationNetworkWorkspace', {
                matrixMode: 'hierarchicalCells',
                allowedMatrixViews: ['horizontalRows'],
                defaultMatrixView: 'table'
            })
        ).toThrow()

        expect(() =>
            parseApplicationLayoutWidgetConfig('interpretationNetworkWorkspace', {
                matrixMode: 'independentRows',
                allowedMatrixViews: ['horizontalRows', 'verticalTree'],
                defaultMatrixView: 'horizontalRows'
            })
        ).toThrow()

        expect(() =>
            parseApplicationLayoutWidgetConfig('interpretationNetworkWorkspace', {
                matrixMode: 'hierarchicalCells',
                allowedMatrixViews: ['table', 'table'],
                defaultMatrixView: 'table'
            })
        ).toThrow()

        expect(() =>
            parseApplicationLayoutWidgetConfig('interpretationNetworkWorkspace', {
                matrixMode: 'independentRows',
                tableProjection: 'hierarchicalPath'
            })
        ).toThrow()

        expect(
            parseApplicationLayoutWidgetConfig('interpretationNetworkWorkspace', {
                matrixMode: 'hierarchicalCells',
                defaultMatrixView: 'horizontalRows'
            })
        ).toEqual({
            matrixMode: 'hierarchicalCells',
            defaultMatrixView: 'horizontalRows'
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('interpretationNetworkWorkspace', {
                matrixMode: 'hierarchicalCells',
                breadcrumbDepth: { mode: 'last', count: 7 }
            })
        ).toThrow()

        expect(() =>
            parseApplicationLayoutWidgetConfig('interpretationNetworkWorkspace', {
                matrixMode: 'hierarchicalCells',
                toolbarLayout: 'diagonal'
            })
        ).toThrow()
    })

    it('normalizes Matrix view settings at UI and runtime boundaries', () => {
        expect(
            normalizeInterpretationNetworkMatrixViewSettings(
                'hierarchicalCells',
                ['verticalTree', 'table', 'horizontalRows', 'table'],
                'table'
            )
        ).toEqual({
            allowedMatrixViews: ['table', 'horizontalRows', 'verticalTree'],
            defaultMatrixView: 'table'
        })
        expect(normalizeInterpretationNetworkMatrixViewSettings('independentRows', ['table', 'verticalTree'], 'verticalTree')).toEqual({
            allowedMatrixViews: ['table'],
            defaultMatrixView: 'table'
        })
        expect(normalizeInterpretationNetworkMatrixViewSettings('hierarchicalCells', ['unknown'], 'unknown')).toEqual({
            allowedMatrixViews: ['table'],
            defaultMatrixView: 'table'
        })
    })

    it('normalizes Interpretation Network structure mode at UI and runtime boundaries', () => {
        expect(parseApplicationLayoutWidgetConfig('interpretationNetworkWorkspace', {})).toEqual({
            visibleFor: undefined
        })
        expect(
            parseApplicationLayoutWidgetConfig('interpretationNetworkWorkspace', {
                structureMode: 'multiple'
            })
        ).toEqual({
            structureMode: 'multiple'
        })
        expect(
            parseApplicationLayoutWidgetConfig('interpretationNetworkWorkspace', {
                structureMode: 'singleSystem'
            })
        ).toEqual({
            structureMode: 'singleSystem'
        })
    })

    it('normalizes Interpretation Network table settings at UI and runtime boundaries', () => {
        expect(normalizeInterpretationNetworkTableSettings('hierarchicalCells', undefined, undefined, undefined)).toEqual({
            tableProjection: 'hierarchicalPath',
            breadcrumbDepth: { mode: 'full' },
            toolbarLayout: 'horizontal',
            showHierarchicalTableHeaders: false,
            showHierarchicalTableHeaderCard: true,
            showMatrixTreeTotalCells: true,
            colorBreadcrumbsByCell: true
        })
        expect(
            normalizeInterpretationNetworkTableSettings(
                'hierarchicalCells',
                'independentAxes',
                { mode: 'last', count: 4 },
                'vertical',
                true,
                false,
                false,
                false
            )
        ).toEqual({
            tableProjection: 'independentAxes',
            breadcrumbDepth: { mode: 'last', count: 4 },
            toolbarLayout: 'vertical',
            showHierarchicalTableHeaders: true,
            showHierarchicalTableHeaderCard: false,
            showMatrixTreeTotalCells: false,
            colorBreadcrumbsByCell: false
        })
        expect(
            normalizeInterpretationNetworkTableSettings('independentRows', 'hierarchicalPath', { mode: 'last', count: 99 }, 'diagonal')
        ).toEqual({
            tableProjection: 'independentAxes',
            breadcrumbDepth: { mode: 'full' },
            toolbarLayout: 'horizontal',
            showHierarchicalTableHeaders: false,
            showHierarchicalTableHeaderCard: true,
            showMatrixTreeTotalCells: true,
            colorBreadcrumbsByCell: true
        })
    })

    it('accepts only a minimal split-pane configuration and provides fixed layout bounds', () => {
        expect(INTERPRETATION_NETWORK_SPLIT_PANE_DEFAULT).toBe(50)
        expect(INTERPRETATION_NETWORK_SPLIT_PANE_MIN_PERCENT).toBe(25)
        expect(INTERPRETATION_NETWORK_SPLIT_PANE_MAX_PERCENT).toBe(75)
        expect(normalizeInterpretationNetworkSplitPaneSettings({ enabled: true })).toEqual({ enabled: true })
        expect(normalizeInterpretationNetworkSplitPaneSettings({ enabled: 'true' })).toEqual({ enabled: true })
        expect(normalizeInterpretationNetworkSplitPaneSettings(undefined)).toEqual({ enabled: true })
        expect(() =>
            parseApplicationLayoutWidgetConfig('interpretationNetworkWorkspace', {
                splitPane: { enabled: true, ratio: 0.5 }
            })
        ).toThrow()
    })

    it('accepts generic PlayCanvas canvas widget configuration', () => {
        expect(
            parseApplicationLayoutWidgetConfig('playcanvasCanvas', {
                title: { en: 'Flight simulator', ru: 'Симулятор полета' },
                minHeight: 560,
                heightMode: 'fitViewport',
                moduleCodename: 'flight-runtime',
                serverModuleCodename: 'fixed-tick-runtime',
                attachedToKind: 'metahub',
                visibleFor: { sectionCodenames: ['FlightWorld'] },
                scene: {
                    controlledObjectId: 'ship',
                    targetObjectId: 'station',
                    cruiseSpeed: 36,
                    intentDistance: 720,
                    objects: [
                        {
                            id: 'ship',
                            position: { x: 0, y: 0, z: 0 },
                            scale: { x: 12, y: 4, z: 4 },
                            selectable: true
                        },
                        {
                            id: 'station',
                            position: { x: 72, y: 0, z: -48 },
                            scale: { x: 48, y: 16, z: 16 },
                            selectable: true,
                            guard: true
                        }
                    ]
                }
            })
        ).toMatchObject({
            minHeight: 560,
            heightMode: 'fitViewport',
            visibleFor: { sectionCodenames: ['FlightWorld'] },
            scene: {
                controlledObjectId: 'ship',
                targetObjectId: 'station',
                intentDistance: 720
            }
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('playcanvasCanvas', {
                minHeight: 120,
                scene: {
                    objects: []
                }
            })
        ).toThrow()

        expect(() =>
            parseApplicationLayoutWidgetConfig('playcanvasCanvas', {
                scene: {
                    controlledObjectId: 'missing-ship',
                    targetObjectId: 'station',
                    objects: [
                        {
                            id: 'ship',
                            position: { x: 0, y: 0, z: 0 },
                            scale: { x: 12, y: 4, z: 4 }
                        },
                        {
                            id: 'station',
                            position: { x: 72, y: 0, z: -48 },
                            scale: { x: 48, y: 16, z: 16 }
                        }
                    ]
                }
            })
        ).toThrow()

        expect(() =>
            parseApplicationLayoutWidgetConfig('playcanvasCanvas', {
                scene: {
                    controlledObjectId: 'ship',
                    objects: [
                        {
                            id: 'ship',
                            position: { x: 0, y: 0, z: 0 },
                            scale: { x: 12, y: 4, z: 4 }
                        },
                        {
                            id: 'ship',
                            position: { x: 72, y: 0, z: -48 },
                            scale: { x: 48, y: 16, z: 16 }
                        }
                    ]
                }
            })
        ).toThrow()
    })

    it('accepts PlayCanvas canvas widget binding to a published runtime manifest', () => {
        const checksum = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
        expect(
            parseApplicationLayoutWidgetConfig('playcanvasCanvas', {
                title: { en: 'MMOOMM', ru: 'MMOOMM' },
                runtimeManifest: {
                    source: 'publishedManifest',
                    projectId: '018f3f98-7a63-7b4a-9a5a-20c9a5b2d104',
                    sceneId: '018f3f98-7a63-7b4a-9a5a-20c9a5b2d105',
                    checksum
                }
            })
        ).toMatchObject({
            runtimeManifest: {
                source: 'publishedManifest',
                projectId: '018f3f98-7a63-7b4a-9a5a-20c9a5b2d104',
                sceneId: '018f3f98-7a63-7b4a-9a5a-20c9a5b2d105',
                checksum,
                failClosed: true
            }
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('playcanvasCanvas', {
                runtimeManifest: {
                    source: 'publishedManifest',
                    projectId: '018f3f98-7a63-7b4a-9a5a-20c9a5b2d104',
                    checksum: 'not-a-checksum'
                }
            })
        ).toThrow()
    })

    it('accepts only implemented metric keys for overviewCards stat-card datasources', () => {
        expect(
            parseApplicationLayoutWidgetConfig('overviewCards', {
                cards: [
                    {
                        title: 'Courses',
                        datasource: {
                            kind: 'metric',
                            metricKey: 'records.count',
                            params: {
                                sectionCodename: 'Modules',
                                search: 'safety'
                            }
                        }
                    }
                ]
            })
        ).toMatchObject({
            cards: [
                {
                    title: 'Courses',
                    datasource: {
                        kind: 'metric',
                        metricKey: 'records.count'
                    }
                }
            ]
        })

        expect(
            parseApplicationLayoutWidgetConfig('overviewCards', {
                cards: [
                    {
                        title: 'Average progress',
                        datasource: {
                            kind: 'metric',
                            metricKey: 'report.aggregation',
                            params: {
                                reportCodename: 'LearnerProgress',
                                aggregationAlias: 'AverageProgress'
                            }
                        }
                    }
                ]
            })
        ).toMatchObject({
            cards: [
                {
                    title: 'Average progress',
                    datasource: {
                        kind: 'metric',
                        metricKey: 'report.aggregation',
                        params: {
                            reportCodename: 'LearnerProgress',
                            aggregationAlias: 'AverageProgress'
                        }
                    }
                }
            ]
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('overviewCards', {
                cards: [
                    {
                        title: 'Unsupported',
                        datasource: {
                            kind: 'metric',
                            metricKey: 'unsupported.metric'
                        }
                    }
                ]
            })
        ).toThrow()
    })

    it('accepts typed records.list datasource contracts for chart widgets', () => {
        expect(
            parseApplicationLayoutWidgetConfig('pageViewsChart', {
                title: 'Completions',
                value: '120',
                datasource: {
                    kind: 'records.list',
                    sectionCodename: 'ModuleProgress',
                    query: {
                        search: 'cohort',
                        sort: [{ field: 'period', direction: 'asc' }],
                        filters: [{ field: 'status', operator: 'equals', value: 'completed' }]
                    }
                },
                xField: 'period',
                maxRows: 12,
                series: [{ field: 'completed', label: 'Completed', stack: 'learning' }]
            })
        ).toMatchObject({
            title: 'Completions',
            datasource: {
                kind: 'records.list',
                sectionCodename: 'ModuleProgress'
            },
            xField: 'period',
            series: [{ field: 'completed', label: 'Completed' }]
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('sessionsChart', {
                datasource: {
                    kind: 'metric',
                    metricKey: 'records.count'
                },
                xField: 'period',
                series: [{ field: 'completed' }]
            })
        ).toThrow()
    })

    it('accepts sequence policy contracts for detailsTable widgets', () => {
        expect(
            parseApplicationLayoutWidgetConfig('detailsTable', {
                datasource: {
                    kind: 'records.list',
                    sectionCodename: 'CourseModules'
                },
                sequencePolicy: {
                    mode: 'sequential',
                    orderFieldCodename: 'SortOrder',
                    completion: [{ kind: 'scoreAtLeast', field: 'ScorePercent', value: 80 }],
                    maxAttempts: 3
                }
            })
        ).toMatchObject({
            datasource: {
                kind: 'records.list',
                sectionCodename: 'CourseModules'
            },
            sequencePolicy: {
                mode: 'sequential',
                orderFieldCodename: 'SortOrder',
                completion: [{ kind: 'scoreAtLeast', field: 'ScorePercent', value: 80 }],
                maxAttempts: 3
            }
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('detailsTable', {
                sequencePolicy: {
                    mode: 'sequential',
                    completion: Array.from({ length: 17 }, () => ({ kind: 'manual' }))
                }
            })
        ).toThrow()
    })

    it('marks dashboard shell widgets as single-instance placements', () => {
        expect(LAYOUT_WIDGET_DEFINITIONS.filter((widget) => widget.key === 'appNavbar' || widget.key === 'header')).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ key: 'appNavbar', multiInstance: false }),
                expect.objectContaining({ key: 'header', multiInstance: false })
            ])
        )
    })

    it('accepts localized row-count warnings for detailsTable widgets', () => {
        expect(
            parseApplicationLayoutWidgetConfig('detailsTable', {
                datasource: {
                    kind: 'records.list',
                    sectionCodename: 'CourseItems'
                },
                rowCountWarning: {
                    threshold: 100,
                    message: {
                        _primary: 'en',
                        locales: {
                            en: { content: 'Large outline' },
                            ru: { content: 'Большая структура' }
                        }
                    }
                }
            })
        ).toMatchObject({
            rowCountWarning: {
                threshold: 100
            }
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('detailsTable', {
                rowCountWarning: {
                    threshold: 0,
                    message: 'Invalid warning'
                }
            })
        ).toThrow()
    })

    it('accepts generic create targets for records.union detailsTable widgets', () => {
        expect(
            parseApplicationLayoutWidgetConfig('detailsTable', {
                datasource: {
                    kind: 'records.union',
                    projectedFields: ['Instructor'],
                    targets: [
                        { sectionCodename: 'LearningResources', displayType: 'resource' },
                        { sectionCodename: 'Courses', displayType: 'course' }
                    ]
                },
                showSearch: true,
                targetFilters: [
                    {
                        id: 'resources',
                        label: 'Resources',
                        targetDisplayTypes: ['resource']
                    },
                    {
                        id: 'courses',
                        label: {
                            _primary: 'en',
                            locales: {
                                en: { content: 'Courses' },
                                ru: { content: 'Курсы' }
                            }
                        },
                        targetSectionCodenames: ['Courses']
                    }
                ],
                createTargets: [
                    {
                        id: 'create-page',
                        label: {
                            _primary: 'en',
                            locales: {
                                en: { content: 'Page' },
                                ru: { content: 'Страница' }
                            }
                        },
                        sectionCodename: 'LearningResources',
                        surface: 'dialog',
                        createDefaults: [
                            { fieldCodename: 'ResourceType', enumCodename: 'Page' },
                            { fieldCodename: 'Source', resourceSourceType: 'page' },
                            {
                                fieldCodename: 'NavigationMode',
                                contextPath: 'learningContent.courseCompletionPolicy.navigationMode'
                            }
                        ]
                    },
                    {
                        id: 'create-course',
                        label: 'Course',
                        objectCollectionCodename: 'Courses'
                    }
                ]
            })
        ).toMatchObject({
            showSearch: true,
            targetFilters: [
                { id: 'resources', targetDisplayTypes: ['resource'] },
                { id: 'courses', targetSectionCodenames: ['Courses'] }
            ],
            createTargets: [
                {
                    id: 'create-page',
                    sectionCodename: 'LearningResources',
                    surface: 'dialog',
                    createDefaults: [
                        { fieldCodename: 'ResourceType', enumCodename: 'Page' },
                        { fieldCodename: 'Source', resourceSourceType: 'page' },
                        {
                            fieldCodename: 'NavigationMode',
                            contextPath: 'learningContent.courseCompletionPolicy.navigationMode'
                        }
                    ]
                },
                { id: 'create-course', objectCollectionCodename: 'Courses' }
            ]
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('detailsTable', {
                createTargets: [{ id: 'invalid', label: 'Invalid' }]
            })
        ).toThrow()

        const extendedCreateTargets = parseApplicationLayoutWidgetConfig('detailsTable', {
            createTargets: Array.from({ length: 16 }, (_, index) => ({
                id: `create-target-${index + 1}`,
                label: `Target ${index + 1}`,
                sectionCodename: 'LearningResources'
            }))
        })
        expect(extendedCreateTargets.createTargets).toHaveLength(16)
        expect(extendedCreateTargets.createTargets?.[0]).toMatchObject({
            id: 'create-target-1',
            sectionCodename: 'LearningResources'
        })
        expect(extendedCreateTargets.createTargets?.[15]).toMatchObject({
            id: 'create-target-16',
            sectionCodename: 'LearningResources'
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('detailsTable', {
                createTargets: Array.from({ length: 17 }, (_, index) => ({
                    id: `create-target-${index + 1}`,
                    label: `Target ${index + 1}`,
                    sectionCodename: 'LearningResources'
                }))
            })
        ).toThrow()

        expect(() =>
            parseApplicationLayoutWidgetConfig('detailsTable', {
                targetFilters: [{ id: 'invalid-filter', label: 'Invalid filter' }]
            })
        ).toThrow()

        for (const fieldCodename of ['OwnerUserId', 'workspace_id', 'ProgressPercent', 'LifecycleState', '_upl_created_by']) {
            expect(() =>
                parseApplicationLayoutWidgetConfig('detailsTable', {
                    createTargets: [
                        {
                            id: `unsafe-default-${fieldCodename}`,
                            label: 'Unsafe',
                            sectionCodename: 'LearningResources',
                            createDefaults: [{ fieldCodename, value: 'attacker' }]
                        }
                    ]
                })
            ).toThrow()
        }

        expect(() =>
            parseApplicationLayoutWidgetConfig('detailsTable', {
                createTargets: [
                    {
                        id: 'ambiguous-default',
                        label: 'Ambiguous',
                        sectionCodename: 'LearningResources',
                        createDefaults: [
                            {
                                fieldCodename: 'ResourceType',
                                value: 'Page',
                                enumCodename: 'Page',
                                contextPath: 'learningContent.courseCompletionPolicy.navigationMode'
                            }
                        ]
                    }
                ]
            })
        ).toThrow()

        for (const contextPath of ['learningContent.__proto__.navigationMode', 'learningContent[0].navigationMode']) {
            expect(() =>
                parseApplicationLayoutWidgetConfig('detailsTable', {
                    createTargets: [
                        {
                            id: `unsafe-context-${contextPath}`,
                            label: 'Unsafe',
                            sectionCodename: 'Courses',
                            createDefaults: [{ fieldCodename: 'NavigationMode', contextPath }]
                        }
                    ]
                })
            ).toThrow()
        }
    })

    it('accepts generic library row actions for records.union detailsTable widgets', () => {
        expect(
            parseApplicationLayoutWidgetConfig('detailsTable', {
                datasource: {
                    kind: 'records.union',
                    projectedFields: ['Instructor'],
                    targets: [
                        { sectionCodename: 'LearningResources', displayType: 'resource' },
                        { sectionCodename: 'Courses', displayType: 'course' }
                    ]
                },
                rowActions: [
                    {
                        id: 'toggle-starred',
                        kind: 'library.toggle',
                        libraryView: 'starred',
                        icon: 'star',
                        label: {
                            _primary: 'en',
                            locales: {
                                en: { content: 'Add to starred' },
                                ru: { content: 'Добавить в избранное' }
                            }
                        },
                        activeLabel: {
                            _primary: 'en',
                            locales: {
                                en: { content: 'Remove from starred' },
                                ru: { content: 'Убрать из избранного' }
                            }
                        }
                    },
                    {
                        id: 'toggle-shared',
                        kind: 'library.toggle',
                        libraryView: 'shared',
                        icon: 'share',
                        principalTarget: 'workspaceMember',
                        label: {
                            _primary: 'en',
                            locales: {
                                en: { content: 'Share' },
                                ru: { content: 'Поделиться' }
                            }
                        },
                        activeLabel: {
                            _primary: 'en',
                            locales: {
                                en: { content: 'Share' },
                                ru: { content: 'Поделиться' }
                            }
                        },
                        dialogTitle: {
                            _primary: 'en',
                            locales: {
                                en: { content: 'Share content' },
                                ru: { content: 'Поделиться контентом' }
                            }
                        },
                        targetLabel: {
                            _primary: 'en',
                            locales: {
                                en: { content: 'Workspace member' },
                                ru: { content: 'Участник рабочего пространства' }
                            }
                        }
                    },
                    {
                        id: 'move-project',
                        kind: 'field.updateWithTarget',
                        fieldCodename: 'ProjectId',
                        targetObjectCollectionCodename: 'ContentProjects',
                        labelFields: ['Name', 'Title'],
                        icon: 'move',
                        label: {
                            _primary: 'en',
                            locales: {
                                en: { content: 'Move to project' },
                                ru: { content: 'Переместить в проект' }
                            }
                        },
                        dialogTitle: {
                            _primary: 'en',
                            locales: {
                                en: { content: 'Move to project' },
                                ru: { content: 'Переместить в проект' }
                            }
                        },
                        targetLabel: {
                            _primary: 'en',
                            locales: {
                                en: { content: 'Project' },
                                ru: { content: 'Проект' }
                            }
                        }
                    }
                ]
            })
        ).toMatchObject({
            rowActions: [
                {
                    id: 'toggle-starred',
                    kind: 'library.toggle',
                    libraryView: 'starred',
                    icon: 'star'
                },
                {
                    id: 'toggle-shared',
                    kind: 'library.toggle',
                    libraryView: 'shared',
                    icon: 'share',
                    principalTarget: 'workspaceMember'
                },
                {
                    id: 'move-project',
                    kind: 'field.updateWithTarget',
                    fieldCodename: 'ProjectId',
                    targetObjectCollectionCodename: 'ContentProjects',
                    labelFields: ['Name', 'Title'],
                    icon: 'move'
                }
            ]
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('detailsTable', {
                datasource: {
                    kind: 'records.union',
                    targets: [{ sectionCodename: 'LearningResources' }]
                },
                rowActions: [{ id: 'bad-action', kind: 'library.toggle', libraryView: 'recent' }]
            })
        ).toThrow()

        expect(() =>
            parseApplicationLayoutWidgetConfig('detailsTable', {
                datasource: {
                    kind: 'records.union',
                    targets: [{ sectionCodename: 'LearningResources' }]
                },
                rowActions: [{ id: 'bad-target-action', kind: 'field.updateWithTarget', fieldCodename: 'ProjectId' }]
            })
        ).toThrow()
    })

    it('accepts generic restore target pickers for deleted records.union detailsTable widgets', () => {
        expect(
            parseApplicationLayoutWidgetConfig('detailsTable', {
                datasource: {
                    kind: 'records.union',
                    targets: [{ sectionCodename: 'LearningResources', displayType: 'resource' }],
                    query: { lifecycleState: 'deleted' }
                },
                restoreTarget: {
                    targetObjectCollectionCodename: 'ContentProjects',
                    parentFieldCodename: 'ProjectId',
                    labelFields: ['Name', 'Title'],
                    dialogTitle: {
                        _primary: 'en',
                        locales: {
                            en: { content: 'Restore to project' },
                            ru: { content: 'Восстановить в проект' }
                        }
                    },
                    targetLabel: 'Project'
                }
            })
        ).toMatchObject({
            restoreTarget: {
                targetObjectCollectionCodename: 'ContentProjects',
                parentFieldCodename: 'ProjectId',
                labelFields: ['Name', 'Title']
            }
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('detailsTable', {
                restoreTarget: {
                    parentFieldCodename: 'ProjectId'
                }
            })
        ).toThrow()
    })

    it('accepts context-derived create defaults for writable scalar fields', () => {
        expect(
            parseApplicationLayoutWidgetConfig('detailsTable', {
                createTargets: [
                    {
                        id: 'create-course',
                        label: 'Course',
                        sectionCodename: 'Courses',
                        createDefaults: [
                            {
                                fieldCodename: 'NavigationMode',
                                contextPath: 'learningContent.courseCompletionPolicy.navigationMode'
                            },
                            {
                                fieldCodename: 'CompletionCondition',
                                contextPath: 'learningContent.courseCompletionPolicy.completionCondition'
                            }
                        ]
                    }
                ]
            })
        ).toMatchObject({
            createTargets: [
                {
                    id: 'create-course',
                    createDefaults: [
                        {
                            fieldCodename: 'NavigationMode',
                            contextPath: 'learningContent.courseCompletionPolicy.navigationMode'
                        },
                        {
                            fieldCodename: 'CompletionCondition',
                            contextPath: 'learningContent.courseCompletionPolicy.completionCondition'
                        }
                    ]
                }
            ]
        })
    })

    it('accepts generic relation builder widgets for parent-scoped child records', () => {
        expect(
            parseApplicationLayoutWidgetConfig('relationBuilder', {
                parentDatasource: {
                    kind: 'records.list',
                    sectionCodename: 'Courses'
                },
                parentLabel: 'Course',
                parentTitleFieldCodename: 'Title',
                panels: [
                    {
                        id: 'course-items',
                        title: 'Items',
                        datasource: {
                            kind: 'records.list',
                            sectionCodename: 'CourseItems'
                        },
                        parentFieldCodename: 'CourseId',
                        sortOrderFieldCodename: 'SortOrder',
                        enableRowReordering: true,
                        createDefaults: { TargetType: 'course' }
                    }
                ]
            })
        ).toMatchObject({
            parentDatasource: {
                kind: 'records.list',
                sectionCodename: 'Courses'
            },
            panels: [
                {
                    id: 'course-items',
                    parentFieldCodename: 'CourseId',
                    createDefaults: { TargetType: 'course' }
                }
            ]
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('relationBuilder', {
                panels: []
            })
        ).toThrow()
    })

    it('accepts generic learner player widgets with static metadata target objects', () => {
        expect(
            parseApplicationLayoutWidgetConfig('learnerPlayer', {
                parentDatasource: {
                    kind: 'records.list',
                    sectionCodename: 'LearningTracks',
                    query: { sort: [{ field: 'Title', direction: 'asc' }] }
                },
                itemsDatasource: {
                    kind: 'records.list',
                    sectionCodename: 'TrackSteps',
                    query: { sort: [{ field: 'SortOrder', direction: 'asc' }] }
                },
                parentLabel: {
                    _primary: 'en',
                    locales: {
                        en: { content: 'Learning Track' },
                        ru: { content: 'Учебный трек' }
                    }
                },
                parentFieldCodename: 'TrackId',
                itemTitleFieldCodename: 'Title',
                targetObjectCodename: 'Courses',
                targetRecordIdField: 'CourseId',
                completionTargetObjectCodename: 'TrackSteps',
                sequencePolicy: {
                    mode: 'sequential',
                    scopeFieldCodename: 'TrackId',
                    orderFieldCodename: 'SortOrder'
                },
                targetContent: {
                    titleFieldCodename: 'Title',
                    descriptionFieldCodename: 'Description'
                }
            })
        ).toMatchObject({
            parentDatasource: {
                kind: 'records.list',
                sectionCodename: 'LearningTracks'
            },
            itemsDatasource: {
                kind: 'records.list',
                sectionCodename: 'TrackSteps'
            },
            targetObjectCodename: 'Courses',
            targetRecordIdField: 'CourseId',
            completionTargetObjectCodename: 'TrackSteps'
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('learnerPlayer', {
                targetObjectCodename: ''
            })
        ).toThrow()
    })

    it('accepts generic records.union datasources for unified runtime content libraries', () => {
        expect(
            parseApplicationLayoutWidgetConfig('detailsTable', {
                datasource: {
                    kind: 'records.union',
                    projectedFields: ['Instructor'],
                    targets: [
                        {
                            sectionCodename: 'LearningResources',
                            displayType: 'page',
                            titleField: 'Title',
                            statusField: 'PublicationStatus',
                            projectField: 'ProjectId'
                        },
                        {
                            sectionCodename: 'Courses',
                            displayType: 'course',
                            titleField: 'Title',
                            statusField: 'Status',
                            projectField: 'ProjectId'
                        }
                    ],
                    query: {
                        libraryView: 'starred',
                        search: 'onboarding',
                        sort: [{ field: 'UpdatedAt', direction: 'desc' }]
                    }
                }
            })
        ).toMatchObject({
            datasource: {
                kind: 'records.union',
                projectedFields: ['Instructor'],
                targets: [
                    {
                        sectionCodename: 'LearningResources',
                        displayType: 'page',
                        projectField: 'ProjectId'
                    },
                    {
                        sectionCodename: 'Courses',
                        displayType: 'course',
                        projectField: 'ProjectId'
                    }
                ],
                query: {
                    libraryView: 'starred'
                }
            }
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('detailsTable', {
                datasource: {
                    kind: 'records.union',
                    targets: [{ displayType: 'page' }]
                }
            })
        ).toThrow(/Union datasource targets/)
    })

    it('accepts inline report definition contracts for detailsTable widgets', () => {
        expect(
            parseApplicationLayoutWidgetConfig('detailsTable', {
                reportDefinition: {
                    codename: 'LearnerProgress',
                    title: 'Learner progress',
                    datasource: {
                        kind: 'records.list',
                        sectionCodename: 'ModuleProgress'
                    },
                    columns: [{ field: 'ProgressPercent', label: 'Progress', type: 'number' }],
                    filters: [{ field: 'Status', operator: 'equals', value: 'completed' }],
                    aggregations: [{ field: 'ProgressPercent', function: 'avg', alias: 'AverageProgress' }]
                }
            })
        ).toMatchObject({
            reportDefinition: {
                codename: 'LearnerProgress',
                title: 'Learner progress',
                datasource: {
                    kind: 'records.list',
                    sectionCodename: 'ModuleProgress'
                },
                columns: [{ field: 'ProgressPercent', label: 'Progress', type: 'number' }]
            }
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('detailsTable', {
                reportDefinition: {
                    codename: 'BrokenReport',
                    title: 'Broken report',
                    datasource: {
                        kind: 'records.list',
                        sectionCodename: 'ModuleProgress'
                    },
                    columns: []
                }
            })
        ).toThrow()
    })

    it('accepts saved report codename references for detailsTable widgets', () => {
        expect(
            parseApplicationLayoutWidgetConfig('detailsTable', {
                reportCodename: 'CourseBuilderOutline'
            })
        ).toMatchObject({
            reportCodename: 'CourseBuilderOutline'
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('detailsTable', {
                reportCodename: ''
            })
        ).toThrow()
    })

    it('accepts workflow action contracts for detailsTable widgets', () => {
        expect(
            parseApplicationLayoutWidgetConfig('detailsTable', {
                workflowActions: [
                    {
                        codename: 'AcceptSubmission',
                        title: 'Accept submission',
                        from: ['PendingReview'],
                        to: 'Accepted',
                        statusFieldCodename: 'ReviewStatus',
                        requiredCapabilities: ['workflow.execute'],
                        postingCommand: 'post',
                        confirmation: {
                            required: true,
                            title: 'Accept submission?',
                            message: 'This will update the review status.'
                        }
                    }
                ]
            })
        ).toMatchObject({
            workflowActions: [
                {
                    codename: 'AcceptSubmission',
                    title: 'Accept submission',
                    from: ['PendingReview'],
                    to: 'Accepted',
                    requiredCapabilities: ['workflow.execute'],
                    postingCommand: 'post'
                }
            ]
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('detailsTable', {
                workflowActions: [
                    {
                        codename: '',
                        title: '',
                        from: [],
                        to: '',
                        requiredCapabilities: []
                    }
                ]
            })
        ).toThrow()
    })

    it('accepts generic resource preview widget contracts with safe resource sources', () => {
        expect(
            parseApplicationLayoutWidgetConfig('resourcePreview', {
                title: 'Intro video',
                description: 'Reusable learning resource.',
                source: {
                    type: 'video',
                    url: 'https://cdn.example.com/intro.mp4',
                    mimeType: 'video/mp4'
                }
            })
        ).toMatchObject({
            title: 'Intro video',
            source: {
                type: 'video',
                url: 'https://cdn.example.com/intro.mp4',
                mimeType: 'video/mp4',
                launchMode: 'inline'
            }
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('resourcePreview', {
                source: {
                    type: 'embed',
                    url: 'https://evil.example.com/embed'
                }
            })
        ).toThrow()

        expect(
            parseApplicationLayoutWidgetConfig('resourcePreview', {
                source: {
                    type: 'xapi',
                    packageDescriptor: {
                        standard: 'xAPI',
                        status: 'deferred',
                        launch: 'index.html'
                    }
                }
            })
        ).toMatchObject({
            source: {
                type: 'xapi',
                launchMode: 'inline'
            }
        })
    })

    it('accepts generic details tab widgets and rejects recursive tab nesting', () => {
        expect(
            parseApplicationLayoutWidgetConfig('detailsTabs', {
                tabs: [
                    {
                        id: 'outline',
                        label: { en: { content: 'Outline' }, ru: { content: 'Structure' } },
                        widgets: [
                            {
                                widgetKey: 'columnsContainer',
                                config: {
                                    columns: [
                                        {
                                            id: 'outline-main',
                                            width: 12,
                                            widgets: [{ widgetKey: 'detailsTable' }]
                                        }
                                    ]
                                }
                            }
                        ]
                    },
                    {
                        id: 'reports',
                        label: 'Reports',
                        widgets: [
                            {
                                widgetKey: 'detailsTable',
                                config: {
                                    reportDefinition: {
                                        codename: 'OutlineReport',
                                        title: 'Outline report',
                                        datasource: {
                                            kind: 'records.list',
                                            sectionCodename: 'CourseItems'
                                        },
                                        columns: [{ field: 'Title', label: 'Title', type: 'text' }]
                                    }
                                }
                            }
                        ]
                    }
                ]
            })
        ).toMatchObject({
            tabs: [
                {
                    id: 'outline',
                    widgets: [{ widgetKey: 'columnsContainer' }]
                },
                {
                    id: 'reports',
                    widgets: [{ widgetKey: 'detailsTable' }]
                }
            ]
        })

        expect(() =>
            parseApplicationLayoutWidgetConfig('detailsTabs', {
                tabs: [
                    {
                        id: 'broken',
                        widgets: [{ widgetKey: 'detailsTabs' }]
                    }
                ]
            })
        ).toThrow()
    })
})
