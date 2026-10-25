import assert from 'node:assert/strict'
import test from 'node:test'
import {
    getNormalizedDashboardFixtureDifference,
    getTrackedDashboardCompatibilityIssue,
    getTrackedDashboardFixtureContractIssue,
    parseTrackedTransportEnvelope
} from './checkDashboardSnapshotFixtureDrift.ts'

const validDashboardSnapshot = () => ({
    layouts: [],
    layoutZoneWidgets: []
})

test('tracked Dashboard invariants always report retired fields as invalid', () => {
    const staleSnapshot = {
        ...validDashboardSnapshot(),
        layoutConfig: { showLegacyWidget: true }
    }

    assert.match(getTrackedDashboardCompatibilityIssue(staleSnapshot) ?? '', /retired show\*/u)
    assert.equal(getTrackedDashboardCompatibilityIssue(validDashboardSnapshot()), null)
})

const trackedEnvelope = (snapshotFormatVersion: number) => ({
    kind: 'metahub_snapshot_bundle',
    bundleVersion: 1,
    exportedAt: '2026-10-24T16:00:00.000Z',
    metahub: {
        id: '0192d1e5-7b00-7000-8000-000000000001',
        name: {},
        codename: {}
    },
    snapshot: {
        version: 1,
        metahubId: '0192d1e5-7b00-7000-8000-000000000001',
        versionEnvelope: { structureVersion: '0.1.0', templateVersion: null, snapshotFormatVersion },
        entities: {}
    },
    snapshotHash: 'a'.repeat(64)
})

test('tracked transport envelopes require the current snapshot format and structure versions', () => {
    const current = parseTrackedTransportEnvelope(trackedEnvelope(1))
    assert.equal((current.snapshot as { versionEnvelope: { snapshotFormatVersion: number } }).versionEnvelope.snapshotFormatVersion, 1)
    assert.throws(() => parseTrackedTransportEnvelope(trackedEnvelope(3)), /Invalid literal value/u)
    assert.throws(() => parseTrackedTransportEnvelope({ ...trackedEnvelope(1), kind: 'invalid' }), /Invalid literal value/u)

    const outdatedStructure = trackedEnvelope(1)
    outdatedStructure.snapshot.versionEnvelope.structureVersion = '0.2.0'
    assert.throws(() => parseTrackedTransportEnvelope(outdatedStructure), /Invalid literal value/u)
})

test('tracked fixture contract issues are surfaced without a compatibility bypass', () => {
    const assertContract = (fixture: unknown) => {
        if (!fixture || typeof fixture !== 'object' || !('currentField' in fixture)) {
            throw new Error('Fixture is missing currentField')
        }
    }

    assert.equal(getTrackedDashboardFixtureContractIssue({}, assertContract), 'Fixture is missing currentField')
    assert.equal(getTrackedDashboardFixtureContractIssue({ currentField: true }, assertContract), null)
})

test('normalized fixture comparison still reports non-volatile tracked drift', () => {
    const tracked = { snapshot: { ...validDashboardSnapshot(), field: { uiConfig: {} } } }
    const generated = { snapshot: { ...validDashboardSnapshot(), field: { uiConfig: { gridHidden: true } } } }

    assert.match(getNormalizedDashboardFixtureDifference(tracked, generated) ?? '', /gridHidden/u)
    assert.equal(getNormalizedDashboardFixtureDifference(generated, generated), null)
})
