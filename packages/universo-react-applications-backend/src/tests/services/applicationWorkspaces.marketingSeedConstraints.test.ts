import { syncWorkspaceSeededElements } from '../../services/applicationWorkspaces'
import { createMockDbExecutor } from '../utils/dbMocks'
import { createMarketingPricingConfig } from '../utils/marketingWidgetBindings'

describe('applicationWorkspaces Marketing seed row and unique-key constraints', () => {
    it('rejects oversized workspace seed data for a custom Object referenced by a Pricing relation set', async () => {
        const { executor } = createMockDbExecutor()
        const schemaName = 'app_019ccefc2f7b7b3682f485cdb1312268'
        const objectId = '019ccefc-2f7b-7b36-82f4-85cdb1312268'
        const objectTable = 'obj_019ccefc2f7b7b3682f485cdb1312268'
        const oversizedRows = Array.from({ length: 1001 }, (_unused, index) => ({
            id: `019ccefc-2f7b-7b39-82f4-85cdb131${String(index).padStart(4, '0')}`,
            data: {}
        }))

        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes("table_name = '_app_layouts'") && sql.includes("table_name = '_app_widgets'")) {
                return [{ layouts: true, widgets: true }]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_settings"`)) {
                return [
                    {
                        value: {
                            version: 1,
                            elements: { [objectId]: oversizedRows }
                        }
                    }
                ]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                return [{ objectId, codename: 'CustomLandingBenefit', tableName: objectTable }]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_widgets"`)) {
                return [
                    {
                        widget_key: 'marketing.pricing',
                        zone: 'marketing-main',
                        config: createMarketingPricingConfig({ benefits: 'CustomLandingBenefit' }),
                        source_config: null,
                        source_base_widget_id: null
                    }
                ]
            }
            return []
        })

        await expect(
            syncWorkspaceSeededElements(executor, {
                schemaName,
                workspaceId: '019ccefc-2f7b-7b36-82f4-85cdb1312270',
                actorUserId: '019ccefc-2f7b-7b36-82f4-85cdb1312271'
            })
        ).rejects.toThrow('exceeds the public runtime row limit')

        expect(executor.query.mock.calls.some(([sql]) => String(sql).includes(`INSERT INTO "${schemaName}"."${objectTable}"`))).toBe(false)
    })

    it('rejects Marketing-bound workspace content when existing active rows exceed the public runtime limit', async () => {
        const { executor } = createMockDbExecutor()
        const schemaName = 'app_019ccefc2f7b7b3682f485cdb1312268'
        const workspaceId = '019ccefc-2f7b-7b36-82f4-85cdb1312270'
        const objectId = '019ccefc-2f7b-7b36-82f4-85cdb1312268'
        const objectTable = 'obj_019ccefc2f7b7b3682f485cdb1312268'

        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes("table_name = '_app_layouts'") && sql.includes("table_name = '_app_widgets'")) {
                return [{ layouts: true, widgets: true }]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_settings"`)) {
                return [{ value: { version: 1, elements: {} } }]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_objects"`) && sql.includes('table_name AS "tableName"')) {
                return [{ objectId, codename: 'CustomLandingBenefit', tableName: objectTable }]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_widgets"`)) {
                return [
                    {
                        widget_key: 'marketing.pricing',
                        zone: 'marketing-main',
                        config: createMarketingPricingConfig({ benefits: 'CustomLandingBenefit' }),
                        source_config: null,
                        source_base_widget_id: null
                    }
                ]
            }
            if (sql.includes(`FROM "${schemaName}"."${objectTable}"`) && sql.includes('COUNT(*)::text AS count')) {
                return [{ count: '1001' }]
            }
            return []
        })

        await expect(
            syncWorkspaceSeededElements(executor, {
                schemaName,
                workspaceId,
                actorUserId: '019ccefc-2f7b-7b36-82f4-85cdb1312271'
            })
        ).rejects.toThrow('exceeds the public runtime row limit')

        const countCall = executor.query.mock.calls.find(
            ([sql]) => String(sql).includes(`FROM "${schemaName}"."${objectTable}"`) && String(sql).includes('COUNT(*)::text AS count')
        )
        expect(countCall).toBeDefined()
        expect(String(countCall?.[0])).toContain('"workspace_id" = $1')
        expect(String(countCall?.[0])).toContain('"_upl_archived" = false')
        expect(String(countCall?.[0])).toContain('"_app_archived" = false')
        expect(String(countCall?.[0])).toContain('"_app_published" = true')
        expect(countCall?.[1]).toEqual([workspaceId])
        expect(executor.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))', [
            `marketing-row-cap:runtime-record-rules:${schemaName}.${objectTable}`
        ])
        expect(executor.query.mock.calls.some(([sql]) => String(sql).includes(`INSERT INTO "${schemaName}"."${objectTable}"`))).toBe(false)
    })

    it('rejects workspace seeding of marketing rows with case-insensitive duplicate unique keys', async () => {
        const { executor } = createMockDbExecutor()
        const schemaName = 'app_018f8a787b8f7c1da111222233335090'
        const objectId = '018f8a78-7b8f-7c1d-a111-222233335091'
        const componentId = '018f8a78-7b8f-7c1d-a111-222233335092'
        const columnName = 'col_018f8a787b8f7c1da111222233335092'

        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes("table_name = '_app_layouts'") && sql.includes("table_name = '_app_widgets'")) {
                return [{ layouts: true, widgets: true }]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_settings"`)) {
                return [
                    {
                        value: {
                            version: 1,
                            elements: {
                                [objectId]: [
                                    { id: 'pricing-row-a', data: { PricingKey: 'Starter' } },
                                    { id: 'pricing-row-b', data: { PricingKey: ' starter ' } }
                                ]
                            }
                        }
                    }
                ]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                return [{ objectId, codename: 'CustomPricingSection', tableName: 'obj_018f8a787b8f7c1da111222233335091' }]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_widgets"`)) {
                return [
                    {
                        widget_key: 'marketing.pricing',
                        zone: 'marketing-main',
                        config: createMarketingPricingConfig({ section: 'CustomPricingSection' }),
                        source_config: null,
                        source_base_widget_id: null
                    }
                ]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                return [
                    {
                        objectId,
                        componentId,
                        parentComponentId: null,
                        codename: 'PricingKey',
                        columnName,
                        dataType: 'STRING',
                        uiConfig: { stringMode: 'plain' },
                        validationRules: { unique: true },
                        targetObjectId: null,
                        targetObjectKind: null
                    }
                ]
            }

            if (sql.includes('FROM information_schema.columns')) {
                return [{ tableName: 'obj_018f8a787b8f7c1da111222233335091', columnName, udtName: 'text' }]
            }

            return []
        })

        await expect(
            syncWorkspaceSeededElements(executor, {
                schemaName,
                workspaceId: '018f8a78-7b8f-7c1d-a111-222233335099'
            })
        ).rejects.toThrow(/duplicate unique key/)

        const runtimeInsert = executor.query.mock.calls.find(([sql]) =>
            String(sql).includes(`INSERT INTO "${schemaName}"."obj_018f8a787b8f7c1da111222233335091"`)
        )
        expect(runtimeInsert).toBeUndefined()
    })
})
