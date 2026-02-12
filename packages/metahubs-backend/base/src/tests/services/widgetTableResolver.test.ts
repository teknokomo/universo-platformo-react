import type { Knex } from 'knex'
import { MetahubMigrationRequiredError } from '../../domains/shared/domainErrors'
import { clearWidgetTableResolverCache, resolveWidgetTableName } from '../../domains/templates/services/widgetTableResolver'

describe('widgetTableResolver', () => {
    beforeEach(() => {
        clearWidgetTableResolverCache()
    })

    it('resolves new widgets table when available', async () => {
        const hasTable = jest.fn(async (tableName: string) => tableName === '_mhb_widgets')
        const knex = {
            schema: {
                withSchema: jest.fn(() => ({ hasTable }))
            }
        } as unknown as Knex

        const tableName = await resolveWidgetTableName(knex, 'mhb_test_schema')
        expect(tableName).toBe('_mhb_widgets')
    })

    it('falls back to legacy widgets table for V1 schemas', async () => {
        const hasTable = jest.fn(async (tableName: string) => tableName === '_mhb_layout_zone_widgets')
        const knex = {
            schema: {
                withSchema: jest.fn(() => ({ hasTable }))
            }
        } as unknown as Knex

        const tableName = await resolveWidgetTableName(knex, 'mhb_legacy_schema')
        expect(tableName).toBe('_mhb_layout_zone_widgets')
    })

    it('throws migration required when no compatible widgets table exists', async () => {
        const hasTable = jest.fn(async () => false)
        const knex = {
            schema: {
                withSchema: jest.fn(() => ({ hasTable }))
            }
        } as unknown as Knex

        await expect(resolveWidgetTableName(knex, 'mhb_broken_schema')).rejects.toBeInstanceOf(MetahubMigrationRequiredError)
    })
})
