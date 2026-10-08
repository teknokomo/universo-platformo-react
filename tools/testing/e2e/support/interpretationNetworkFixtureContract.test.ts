import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { computeSnapshotHash } from '@universo-react/utils'
import type { MetahubSnapshotTransportEnvelope } from '@universo-react/types'
import { assertInterpretationNetworkFixtureEnvelopeContract } from './interpretationNetworkFixtureContract.ts'

type FixtureRecord = Record<string, unknown>

const fixturePath = path.resolve(process.cwd(), 'tools', 'fixtures', 'metahubs-interpretation-network-app-snapshot.json')
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as MetahubSnapshotTransportEnvelope

const withLegacyNestedWidgets = (container: 'columns' | 'tabs'): MetahubSnapshotTransportEnvelope => {
    const envelope = structuredClone(fixture)
    const snapshot = envelope.snapshot as unknown as FixtureRecord
    const placements = snapshot.layoutZoneWidgets
    if (!Array.isArray(placements) || typeof snapshot.defaultLayoutId !== 'string') {
        throw new Error('Interpretation Network fixture test requires the canonical Dashboard placements')
    }

    placements.push({
        id: 'legacy-nested-widget-probe',
        layoutId: snapshot.defaultLayoutId,
        zone: 'left',
        widgetKey: 'divider',
        instanceKey: 'legacy-nested-widget-probe',
        parentWidgetId: null,
        slotKey: null,
        sortOrder: 999,
        config: {
            [container]: [{ widgets: [{ widgetKey: 'detailsTable', config: {} }] }]
        },
        isActive: true
    })
    envelope.snapshotHash = computeSnapshotHash(envelope.snapshot)
    return envelope
}

const findFixtureEntity = (envelope: MetahubSnapshotTransportEnvelope, codename: string): FixtureRecord => {
    const snapshot = envelope.snapshot as unknown as FixtureRecord
    const entities = snapshot.entities as Record<string, FixtureRecord>
    const entity = Object.values(entities).find((candidate) => {
        const codenameValue = candidate.codename as FixtureRecord
        const locales = codenameValue.locales as Record<string, FixtureRecord>
        return locales.en.content === codename
    })
    if (!entity) throw new Error(`Missing fixture entity ${codename}`)
    return entity
}

const withEntityMutation = (codename: string, mutate: (entity: FixtureRecord) => void): MetahubSnapshotTransportEnvelope => {
    const envelope = structuredClone(fixture)
    mutate(findFixtureEntity(envelope, codename))
    envelope.snapshotHash = computeSnapshotHash(envelope.snapshot)
    return envelope
}

const setLocalizedName = (entity: FixtureRecord, locale: 'en' | 'ru', value: string): void => {
    const presentation = entity.presentation as FixtureRecord
    const name = presentation.name as FixtureRecord
    const locales = name.locales as Record<string, FixtureRecord>
    locales[locale].content = value
}

test('accepts the canonical fixture with generated bilingual Start and Structures navigation', () => {
    assert.doesNotThrow(() => assertInterpretationNetworkFixtureEnvelopeContract(fixture))
})

test('rejects generated navigation with incorrect labels, icons, home route, or Hub grouping', () => {
    const invalidNavigationFixtures = [
        {
            envelope: withEntityMutation('InterpretationNetworkIntro', (entity) => setLocalizedName(entity, 'ru', 'Старт')),
            message: /must use bilingual labels Start\/Начало/u
        },
        {
            envelope: withEntityMutation('InterpretationNetworkIntro', (entity) => {
                const config = entity.config as FixtureRecord
                const runtime = config.runtime as FixtureRecord
                runtime.icon = 'page'
            }),
            message: /source InterpretationNetworkIntro must have primary visibility, icon home/u
        },
        {
            envelope: withEntityMutation('InterpretationNetworkIntro', (entity) => {
                const config = entity.config as FixtureRecord
                const runtime = config.runtime as FixtureRecord
                runtime.routeSegment = 'start'
            }),
            message: /source InterpretationNetworkIntro must have primary visibility, icon home, and its expected route/u
        },
        {
            envelope: withEntityMutation('Structure', (entity) => {
                const config = entity.config as FixtureRecord
                const runtime = config.runtime as FixtureRecord
                runtime.menuVisibility = 'hidden'
            }),
            message: /source Structure must have primary visibility, icon object/u
        },
        {
            envelope: withEntityMutation('Structure', (entity) => {
                const config = entity.config as FixtureRecord
                const mainHub = findFixtureEntity(fixture, 'Main')
                config.hubs = [mainHub.id]
            }),
            message: /source Structure must appear at the top level without a Hub group/u
        }
    ]

    for (const invalidFixture of invalidNavigationFixtures) {
        assert.throws(() => assertInterpretationNetworkFixtureEnvelopeContract(invalidFixture.envelope), invalidFixture.message)
    }
})

test('rejects legacy nested Dashboard child widgets in columns and tabs', () => {
    for (const container of ['columns', 'tabs'] as const) {
        assert.throws(
            () => assertInterpretationNetworkFixtureEnvelopeContract(withLegacyNestedWidgets(container)),
            /widgets is retired; child widgets must be first-class placements/u
        )
    }
})
