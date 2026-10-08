import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { repoRoot } from './env/load-e2e-env.mjs'
import { acquireE2eRunLock, releaseE2eRunLock } from './e2eRunLock.mjs'

const fixtureInventory = [
    {
        kind: '73rd-meridian',
        filename: 'metahubs-73rd-meridian-app-snapshot.json',
        outputVariable: 'MERIDIAN_73_FIXTURE_OUTPUT_PATH',
        spec: 'metahubs-73rd-meridian-app-export.spec.ts'
    },
    {
        kind: 'interpretation-network',
        filename: 'metahubs-interpretation-network-app-snapshot.json',
        outputVariable: 'INTERPRETATION_NETWORK_FIXTURE_OUTPUT_PATH',
        spec: 'metahubs-interpretation-network-app-export.spec.ts'
    },
    {
        kind: 'lms',
        filename: 'metahubs-lms-app-snapshot.json',
        outputVariable: 'LMS_FIXTURE_OUTPUT_PATH',
        spec: 'metahubs-lms-app-export.spec.ts'
    },
    {
        kind: 'mmoomm',
        filename: 'metahubs-mmoomm-app-snapshot.json',
        outputVariable: 'MMOOMM_APP_FIXTURE_OUTPUT_PATH',
        spec: 'metahubs-mmoomm-app-export.spec.ts',
        requiresEditorBuild: true
    },
    {
        kind: 'quiz',
        filename: 'metahubs-quiz-app-snapshot.json',
        outputVariable: 'QUIZ_FIXTURE_OUTPUT_PATH',
        spec: 'metahubs-quiz-app-export.spec.ts'
    },
    {
        kind: 'self-hosted',
        filename: 'metahubs-self-hosted-app-snapshot.json',
        outputVariable: 'SELF_HOSTED_APP_FIXTURE_OUTPUT_PATH',
        spec: 'metahubs-self-hosted-app-export.spec.ts'
    }
]

const runtimeSpecs = [
    'snapshot-import-73rd-meridian-public-runtime.spec.ts',
    'interpretation-network-app-imported-snapshot.spec.ts',
    'snapshot-import-lms-runtime.spec.ts',
    'snapshot-import-mmoomm-app-parity.spec.ts',
    'snapshot-import-mmoomm-app-runtime.spec.ts',
    'snapshot-import-quiz-runtime.spec.ts',
    'snapshot-export-import.spec.ts'
]

const expectedHistoricalBaselineSha256 = 'ee6025ab24f00ffaa3b88cd3f3ab34f27290e4662876d3584de4ab51e6667c00'
const baselinePath = path.join(repoRoot, 'tools/fixtures/mmoomm-runtime-pre-extraction-baseline.json')
const runId = `${new Date().toISOString().replace(/[^0-9A-Za-z]+/g, '-')}-${process.pid}`
const artifactRoot = path.join(repoRoot, 'tools/testing/e2e/.artifacts/dashboard-fixtures', runId)
const generatedRoot = path.join(artifactRoot, 'generated')
const backupRoot = path.join(artifactRoot, 'previous-fixtures')
const fullFixtureBackupRoot = path.join(artifactRoot, 'fixture-directory-before-run')
const localSupabaseEnv = {
    UNIVERSO_ENV_FILE: '.env.e2e.local-supabase',
    UNIVERSO_FRONTEND_ENV_FILE: 'packages/universo-react-core-frontend/.env.e2e.local-supabase'
}
const e2eRunLockPath = path.join(repoRoot, 'tools/testing/e2e/.artifacts/run.lock')

const run = (args, options = {}) =>
    new Promise((resolve, reject) => {
        const child = spawn('pnpm', args, {
            cwd: repoRoot,
            stdio: 'inherit',
            shell: process.platform === 'win32',
            env: { ...process.env, ...options.env }
        })
        child.on('error', reject)
        child.on('close', (code, signal) => {
            if (code === 0) resolve()
            else reject(new Error(`pnpm ${args.join(' ')} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}`))
        })
    })

const sha256 = async (filePath) =>
    createHash('sha256')
        .update(await fs.readFile(filePath))
        .digest('hex')

const captureFixtureDirectoryState = async (directory = path.join(repoRoot, 'tools/fixtures'), prefix = '') => {
    const state = new Map()
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        const relativePath = path.join(prefix, entry.name)
        const absolutePath = path.join(directory, entry.name)
        if (entry.isDirectory()) {
            for (const [nestedPath, digest] of await captureFixtureDirectoryState(absolutePath, relativePath)) {
                state.set(nestedPath, digest)
            }
        } else if (entry.isFile()) {
            state.set(relativePath, await sha256(absolutePath))
        }
    }
    return state
}

const assertFixtureDirectoryChangesAreAllowlisted = async (before, allowedPaths = new Set()) => {
    const after = await captureFixtureDirectoryState()
    const allPaths = new Set([...before.keys(), ...after.keys()])
    const unexpected = [...allPaths].filter(
        (fixturePath) => before.get(fixturePath) !== after.get(fixturePath) && !allowedPaths.has(fixturePath)
    )
    if (unexpected.length > 0) {
        for (const fixturePath of unexpected) {
            const currentPath = path.join(repoRoot, 'tools', 'fixtures', fixturePath)
            const previousPath = before.has(fixturePath) ? path.join(fullFixtureBackupRoot, fixturePath) : null
            if (previousPath) {
                await fs.mkdir(path.dirname(currentPath), { recursive: true })
                await fs.copyFile(previousPath, currentPath)
            } else {
                await fs.rm(currentPath, { force: true })
            }
        }
        throw new Error(`Fixture generation changed paths outside its allowlist: ${unexpected.join(', ')}`)
    }
}

const backupFixtureDirectory = async (state) => {
    for (const fixturePath of state.keys()) {
        const sourcePath = path.join(repoRoot, 'tools', 'fixtures', fixturePath)
        const backupPath = path.join(fullFixtureBackupRoot, fixturePath)
        await fs.mkdir(path.dirname(backupPath), { recursive: true })
        await fs.copyFile(sourcePath, backupPath)
    }
}

const preserveArtifacts = async (status, error) => {
    await fs.mkdir(artifactRoot, { recursive: true })
    for (const directory of ['test-results', 'playwright-report']) {
        const source = path.join(repoRoot, directory)
        try {
            await fs.cp(source, path.join(artifactRoot, directory), { recursive: true })
        } catch (copyError) {
            if (copyError?.code !== 'ENOENT') throw copyError
        }
    }
    await fs.writeFile(
        path.join(artifactRoot, 'status.json'),
        `${JSON.stringify(
            {
                gate: 'dashboard-six-fixture-regeneration',
                status,
                fixtures: fixtureInventory.map(({ kind, filename }) => ({ kind, filename })),
                generatorAndRuntimeSpecs: [...fixtureInventory.map((item) => item.spec), ...runtimeSpecs],
                historicalBaseline: {
                    path: path.relative(repoRoot, baselinePath),
                    sha256: expectedHistoricalBaselineSha256
                },
                error: error ?? null,
                finishedAt: new Date().toISOString()
            },
            null,
            2
        )}\n`,
        'utf8'
    )
}

const runPlaywright = async (label, args, options = {}) => {
    const outputRoot = path.join(artifactRoot, 'runs', label)
    let failure
    try {
        await run(args, {
            ...options,
            env: {
                ...options.env,
                UNIVERSO_E2E_RUN_LOCK_OWNER_PID: String(runLockLease.ownerPid),
                UNIVERSO_E2E_RUN_LOCK_TOKEN: runLockLease.token
            }
        })
    } catch (error) {
        failure = error
    }

    let artifactFailure
    try {
        await fs.mkdir(outputRoot, { recursive: true })
        for (const directory of ['test-results', 'playwright-report']) {
            const source = path.join(repoRoot, directory)
            try {
                await fs.cp(source, path.join(outputRoot, directory), { recursive: true })
            } catch (error) {
                if (error?.code !== 'ENOENT') artifactFailure = error
            }
        }
    } catch (error) {
        artifactFailure = error
    }
    if (failure) throw failure
    if (artifactFailure) throw artifactFailure
}

const validateFixture = async (fixture, generatedPath, { compareWithTracked = false, trackedPath = null } = {}) => {
    const args = [
        'exec',
        'node',
        '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
        'tools/testing/e2e/support/checkDashboardSnapshotFixtureDrift.ts',
        fixture.kind,
        path.relative(repoRoot, generatedPath)
    ]
    if (compareWithTracked) {
        args.push('--drift')
        args.push('--allow-stale-tracked')
        if (trackedPath) args.push('--tracked', path.relative(repoRoot, trackedPath))
    }
    await run(args)
}

const assertBaselineUnchanged = async () => {
    const actualSha256 = await sha256(baselinePath)
    if (actualSha256 !== expectedHistoricalBaselineSha256) {
        throw new Error(`Historical MMOOMM baseline checksum changed: ${actualSha256}`)
    }
}

const assertBaselineHasNoGitDiff = async () => {
    await run(['exec', 'git', 'diff', '--exit-code', '--', path.relative(repoRoot, baselinePath)])
}

const stageAndReplaceFixtures = async (generatedPaths) => {
    await fs.mkdir(backupRoot, { recursive: true })
    const staged = []
    const replaced = []

    try {
        for (const fixture of fixtureInventory) {
            const targetPath = path.join(repoRoot, 'tools', 'fixtures', fixture.filename)
            const backupPath = path.join(backupRoot, fixture.filename)
            const temporaryPath = `${targetPath}.tmp-${process.pid}`
            await fs.copyFile(targetPath, backupPath)
            await fs.copyFile(generatedPaths.get(fixture.filename), temporaryPath)
            staged.push({ targetPath, backupPath, temporaryPath })
        }

        for (const item of staged) {
            await fs.rename(item.temporaryPath, item.targetPath)
            replaced.push(item)
        }
        return staged
    } catch (error) {
        for (const item of replaced.reverse()) await fs.copyFile(item.backupPath, item.targetPath)
        throw error
    } finally {
        await Promise.all(staged.map((item) => fs.rm(item.temporaryPath, { force: true })))
    }
}

const restoreActivatedFixtures = async (stagedFixtures) => {
    for (const { targetPath, backupPath } of stagedFixtures) {
        await fs.copyFile(backupPath, targetPath)
    }
}

let failed = false
let failureMessage = null
let activatedFixtures = null
let fixtureDirectoryState = null
let runLockLease = null
let fixtureRestoreSucceeded = true

try {
    runLockLease = await acquireE2eRunLock({
        lockPath: e2eRunLockPath,
        metadata: { gate: 'dashboard-six-fixture-regeneration' }
    })
    fixtureDirectoryState = await captureFixtureDirectoryState()
    await assertBaselineUnchanged()
    await assertBaselineHasNoGitDiff()
    await fs.mkdir(generatedRoot, { recursive: true })
    await backupFixtureDirectory(fixtureDirectoryState)

    await run(['supabase:e2e:nuke'])
    await run(['supabase:e2e:start:minimal'])
    await run(['env:e2e:local-supabase'])
    await run(['doctor:e2e:local-supabase'])
    await run(['build:e2e'], { env: localSupabaseEnv })

    const generatedPaths = new Map()
    for (const fixture of fixtureInventory) {
        if (fixture.requiresEditorBuild) await run(['--filter', '@universo-react/playcanvas-editor-frontend', 'editor:build'])
        const generatedPath = path.join(generatedRoot, fixture.filename)
        const generatorSpec = path.join('tools/testing/e2e/specs/generators', fixture.spec)
        await runPlaywright(
            `generator-${fixture.kind}`,
            ['exec', 'node', 'tools/testing/e2e/run-playwright-suite.mjs', generatorSpec, '--project', 'generators'],
            {
                env: {
                    ...localSupabaseEnv,
                    [fixture.outputVariable]: path.relative(repoRoot, generatedPath)
                }
            }
        )
        await validateFixture(fixture, generatedPath)
        generatedPaths.set(fixture.filename, generatedPath)
    }

    await assertFixtureDirectoryChangesAreAllowlisted(fixtureDirectoryState)

    for (const fixture of fixtureInventory) {
        await validateFixture(fixture, generatedPaths.get(fixture.filename), {
            compareWithTracked: true,
            trackedPath: path.join(fullFixtureBackupRoot, fixture.filename)
        })
    }

    activatedFixtures = await stageAndReplaceFixtures(generatedPaths)
    await assertFixtureDirectoryChangesAreAllowlisted(fixtureDirectoryState, new Set(fixtureInventory.map(({ filename }) => filename)))
    const regeneratedFixtureState = await captureFixtureDirectoryState()

    for (const fixture of fixtureInventory) {
        const generatedPath = generatedPaths.get(fixture.filename)
        const promotedPath = path.join(repoRoot, 'tools', 'fixtures', fixture.filename)
        if ((await sha256(promotedPath)) !== (await sha256(generatedPath))) {
            throw new Error(`${fixture.kind} promoted fixture does not match its fresh generated snapshot.`)
        }
    }

    for (const spec of runtimeSpecs) {
        await runPlaywright(
            `runtime-${spec.replace(/\.spec\.ts$/, '')}`,
            [
                'exec',
                'node',
                'tools/testing/e2e/run-playwright-suite.mjs',
                path.join('tools/testing/e2e/specs/flows', spec),
                '--project',
                'chromium'
            ],
            { env: localSupabaseEnv }
        )
    }

    await assertFixtureDirectoryChangesAreAllowlisted(regeneratedFixtureState)
    await assertBaselineUnchanged()
    await assertBaselineHasNoGitDiff()
} catch (error) {
    failed = true
    failureMessage = error instanceof Error ? error.message : String(error)
    throw error
} finally {
    if (runLockLease) {
        if (failed && activatedFixtures) {
            try {
                await restoreActivatedFixtures(activatedFixtures)
            } catch (error) {
                fixtureRestoreSucceeded = false
                const message = error instanceof Error ? error.message : String(error)
                process.stderr.write(`Failed to restore Dashboard fixtures after an unsuccessful acceptance run: ${message}\n`)
                process.exitCode = 1
            }
        }
        try {
            await preserveArtifacts(failed ? 'failed' : 'passed', failureMessage)
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            process.stderr.write(`Failed to preserve Dashboard fixture artifacts: ${message}\n`)
            process.exitCode = 1
        }
        let supabaseStopSucceeded = false
        try {
            await run(['supabase:e2e:stop'])
            supabaseStopSucceeded = true
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            process.stderr.write(`Failed to stop local E2E Supabase after Dashboard fixture regeneration: ${message}\n`)
            if (!failed) process.exitCode = 1
        }
        if (supabaseStopSucceeded && fixtureRestoreSucceeded) {
            try {
                await releaseE2eRunLock(runLockLease)
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error)
                process.stderr.write(`Failed to release Dashboard fixture E2E run lock: ${message}\n`)
                process.exitCode = 1
            }
        } else {
            const reasons = [
                !supabaseStopSucceeded ? 'Supabase stop was not confirmed' : null,
                !fixtureRestoreSucceeded ? 'fixture restoration was not confirmed' : null
            ].filter(Boolean)
            process.stderr.write(`Retaining Dashboard fixture E2E run lock because ${reasons.join(' and ')}.\n`)
        }
    }
}
