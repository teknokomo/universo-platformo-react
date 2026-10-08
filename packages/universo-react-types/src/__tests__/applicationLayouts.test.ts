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
    effectiveLayoutRuntimeWidgetSchema,
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
            'marketing.brand',
            'marketing.navigation',
            'marketing.auth',
            'marketing.hero',
            'marketing.image',
            'marketing.collection',
            'marketing.pricing',
            'marketing.footer'
        ])
        expect(LAYOUT_WIDGET_DEFINITIONS.every((widget) => widget.labelKey && widget.defaultLabel)).toBe(true)
        expect(marketingWidgets.every((widget) => widget.labelKey === `layouts.widgets.${widget.key}`)).toBe(true)

        const languageSwitcher = LAYOUT_WIDGET_DEFINITIONS.find((widget) => widget.key === 'languageSwitcher')
        expect(languageSwitcher).toMatchObject({
            shared: true,
            multiInstance: false,
            defaultPlacement: 'end',
            mobileProjection: 'compact-header',
            supportedTemplates: ['dashboard', 'marketing-page'],
            allowedZonesByTemplate: {
                dashboard: ['top'],
                'marketing-page': ['marketing-header']
            },
            requiredHostCapabilities: ['locale.state', 'locale.change', 'keyboard.focus', 'accessibility.label', 'theme.safe']
        })
    })

    it('validates marketing header widget configs with their specialized schemas', () => {
        expect(parseApplicationLayoutWidgetConfig('marketing.brand', {})).toEqual({})
        expect(() => parseApplicationLayoutWidgetConfig('marketing.brand', { instanceKey: 'marketing-brand' })).toThrow()
        expect(() => parseApplicationLayoutWidgetConfig('marketing.brand', { source: {} })).toThrow()

        expect(parseApplicationLayoutWidgetConfig('marketing.auth', {})).toMatchObject({
            showAuthActions: true
        })
        expect(() => parseApplicationLayoutWidgetConfig('marketing.auth', { unexpected: true })).toThrow()

        expect(parseApplicationLayoutWidgetConfig('marketing.image', {})).toEqual({})
        expect(() => parseApplicationLayoutWidgetConfig('marketing.image', { media: { type: 'url' } })).toThrow()
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
            {
                key: 'left',
                templateKey: 'dashboard',
                semanticRegion: 'sidebar',
                labelKey: 'layouts.zones.left',
                defaultLabel: 'Left',
                settings: []
            },
            {
                key: 'top',
                templateKey: 'dashboard',
                semanticRegion: 'header',
                labelKey: 'layouts.zones.top',
                defaultLabel: 'Top',
                settings: []
            },
            {
                key: 'right',
                templateKey: 'dashboard',
                semanticRegion: 'auxiliary',
                labelKey: 'layouts.zones.right',
                defaultLabel: 'Right',
                settings: []
            },
            {
                key: 'bottom',
                templateKey: 'dashboard',
                semanticRegion: 'footer',
                labelKey: 'layouts.zones.bottom',
                defaultLabel: 'Bottom',
                settings: []
            },
            {
                key: 'center',
                templateKey: 'dashboard',
                semanticRegion: 'main',
                labelKey: 'layouts.zones.center',
                defaultLabel: 'Center',
                settings: []
            },
            {
                key: 'marketing-header',
                templateKey: 'marketing-page',
                semanticRegion: 'header',
                labelKey: 'layouts.zones.marketingHeader',
                defaultLabel: 'Marketing header',
                settings: [
                    {
                        key: 'position',
                        kind: 'enum',
                        options: ['fixed', 'flow'],
                        defaultValue: 'fixed',
                        labelKey: 'layouts.zoneSettings.headerBehavior',
                        defaultLabel: 'Header behavior',
                        optionLabelKeys: {
                            fixed: 'layouts.zoneSettings.fixed',
                            flow: 'layouts.zoneSettings.flow'
                        },
                        defaultOptionLabels: {
                            fixed: 'Fixed on screen',
                            flow: 'Scrolls with page'
                        }
                    }
                ]
            },
            {
                key: 'marketing-main',
                templateKey: 'marketing-page',
                semanticRegion: 'main',
                labelKey: 'layouts.zones.marketingMain',
                defaultLabel: 'Marketing content',
                settings: []
            },
            {
                key: 'marketing-footer',
                templateKey: 'marketing-page',
                semanticRegion: 'footer',
                labelKey: 'layouts.zones.marketingFooter',
                defaultLabel: 'Marketing footer',
                settings: []
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
            parentInstanceKey: null,
            slotKey: null,
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
                parentInstanceKey: null,
                slotKey: null,
                sortOrder: 0,
                config: { variant: 'logos' },
                isActive: true
            },
            {
                id: '0190a9b5-3cde-7abc-8def-0123456789a3',
                widgetKey: 'marketing.collection' as const,
                zone: 'marketing-main' as const,
                semanticRegion: 'main' as const,
                instanceKey: 'collection-secondary',
                parentInstanceKey: null,
                slotKey: null,
                sortOrder: 1,
                config: { variant: 'features' },
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
        expect(
            effectiveLayoutResultSchema.safeParse({
                ...(result.success ? result.data : {}),
                layout: {
                    ...(result.success ? result.data.layout : {}),
                    zoneSettings: { 'marketing-header': { position: 'unsupported' } }
                }
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
            instanceKey: 'interpretation-workspace',
            parentWidgetId: null,
            slotKey: null,
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
            parentInstanceKey: null,
            slotKey: null,
            sortOrder: 0,
            config: {},
            isActive: true
        }

        const parsed = effectiveLayoutWidgetSchema.safeParse(widget)
        expect(parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues)).toBe(true)
        const runtimeWidget = { ...widget, runtimeData: { status: 'ready' as const, data: { kind: 'title' as const, text: 'Overview' } } }
        expect(effectiveLayoutRuntimeWidgetSchema.safeParse(runtimeWidget).success).toBe(true)
        expect(
            effectiveLayoutRuntimeWidgetSchema.safeParse({
                ...widget,
                runtimeData: { status: 'ready', data: { kind: 'title', text: 'Overview', recordId: 'must-not-leak' } }
            }).success
        ).toBe(false)
        expect(
            effectiveLayoutResultSchema.safeParse({
                status: 'ok',
                target: {
                    applicationId: '0190a9b5-3cde-7abc-8def-0123456789a1',
                    targetKind: null,
                    locale: 'en'
                },
                scope: 'global',
                layout: {
                    id: '0190a9b5-3cde-7abc-8def-0123456789a2',
                    templateKey: 'dashboard',
                    sourceKind: 'application',
                    sourceLayoutId: null,
                    compositionMode: 'independent',
                    baseLayoutId: null
                },
                widgets: [runtimeWidget],
                precedence: ['application-global'],
                publicationIdentity: null,
                effectiveHash: 'a'.repeat(64)
            }).success
        ).toBe(true)
        expect(
            effectiveLayoutWidgetSchema.safeParse({
                ...widget,
                runtimeData: { status: 'ready', data: { kind: 'title', text: 'Overview' } }
            }).success
        ).toBe(false)
        expect(effectiveLayoutWidgetSchema.safeParse({ ...widget, sortOrder: -200 }).success).toBe(true)
        expect(effectiveLayoutWidgetSchema.safeParse({ ...widget, parentWidgetId: null }).success).toBe(false)
        expect(effectiveLayoutWidgetSchema.safeParse({ ...widget, parentInstanceKey: 'parent', slotKey: null }).success).toBe(false)
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
            conceptCodename: 'Structure',
            serverModuleCodename: 'interpretation-runtime',
            matrixField: 'InterpretationMatrix',
            materialTitleField: 'Title',
            interpretationTitleField: 'Title',
            tableTemplateNameField: 'Name',
            tableTemplateDescriptionField: 'Description'
        })
        expect(() =>
            parseApplicationLayoutWidgetConfig('interpretationNetworkWorkspace', {
                matrixMode: 'hierarchicalCells',
                visibleFor: { sectionIds: ['018f8a78-7b8f-7c1d-a111-2222333344a1'] }
            })
        ).toThrow()
        expect(() =>
            parseApplicationLayoutWidgetConfig('interpretationNetworkWorkspace', {
                matrixMode: 'hierarchicalCells',
                sharedBehavior: { canDeactivate: true, canExclude: false, positionLocked: true }
            })
        ).toThrow()
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
        expect(parseApplicationLayoutWidgetConfig('interpretationNetworkWorkspace', {})).toEqual({})
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

    it('marks dashboard shell widgets as single-instance placements', () => {
        expect(LAYOUT_WIDGET_DEFINITIONS.filter((widget) => widget.key === 'appNavbar' || widget.key === 'header')).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ key: 'appNavbar', multiInstance: false }),
                expect.objectContaining({ key: 'header', multiInstance: false })
            ])
        )
    })

    it('accepts strict presentation-only renderer configs and rejects inventoried legacy payloads', () => {
        expect(parseApplicationLayoutWidgetConfig('playcanvasCanvas', { minHeight: 560, heightMode: 'fitViewport' })).toEqual({
            minHeight: 560,
            heightMode: 'fitViewport'
        })
        expect(parseApplicationLayoutWidgetConfig('overviewCards', { maxCards: 4, density: 'compact' })).toEqual({
            maxCards: 4,
            density: 'compact'
        })
        expect(parseApplicationLayoutWidgetConfig('columnsContainer', { columns: [{ slotKey: 'column:main', width: 12 }] })).toEqual({
            columns: [{ slotKey: 'column:main', width: 12 }]
        })
        expect(
            parseApplicationLayoutWidgetConfig('detailsTabs', { tabs: [{ slotKey: 'tab:overview', label: 'Overview', isDefault: true }] })
        ).toEqual({
            tabs: [{ slotKey: 'tab:overview', label: 'Overview', isDefault: true }]
        })

        const legacyPayloads: Array<[string, unknown]> = [
            ['menuWidget', { variant: 'manual', items: [{ label: 'Legacy item' }] }],
            ['overviewTitle', { content: { en: 'Demo title' } }],
            ['overviewCards', { cards: [{ metricKey: 'records.count', value: 42 }] }],
            ['sessionsChart', { datasource: { kind: 'metric', metricKey: 'records.count' }, series: [{ values: [1, 2, 3] }] }],
            ['detailsTable', { datasource: { kind: 'records.list', sectionCodename: 'CourseItems' } }],
            ['relationBuilder', { parentDatasource: { kind: 'records.list' }, panels: [{ id: 'children', widgets: [] }] }],
            ['columnsContainer', { columns: [{ id: 'main', width: 12, widgets: [{ widgetKey: 'detailsTable' }] }] }],
            ['detailsTabs', { tabs: [{ id: 'overview', label: 'Overview', widgets: [{ widgetKey: 'detailsTable' }] }] }],
            ['playcanvasCanvas', { scene: { objects: [{ id: 'ship' }] } }],
            ['resourcePreview', { source: { type: 'video', url: 'https://example.test/video.mp4' } }],
            ['learnerPlayer', { itemsDatasource: { kind: 'records.list' } }],
            ['quizWidget', { questions: [{ prompt: 'Demo question' }] }],
            ['interpretationNetworkWorkspace', { sharedBehavior: { source: 'legacy' } }],
            ['infoCard', { title: { en: 'Legacy content' }, description: 'Demo text' }],
            ['overviewCards', { instanceKey: 'renderer-config-identity' }]
        ]

        for (const [widgetKey, config] of legacyPayloads) {
            expect(() => parseApplicationLayoutWidgetConfig(widgetKey, config), widgetKey).toThrow()
        }
        expect(() => parseApplicationLayoutWidgetConfig('brandSelector', {})).toThrow()
        expect(() => parseApplicationLayoutWidgetConfig('productTree', {})).toThrow()
        expect(() => parseApplicationLayoutWidgetConfig('usersByCountryChart', {})).toThrow()
    })

    it('validates effective placements through semantic parent instance keys and declared container slots', () => {
        const baseLayout = {
            id: '0190a9b5-3cde-7abc-8def-0123456789a1',
            templateKey: 'dashboard' as const,
            scopeKind: 'global' as const,
            scopeEntityId: null,
            sourceKind: 'metahub' as const,
            sourceLayoutId: null,
            compositionMode: 'independent' as const,
            baseLayoutId: null
        }
        const parent = {
            id: '0190a9b5-3cde-7abc-8def-0123456789a2',
            widgetKey: 'columnsContainer' as const,
            zone: 'center' as const,
            semanticRegion: 'main' as const,
            instanceKey: 'columns-main',
            parentInstanceKey: null,
            slotKey: null,
            sortOrder: 0,
            config: { columns: [{ slotKey: 'column:main', width: 12 }] },
            isActive: true
        }
        const child = {
            id: '0190a9b5-3cde-7abc-8def-0123456789a3',
            widgetKey: 'overviewTitle' as const,
            zone: 'center' as const,
            semanticRegion: 'main' as const,
            instanceKey: 'overview-title',
            parentInstanceKey: 'columns-main',
            slotKey: 'column:main',
            sortOrder: 0,
            config: { align: 'left' },
            isActive: true
        }

        expect(applicationLayoutContractSchema.safeParse({ ...baseLayout, widgets: [parent, child] }).success).toBe(true)
        expect(
            applicationLayoutContractSchema.safeParse({ ...baseLayout, widgets: [parent, { ...child, parentInstanceKey: 'missing' }] })
                .success
        ).toBe(false)
        expect(
            applicationLayoutContractSchema.safeParse({ ...baseLayout, widgets: [parent, { ...child, slotKey: 'column:undeclared' }] })
                .success
        ).toBe(false)
        expect(
            applicationLayoutContractSchema.safeParse({ ...baseLayout, widgets: [parent, { ...child, parentWidgetId: parent.id }] }).success
        ).toBe(false)
    })
})
