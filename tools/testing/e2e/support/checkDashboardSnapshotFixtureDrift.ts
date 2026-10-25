import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { MetahubSnapshotTransportEnvelopeSchema } from '@universo-react/types'
import { validateSnapshotEnvelope } from '@universo-react/utils'
import { repoRoot } from './env/load-e2e-env.mjs'
import { assertDashboardSnapshotInvariants } from './dashboardSnapshotInvariants.ts'
import {
    findFirstSnapshotFixtureDifference,
    normalizeSnapshotFixtureVolatileValues,
    stableSnapshotFixtureStringify
} from './snapshotFixtureDrift.ts'
import { resolvePathInsideRepository } from './fixtureOutputPath.ts'

const profiles = {
    '73rd-meridian': {
        filename: 'metahubs-73rd-meridian-app-snapshot.json',
        contractModule: 'meridian73FixtureContract.ts',
        contractFunction: 'assertMeridian73FixtureEnvelopeContract'
    },
    'interpretation-network': {
        filename: 'metahubs-interpretation-network-app-snapshot.json',
        contractModule: 'interpretationNetworkFixtureContract.ts',
        contractFunction: 'assertInterpretationNetworkFixtureEnvelopeContract'
    },
    lms: {
        filename: 'metahubs-lms-app-snapshot.json',
        contractModule: 'lmsFixtureContract.ts',
        contractFunction: 'assertLmsFixtureEnvelopeContract'
    },
    quiz: {
        filename: 'metahubs-quiz-app-snapshot.json',
        contractModule: 'quizFixtureContract.ts',
        contractFunction: 'assertQuizFixtureEnvelopeContract'
    },
    'self-hosted': {
        filename: 'metahubs-self-hosted-app-snapshot.json',
        contractModule: 'selfHostedAppFixtureContract.mjs',
        contractFunction: 'assertSelfHostedAppEnvelopeContract'
    },
    mmoomm: {
        filename: 'metahubs-mmoomm-app-snapshot.json',
        contractModule: 'mmoommAppFixtureContract.ts',
        contractFunction: 'assertMmoommAppFixtureEnvelopeContract'
    }
} as const

type FixtureKind = keyof typeof profiles

export const parseTrackedTransportEnvelope = (raw: unknown): Record<string, unknown> =>
    MetahubSnapshotTransportEnvelopeSchema.parse(raw) as unknown as Record<string, unknown>

export const getTrackedDashboardCompatibilityIssue = (snapshot: unknown): string | null => {
    try {
        assertDashboardSnapshotInvariants(snapshot)
        return null
    } catch (error) {
        return error instanceof Error ? error.message : String(error)
    }
}

export const getTrackedDashboardFixtureContractIssue = (fixture: unknown, assertContract: (value: unknown) => unknown): string | null => {
    try {
        assertContract(fixture)
        return null
    } catch (error) {
        return error instanceof Error ? error.message : String(error)
    }
}

export const getNormalizedDashboardFixtureDifference = (tracked: unknown, generated: unknown): string | null => {
    const normalizedTracked = normalizeSnapshotFixtureVolatileValues(tracked)
    const normalizedGenerated = normalizeSnapshotFixtureVolatileValues(generated)
    if (stableSnapshotFixtureStringify(normalizedTracked) === stableSnapshotFixtureStringify(normalizedGenerated)) return null
    return findFirstSnapshotFixtureDifference(normalizedTracked, normalizedGenerated) ?? 'Normalized fixtures differ.'
}

async function main(): Promise<void> {
    const args = process.argv.slice(2)
    const [kindInput, generatedInput] = args
    if (kindInput === '--all-tracked') {
        for (const [kind, profile] of Object.entries(profiles)) {
            const fixturePath = path.join(repoRoot, 'tools', 'fixtures', profile.filename)
            if (!fs.existsSync(fixturePath)) throw new Error(`Tracked ${kind} fixture is missing.`)
            const contractPath = pathToFileURL(path.join(repoRoot, 'tools', 'testing', 'e2e', 'support', profile.contractModule)).href
            const contractModule = (await import(contractPath)) as Record<string, unknown>
            const assertContract = contractModule[profile.contractFunction]
            if (typeof assertContract !== 'function') throw new Error(`Missing ${profile.contractFunction} fixture contract.`)
            const fixture = validateSnapshotEnvelope(JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as Record<string, unknown>)
            assertDashboardSnapshotInvariants(fixture.snapshot)
            assertContract(fixture)
            process.stdout.write(`${kind} snapshot fixture contract passed: ${path.relative(repoRoot, fixturePath)}\n`)
        }
        return
    }
    if (!kindInput || !(kindInput in profiles) || !generatedInput) {
        throw new Error(
            'Usage: checkDashboardSnapshotFixtureDrift.ts <73rd-meridian|interpretation-network|lms|quiz|self-hosted|mmoomm> <fixture-path> [--drift] [--tracked <fixture-path>]'
        )
    }

    const kind = kindInput as FixtureKind
    const profile = profiles[kind]
    const trackedArgumentIndex = args.indexOf('--tracked')
    const trackedInput = trackedArgumentIndex >= 0 ? args[trackedArgumentIndex + 1] : undefined
    if (trackedArgumentIndex >= 0 && (!trackedInput || trackedInput.startsWith('--'))) {
        throw new Error('--tracked requires a repository-local fixture path.')
    }
    const trackedPath = trackedInput
        ? resolvePathInsideRepository(trackedInput, 'Tracked fixture paths')
        : path.join(repoRoot, 'tools', 'fixtures', profile.filename)
    const fixturePath = resolvePathInsideRepository(generatedInput, 'Fixture paths')
    const compareWithTracked = args.includes('--drift')
    if (!fs.existsSync(fixturePath) || (compareWithTracked && !fs.existsSync(trackedPath))) {
        throw new Error(`${compareWithTracked ? 'Tracked or generated' : 'Generated'} ${kind} fixture is missing.`)
    }

    const contractPath = pathToFileURL(path.join(repoRoot, 'tools', 'testing', 'e2e', 'support', profile.contractModule)).href
    const contractModule = (await import(contractPath)) as Record<string, unknown>
    const assertContract = contractModule[profile.contractFunction]
    if (typeof assertContract !== 'function') throw new Error(`Missing ${profile.contractFunction} fixture contract.`)

    const readEnvelope = (filePath: string) =>
        validateSnapshotEnvelope(JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>)
    const fixture = readEnvelope(fixturePath)
    assertDashboardSnapshotInvariants(fixture.snapshot)
    assertContract(fixture)

    if (!compareWithTracked) {
        process.stdout.write(`${kind} snapshot fixture contract passed: ${path.relative(repoRoot, fixturePath)}\n`)
        return
    }

    const tracked = parseTrackedTransportEnvelope(JSON.parse(fs.readFileSync(trackedPath, 'utf8')) as unknown)
    const compatibilityIssue = getTrackedDashboardCompatibilityIssue(tracked.snapshot)
    if (compatibilityIssue) {
        throw new Error(`${kind} tracked fixture violates current dashboard invariants: ${compatibilityIssue}`)
    }
    const trackedContractIssue = getTrackedDashboardFixtureContractIssue(tracked, assertContract)
    if (trackedContractIssue) {
        throw new Error(`${kind} tracked fixture violates its current fixture contract: ${trackedContractIssue}`)
    }

    const difference = getNormalizedDashboardFixtureDifference(tracked, fixture)
    if (difference) {
        throw new Error(
            `${kind} snapshot fixture drift detected after normalizing volatile identifiers and timestamps.\n` +
                `Tracked: ${path.relative(repoRoot, trackedPath)}\nGenerated: ${path.relative(repoRoot, fixturePath)}\n` +
                `First normalized difference:\n${difference}`
        )
    }

    process.stdout.write(`${kind} snapshot fixture drift check passed: ${path.relative(repoRoot, fixturePath)}\n`)
}

const isDirectExecution = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
if (isDirectExecution) {
    void main().catch((error: unknown) => {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
        process.exitCode = 1
    })
}
