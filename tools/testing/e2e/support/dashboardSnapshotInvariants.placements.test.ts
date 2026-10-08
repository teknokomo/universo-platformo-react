import assert from 'node:assert/strict'
import test from 'node:test'
import { assertDashboardSnapshotInvariants } from './dashboardSnapshotInvariants.ts'

const LAYOUT_ID = '0190f1c0-0000-7000-8000-000000000001'
const OUTER_WIDGET_ID = '0190f1c0-0000-7000-8000-000000000002'
const INNER_WIDGET_ID = '0190f1c0-0000-7000-8000-000000000003'

const makeSnapshot = (placements: Record<string, unknown>[]) => ({
    layouts: [{ id: LAYOUT_ID, templateKey: 'dashboard', config: {} }],
    layoutZoneWidgets: placements
})

const columnsContainer = (id: string, instanceKey: string, columns: string[], overrides: Record<string, unknown> = {}) => ({
    id,
    layoutId: LAYOUT_ID,
    widgetKey: 'columnsContainer',
    instanceKey,
    parentWidgetId: null,
    slotKey: null,
    zone: 'center',
    config: { columns: columns.map((slotKey) => ({ slotKey, width: 12 })) },
    ...overrides
})

test('accepts compatible parent slots and rejects undeclared slots', () => {
    const parent = columnsContainer(OUTER_WIDGET_ID, 'columns-main', ['column:main'])
    const child = {
        id: INNER_WIDGET_ID,
        layoutId: LAYOUT_ID,
        widgetKey: 'overviewTitle',
        instanceKey: 'overview-title',
        parentWidgetId: OUTER_WIDGET_ID,
        slotKey: 'column:main',
        zone: 'center',
        config: { align: 'left' }
    }
    assert.doesNotThrow(() => assertDashboardSnapshotInvariants(makeSnapshot([parent, child])))
    assert.throws(
        () => assertDashboardSnapshotInvariants(makeSnapshot([parent, { ...child, slotKey: 'column:missing' }])),
        /incompatible parent or slot/u
    )
})

test('rejects a cycle-shaped graph that nests root-only container placements', () => {
    const outer = columnsContainer(OUTER_WIDGET_ID, 'columns-outer', ['column:outer'], {
        parentWidgetId: INNER_WIDGET_ID,
        slotKey: 'column:inner'
    })
    const inner = columnsContainer(INNER_WIDGET_ID, 'columns-inner', ['column:inner'], {
        parentWidgetId: OUTER_WIDGET_ID,
        slotKey: 'column:outer'
    })
    assert.throws(() => assertDashboardSnapshotInvariants(makeSnapshot([outer, inner])), /incompatible parent or slot/u)
})
