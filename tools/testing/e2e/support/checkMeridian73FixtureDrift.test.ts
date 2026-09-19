import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { computeSnapshotHash } from '@universo-react/utils'

type FixtureRecord = Record<string, unknown>

const repoRoot = process.cwd()
const fixturePath = path.resolve(repoRoot, 'tools', 'fixtures', 'metahubs-73rd-meridian-app-snapshot.json')
const driftScriptPath = path.resolve(repoRoot, 'tools', 'testing', 'e2e', 'support', 'checkMeridian73FixtureDrift.ts')

const readFixture = (): FixtureRecord => JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as FixtureRecord

const writeFixture = (fixture: FixtureRecord, directory: string, filename: string): string => {
    const outputPath = path.join(directory, filename)
    fs.writeFileSync(outputPath, JSON.stringify(fixture))
    return outputPath
}

const runDriftCheck = (generatedPath: string, trackedPath: string) =>
    spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', driftScriptPath, '--', generatedPath], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: {
            ...process.env,
            MERIDIAN_73_FIXTURE_TRACKED_PATH: trackedPath
        }
    })

test('ignores regenerated export timestamps while preserving the fixture contract', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian73-drift-timestamp-'))
    try {
        const fixture = readFixture()
        fixture.exportedAt = '2030-01-02T03:04:05.678Z'
        const trackedPath = writeFixture(readFixture(), directory, 'tracked.json')
        const generatedPath = writeFixture(fixture, directory, 'generated.json')
        const result = runDriftCheck(generatedPath, trackedPath)

        assert.equal(result.status, 0, result.stderr || result.stdout)
    } finally {
        fs.rmSync(directory, { recursive: true, force: true })
    }
})

test('rejects semantic layout drift after the snapshot hash is refreshed', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'meridian73-drift-semantic-'))
    try {
        const trackedFixture = readFixture()
        const trackedPath = writeFixture(trackedFixture, directory, 'tracked.json')
        const generatedFixture = structuredClone(trackedFixture) as FixtureRecord
        const snapshot = generatedFixture.snapshot as FixtureRecord
        const widgets = snapshot.layoutZoneWidgets as FixtureRecord[]
        const footerWidget = widgets.find((widget) => (widget.config as FixtureRecord | undefined)?.instanceKey === 'footer')
        assert.ok(footerWidget, 'fixture must contain the marketing footer widget')
        footerWidget.sortOrder = Number(footerWidget.sortOrder ?? 0) + 1
        generatedFixture.snapshotHash = computeSnapshotHash(snapshot)
        const generatedPath = writeFixture(generatedFixture, directory, 'generated.json')
        const result = runDriftCheck(generatedPath, trackedPath)

        assert.notEqual(result.status, 0)
        assert.match(result.stderr || result.stdout, /73rd Meridian fixture drift detected/)
        assert.match(result.stderr || result.stdout, /layoutZoneWidgets/)
    } finally {
        fs.rmSync(directory, { recursive: true, force: true })
    }
})
