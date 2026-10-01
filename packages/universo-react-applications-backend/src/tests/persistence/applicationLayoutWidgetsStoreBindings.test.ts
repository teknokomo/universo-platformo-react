import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import {
    buildSingleTargetWidgetBinding,
    decodeLayoutWidgetConfigEnvelope,
    encodeLayoutWidgetConfigEnvelope,
    getLayoutWidgetDefinition,
    LAYOUT_WIDGET_DEFINITIONS
} from '@universo-react/types'
import * as layoutSupport from '../../persistence/applicationLayoutStoreSupport'
import { createApplicationLayoutWidgetSourceState } from '../../services/applicationLayoutWidgetSourceState'
import {
    moveApplicationLayoutWidget,
    resetApplicationLayoutWidgetConfigsBatch,
    updateApplicationLayoutWidgetConfig,
    upsertApplicationLayoutWidget
} from '../../persistence/applicationLayoutWidgetsStore'
import * as structureModeGuard from '../../shared/interpretationNetworkStructureModeGuard'
import { createMockDbExecutor } from '../utils/dbMocks'

const layoutId = '0190a9b5-3cde-7abc-8def-012345678901'
const heroId = '0190a9b5-3cde-7abc-8def-012345678902'
const secondHeroId = '0190a9b5-3cde-7abc-8def-012345678903'
const schemaName = 'app_018f8a787b8f7c1da111222233334444'

const heroDefinition = LAYOUT_WIDGET_DEFINITIONS.find(({ key }) => key === 'marketing.hero')
if (!heroDefinition) throw new Error('The marketing hero widget must be registered')

const expectedSourceManagedWidgetKeys = new Set([
    'marketing.brand',
    'marketing.navigation',
    'marketing.hero',
    'marketing.image',
    'marketing.collection',
    'marketing.pricing',
    'marketing.footer'
])
const sourceManagedMarketingVariants = LAYOUT_WIDGET_DEFINITIONS.flatMap((definition) => {
    if (!definition.supportedTemplates.includes('marketing-page')) return []
    const zone = definition.allowedZonesByTemplate['marketing-page']?.[0]
    if (!zone) return []
    const variants = definition.bindingVariants ? Object.keys(definition.bindingVariants) : [undefined]

    return variants.flatMap((variant) => {
        const config = { instanceKey: `application-copy-${definition.key}${variant ? `-${variant}` : ''}`, ...(variant ? { variant } : {}) }
        const resolvedDefinition = getLayoutWidgetDefinition(definition.key, config)
        if (!(resolvedDefinition?.bindingSlots ?? []).some(({ cardinality }) => cardinality.min > 0)) return []
        if (!expectedSourceManagedWidgetKeys.has(definition.key)) {
            throw new Error(`Unexpected source-owned Marketing widget key in the application mutation matrix: ${definition.key}`)
        }
        return [{ widgetKey: definition.key, zone, config, variant: variant ?? 'default' }]
    })
})
if (sourceManagedMarketingVariants.length !== 11) {
    throw new Error('The application mutation matrix must cover all 11 required source-owned Marketing widget variants')
}

const heroBinding = (semanticKey: string) =>
    buildSingleTargetWidgetBinding(heroDefinition, 'content', {
        entityKind: 'object',
        entityCodename: 'MarketingPageHero',
        semanticKey
    })

const sourceConfig = (instanceKey: string, semanticKey: string) =>
    encodeLayoutWidgetConfigEnvelope(
        {
            rendererConfig: { instanceKey, showLeadForm: true },
            neutral: { bindings: heroBinding(semanticKey) }
        },
        { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
    )

const sourceState = (instanceKey: string, semanticKey: string, sortOrder: number) =>
    createApplicationLayoutWidgetSourceState('marketing-page', 'marketing.hero', {
        zone: 'marketing-main',
        sortOrder,
        isActive: true,
        config: sourceConfig(instanceKey, semanticKey)
    })

const widgetRow = (input: {
    id: string
    instanceKey: string
    semanticKey: string
    showLeadForm: boolean
    sortOrder: number
    version?: number
}) => ({
    id: input.id,
    layout_id: layoutId,
    zone: 'marketing-main',
    widget_key: 'marketing.hero',
    sort_order: input.sortOrder,
    config: { instanceKey: input.instanceKey, showLeadForm: input.showLeadForm },
    source_config: sourceConfig(input.instanceKey, input.semanticKey),
    source_state: sourceState(input.instanceKey, input.semanticKey, input.sortOrder),
    source_widget_id: input.id,
    source_base_widget_id: null,
    is_customized: !input.showLeadForm,
    is_active: true,
    version: input.version ?? 2
})

const mapHero = (input: Parameters<typeof widgetRow>[0]) => layoutSupport.mapWidget(widgetRow(input), 'marketing-page')

const layoutDetail = (widgets: ReturnType<typeof mapHero>[]) =>
    ({
        item: { id: layoutId, templateKey: 'marketing-page', isActive: true, version: 3 },
        widgets
    } as never)

const { executor, txExecutor } = createMockDbExecutor()
const lockLayout = jest.spyOn(layoutSupport, 'lockApplicationLayoutMutation')
const getLayoutDetail = jest.spyOn(layoutSupport, 'getApplicationLayoutDetail')
const lockStructureMode = jest.spyOn(structureModeGuard, 'lockInterpretationNetworkStructureMode')

beforeEach(() => {
    jest.clearAllMocks()
    txExecutor.query.mockReset().mockResolvedValue([])
    lockLayout.mockResolvedValue(
        layoutDetail([
            mapHero({
                id: heroId,
                instanceKey: 'hero-main',
                semanticKey: 'default',
                showLeadForm: false,
                sortOrder: 1
            })
        ])
    )
    getLayoutDetail.mockResolvedValue(null)
    lockStructureMode.mockResolvedValue(undefined)
})

describe('application layout widget source binding lifecycle', () => {
    it.each(sourceManagedMarketingVariants)(
        'rejects application-owned Add for the required $widgetKey source variant ($variant)',
        async ({ widgetKey, zone, config }) => {
            await expect(
                upsertApplicationLayoutWidget(
                    executor,
                    schemaName,
                    layoutId,
                    { expectedVersion: 3, zone, widgetKey, config } as never,
                    'user-1'
                )
            ).rejects.toThrow('APPLICATION_LAYOUT_ENTITY_BACKED_WIDGET_COPY_CONFLICT')

            expect(lockLayout).not.toHaveBeenCalled()
            expect(txExecutor.query).not.toHaveBeenCalled()
        }
    )

    it('rejects adding an entity-backed widget without a trusted source binding', async () => {
        await expect(
            upsertApplicationLayoutWidget(
                executor,
                schemaName,
                layoutId,
                {
                    expectedVersion: 3,
                    zone: 'marketing-main',
                    widgetKey: 'marketing.hero',
                    config: { instanceKey: 'hero-copy', showLeadForm: true }
                } as never,
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_ENTITY_BACKED_WIDGET_COPY_CONFLICT')

        expect(lockLayout).not.toHaveBeenCalled()
        expect(txExecutor.query).not.toHaveBeenCalled()
    })

    it('rejects application copies of widgets whose Entity bindings depend on renderer variants', async () => {
        await expect(
            upsertApplicationLayoutWidget(
                executor,
                schemaName,
                layoutId,
                {
                    expectedVersion: 3,
                    zone: 'marketing-main',
                    widgetKey: 'marketing.collection',
                    config: { instanceKey: 'logos-copy', variant: 'logos' }
                } as never,
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_ENTITY_BACKED_WIDGET_COPY_CONFLICT')

        expect(lockLayout).not.toHaveBeenCalled()
        expect(txExecutor.query).not.toHaveBeenCalled()
    })

    it('rejects attempts to forge binding metadata through ordinary widget writes', async () => {
        const forgedConfig = { instanceKey: 'hero-main', showLeadForm: true, __layout: { bindings: heroBinding('default') } }

        await expect(
            upsertApplicationLayoutWidget(
                executor,
                schemaName,
                layoutId,
                { expectedVersion: 3, zone: 'marketing-main', widgetKey: 'marketing.hero', config: forgedConfig } as never,
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_RESERVED_METADATA')
        await expect(
            updateApplicationLayoutWidgetConfig(
                executor,
                schemaName,
                layoutId,
                heroId,
                { expectedVersion: 2, config: forgedConfig } as never,
                'user-1'
            )
        ).rejects.toThrow('APPLICATION_LAYOUT_RESERVED_METADATA')

        expect(txExecutor.query).not.toHaveBeenCalled()
        expect(lockLayout).not.toHaveBeenCalled()
    })

    it('keeps source_config binding intact when saving a local presentation override', async () => {
        const baseline = widgetRow({
            id: heroId,
            instanceKey: 'hero-main',
            semanticKey: 'default',
            showLeadForm: true,
            sortOrder: 1
        })
        const updated = { ...baseline, config: { instanceKey: 'hero-main', showLeadForm: false }, is_customized: true, version: 3 }
        txExecutor.query.mockResolvedValueOnce([updated])

        const saved = await updateApplicationLayoutWidgetConfig(
            executor,
            schemaName,
            layoutId,
            heroId,
            { expectedVersion: 2, config: { instanceKey: 'hero-main', showLeadForm: false } } as never,
            'user-1'
        )

        expect(txExecutor.query.mock.calls[0]?.[0]).toContain('SET config = $2::jsonb')
        expect(txExecutor.query.mock.calls[0]?.[0]).not.toMatch(/SET[^;]*source_config\s*=/isu)
        expect(JSON.stringify(txExecutor.query.mock.calls[0]?.[1]?.[1])).not.toContain('bindings')
        expect(saved?.config).toEqual({ instanceKey: 'hero-main', showLeadForm: false })
        expect(layoutSupport.getApplicationLayoutWidgetSourceBindingState(saved)).toEqual({
            persistedApplicationRow: true,
            bindings: heroBinding('default')
        })
        expect(JSON.stringify(saved)).not.toContain('bindings')
    })

    it('maps sparse Marketing overlay source configs without exposing inherited bindings', () => {
        const overlayConfig = encodeLayoutWidgetConfigEnvelope(
            { rendererConfig: { instanceKey: 'hero-main', showLeadForm: true } },
            { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
        )
        const overlay = {
            ...widgetRow({
                id: heroId,
                instanceKey: 'hero-main',
                semanticKey: 'default',
                showLeadForm: true,
                sortOrder: 1
            }),
            config: { instanceKey: 'hero-main', showLeadForm: false },
            source_config: overlayConfig,
            source_state: createApplicationLayoutWidgetSourceState('marketing-page', 'marketing.hero', {
                zone: 'marketing-main',
                sortOrder: 1,
                isActive: true,
                config: overlayConfig
            }),
            source_widget_id: null,
            source_base_widget_id: secondHeroId
        }

        const mapped = layoutSupport.mapWidget(overlay, 'marketing-page')
        expect(mapped.config).toEqual({ instanceKey: 'hero-main', showLeadForm: false })
        expect(mapped.sourceBaseWidgetId).toBe(secondHeroId)
        expect(layoutSupport.getApplicationLayoutWidgetSourceBindingState(mapped)).toEqual({ persistedApplicationRow: true })
        expect(JSON.stringify(mapped)).not.toContain('bindings')

        expect(() => layoutSupport.mapWidget({ ...overlay, source_config: sourceConfig('hero-main', 'forged') }, 'marketing-page')).toThrow(
            'APPLICATION_LAYOUT_WIDGET_INVALID'
        )

        const direct = widgetRow({
            id: heroId,
            instanceKey: 'hero-main',
            semanticKey: 'default',
            showLeadForm: true,
            sortOrder: 1
        })
        expect(() => layoutSupport.mapWidget({ ...direct, config: sourceConfig('hero-main', 'forged') }, 'marketing-page')).toThrow(
            'APPLICATION_LAYOUT_WIDGET_INVALID'
        )
    })

    it('atomically restores the full source presentation baseline and preserves the trusted binding', async () => {
        const customized = widgetRow({
            id: heroId,
            instanceKey: 'hero-main',
            semanticKey: 'default',
            showLeadForm: false,
            sortOrder: 10
        })
        customized.is_active = false
        const baseline = sourceState('hero-main', 'default', 1)
        customized.source_state = baseline
        const resetConfig = encodeLayoutWidgetConfigEnvelope(
            {
                rendererConfig: baseline.rendererConfig,
                neutral: baseline.placement === null ? {} : { placement: baseline.placement }
            },
            { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: baseline.zone }
        )
        const reset = {
            ...customized,
            zone: baseline.zone,
            sort_order: baseline.sortOrder,
            config: resetConfig,
            is_active: baseline.isActive,
            is_customized: false,
            version: 3
        }
        txExecutor.query.mockResolvedValueOnce([customized]).mockResolvedValueOnce([reset])

        const saved = await resetApplicationLayoutWidgetConfigsBatch(
            executor,
            schemaName,
            { updates: [{ layoutId, widgetId: heroId, expectedVersion: 2 }] } as never,
            'user-1'
        )

        const [sql, params] = txExecutor.query.mock.calls[1] as [string, unknown[]]
        expect(sql).toContain('SET config = $3::jsonb')
        expect(sql).toContain('zone = $5')
        expect(sql).toContain('sort_order = $6')
        expect(sql).toContain('is_active = $7')
        expect(txExecutor.query.mock.calls[1]?.[0]).not.toMatch(/SET[^;]*source_config\s*=/isu)
        expect(params?.[4]).toBe(baseline.zone)
        expect(params?.[5]).toBe(baseline.sortOrder)
        expect(params?.[6]).toBe(baseline.isActive)
        const storedResetConfig = JSON.parse(String(params?.[2])) as Record<string, unknown>
        expect(storedResetConfig).toEqual(resetConfig)
        expect(storedResetConfig).not.toHaveProperty('__layout.bindings')
        expect(saved[0]?.config).toEqual({ instanceKey: 'hero-main', showLeadForm: true })
        expect(saved[0]?.sortOrder).toBe(1)
        expect(saved[0]?.isActive).toBe(true)
        expect(
            decodeLayoutWidgetConfigEnvelope(resetConfig, {
                templateKey: 'marketing-page',
                widgetKey: 'marketing.hero',
                zone: baseline.zone
            }).neutral.placement ?? null
        ).toEqual(baseline.placement)
        expect(
            decodeLayoutWidgetConfigEnvelope(customized.source_config, {
                templateKey: 'marketing-page',
                widgetKey: 'marketing.hero',
                zone: baseline.zone
            }).neutral.bindings
        ).toEqual(heroBinding('default'))
        expect(layoutSupport.getApplicationLayoutWidgetSourceBindingState(saved[0])).toEqual({
            persistedApplicationRow: true,
            bindings: heroBinding('default')
        })
        expect(JSON.stringify(saved[0])).not.toContain('bindings')
    })

    it('resets a Marketing overlay sparse source config without requiring inherited bindings locally', async () => {
        const overlayConfig = encodeLayoutWidgetConfigEnvelope(
            { rendererConfig: { instanceKey: 'hero-main', showLeadForm: true } },
            { templateKey: 'marketing-page', widgetKey: 'marketing.hero', zone: 'marketing-main' }
        )
        const baseline = createApplicationLayoutWidgetSourceState('marketing-page', 'marketing.hero', {
            zone: 'marketing-main',
            sortOrder: 1,
            isActive: true,
            config: overlayConfig
        })
        const customized = {
            ...widgetRow({
                id: heroId,
                instanceKey: 'hero-main',
                semanticKey: 'default',
                showLeadForm: true,
                sortOrder: 1
            }),
            config: { instanceKey: 'hero-main', showLeadForm: false },
            source_config: overlayConfig,
            source_state: baseline,
            source_widget_id: null,
            source_base_widget_id: secondHeroId
        }
        const reset = { ...customized, config: overlayConfig, version: 3 }
        lockLayout.mockResolvedValue({
            ...layoutDetail([]),
            item: { id: layoutId, templateKey: 'marketing-page', isActive: true, version: 3 } as never
        })
        txExecutor.query.mockResolvedValueOnce([customized]).mockResolvedValueOnce([reset])

        const saved = await resetApplicationLayoutWidgetConfigsBatch(
            executor,
            schemaName,
            { updates: [{ layoutId, widgetId: heroId, expectedVersion: 2 }] } as never,
            'user-1'
        )

        expect(saved[0]?.sourceBaseWidgetId).toBe(secondHeroId)
        expect(saved[0]?.config).toEqual({ instanceKey: 'hero-main', showLeadForm: true })
        expect(layoutSupport.getApplicationLayoutWidgetSourceBindingState(saved[0])).toEqual({ persistedApplicationRow: true })
    })

    it('preserves the source binding through a widget move and order-only SQL update', async () => {
        const firstHero = widgetRow({
            id: heroId,
            instanceKey: 'hero-main',
            semanticKey: 'default',
            showLeadForm: false,
            sortOrder: 1
        })
        const secondHero = widgetRow({
            id: secondHeroId,
            instanceKey: 'hero-secondary',
            semanticKey: 'campaign',
            showLeadForm: true,
            sortOrder: 2
        })
        lockLayout.mockResolvedValue(
            layoutDetail([layoutSupport.mapWidget(firstHero, 'marketing-page'), layoutSupport.mapWidget(secondHero, 'marketing-page')])
        )
        const movedFirst = { ...firstHero, sort_order: 2, version: 3 }
        const movedSecond = { ...secondHero, sort_order: 1, version: 3 }
        txExecutor.query.mockResolvedValueOnce([movedSecond, movedFirst])

        const moved = await moveApplicationLayoutWidget(
            executor,
            schemaName,
            layoutId,
            { expectedVersion: 2, widgetId: heroId, targetZone: 'marketing-main', targetIndex: 1 } as never,
            'user-1'
        )

        expect(txExecutor.query).toHaveBeenCalledTimes(1)
        expect(txExecutor.query.mock.calls[0]?.[0]).toContain('WITH updates AS')
        expect(txExecutor.query.mock.calls[0]?.[0]).not.toMatch(/SET[^;]*source_config\s*=/isu)
        expect(moved?.sortOrder).toBe(2)
        expect(layoutSupport.getApplicationLayoutWidgetSourceBindingState(moved)).toEqual({
            persistedApplicationRow: true,
            bindings: heroBinding('default')
        })
        expect(JSON.stringify(moved)).not.toContain('bindings')
    })

    it('retains the source binding when a no-op move returns an in-memory widget clone', async () => {
        const hero = mapHero({
            id: heroId,
            instanceKey: 'hero-main',
            semanticKey: 'default',
            showLeadForm: false,
            sortOrder: 1
        })
        lockLayout.mockResolvedValue(layoutDetail([hero]))

        const moved = await moveApplicationLayoutWidget(
            executor,
            schemaName,
            layoutId,
            { expectedVersion: 2, widgetId: heroId, targetZone: 'marketing-main', targetIndex: 0 } as never,
            'user-1'
        )

        expect(txExecutor.query).not.toHaveBeenCalled()
        expect(layoutSupport.getApplicationLayoutWidgetSourceBindingState(moved)).toEqual({
            persistedApplicationRow: true,
            bindings: heroBinding('default')
        })
        expect(JSON.stringify(moved)).not.toContain('bindings')
    })
})
