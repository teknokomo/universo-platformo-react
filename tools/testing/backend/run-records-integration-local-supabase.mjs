import { spawn } from 'node:child_process'
import { ensurePlatformMigrations, loadLocalSupabaseDatabaseUrl } from './localSupabaseEnv.mjs'

/**
 * Runs the metahub records integration suite against the local E2E Supabase
 * database. The suite is skipped without DATABASE_TEST_URL, so CI would stay
 * green while never exercising real PostgreSQL; this runner derives the URL
 * from the generated local-Supabase backend env file and reapplies platform
 * migrations because the E2E runner drops schemas after a browser run.
 */

const { databaseUrl } = loadLocalSupabaseDatabaseUrl()

const migrationsExitCode = await ensurePlatformMigrations(databaseUrl)
if (migrationsExitCode !== 0) {
    console.error('Platform migrations could not be applied; the records integration suite was not run.')
    process.exit(migrationsExitCode)
}

const child = spawn(
    'pnpm',
    [
        '--filter',
        '@universo-react/metahubs-backend',
        'exec',
        'node',
        '../../tools/testing/backend/run-jest.cjs',
        '--config',
        './jest.config.js',
        'src/tests/services/MetahubRecordsService.integration.test.ts'
    ],
    {
        stdio: 'inherit',
        shell: process.platform === 'win32',
        env: {
            ...process.env,
            DATABASE_TEST_URL: databaseUrl
        }
    }
)

child.on('error', (error) => {
    console.error(`Failed to start the records integration suite: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
})

child.on('close', (code, signal) => {
    if (code === 0) {
        process.exit(0)
    }
    console.error(`Records integration suite failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}`)
    process.exit(code ?? 1)
})
