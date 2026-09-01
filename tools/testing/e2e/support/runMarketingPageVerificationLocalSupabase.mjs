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
            env: {
                ...process.env,
                ...options.env
            }
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
const artifactRoot = path.join(repoRoot, 'tools/testing/e2e/.artifacts/marketing-page', artifactRunId)

async function preserveRunnerArtifacts(label) {
    await fs.mkdir(artifactRoot, { recursive: true })
    for (const directory of ['test-results', 'playwright-report']) {
        const source = path.join(repoRoot, directory)
        const target = path.join(artifactRoot, label, directory)
        try {
            await fs.cp(source, target, { recursive: true })
        } catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') continue
            throw error
        }
    }
}

let failed = false

try {
    await run(['supabase:e2e:start:minimal'])
    await run(['env:e2e:local-supabase'])
    await run(['doctor:e2e:local-supabase'])
    await run(['build:e2e'], { env: localSupabaseEnv })
    await run(['run', 'check:marketing-page-template-contract'], { env: localSupabaseEnv })

    await run(
        [
            'exec',
            'node',
            'tools/testing/e2e/run-playwright-suite.mjs',
            'tools/testing/e2e/specs/flows/marketing-page-runtime.spec.ts',
            'tools/testing/e2e/specs/flows/marketing-page-permissions.spec.ts',
            'tools/testing/e2e/specs/flows/marketing-page-workspace-management.spec.ts',
            'tools/testing/e2e/specs/flows/marketing-page-authoring.spec.ts',
            'tools/testing/e2e/specs/flows/marketing-page-snapshot-roundtrip.spec.ts',
            '--project',
            'chromium'
        ],
        { env: localSupabaseEnv }
    )
    await preserveRunnerArtifacts('chromium')

    await run(
        [
            'exec',
            'node',
            'tools/testing/e2e/run-playwright-suite.mjs',
            'tools/testing/e2e/specs/matrix/marketing-page-visual.spec.ts',
            '--project',
            'ru-light',
            '--project',
            'ru-dark',
            '--project',
            'en-light',
            '--project',
            'en-dark',
            '--workers',
            '1',
            '--retries',
            '2',
            '--grep',
            '@marketing-page'
        ],
        { env: localSupabaseEnv }
    )
    await preserveRunnerArtifacts('matrix')

    await run(['docs:marketing-page:screenshot:check'])
    await run(['docs:i18n:check'])
    await run(['docs:gitbook-screenshot-assets:check'])
    await run(['exec', 'node', 'tools/docs/check-gitbook-links.mjs'])
} catch (error) {
    failed = true
    throw error
} finally {
    try {
        await run(['supabase:e2e:stop'])
    } catch (stopError) {
        const message = stopError instanceof Error ? stopError.message : String(stopError)
        process.stderr.write(`Failed to stop local E2E Supabase after marketing-page verification: ${message}\n`)
        if (!failed) process.exitCode = 1
    }
}
