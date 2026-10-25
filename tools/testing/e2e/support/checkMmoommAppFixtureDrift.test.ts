import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { computeSnapshotHash } from '@universo-react/utils'

type FixtureRecord = Record<string, unknown>

const repoRoot = process.cwd()
const fixturePath = path.resolve(repoRoot, 'tools', 'fixtures', 'metahubs-mmoomm-app-snapshot.json')
const driftScriptPath = path.resolve(repoRoot, 'tools', 'testing', 'e2e', 'support', 'checkMmoommAppFixtureDrift.ts')

const readFixture = (): FixtureRecord => JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as FixtureRecord

const requireRecord = (value: unknown, label: string): FixtureRecord => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`MMOOMM drift test fixture is missing ${label}`)
    }
    return value as FixtureRecord
}

const requireFirstProjectDocument = (fixture: FixtureRecord): FixtureRecord => {
    const snapshot = requireRecord(fixture.snapshot, 'snapshot')
    const playcanvasProjects = requireRecord(snapshot.playcanvasProjects, 'playcanvasProjects')
    if (!Array.isArray(playcanvasProjects.projects) || playcanvasProjects.projects.length === 0) {
        throw new Error('MMOOMM drift test fixture is missing PlayCanvas projects')
    }
    const project = requireRecord(playcanvasProjects.projects[0], 'first PlayCanvas project')
    const settings = requireRecord(project.settings, 'first PlayCanvas project settings')
    const realtime = requireRecord(settings.playCanvasEditorRealtime, 'PlayCanvas Editor realtime settings')
    const documents = requireRecord(realtime.documents, 'PlayCanvas Editor realtime documents')
    const documentKey = Object.keys(documents).find((key) => /^project_\d+$/.test(key))
    if (!documentKey) {
        throw new Error('MMOOMM drift test fixture is missing a project ShareDB document')
    }
    return requireRecord(documents[documentKey], 'project ShareDB document')
}

const addFirstProjectDocument = (fixture: FixtureRecord): FixtureRecord => {
    const snapshot = requireRecord(fixture.snapshot, 'snapshot')
    const playcanvasProjects = requireRecord(snapshot.playcanvasProjects, 'playcanvasProjects')
    if (!Array.isArray(playcanvasProjects.projects) || playcanvasProjects.projects.length === 0) {
        throw new Error('MMOOMM drift test fixture is missing PlayCanvas projects')
    }
    const project = requireRecord(playcanvasProjects.projects[0], 'first PlayCanvas project')
    const settings = requireRecord(project.settings, 'first PlayCanvas project settings')
    const realtime = requireRecord(settings.playCanvasEditorRealtime, 'PlayCanvas Editor realtime settings')
    realtime.documents = {
        project_123: {
            data: {
                id: 'project_123',
                project: 123,
                scripts: [],
                width: 1280,
                height: 720,
                useLegacyScripts: false,
                engineV2: true
            },
            version: 1,
            updatedAt: '2026-01-01T00:00:00.000Z'
        }
    }
    return requireFirstProjectDocument(fixture)
}

const writeFixture = (fixture: FixtureRecord, directory: string, filename: string): string => {
    const snapshot = requireRecord(fixture.snapshot, 'snapshot')
    fixture.snapshotHash = computeSnapshotHash(snapshot)
    const outputPath = path.join(directory, filename)
    fs.writeFileSync(outputPath, JSON.stringify(fixture))
    return outputPath
}

const reorderObjectKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) {
        return value.map(reorderObjectKeys)
    }
    if (!value || typeof value !== 'object') {
        return value
    }
    return Object.fromEntries(
        Object.entries(value)
            .reverse()
            .map(([key, item]) => [key, reorderObjectKeys(item)])
    )
}

const runDriftCheck = (generatedPath: string, trackedPath = fixturePath) =>
    spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', driftScriptPath, '--', generatedPath], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: {
            ...process.env,
            MMOOMM_APP_FIXTURE_TRACKED_PATH: trackedPath
        }
    })

test('ignores only the volatile ShareDB project document revision', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mmoomm-drift-version-'))
    try {
        const trackedFixture = readFixture()
        addFirstProjectDocument(trackedFixture)
        const trackedPath = writeFixture(trackedFixture, directory, 'tracked.json')
        const generatedFixture = structuredClone(trackedFixture)
        const document = requireFirstProjectDocument(generatedFixture)
        document.version = Number(document.version ?? 0) + 97
        const generatedPath = writeFixture(generatedFixture, directory, 'generated.json')

        const result = runDriftCheck(generatedPath, trackedPath)

        assert.equal(result.status, 0, result.stderr || result.stdout)
    } finally {
        fs.rmSync(directory, { recursive: true, force: true })
    }
})

test('continues to reject semantic changes inside the ShareDB project document', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mmoomm-drift-semantic-'))
    try {
        const trackedFixture = readFixture()
        addFirstProjectDocument(trackedFixture)
        const trackedPath = writeFixture(trackedFixture, directory, 'tracked.json')
        const generatedFixture = structuredClone(trackedFixture)
        const document = requireFirstProjectDocument(generatedFixture)
        const data = requireRecord(document.data, 'project ShareDB document data')
        data.width = Number(data.width ?? 0) + 1
        const generatedPath = writeFixture(generatedFixture, directory, 'generated.json')

        const result = runDriftCheck(generatedPath, trackedPath)

        assert.notEqual(result.status, 0)
        assert.match(result.stderr, /playCanvasEditorRealtime\.documents\.project_<number>\.data\.width/)
    } finally {
        fs.rmSync(directory, { recursive: true, force: true })
    }
})

test('ignores JSON object key order while preserving normalized value relationships', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mmoomm-drift-key-order-'))
    try {
        const trackedPath = writeFixture(readFixture(), directory, 'tracked.json')
        const trackedFixture = JSON.parse(fs.readFileSync(trackedPath, 'utf8')) as FixtureRecord
        const generatedFixture = reorderObjectKeys(structuredClone(trackedFixture)) as FixtureRecord
        const generatedPath = writeFixture(generatedFixture, directory, 'generated.json')

        const result = runDriftCheck(generatedPath, trackedPath)

        assert.equal(result.status, 0, result.stderr || result.stdout)
    } finally {
        fs.rmSync(directory, { recursive: true, force: true })
    }
})

test('ignores generated module property order when normalizing checksums', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mmoomm-drift-module-key-order-'))
    try {
        const trackedPath = writeFixture(readFixture(), directory, 'tracked.json')
        const generatedFixture = structuredClone(JSON.parse(fs.readFileSync(trackedPath, 'utf8'))) as FixtureRecord
        const snapshot = requireRecord(generatedFixture.snapshot, 'snapshot')
        assert.ok(Array.isArray(snapshot.modules) && snapshot.modules.length > 0)
        const firstModule = requireRecord(snapshot.modules[0], 'first module')
        const entries = Object.entries(firstModule)
        const checksumEntry = entries.find(([key]) => key === 'checksum')
        const entriesWithoutChecksum = entries.filter(([key]) => key !== 'checksum')
        const sourceStorageIndex = entriesWithoutChecksum.findIndex(([key]) => key === 'sourceStorage')
        assert.ok(checksumEntry)
        assert.notEqual(sourceStorageIndex, -1)
        entriesWithoutChecksum.splice(sourceStorageIndex, 0, checksumEntry)
        snapshot.modules[0] = Object.fromEntries(entriesWithoutChecksum)
        const generatedPath = writeFixture(generatedFixture, directory, 'generated.json')

        const result = runDriftCheck(generatedPath, trackedPath)

        assert.equal(result.status, 0, result.stderr || result.stdout)
    } finally {
        fs.rmSync(directory, { recursive: true, force: true })
    }
})

test('rejects changes to repeated checksums within a module', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mmoomm-drift-checksum-relation-'))
    try {
        const trackedPath = writeFixture(readFixture(), directory, 'tracked.json')
        const generatedFixture = structuredClone(JSON.parse(fs.readFileSync(trackedPath, 'utf8'))) as FixtureRecord
        const snapshot = requireRecord(generatedFixture.snapshot, 'snapshot')
        const modules = snapshot.modules
        assert.ok(Array.isArray(modules) && modules.length > 0)
        const firstModule = requireRecord(modules[0], 'first module')
        firstModule.checksum = 'a'.repeat(64)
        const generatedPath = writeFixture(generatedFixture, directory, 'generated.json')

        const result = runDriftCheck(generatedPath, trackedPath)

        assert.notEqual(result.status, 0)
        assert.match(result.stderr, /snapshot\.modules\[0\]\.(?:checksum|manifest\.checksum)/)
    } finally {
        fs.rmSync(directory, { recursive: true, force: true })
    }
})

test('continues to reject semantic array reordering', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mmoomm-drift-array-order-'))
    try {
        const trackedPath = writeFixture(readFixture(), directory, 'tracked.json')
        const generatedFixture = structuredClone(JSON.parse(fs.readFileSync(trackedPath, 'utf8'))) as FixtureRecord
        const snapshot = requireRecord(generatedFixture.snapshot, 'snapshot')
        assert.ok(Array.isArray(snapshot.modules) && snapshot.modules.length > 1)
        const modules = snapshot.modules as unknown[]
        const firstModule = modules[0]
        modules[0] = modules[1]
        modules[1] = firstModule
        const generatedPath = writeFixture(generatedFixture, directory, 'generated.json')

        const result = runDriftCheck(generatedPath, trackedPath)

        assert.notEqual(result.status, 0)
    } finally {
        fs.rmSync(directory, { recursive: true, force: true })
    }
})
