jest.mock('../../domains/templates/services/widgetTableResolver', () => ({
    __esModule: true,
    resolveWidgetTableName: jest.fn(async () => '_mhb_widgets')
}))

import { TemplateSeedExecutor } from '../../domains/templates/services/TemplateSeedExecutor'
import { basicDemoTemplate } from '../../domains/templates/data/basic-demo.template'
import { resolveWidgetTableName } from '../../domains/templates/services/widgetTableResolver'
import type { TemplateSeedZoneWidget } from '@universo-react/types'

const schemaName = 'mhb_dashboard_seed'
const layoutId = '0190a9b5-3cde-7abc-8def-012345678901'
const recordsEntityId = '0190a9b5-3cde-7abc-8def-012345678902'
const generatedUuidV7Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const resolveWidgetTableNameMock = resolveWidgetTableName as jest.MockedFunction<typeof resolveWidgetTableName>

const getDemoParentAndChildPlacements = (): [TemplateSeedZoneWidget, TemplateSeedZoneWidget] => {
    const placements = basicDemoTemplate.seed.layoutZoneWidgets?.main ?? []
    const parent = placements.find(({ instanceKey }) => instanceKey === 'demo-records-container')
    const child = placements.find(({ instanceKey }) => instanceKey === 'demo-records-table')
    if (!parent || !child) throw new Error('The Basic Demo dashboard seed must include a record table parent and child')
    return [parent, child]
}

const createPlacementExecutor = (
    existingByInstanceKey = new Map<string, { id: string; instance_key: string }>()
): {
    executor: TemplateSeedExecutor
    inserted: Array<Record<string, unknown>>
    transaction: Record<string, unknown>
} => {
    const inserted: Array<Record<string, unknown>> = []
    const transaction = {
        withSchema: jest.fn(() => ({
            from: jest.fn((tableName: string) => {
                let conditions: Record<string, unknown> = {}
                const query: any = {}
                query.where = jest.fn((input: Record<string, unknown>) => {
                    conditions = input
                    return query
                })
                query.select = jest.fn(() => query)
                query.first = jest.fn(async () => {
                    if (tableName === '_mhb_layouts') return { template_key: 'dashboard' }
                    return existingByInstanceKey.get(String(conditions.instance_key))
                })
                return query
            }),
            into: jest.fn((tableName: string) => ({
                insert: jest.fn(async (payload: Record<string, unknown>) => {
                    if (tableName !== '_mhb_widgets') throw new Error(`Unexpected widget insert target: ${tableName}`)
                    inserted.push(payload)
                })
            }))
        }))
    }

    return {
        executor: new TemplateSeedExecutor({} as never, schemaName),
        inserted,
        transaction
    }
}

const createSeedPlacements = async (
    placements: TemplateSeedZoneWidget[],
    entityIdMap: Map<string, string>,
    existingByInstanceKey = new Map<string, { id: string; instance_key: string }>()
): Promise<Array<Record<string, unknown>>> => {
    const { executor, inserted, transaction } = createPlacementExecutor(existingByInstanceKey)
    await (executor as any).createZoneWidgets(transaction, { main: placements }, new Map([['main', layoutId]]), entityIdMap)
    return inserted
}

describe('TemplateSeedExecutor Dashboard placement writes', () => {
    beforeEach(() => {
        resolveWidgetTableNameMock.mockClear()
    })

    it('persists parent and child placements with UUID v7 identity and the generated parent foreign key', async () => {
        const [parent, child] = getDemoParentAndChildPlacements()
        const inserted = await createSeedPlacements([parent, child], new Map([['object:DashboardDemoRecords', recordsEntityId]]))

        expect(inserted).toHaveLength(2)
        expect(inserted[0]).toEqual(
            expect.objectContaining({
                layout_id: layoutId,
                instance_key: parent.instanceKey,
                widget_key: parent.widgetKey,
                parent_widget_id: null,
                slot_key: null
            })
        )
        expect(inserted[1]).toEqual(
            expect.objectContaining({
                layout_id: layoutId,
                instance_key: child.instanceKey,
                widget_key: child.widgetKey,
                parent_widget_id: inserted[0]?.id,
                slot_key: child.slotKey
            })
        )
        expect(inserted.map(({ id }) => id)).toEqual(expect.arrayContaining([expect.stringMatching(generatedUuidV7Pattern)]))
        expect(inserted[1]?.config).toEqual(
            expect.objectContaining({
                ...child.rendererConfig,
                __layout: expect.objectContaining({ bindings: child.bindings })
            })
        )
        expect(resolveWidgetTableNameMock).toHaveBeenCalledWith(expect.anything(), schemaName)
    })

    it('reuses an existing parent placement identity when inserting its missing child', async () => {
        const [parent, child] = getDemoParentAndChildPlacements()
        const existingParentId = '0190a9b5-3cde-7abc-8def-012345678903'
        const inserted = await createSeedPlacements(
            [parent, child],
            new Map([['object:DashboardDemoRecords', recordsEntityId]]),
            new Map([[parent.instanceKey, { id: existingParentId, instance_key: parent.instanceKey }]])
        )

        expect(inserted).toHaveLength(1)
        expect(inserted[0]).toEqual(
            expect.objectContaining({
                instance_key: child.instanceKey,
                parent_widget_id: existingParentId,
                slot_key: child.slotKey
            })
        )
    })

    it('fails closed before writing a bound placement when its Entity source is missing', async () => {
        const [parent, child] = getDemoParentAndChildPlacements()
        const existingParentId = '0190a9b5-3cde-7abc-8def-012345678903'
        const { executor, inserted, transaction } = createPlacementExecutor(
            new Map([[parent.instanceKey, { id: existingParentId, instance_key: parent.instanceKey }]])
        )

        await expect(
            (executor as any).createZoneWidgets(transaction, { main: [parent, child] }, new Map([['main', layoutId]]), new Map())
        ).rejects.toThrow('Dashboard widget source Entity is missing: object/DashboardDemoRecords')

        expect(inserted).toEqual([])
    })
})
