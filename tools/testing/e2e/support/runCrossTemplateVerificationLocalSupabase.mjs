import fs from 'fs/promises'
import path from 'path'
import { spawn } from 'child_process'
import { repoRoot } from './env/load-e2e-env.mjs'
import { acquireE2eRunLock, releaseE2eRunLock } from './e2eRunLock.mjs'

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
            if (code === 0) {
                resolve()
                return
            }
            reject(new Error(`pnpm ${args.join(' ')} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}`))
        })
    })

const localSupabaseEnv = {
    UNIVERSO_ENV_FILE: '.env.e2e.local-supabase',
    UNIVERSO_FRONTEND_ENV_FILE: 'packages/universo-react-core-frontend/.env.e2e.local-supabase'
}
const dashboardAcceptance = process.argv.includes('--dashboard-acceptance')
const acceptanceSpecs = dashboardAcceptance
    ? [
          'tools/testing/e2e/specs/flows/metahub-dashboard-nested-placement-authoring.spec.ts',
          'tools/testing/e2e/specs/flows/dashboard-widget-content-authoring.spec.ts',
          'tools/testing/e2e/specs/flows/application-layout-management.spec.ts',
          'tools/testing/e2e/specs/flows/app-runtime-views.spec.ts',
          'tools/testing/e2e/specs/flows/app-runtime-views.entity-backed.spec.ts',
          'tools/testing/e2e/specs/flows/published-dashboard-navigation.spec.ts',
          'tools/testing/e2e/specs/flows/cross-template-runtime.spec.ts',
          'tools/testing/e2e/specs/flows/cross-template-scoped-layout.spec.ts',
          'tools/testing/e2e/specs/flows/cross-template-concurrency.spec.ts',
          'tools/testing/e2e/specs/flows/snapshot-import-lms-runtime.spec.ts'
      ]
    : ['tools/testing/e2e/specs/flows/cross-template-runtime.spec.ts', 'tools/testing/e2e/specs/flows/cross-template-scoped-layout.spec.ts']
const artifactRunId = new Date()
    .toISOString()
    .replace(/[^0-9A-Za-z]+/g, '-')
    .replace(/-+$/g, '')
const artifactRoot = path.join(
    repoRoot,
    `tools/testing/e2e/.artifacts/${dashboardAcceptance ? 'dashboard-entity-backed' : 'cross-template'}`,
    artifactRunId
)
const e2eRunLockPath = path.join(repoRoot, 'tools/testing/e2e/.artifacts/run.lock')

async function preserveRunnerArtifacts(status) {
    await fs.mkdir(artifactRoot, { recursive: true })
    for (const directory of ['test-results', 'playwright-report']) {
        const source = path.join(repoRoot, directory)
        try {
            await fs.cp(source, path.join(artifactRoot, directory), { recursive: true })
        } catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') continue
            throw error
        }
    }
    await fs.writeFile(
        path.join(artifactRoot, 'status.json'),
        `${JSON.stringify(
            {
                status: status.status,
                error: status.error ?? null,
                acceptanceMode: dashboardAcceptance ? 'dashboard-entity-backed' : 'cross-template',
                specs: acceptanceSpecs,
                finishedAt: new Date().toISOString()
            },
            null,
            2
        )}\n`,
        'utf8'
    )
}

let failed = false
let failureMessage = null
let runLockLease = null
let runnerCanWriteArtifacts = !dashboardAcceptance

try {
    if (dashboardAcceptance) {
        runLockLease = await acquireE2eRunLock({
            lockPath: e2eRunLockPath,
            metadata: { gate: 'dashboard-entity-backed-acceptance' }
        })
        runnerCanWriteArtifacts = true
        await run(['supabase:e2e:nuke'])
    }
    await run(['supabase:e2e:start:minimal'])
    await run(['env:e2e:local-supabase'])
    await run(['doctor:e2e:local-supabase'])
    await run(['build:e2e'], { env: localSupabaseEnv })
    await run(['exec', 'node', 'tools/testing/e2e/run-playwright-suite.mjs', ...acceptanceSpecs, '--project', 'chromium'], {
        env: {
            ...localSupabaseEnv,
            ...(runLockLease
                ? {
                      UNIVERSO_E2E_RUN_LOCK_OWNER_PID: String(runLockLease.ownerPid),
                      UNIVERSO_E2E_RUN_LOCK_TOKEN: runLockLease.token
                  }
                : {})
        }
    })
} catch (error) {
    failed = true
    failureMessage = error instanceof Error ? error.message : String(error)
    throw error
} finally {
    if (runnerCanWriteArtifacts) {
        try {
            await preserveRunnerArtifacts({ status: failed ? 'failed' : 'passed', error: failureMessage })
        } catch (artifactError) {
            const message = artifactError instanceof Error ? artifactError.message : String(artifactError)
            process.stderr.write(`Failed to preserve cross-template E2E artifacts: ${message}\n`)
            process.exitCode = 1
        }
    }

    let supabaseStopSucceeded = false
    if (!dashboardAcceptance || runLockLease) {
        try {
            await run(['supabase:e2e:stop'])
            supabaseStopSucceeded = true
        } catch (stopError) {
            const message = stopError instanceof Error ? stopError.message : String(stopError)
            process.stderr.write(`Failed to stop local E2E Supabase after cross-template verification: ${message}\n`)
            if (!failed) process.exitCode = 1
        }
    }

    if (runLockLease && supabaseStopSucceeded) {
        try {
            await releaseE2eRunLock(runLockLease)
        } catch (lockError) {
            const message = lockError instanceof Error ? lockError.message : String(lockError)
            process.stderr.write(`Failed to release Dashboard acceptance E2E run lock: ${message}\n`)
            process.exitCode = 1
        }
    } else if (runLockLease) {
        process.stderr.write('Retaining Dashboard acceptance E2E run lock because Supabase stop was not confirmed.\n')
    }
}
