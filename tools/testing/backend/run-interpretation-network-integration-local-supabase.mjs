import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ensurePlatformMigrations, loadLocalSupabaseDatabaseUrl } from './localSupabaseEnv.mjs'
import { inspectInterpretationNetworkPostgresResults } from './interpretationNetworkPostgresResults.mjs'

const suitePaths = [
    'src/tests/persistence/interpretationNetworkWorkspaceSettings.integration.test.ts',
    'src/tests/persistence/runtimeWorkspaceCopy.integration.test.ts',
    'src/tests/persistence/publicInterpretationNetworkRuntimeStore.integration.test.ts',
    'src/tests/persistence/interpretationNetworkFavoriteLocking.integration.test.ts'
]
const { databaseUrl } = loadLocalSupabaseDatabaseUrl()

const migrationsExitCode = await ensurePlatformMigrations(databaseUrl)
if (migrationsExitCode !== 0) {
    console.error('Platform migrations could not be applied; the Interpretation Network PostgreSQL suite was not run.')
    process.exit(migrationsExitCode)
}

const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'universo-interpretation-network-jest-'))
const resultsPath = path.join(outputDirectory, 'jest-results.json')

const exitCode = await new Promise((resolve) => {
    const child = spawn(
        'pnpm',
        [
            '--filter',
            '@universo-react/applications-backend',
            'exec',
            'node',
            '../../tools/testing/backend/run-jest.cjs',
            '--config',
            './jest.config.js',
            '--runInBand',
            '--json',
            `--outputFile=${resultsPath}`,
            ...suitePaths
        ],
        {
            stdio: 'inherit',
            shell: process.platform === 'win32',
            env: {
                ...process.env,
                DATABASE_TEST_URL: databaseUrl,
                REQUIRE_DATABASE_TESTS: '1'
            }
        }
    )
    child.on('error', (error) => {
        console.error(`Failed to start Interpretation Network PostgreSQL integration tests: ${error.message}`)
        resolve(1)
    })
    child.on('close', (code, signal) => {
        if (signal) {
            console.error(`Interpretation Network PostgreSQL integration tests stopped with signal ${signal}`)
        }
        resolve(code ?? 1)
    })
})

try {
    let results
    try {
        results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'))
    } catch {
        throw new Error('Jest did not produce a result file for the required PostgreSQL integration suite')
    }

    const summary = inspectInterpretationNetworkPostgresResults({ results, suitePaths, exitCode })
    if (!summary.ok) throw new Error(summary.errors.join('\n'))
    process.stdout.write(`Interpretation Network PostgreSQL integration passed: ${summary.passedCases} non-skipped cases, 0 skipped.\n`)
} catch (error) {
    process.exitCode = 1
    console.error(error instanceof Error ? error.message : String(error))
} finally {
    fs.rmSync(outputDirectory, { recursive: true, force: true })
}
