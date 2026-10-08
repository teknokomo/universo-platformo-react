import assert from 'node:assert/strict'
import test from 'node:test'
import { assertDashboardSnapshotInvariants } from './dashboardSnapshotInvariants.ts'

const LAYOUT_ID = '0190f1c0-0000-7000-8000-000000000001'
const WIDGET_ID_1 = '0190f1c0-0000-7000-8000-000000000002'
const WIDGET_ID_2 = '0190f1c0-0000-7000-8000-000000000003'
const SCOPED_LAYOUT_ID = '0190f1c0-0000-7000-8000-000000000004'
const MISSING_WIDGET_ID = '0190f1c0-0000-7000-8000-000000000005'

const makeSnapshot = (
    layoutConfig: Record<string, unknown> = {},
    placements: Record<string, unknown>[] = [],
    scopedLayouts: Record<string, unknown>[] = []
) => ({
    layouts: [{ id: LAYOUT_ID, templateKey: 'dashboard', config: layoutConfig }],
    scopedLayouts,
    layoutZoneWidgets: placements
})

const rootHeader = (overrides: Record<string, unknown> = {}) => ({
    id: WIDGET_ID_1,
    layoutId: LAYOUT_ID,
    widgetKey: 'header',
    instanceKey: 'header',
    parentWidgetId: null,
    slotKey: null,
    zone: 'top',
    config: {},
    ...overrides
})

const rootInfoCard = (overrides: Record<string, unknown> = {}) => ({
    ...rootHeader({ widgetKey: 'infoCard', instanceKey: 'info-card', zone: 'left' }),
    ...overrides
})

test('accepts a canonical root placement with a stable identity', () => {
    assert.doesNotThrow(() => assertDashboardSnapshotInvariants(makeSnapshot({}, [rootHeader()])))
})

test('validates placements belonging to dashboard scoped layouts', () => {
    const scopedLayout = { id: SCOPED_LAYOUT_ID, baseLayoutId: LAYOUT_ID, templateKey: 'dashboard', config: {} }
    assert.doesNotThrow(() =>
        assertDashboardSnapshotInvariants(makeSnapshot({}, [rootHeader({ layoutId: SCOPED_LAYOUT_ID })], [scopedLayout]))
    )
    assert.throws(
        () => assertDashboardSnapshotInvariants(makeSnapshot({}, [rootHeader({ layoutId: '0190f1c0-0000-7000-8000-000000000006' })])),
        /unavailable layout/u
    )
})

test('validates strict renderer config after decoding the persisted neutral envelope', () => {
    assert.doesNotThrow(() => assertDashboardSnapshotInvariants(makeSnapshot({}, [rootHeader({ config: { __layout: {} } })])))
})

test('rejects retired show flags and renderer-owned content in Dashboard config', () => {
    assert.throws(() => assertDashboardSnapshotInvariants(makeSnapshot({ showDetailsTable: false })), /showDetailsTable/u)
    assert.throws(
        () => assertDashboardSnapshotInvariants({ ...makeSnapshot(), layoutConfig: { showDetailsTable: false } }),
        /retired show\*/u
    )
    assert.throws(() => assertDashboardSnapshotInvariants(makeSnapshot({}, [rootHeader({ config: { content: 'demo' } })])))
})

test('rejects retired widgets and legacy nested/manual menu composition', () => {
    assert.throws(
        () => assertDashboardSnapshotInvariants(makeSnapshot({}, [rootHeader({ widgetKey: 'productTree' })])),
        /retired|unsupported/u
    )
    assert.throws(() =>
        assertDashboardSnapshotInvariants(
            makeSnapshot({}, [rootHeader({ widgetKey: 'menuWidget', config: { items: [{ title: 'Demo' }] } })])
        )
    )
})

test('requires complete first-class placement identity and a valid parent/slot pair', () => {
    const { instanceKey: _instanceKey, ...missingIdentity } = rootHeader()
    assert.throws(() => assertDashboardSnapshotInvariants(makeSnapshot({}, [missingIdentity])), /identity/u)
    assert.throws(
        () => assertDashboardSnapshotInvariants(makeSnapshot({}, [rootHeader({ parentWidgetId: MISSING_WIDGET_ID, slotKey: null })])),
        /parent\/slot/u
    )
})

test('rejects non-UUID-v7 identities for layouts and widget placements', () => {
    assert.throws(() =>
        assertDashboardSnapshotInvariants({
            ...makeSnapshot(),
            layouts: [{ id: 'layout-v4-or-invalid', templateKey: 'dashboard', config: {} }]
        })
    )
    assert.throws(() => assertDashboardSnapshotInvariants(makeSnapshot({}, [rootHeader({ id: 'widget-v4-or-invalid' })])))
    assert.throws(() => assertDashboardSnapshotInvariants(makeSnapshot({}, [rootHeader({ layoutId: 'layout-v4-or-invalid' })])))
    assert.throws(() =>
        assertDashboardSnapshotInvariants(
            makeSnapshot({}, [rootHeader({ parentWidgetId: 'widget-v4-or-invalid', slotKey: 'column:main' })])
        )
    )
    assert.throws(() => assertDashboardSnapshotInvariants(makeSnapshot({}, [rootHeader({ sourceWidgetId: 'widget-v4-or-invalid' })])))
})

test('rejects duplicate instance keys and unavailable parents', () => {
    assert.throws(
        () => assertDashboardSnapshotInvariants(makeSnapshot({}, [rootInfoCard(), rootInfoCard({ id: WIDGET_ID_2 })])),
        /duplicates instance key/u
    )
    assert.throws(
        () =>
            assertDashboardSnapshotInvariants(
                makeSnapshot({}, [rootHeader({ parentWidgetId: MISSING_WIDGET_ID, slotKey: 'column:main' })])
            ),
        /missing, foreign, or self parent/u
    )
})
