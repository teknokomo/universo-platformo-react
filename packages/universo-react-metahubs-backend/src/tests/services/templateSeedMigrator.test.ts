jest.mock('../../domains/templates/services/widgetTableResolver', () => ({
    __esModule: true,
    resolveWidgetTableName: jest.fn(async () => '_mhb_widgets')
}))

import { TemplateSeedMigrator } from '../../domains/templates/services/TemplateSeedMigrator'

describe('TemplateSeedMigrator repeated widget identities', () => {
    it('preserves every repeated dashboard seed row instead of deleting sibling rows', async () => {
        const insertedWidgets: Array<Record<string, unknown>> = []
        const updates: Array<{ table: string; payload: Record<string, unknown> }> = []
        let layoutSelectCalled = false

        const createBuilder = (table: string) => {
            let selected = false
            const builder: Record<string, unknown> = {
                where: jest.fn().mockReturnThis(),
                whereRaw: jest.fn().mockReturnThis(),
                whereNull: jest.fn().mockReturnThis(),
                whereNot: jest.fn().mockReturnThis(),
                select: jest.fn(() => {
                    selected = true
                    return builder
                }),
                orderBy: jest.fn().mockReturnThis(),
                first: jest.fn(async () => {
                    if (table === '_mhb_layouts' && !layoutSelectCalled) {
                        layoutSelectCalled = true
                        return { id: 'layout-1' }
                    }
                    if (table === '_mhb_layouts') {
                        return { template_key: 'dashboard', config: {} }
                    }
                    return null
                }),
                insert: jest.fn(async (payload: Record<string, unknown>) => {
                    insertedWidgets.push(payload)
                    return [{ id: `widget-${insertedWidgets.length}` }]
                }),
                update: jest.fn(async (payload: Record<string, unknown>) => {
                    updates.push({ table, payload })
                    return 1
                }),
                then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
                    Promise.resolve(
                        table === '_mhb_widgets' && selected
                            ? [
                                  { widget_key: 'header', zone: 'top' },
                                  { widget_key: 'header', zone: 'top' }
                              ]
                            : []
                    ).then(resolve, reject)
            }
            return builder
        }

        const trx = {
            withSchema: jest.fn(() => ({
                from: jest.fn((table: string) => createBuilder(table)),
                into: jest.fn((table: string) => createBuilder(table))
            }))
        }
        const knex = {
            transaction: jest.fn(async (callback: (transaction: typeof trx) => Promise<void>) => callback(trx))
        }

        const result = await new TemplateSeedMigrator(knex as never, 'mhb_seed_test').migrateSeed({
            layouts: [
                {
                    codename: 'main',
                    templateKey: 'dashboard',
                    name: {} as never,
                    isDefault: true,
                    isActive: true,
                    sortOrder: 0
                }
            ],
            layoutZoneWidgets: {
                main: [
                    { zone: 'top', widgetKey: 'header', sortOrder: 1 },
                    { zone: 'top', widgetKey: 'header', sortOrder: 2 }
                ]
            }
        })

        expect(result.zoneWidgetsAdded).toBe(2)
        expect(insertedWidgets).toHaveLength(2)
        expect(insertedWidgets.map((widget) => widget.sort_order)).toEqual([1, 2])
        expect(updates.some(({ table, payload }) => table === '_mhb_widgets' && payload._mhb_deleted === true)).toBe(false)
    })
})
