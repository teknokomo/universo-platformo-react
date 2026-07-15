import { spawn } from 'child_process'

const run = (args, options = {}) =>
    new Promise((resolve, reject) => {
        const child = spawn('pnpm', args, {
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

const generatedFixturePath = 'tools/testing/e2e/.artifacts/generated-metahubs-interpretation-network-app-snapshot.json'
const generatedFixtureEnv = {
    ...localSupabaseEnv,
    INTERPRETATION_NETWORK_FIXTURE_PATH: generatedFixturePath
}

let failed = false

try {
    await run(['supabase:e2e:start:minimal'])
    await run(['env:e2e:local-supabase'])
    await run(['doctor:e2e:local-supabase'])
    await run(['build:e2e'], { env: localSupabaseEnv })
    await run(['test:e2e:interpretation-network-fixture-generator'], {
        env: {
            ...localSupabaseEnv,
            INTERPRETATION_NETWORK_FIXTURE_OUTPUT_PATH: generatedFixturePath
        }
    })
    await run(['check:interpretation-network-fixture-contract'], { env: generatedFixtureEnv })
    await run(['check:interpretation-network-fixture-drift', '--', generatedFixturePath])
    await run(
        [
            'exec',
            'node',
            'tools/testing/e2e/run-playwright-suite.mjs',
            'specs/flows/interpretation-network-app-imported-snapshot.spec.ts',
            'specs/visual/interpretation-network-workspace.spec.ts'
        ],
        {
            env: generatedFixtureEnv
        }
    )
    await run(['docs:i18n:check'])
    await run(['exec', 'node', 'tools/docs/check-gitbook-links.mjs'])
    await run(['docs:gitbook-screenshot-assets:check'])
} catch (error) {
    failed = true
    throw error
} finally {
    try {
        await run(['supabase:e2e:stop'])
    } catch (stopError) {
        const message = stopError instanceof Error ? stopError.message : String(stopError)
        process.stderr.write(`Failed to stop local E2E Supabase after Interpretation Network verification: ${message}\n`)
        if (!failed) {
            process.exitCode = 1
        }
    }
}
