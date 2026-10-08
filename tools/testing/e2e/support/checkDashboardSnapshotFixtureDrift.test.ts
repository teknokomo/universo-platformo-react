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

test('stale tracked Dashboard contracts are accepted only by the explicit regeneration mode', () => {
    const staleSnapshot = {
        ...validDashboardSnapshot(),
        layoutConfig: { showLegacyWidget: true }
    }

    assert.throws(() => getTrackedDashboardCompatibilityIssue(staleSnapshot, false), /retired show\*/u)
    assert.match(getTrackedDashboardCompatibilityIssue(staleSnapshot, true) ?? '', /retired show\*/u)
    assert.equal(getTrackedDashboardCompatibilityIssue(validDashboardSnapshot(), true), null)
})

test('stale mode does not waive the tracked transport envelope schema', () => {
    assert.throws(() => parseTrackedTransportEnvelope({ kind: 'metahub_snapshot_bundle' }))
})

test('stale regeneration mode accepts an outdated tracked contract only after generated validation', () => {
    const assertContract = (fixture: unknown) => {
        if (!fixture || typeof fixture !== 'object' || !('currentField' in fixture)) {
            throw new Error('Fixture is missing currentField')
        }
    }

    assert.throws(() => getTrackedDashboardFixtureContractIssue({}, assertContract, false), /currentField/u)
    assert.equal(getTrackedDashboardFixtureContractIssue({}, assertContract, true), 'Fixture is missing currentField')
    assert.equal(getTrackedDashboardFixtureContractIssue({ currentField: true }, assertContract, true), null)
})

test('normalized fixture comparison still reports non-volatile tracked drift', () => {
    const tracked = { snapshot: { ...validDashboardSnapshot(), field: { uiConfig: {} } } }
    const generated = { snapshot: { ...validDashboardSnapshot(), field: { uiConfig: { gridHidden: true } } } }

    assert.match(getNormalizedDashboardFixtureDifference(tracked, generated) ?? '', /gridHidden/u)
    assert.equal(getNormalizedDashboardFixtureDifference(generated, generated), null)
})
