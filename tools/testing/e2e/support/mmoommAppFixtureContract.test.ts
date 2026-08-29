import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { computeSnapshotHash } from '@universo-react/utils'
import { assertMmoommAppFixtureEnvelopeContract, type SnapshotEnvelope } from './mmoommAppFixtureContract.ts'

type FixtureRecord = Record<string, unknown>

type FixtureProjects = FixtureRecord & {
    assets: FixtureRecord[]
    scriptAssets: FixtureRecord[]
    sceneScriptBindings: FixtureRecord[]
    generatedArtifacts: FixtureRecord[]
    runtimeManifests: FixtureRecord[]
}

type Fixture = SnapshotEnvelope & {
    snapshot: FixtureRecord & { playcanvasProjects: FixtureProjects }
}

const fixturePath = path.resolve(process.cwd(), 'tools', 'fixtures', 'metahubs-mmoomm-app-snapshot.json')
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as Fixture

const cloneFixture = (): Fixture => structuredClone(fixture)

const withMutation = (mutate: (projects: FixtureProjects) => void): Fixture => {
    const envelope = cloneFixture()
    mutate(envelope.snapshot.playcanvasProjects)
    envelope.snapshotHash = computeSnapshotHash(envelope.snapshot)
    return envelope
}

const expectContractFailure = (envelope: Fixture, expectedMessage: string): void => {
    assert.throws(
        () => assertMmoommAppFixtureEnvelopeContract(envelope),
        (error: unknown) => error instanceof Error && error.message.includes(expectedMessage)
    )
}

const requireArrayItem = (items: FixtureRecord[], index: number, label: string): FixtureRecord => {
    const item = items[index]
    if (!item) throw new Error(`Fixture test is missing ${label} at index ${index}`)
    return item
}

const requireOutputFile = (artifact: FixtureRecord): FixtureRecord => {
    const outputFile = artifact.outputFile
    if (!outputFile || typeof outputFile !== 'object' || Array.isArray(outputFile)) {
        throw new Error('Fixture test artifact is missing outputFile')
    }
    return outputFile as FixtureRecord
}

test('accepts the canonical MMOOMM app fixture', () => {
    assertMmoommAppFixtureEnvelopeContract(fixture)
})

test('rejects duplicate script asset ids and names', () => {
    const duplicateId = withMutation((projects) => {
        const first = requireArrayItem(projects.scriptAssets, 0, 'script asset')
        const second = requireArrayItem(projects.scriptAssets, 1, 'script asset')
        second.id = first.id
    })
    expectContractFailure(duplicateId, 'PlayCanvas script asset ids must be unique')

    const duplicateName = withMutation((projects) => {
        const first = requireArrayItem(projects.scriptAssets, 0, 'script asset')
        const second = requireArrayItem(projects.scriptAssets, 1, 'script asset')
        second.scriptName = first.scriptName
    })
    expectContractFailure(duplicateName, 'PlayCanvas script asset names must be unique')
})

test('rejects generated artifacts whose decoded bytes do not match the declared hash', () => {
    const envelope = withMutation((projects) => {
        const artifact = requireArrayItem(projects.generatedArtifacts, 0, 'generated artifact')
        const outputFile = requireOutputFile(artifact)
        outputFile.snapshotContentBase64 = Buffer.from('tampered artifact bytes', 'utf8').toString('base64')
    })
    expectContractFailure(envelope, 'output file hash does not match its decoded bytes')
})

test('requires a strict one-to-one script asset and generated artifact mapping', () => {
    const duplicateMapping = withMutation((projects) => {
        const firstAsset = requireArrayItem(projects.scriptAssets, 0, 'script asset')
        const secondArtifact = requireArrayItem(projects.generatedArtifacts, 1, 'generated artifact')
        secondArtifact.scriptAssetId = firstAsset.id
        secondArtifact.scriptName = firstAsset.scriptName
        secondArtifact.scriptKind = firstAsset.scriptKind
    })
    expectContractFailure(duplicateMapping, 'generated artifact script asset mappings must be unique')

    const missingArtifact = withMutation((projects) => {
        projects.generatedArtifacts.pop()
    })
    expectContractFailure(missingArtifact, 'exactly one generated artifact for every PlayCanvas script asset')
})

test('rejects a runtime artifact URL that diverges from the generated artifact bytes', () => {
    const envelope = withMutation((projects) => {
        const manifest = requireArrayItem(projects.runtimeManifests, 1, 'runtime manifest')
        const scripts = manifest.scripts
        if (!Array.isArray(scripts)) throw new Error('Fixture test manifest is missing scripts')
        const script = scripts.find(
            (candidate): candidate is FixtureRecord =>
                Boolean(candidate) && typeof candidate === 'object' && (candidate as FixtureRecord).scriptName === 'flightControl'
        )
        if (!script) throw new Error('Fixture test is missing flightControl runtime script')
        script.artifactUrl = `data:text/javascript;base64,${Buffer.from('tampered runtime bytes', 'utf8').toString('base64')}`
    })
    expectContractFailure(envelope, 'artifact URL bytes must match its generated artifact')
})

test('requires exactly one enabled scene binding for every published script asset', () => {
    const missingBinding = withMutation((projects) => {
        projects.sceneScriptBindings.splice(0, 1)
    })
    expectContractFailure(missingBinding, 'exactly one enabled scene binding for every PlayCanvas script asset')

    const duplicateBinding = withMutation((projects) => {
        const binding = requireArrayItem(projects.sceneScriptBindings, 0, 'scene script binding')
        projects.sceneScriptBindings.push({ ...binding, id: `${String(binding.id)}-duplicate`, sortOrder: 3 })
    })
    expectContractFailure(duplicateBinding, 'exactly one enabled binding per script asset')
})
