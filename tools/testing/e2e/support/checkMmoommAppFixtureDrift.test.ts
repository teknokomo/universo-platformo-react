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

const writeFixture = (fixture: FixtureRecord, directory: string, filename: string): string => {
    const snapshot = requireRecord(fixture.snapshot, 'snapshot')
    fixture.snapshotHash = computeSnapshotHash(snapshot)
    const outputPath = path.join(directory, filename)
    fs.writeFileSync(outputPath, JSON.stringify(fixture))
    return outputPath
}

const runDriftCheck = (generatedPath: string) =>
    spawnSync(process.execPath, ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', driftScriptPath, '--', generatedPath], {
        cwd: repoRoot,
        encoding: 'utf8'
    })

test('ignores only the volatile ShareDB project document revision', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mmoomm-drift-version-'))
    try {
        const fixture = readFixture()
        const document = requireFirstProjectDocument(fixture)
        document.version = Number(document.version ?? 0) + 97
        const generatedPath = writeFixture(fixture, directory, 'generated.json')

        const result = runDriftCheck(generatedPath)

        assert.equal(result.status, 0, result.stderr || result.stdout)
    } finally {
        fs.rmSync(directory, { recursive: true, force: true })
    }
})

test('continues to reject semantic changes inside the ShareDB project document', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mmoomm-drift-semantic-'))
    try {
        const fixture = readFixture()
        const document = requireFirstProjectDocument(fixture)
        const data = requireRecord(document.data, 'project ShareDB document data')
        data.width = Number(data.width ?? 0) + 1
        const generatedPath = writeFixture(fixture, directory, 'generated.json')

        const result = runDriftCheck(generatedPath)

        assert.notEqual(result.status, 0)
        assert.match(result.stderr, /playCanvasEditorRealtime\.documents\.project_<number>\.data\.width/)
    } finally {
        fs.rmSync(directory, { recursive: true, force: true })
    }
})
