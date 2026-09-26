import { buildSingleTargetWidgetBinding, encodeWidgetConfigEnvelope, LAYOUT_WIDGET_DEFINITIONS } from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils/database'
import type { MarketingHeroBindingTarget } from '../../domains/layouts/marketingHeroBindingsStore'
import { MarketingHeroBindingService } from '../../domains/layouts/marketingHeroBindingService'
import { loadMarketingHeroBindingTarget } from '../../domains/layouts/marketingHeroBindingsStore'

jest.mock('../../domains/layouts/marketingHeroBindingsStore', () => ({
    loadMarketingHeroBindingBySemanticTarget: jest.fn(),
    loadMarketingHeroBindingTarget: jest.fn()
}))

jest.mock('../../domains/layouts/marketingHeroActionPolicy', () => ({
    validateMarketingHeroActionTargets: jest.fn()
}))

const schemaName = 'mhb_0123456789abcdef0123456789abcdef_b1'
const metahubId = '0190a9b5-3cde-7abc-8def-0123456789a1'
const layoutId = '0190a9b5-3cde-7abc-8def-0123456789a2'
const widgetId = '0190a9b5-3cde-7abc-8def-0123456789a3'
const recordId = '0190a9b5-3cde-7abc-8def-0123456789a4'

const widgetDefinition = LAYOUT_WIDGET_DEFINITIONS.find(({ key }) => key === 'marketing.hero')
if (!widgetDefinition) throw new Error('Marketing Hero widget is not registered')

const targetBinding = buildSingleTargetWidgetBinding(widgetDefinition, 'content', {
    entityKind: 'object',
    entityCodename: 'MarketingPageHero',
    semanticKey: 'hero-default'
})
const initialBinding = buildSingleTargetWidgetBinding(widgetDefinition, 'content', {
    entityKind: 'object',
    entityCodename: 'MarketingPageHero',
    semanticKey: 'hero-before-rebind'
})

const widgetContext = { templateKey: 'marketing-page' as const, widgetKey: 'marketing.hero' as const, zone: 'marketing-main' as const }
const originalConfig = encodeWidgetConfigEnvelope(
    { rendererConfig: { instanceKey: 'hero-default' }, neutral: { bindings: initialBinding } },
    widgetContext
)

describe('MarketingHeroBindingService transaction boundary', () => {
    it('rolls a rebind back when layout synchronization fails after the widget update', async () => {
        const updateFailure = new Error('layout synchronization failed')
        const events: string[] = []
        let persistedConfig: unknown = originalConfig
        const currentWidget = {
            id: widgetId,
            layout_id: layoutId,
            widget_key: 'marketing.hero',
            zone: 'marketing-main',
            config: originalConfig,
            _upl_version: 2
        }
        const query = jest.fn(async (sql: string, parameters?: unknown[]) => {
            if (sql.includes('SELECT * FROM')) return [currentWidget]
            if (sql.startsWith('UPDATE')) {
                persistedConfig = JSON.parse(String(parameters?.[0])) as unknown
                return [{ ...currentWidget, config: persistedConfig, _upl_version: 3 }]
            }
            return []
        })

        let savepointExecutor: DbExecutor
        const savepointTransaction = jest.fn(async (work: (executor: DbExecutor) => Promise<unknown>) => {
            events.push('savepoint')
            const beforeSavepoint = persistedConfig
            try {
                const result = await work(savepointExecutor)
                events.push('release')
                return result
            } catch (error) {
                persistedConfig = beforeSavepoint
                events.push('rollback')
                throw error
            }
        })
        savepointExecutor = {
            query,
            transaction: savepointTransaction,
            isReleased: () => false
        } as unknown as DbExecutor

        const exec = {
            query,
            transaction: jest.fn(async (work: (executor: DbExecutor) => Promise<unknown>) => work(savepointExecutor)),
            isReleased: () => false
        } as unknown as DbExecutor
        const layout = {
            id: layoutId,
            scope_entity_id: null,
            base_layout_id: null,
            template_key: 'marketing-page',
            config: {}
        }
        const targetLoader = jest.mocked(loadMarketingHeroBindingTarget)
        targetLoader.mockResolvedValue({
            binding: targetBinding,
            data: {} as MarketingHeroBindingTarget['data'],
            recordId,
            recordVersion: 1,
            label: 'Hero',
            policy: {} as MarketingHeroBindingTarget['policy']
        })

        const service = new MarketingHeroBindingService({
            exec,
            schemaService: { ensureSchema: jest.fn().mockResolvedValue(schemaName) } as never,
            acquireLayoutGraphLock: jest.fn(),
            getLayoutScopeRow: jest.fn().mockResolvedValue(layout),
            lockLayoutScopeRow: jest.fn().mockResolvedValue(layout),
            assertLayoutSupportsWidgets: jest.fn().mockReturnValue('marketing-page'),
            assertExpectedWidgetVersion: jest.fn(),
            syncLayoutConfigFromZoneWidgets: jest.fn().mockRejectedValue(updateFailure),
            mapZoneWidgetRow: jest.fn((row) => row)
        })

        await expect(service.update(metahubId, layoutId, widgetId, { recordId, expectedVersion: 2 })).rejects.toBe(updateFailure)

        expect(query).toHaveBeenCalledWith(expect.stringMatching(/^UPDATE /), expect.any(Array))
        const updateParameters = query.mock.calls.find(([sql]) => sql.startsWith('UPDATE'))?.[1]
        expect(JSON.parse(String(updateParameters?.[0]))).not.toEqual(originalConfig)
        expect(events).toEqual(['savepoint', 'rollback'])
        expect(persistedConfig).toEqual(originalConfig)
    })
})
