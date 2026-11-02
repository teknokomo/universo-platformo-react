import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { APPLICATION_TEMPLATE_REGISTRY, LAYOUT_WIDGET_DEFINITIONS } from '@universo-react/types'
import { assertMessengerAppFixtureEnvelopeContract } from './messengerAppFixtureContract.ts'

const layoutId = '0192d1e5-7b00-7000-8000-000000000001'
const topWidget = LAYOUT_WIDGET_DEFINITIONS.find(
    (definition) =>
        definition.supportedTemplates.includes('messenger-app') && definition.allowedZonesByTemplate['messenger-app']?.includes('top')
)
const centerWidget = LAYOUT_WIDGET_DEFINITIONS.find(
    (definition) =>
        definition.supportedTemplates.includes('messenger-app') && definition.allowedZonesByTemplate['messenger-app']?.includes('center')
)

const validEnvelope = () => ({
    snapshot: {
        defaultLayoutId: layoutId,
        layouts: [{ id: layoutId, templateKey: 'messenger-app', isActive: true, isDefault: true }],
        layoutZoneWidgets: [
            { id: '0192d1e5-7b00-7000-8000-000000000002', layoutId, widgetKey: topWidget?.key, zone: 'top', config: {} },
            { id: '0192d1e5-7b00-7000-8000-000000000003', layoutId, widgetKey: centerWidget?.key, zone: 'center', config: {} }
        ]
    }
})

const fixturePath = path.resolve(process.cwd(), 'tools/fixtures/metahubs-messenger-app-snapshot.json')
const readGeneratedFixture = () => JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as Record<string, unknown>
const getFixtureEntityId = (fixture: Record<string, unknown>, codename: string): string => {
    const snapshot = fixture.snapshot as Record<string, unknown>
    const entities = snapshot.entities as Record<string, Record<string, unknown>>
    const entity = Object.entries(entities).find(([, value]) => {
        const localized = value.codename as { locales?: { en?: { content?: string } } }
        return localized?.locales?.en?.content === codename
    })
    assert.ok(entity, `Expected generated fixture entity ${codename}`)
    return entity[0]
}

test('Messenger fixture contract requires a canonical registered template with a seeded top and center', () => {
    assert.ok(APPLICATION_TEMPLATE_REGISTRY['messenger-app'])
    assert.ok(topWidget)
    assert.ok(centerWidget)
    assert.doesNotThrow(() => assertMessengerAppFixtureEnvelopeContract(validEnvelope()))
})

test('Messenger fixture contract rejects legacy layout configuration and platform navigation zones', () => {
    const legacy = validEnvelope()
    legacy.snapshot.layoutConfig = { showList: true }
    assert.throws(() => assertMessengerAppFixtureEnvelopeContract(legacy), /retired layoutConfig/u)

    const unsupported = validEnvelope()
    unsupported.snapshot.layoutZoneWidgets[0].zone = 'left'
    assert.throws(() => assertMessengerAppFixtureEnvelopeContract(unsupported), /unsupported platform zone/u)
})

test('Messenger fixture contract rejects unsupported widgets and missing primary regions', () => {
    const unsupported = validEnvelope()
    unsupported.snapshot.layoutZoneWidgets[0].widgetKey = 'workspaceSwitcher'
    assert.throws(() => assertMessengerAppFixtureEnvelopeContract(unsupported), /not registered for Messenger/u)

    const incomplete = validEnvelope()
    incomplete.snapshot.layoutZoneWidgets.pop()
    assert.throws(() => assertMessengerAppFixtureEnvelopeContract(incomplete), /top and center/u)
})

test('generated Messenger fixture projects every FR-006 Must widget with safe public data', () => {
    assert.doesNotThrow(() => assertMessengerAppFixtureEnvelopeContract(readGeneratedFixture(), { requireOverviewContent: true }))
})

for (const widgetKey of [
    'overviewCards',
    'detailsTabs',
    'detailsTitle',
    'detailsTable',
    'resourcePreview',
    'relationBuilder',
    'columnsContainer',
    'sessionsChart',
    'pageViewsChart'
]) {
    test(`generated Messenger fixture rejects a missing ${widgetKey} Must projection`, () => {
        const fixture = readGeneratedFixture()
        const snapshot = fixture.snapshot as Record<string, unknown>
        const placements = snapshot.layoutZoneWidgets as Array<Record<string, unknown>>
        const layoutId = (snapshot.layouts as Array<Record<string, unknown>>).find((layout) => layout.templateKey === 'messenger-app')?.id
        snapshot.layoutZoneWidgets = placements.filter((placement) => placement.layoutId !== layoutId || placement.widgetKey !== widgetKey)
        assert.throws(() => assertMessengerAppFixtureEnvelopeContract(fixture, { requireOverviewContent: true }))
    })
}

test('generated Messenger fixture rejects an empty record-detail source', () => {
    const fixture = readGeneratedFixture()
    const snapshot = fixture.snapshot as Record<string, unknown>
    const detailEntityId = getFixtureEntityId(fixture, 'DashboardDemoRecordDetail')
    const elements = snapshot.elements as Record<string, unknown>
    elements[detailEntityId] = []
    assert.throws(() => assertMessengerAppFixtureEnvelopeContract(fixture, { requireOverviewContent: true }), /exactly one row/u)
})

test('generated Messenger fixture requires both the multi-row and record-detail table projections', () => {
    for (const maxRows of [1, 3]) {
        const fixture = readGeneratedFixture()
        const snapshot = fixture.snapshot as Record<string, unknown>
        const placements = snapshot.layoutZoneWidgets as Array<Record<string, unknown>>
        const layoutId = (snapshot.layouts as Array<Record<string, unknown>>).find((layout) => layout.templateKey === 'messenger-app')?.id
        snapshot.layoutZoneWidgets = placements.filter((placement) => {
            const config = placement.config as Record<string, unknown> | undefined
            return !(placement.layoutId === layoutId && placement.widgetKey === 'detailsTable' && config?.maxRows === maxRows)
        })
        assert.throws(() => assertMessengerAppFixtureEnvelopeContract(fixture, { requireOverviewContent: true }))
    }
})
