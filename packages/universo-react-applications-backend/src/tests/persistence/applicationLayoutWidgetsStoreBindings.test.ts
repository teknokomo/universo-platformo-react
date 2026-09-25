import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { buildSingleTargetWidgetBinding, encodeLayoutWidgetConfigEnvelope, LAYOUT_WIDGET_DEFINITIONS } from '@universo-react/types'
import * as layoutSupport from '../../persistence/applicationLayoutStoreSupport'
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

    it('restores the trusted source envelope on reset without exposing its binding', async () => {
        const customized = widgetRow({
            id: heroId,
            instanceKey: 'hero-main',
            semanticKey: 'default',
            showLeadForm: false,
            sortOrder: 1
        })
        const reset = { ...customized, config: customized.source_config, is_customized: false, version: 3 }
        txExecutor.query.mockResolvedValueOnce([customized]).mockResolvedValueOnce([reset])

        const saved = await resetApplicationLayoutWidgetConfigsBatch(
            executor,
            schemaName,
            { updates: [{ layoutId, widgetId: heroId, expectedVersion: 2 }] } as never,
            'user-1'
        )

        expect(txExecutor.query.mock.calls[1]?.[0]).toContain('SET config = source_config')
        expect(txExecutor.query.mock.calls[1]?.[0]).not.toMatch(/SET[^;]*source_config\s*=/isu)
        expect(saved[0]?.config).toEqual({ instanceKey: 'hero-main', showLeadForm: true })
        expect(layoutSupport.getApplicationLayoutWidgetSourceBindingState(saved[0])).toEqual({
            persistedApplicationRow: true,
            bindings: heroBinding('default')
        })
        expect(JSON.stringify(saved[0])).not.toContain('bindings')
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
