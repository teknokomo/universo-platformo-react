jest.mock('../../domains/templates/services/widgetTableResolver', () => ({
    __esModule: true,
    resolveWidgetTableName: jest.fn(async () => '_mhb_widgets')
}))

import { TemplateSeedMigrator } from '../../domains/templates/services/TemplateSeedMigrator'
import { makeDashboardSeedPlacement } from '../../domains/templates/services/dashboardSeedPlacement'

describe('TemplateSeedMigrator dashboard placement identities', () => {
    it('preserves each repeated widget type under a distinct stable placement identity', async () => {
        const insertedWidgets: Array<Record<string, unknown>> = []
        const updates: Array<{ table: string; payload: Record<string, unknown> }> = []
        let layoutLookupCount = 0

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
                    if (table === '_mhb_layouts' && layoutLookupCount++ === 0) {
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
                    Promise.resolve(table === '_mhb_widgets' && selected ? [] : []).then(resolve, reject)
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
                    makeDashboardSeedPlacement({
                        zone: 'top',
                        widgetKey: 'divider',
                        instanceKey: 'top-divider-one',
                        sortOrder: 1
                    }),
                    makeDashboardSeedPlacement({
                        zone: 'top',
                        widgetKey: 'divider',
                        instanceKey: 'top-divider-two',
                        sortOrder: 2
                    }),
                    makeDashboardSeedPlacement({
                        zone: 'center',
                        widgetKey: 'columnsContainer',
                        instanceKey: 'layout-columns',
                        sortOrder: 2,
                        rendererConfig: { columns: [{ slotKey: 'column:content', width: 12 }] }
                    }),
                    makeDashboardSeedPlacement({
                        zone: 'center',
                        widgetKey: 'quizWidget',
                        instanceKey: 'quiz-child',
                        sortOrder: 1,
                        parentInstanceKey: 'layout-columns',
                        slotKey: 'column:content'
                    })
                ]
            }
        })

        expect(result.zoneWidgetsAdded).toBe(4)
        expect(insertedWidgets).toHaveLength(4)
        expect(insertedWidgets.map((widget) => widget.instance_key)).toEqual([
            'top-divider-one',
            'layout-columns',
            'quiz-child',
            'top-divider-two'
        ])
        expect(
            insertedWidgets.every(
                (widget) =>
                    typeof widget.id === 'string' &&
                    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(widget.id)
            )
        ).toBe(true)
        const parentRow = insertedWidgets.find((widget) => widget.instance_key === 'layout-columns')
        const childRow = insertedWidgets.find((widget) => widget.instance_key === 'quiz-child')
        expect(parentRow?.parent_widget_id).toBeNull()
        expect(childRow?.parent_widget_id).toBe(parentRow?.id)
        expect(childRow?.slot_key).toBe('column:content')
        expect(updates.some(({ table, payload }) => table === '_mhb_widgets' && payload._mhb_deleted === true)).toBe(false)
    })
})

describe('TemplateSeedMigrator component scopes', () => {
    it('seeds equal component codenames independently at root and within separate TABLE components', async () => {
        type SeededRow = Record<string, unknown>

        const resolveCodename = (value: unknown): string | undefined => {
            if (typeof value === 'string') return value
            if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
            const locales = (value as Record<string, unknown>).locales
            if (!locales || typeof locales !== 'object' || Array.isArray(locales)) return undefined
            const english = (locales as Record<string, unknown>).en
            if (!english || typeof english !== 'object' || Array.isArray(english)) return undefined
            const content = (english as Record<string, unknown>).content
            return typeof content === 'string' ? content : undefined
        }

        const objects: SeededRow[] = []
        const components: SeededRow[] = []
        let nextId = 0

        const createBuilder = (table: string) => {
            const filters: SeededRow = {}
            let codename: string | undefined
            let rootScope = false
            const builder: Record<string, unknown> = {
                where: jest.fn((criteria: SeededRow) => {
                    Object.assign(filters, criteria)
                    return builder
                }),
                whereNull: jest.fn((column: string) => {
                    if (column === 'parent_component_id') rootScope = true
                    return builder
                }),
                whereRaw: jest.fn((_sql: string, values: unknown[]) => {
                    codename = typeof values[0] === 'string' ? values[0] : undefined
                    return builder
                }),
                first: jest.fn(async () => {
                    if (table === '_mhb_objects') return null
                    if (table !== '_mhb_components' || !codename) return null

                    return (
                        components.find((row) => {
                            if (row.object_id !== filters.object_id || row._upl_deleted !== false || row._mhb_deleted !== false) {
                                return false
                            }
                            if (resolveCodename(row.codename) !== codename) return false
                            const parentId = row.parent_component_id ?? null
                            if (rootScope) return parentId === null
                            if (typeof filters.parent_component_id === 'string') {
                                return parentId === filters.parent_component_id
                            }
                            return true
                        }) ?? null
                    )
                }),
                insert: jest.fn((payload: SeededRow) => {
                    const rows = table === '_mhb_objects' ? objects : components
                    const id = `seed-row-${++nextId}`
                    rows.push({ ...payload, id })

                    return {
                        returning: jest.fn(async () => [{ id }]),
                        then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
                            Promise.resolve([{ id }]).then(resolve, reject)
                    }
                })
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
            transaction: jest.fn(async (callback: (transaction: typeof trx) => Promise<unknown>) => callback(trx))
        }

        const result = await new TemplateSeedMigrator(knex as never, 'mhb_component_scope_test').migrateSeed({
            entities: [
                {
                    codename: 'Resources',
                    kind: 'page',
                    name: {} as never,
                    components: [
                        {
                            codename: 'ContentItems',
                            dataType: 'TABLE',
                            name: {} as never,
                            childComponents: [{ codename: 'SortOrder', dataType: 'NUMBER', name: {} as never }]
                        },
                        {
                            codename: 'AuditItems',
                            dataType: 'TABLE',
                            name: {} as never,
                            childComponents: [{ codename: 'SortOrder', dataType: 'NUMBER', name: {} as never }]
                        },
                        { codename: 'SortOrder', dataType: 'NUMBER', name: {} as never }
                    ]
                }
            ]
        })

        const tableIds = components.filter((row) => row.data_type === 'TABLE').map((row) => row.id)
        const numericComponents = components.filter((row) => row.data_type === 'NUMBER')
        const rootNumericComponents = numericComponents.filter((row) => row.parent_component_id == null)
        const childParentIds = numericComponents
            .map((row) => row.parent_component_id)
            .filter((parentId): parentId is string => typeof parentId === 'string')

        expect(rootNumericComponents).toHaveLength(1)
        expect(childParentIds.sort()).toEqual(tableIds.sort())
        expect(result.componentsAdded).toBe(5)
        expect(result.skipped).not.toContain('component:Resources.SortOrder (already exists)')
    })
})
