import { PUBLIC_MARKETING_ROW_LIMIT } from '../../../shared/marketingRuntimeLimits'
import { assertMarketingRuntimeRowCap } from '../../../services/marketingRowCap'
import { copyRuntimeConfiguredRelations } from '../../../controllers/runtimeRowSupport/rows'
import { createMarketingCollectionConfig, createMarketingPricingConfig } from '../../utils/marketingWidgetBindings'
import { buildRuntimeRecordRuleLockKey } from '../../../services/runtimeRecordRuleLockKey'

const schemaName = 'app_019ccefc2f7b7b3682f485cdb1312268'

const createManager = (
    count: string | number | null,
    config?: Record<string, unknown>,
    layoutTablesExist = false,
    widgetKey = 'marketing.collection'
) => ({
    query: jest.fn(async (sql: string) => {
        if (sql.includes('information_schema.tables')) return [{ layouts: layoutTablesExist, widgets: layoutTablesExist }]
        if (sql.includes('COUNT(*)')) return count === null ? [] : [{ count: String(count) }]
        if (sql.includes('"_app_widgets"')) {
            return config
                ? [{ widget_key: widgetKey, zone: 'marketing-main', config, source_config: null, source_base_widget_id: null }]
                : []
        }
        return []
    })
})

describe('assertMarketingRuntimeRowCap', () => {
    it('skips non-marketing objects when the application has no optional layout tables', async () => {
        const manager = createManager(0)

        await assertMarketingRuntimeRowCap({
            manager: manager as never,
            schemaName,
            schemaIdent: `"${schemaName}"`,
            tableName: 'orders',
            runtimeRowCondition: 'TRUE',
            objectCodename: 'Orders'
        })

        expect(manager.query).toHaveBeenCalledTimes(2)
        expect(manager.query.mock.calls[0]?.[0]).toContain('pg_advisory_xact_lock')
        expect(manager.query.mock.calls[1]?.[0]).toContain('information_schema.tables')
        expect(manager.query.mock.calls[1]?.[0]).not.toContain('COUNT(*)')
    })

    it('does not classify an Entity from its codename without a persisted Marketing binding', async () => {
        const manager = createManager(PUBLIC_MARKETING_ROW_LIMIT, undefined, true)

        await assertMarketingRuntimeRowCap({
            manager: manager as never,
            schemaName,
            schemaIdent: `"${schemaName}"`,
            tableName: 'marketing_faq',
            runtimeRowCondition: '_upl_deleted = false',
            objectCodename: 'MarketingPageFaq'
        })

        expect(manager.query.mock.calls.some(([sql]) => sql.includes('COUNT(*)'))).toBe(false)
    })

    it('scopes Marketing binding discovery to the Object being mutated', async () => {
        const manager = {
            query: jest.fn(async (sql: string, params?: unknown[]) => {
                if (sql.includes('pg_advisory_xact_lock')) return []
                if (sql.includes('information_schema.tables')) return [{ layouts: true, widgets: true }]
                if (sql.includes('"_app_widgets"')) {
                    expect(sql).toContain('jsonb_array_elements')
                    expect(sql).not.toContain('?')
                    expect(params).toEqual(['marketing-page', 'UnrelatedObject'])
                    // A malformed Marketing widget for another Object is excluded by the SQL predicate,
                    // so it never reaches strict envelope decoding for this write.
                    return []
                }
                if (sql.includes('COUNT(*)')) throw new Error('Unrelated Object must not be counted as Marketing content')
                return []
            })
        }

        await expect(
            assertMarketingRuntimeRowCap({
                manager: manager as never,
                schemaName,
                schemaIdent: `"${schemaName}"`,
                tableName: 'unrelated_object',
                runtimeRowCondition: '_upl_deleted = false',
                objectCodename: 'UnrelatedObject'
            })
        ).resolves.toBeUndefined()
    })

    it('applies the row cap to a custom Object selected by semantic key', async () => {
        const manager = createManager(
            PUBLIC_MARKETING_ROW_LIMIT - 1,
            createMarketingPricingConfig({ section: 'CustomSemanticFaq' }),
            true,
            'marketing.pricing'
        )

        await expect(
            assertMarketingRuntimeRowCap({
                manager: manager as never,
                schemaName,
                schemaIdent: `"${schemaName}"`,
                tableName: 'marketing_faq',
                runtimeRowCondition: '_upl_deleted = false',
                objectCodename: 'CustomSemanticFaq'
            })
        ).resolves.toBeUndefined()
        const countCall = manager.query.mock.calls.find(([sql]) => sql.includes('COUNT(*)'))
        expect(countCall).toBeDefined()
        expect(String(countCall?.[0])).toContain('"_upl_archived" = false')
        expect(String(countCall?.[0])).toContain('"_app_archived" = false')
        expect(String(countCall?.[0])).toContain('"_app_published" = true')
    })

    it('fails closed with a stable code when the limit is reached', async () => {
        const manager = createManager(
            PUBLIC_MARKETING_ROW_LIMIT,
            createMarketingPricingConfig({ section: 'CustomSemanticFaq' }),
            true,
            'marketing.pricing'
        )

        await expect(
            assertMarketingRuntimeRowCap({
                manager: manager as never,
                schemaName,
                schemaIdent: `"${schemaName}"`,
                tableName: 'marketing_faq',
                runtimeRowCondition: '_upl_deleted = false',
                objectCodename: 'CustomSemanticFaq'
            })
        ).rejects.toMatchObject({
            statusCode: 409,
            body: expect.objectContaining({ code: 'MARKETING_ROW_LIMIT_REACHED' })
        })
    })

    it.each([
        ['a malformed count', 'not-a-number'],
        ['a missing count row', null]
    ] as const)('fails closed for %s', async (_description, count) => {
        const manager = createManager(count, createMarketingPricingConfig({ section: 'CustomSemanticFaq' }), true, 'marketing.pricing')

        await expect(
            assertMarketingRuntimeRowCap({
                manager: manager as never,
                schemaName,
                schemaIdent: `"${schemaName}"`,
                tableName: 'marketing_faq',
                runtimeRowCondition: '_upl_deleted = false',
                objectCodename: 'CustomSemanticFaq'
            })
        ).rejects.toMatchObject({
            statusCode: 500,
            body: expect.objectContaining({ code: 'MARKETING_ROW_COUNT_INVALID' })
        })
    })

    it('applies the public runtime row cap to a custom Entity connected through a collection widget', async () => {
        const manager = createManager(PUBLIC_MARKETING_ROW_LIMIT, createMarketingCollectionConfig('CustomLandingFeature'), true)

        await expect(
            assertMarketingRuntimeRowCap({
                manager: manager as never,
                schemaName,
                schemaIdent: `"${schemaName}"`,
                tableName: 'custom_landing_features',
                runtimeRowCondition: '_upl_deleted = false',
                objectCodename: 'CustomLandingFeature'
            })
        ).rejects.toMatchObject({
            statusCode: 409,
            body: expect.objectContaining({ code: 'MARKETING_ROW_LIMIT_REACHED' })
        })
        expect(manager.query.mock.calls.some(([sql]) => sql.includes('COUNT(*)'))).toBe(true)
        expect(manager.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))', [
            `marketing-row-cap:${buildRuntimeRecordRuleLockKey(`"${schemaName}"`, 'custom_landing_features')}`
        ])
    })

    it('applies the public runtime row cap to a custom Object in a relation-set binding', async () => {
        const manager = createManager(
            PUBLIC_MARKETING_ROW_LIMIT,
            createMarketingPricingConfig({ benefits: 'CustomPricingBenefit' }),
            true,
            'marketing.pricing'
        )

        await expect(
            assertMarketingRuntimeRowCap({
                manager: manager as never,
                schemaName,
                schemaIdent: `"${schemaName}"`,
                tableName: 'custom_pricing_benefits',
                runtimeRowCondition: '_upl_deleted = false',
                objectCodename: 'CustomPricingBenefit'
            })
        ).rejects.toMatchObject({
            statusCode: 409,
            body: expect.objectContaining({ code: 'MARKETING_ROW_LIMIT_REACHED' })
        })
        expect(manager.query.mock.calls.some(([sql]) => sql.includes('COUNT(*)'))).toBe(true)
    })
})

describe('copyRuntimeConfiguredRelations Entity policy', () => {
    it('rejects a denied related Object before inserting any copied relation rows', async () => {
        const manager = {
            query: jest.fn().mockResolvedValue([
                {
                    id: 'related-object',
                    kind: 'object',
                    codename: 'OwnedItems',
                    table_name: 'owned_items',
                    config: {
                        recordPolicy: {
                            version: 1,
                            denyDeleteWhenBound: false,
                            immutableSemanticKeyWhenBound: false,
                            runtimeMutation: 'deny'
                        }
                    }
                }
            ])
        }

        await expect(
            copyRuntimeConfiguredRelations({
                manager: manager as never,
                schemaIdent: '"runtime_schema"',
                currentWorkspaceId: null,
                workspacesEnabled: false,
                userId: 'user-1',
                sourceParentId: 'source-id',
                copiedParentId: 'copy-id',
                relations: [
                    {
                        objectCodename: 'OwnedItems',
                        parentFieldCodename: 'Owner',
                        orderFieldCodename: null,
                        refRemaps: []
                    }
                ]
            })
        ).rejects.toMatchObject({ statusCode: 403, code: 'RUNTIME_ENTITY_MUTATION_DENIED' })

        expect(manager.query).toHaveBeenCalledTimes(1)
        expect(manager.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
    })
})
