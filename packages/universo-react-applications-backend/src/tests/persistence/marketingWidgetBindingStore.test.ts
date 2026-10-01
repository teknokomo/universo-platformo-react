import { createMarketingPricingConfig } from '../utils/marketingWidgetBindings'
import {
    listMarketingWidgetBindingSources,
    listMarketingWidgetBindingSourcesForRuntimeWrites
} from '../../persistence/marketingWidgetBindingStore'

describe('listMarketingWidgetBindingSources', () => {
    const schemaName = 'app_019ccefc2f7b7b3682f485cdb1312268'

    it('reads all selector sources from persisted Marketing widget configs with schema-qualified SQL', async () => {
        const config = createMarketingPricingConfig({
            section: 'CustomPricingSection',
            tiers: 'CustomPricingTier',
            benefits: 'CustomPricingBenefit'
        })
        const executor = {
            query: jest
                .fn()
                .mockResolvedValueOnce([{ layouts: true, widgets: true }])
                .mockResolvedValueOnce([
                    {
                        widget_key: 'marketing.pricing',
                        zone: 'marketing-main',
                        config,
                        source_config: config,
                        source_base_widget_id: null
                    }
                ])
        }

        await expect(listMarketingWidgetBindingSources(executor as never, schemaName)).resolves.toEqual(
            new Set(['CustomPricingSection', 'CustomPricingTier', 'CustomPricingBenefit'])
        )

        const [capabilitySql, capabilityParams] = executor.query.mock.calls[0] as [string, unknown[]]
        expect(capabilitySql).toContain('information_schema.tables')
        expect(capabilityParams).toEqual([schemaName])
        const [sql, params] = executor.query.mock.calls[1] as [string, unknown[]]
        expect(sql).toContain(`"${schemaName}"."_app_layouts"`)
        expect(sql).toContain(`"${schemaName}"."_app_widgets"`)
        expect(sql).toContain('l.template_key = $1')
        expect(sql).toContain('w.source_config')
        expect(sql).toContain('w.source_base_widget_id')
        expect(sql).toContain('w._upl_deleted = false')
        expect(sql).toContain('w._app_deleted = false')
        expect(sql).not.toContain('MarketingPage')
        expect(params).toEqual(['marketing-page'])
    })

    it('returns no sources when an application was created without optional layout tables', async () => {
        const executor = { query: jest.fn().mockResolvedValueOnce([{ layouts: false, widgets: false }]) }

        await expect(listMarketingWidgetBindingSources(executor as never, schemaName)).resolves.toEqual(new Set())
        expect(executor.query).toHaveBeenCalledTimes(1)
        expect(executor.query.mock.calls[0]?.[0]).toContain('information_schema.tables')
        expect(executor.query.mock.calls[0]?.[0]).not.toContain('"_app_widgets"')
    })

    it('skips malformed placements only for runtime-write row-cap classification', async () => {
        const validConfig = createMarketingPricingConfig({ section: 'CustomPricingSection' })
        const executor = {
            query: jest
                .fn()
                .mockResolvedValueOnce([{ layouts: true, widgets: true }])
                .mockResolvedValueOnce([
                    {
                        widget_key: 'marketing.collection',
                        zone: 'marketing-main',
                        config: { variant: 'features' },
                        source_config: null,
                        source_base_widget_id: null
                    },
                    {
                        widget_key: 'marketing.pricing',
                        zone: 'marketing-main',
                        config: validConfig,
                        source_config: validConfig,
                        source_base_widget_id: null
                    }
                ])
        }

        const sources = await listMarketingWidgetBindingSourcesForRuntimeWrites(executor as never, schemaName)
        expect(sources.has('CustomPricingSection')).toBe(true)
    })

    it('fails closed when persisted bindings or their source baseline are invalid', async () => {
        const invalidConfig = { variant: 'features' }
        const executor = {
            query: jest
                .fn()
                .mockResolvedValueOnce([{ layouts: true, widgets: true }])
                .mockResolvedValueOnce([
                    {
                        widget_key: 'marketing.collection',
                        zone: 'marketing-main',
                        config: invalidConfig,
                        source_config: createMarketingPricingConfig(),
                        source_base_widget_id: null
                    }
                ])
        }

        await expect(listMarketingWidgetBindingSources(executor as never, schemaName)).rejects.toThrow()
    })
})
