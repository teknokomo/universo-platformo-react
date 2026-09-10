import fs from 'fs/promises'
import path from 'path'
import { spawn } from 'child_process'
import { repoRoot } from './env/load-e2e-env.mjs'

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
const artifactRunId = new Date()
    .toISOString()
    .replace(/[^0-9A-Za-z]+/g, '-')
    .replace(/-+$/g, '')
const artifactRoot = path.join(repoRoot, 'tools/testing/e2e/.artifacts/cross-template-concurrency', artifactRunId)

const preserveRunnerArtifacts = async (status) => {
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
                gate: 'optimistic-version-concurrency',
                browserEvidence: 'authenticated Playwright page verifies the committed layout after the API race',
                apiEvidence: 'two independent authenticated API sessions race one versioned layout mutation',
                expectedOutcome: 'one 200 commit and one 409 APPLICATION_LAYOUT_VERSION_CONFLICT',
                error: status.error ?? null,
                finishedAt: new Date().toISOString()
            },
            null,
            2
        )}\n`,
        'utf8'
    )
}

const runArgs = [
    'exec',
    'node',
    'tools/testing/e2e/run-playwright-suite.mjs',
    'tools/testing/e2e/specs/flows/cross-template-concurrency.spec.ts',
    '--project',
    'chromium'
]

let failed = false
let failureMessage = null

try {
    await run(['supabase:e2e:start:minimal'])
    await run(['env:e2e:local-supabase'])
    await run(['doctor:e2e:local-supabase'])
    await run(['build:e2e'], { env: localSupabaseEnv })
    await run(runArgs, { env: localSupabaseEnv })
} catch (error) {
    failed = true
    failureMessage = error instanceof Error ? error.message : String(error)
    throw error
} finally {
    try {
        await preserveRunnerArtifacts({ status: failed ? 'failed' : 'passed', error: failureMessage })
    } catch (artifactError) {
        const message = artifactError instanceof Error ? artifactError.message : String(artifactError)
        process.stderr.write(`Failed to preserve cross-template concurrency artifacts: ${message}\n`)
        process.exitCode = 1
    }
    try {
        await run(['supabase:e2e:stop'])
    } catch (stopError) {
        const message = stopError instanceof Error ? stopError.message : String(stopError)
        process.stderr.write(`Failed to stop local E2E Supabase after cross-template concurrency: ${message}\n`)
        if (!failed) process.exitCode = 1
    }
}
