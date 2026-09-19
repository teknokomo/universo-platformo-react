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

const collectPlaywrightTests = (suites, pathParts = [], collected = []) => {
    for (const suite of suites ?? []) {
        const nextPath = suite.title ? [...pathParts, suite.title] : pathParts
        for (const spec of suite.specs ?? []) {
            for (const test of spec.tests ?? []) {
                collected.push({
                    title: [...nextPath, spec.title].filter(Boolean).join(' > '),
                    projectName: test.projectName ?? test.projectId ?? 'unknown',
                    expectedStatus: test.expectedStatus ?? 'unknown',
                    annotations: test.annotations ?? [],
                    results: test.results ?? []
                })
            }
        }
        collectPlaywrightTests(suite.suites, nextPath, collected)
    }
    return collected
}

async function summarizePlaywrightResults(label) {
    const resultsPath = path.join(repoRoot, 'test-results/playwright-results.json')
    const raw = await fs.readFile(resultsPath, 'utf8')
    const report = JSON.parse(raw)
    const tests = collectPlaywrightTests(report.suites)
    const summarized = tests.map((test) => {
        const finalResult = test.results.at(-1)
        return {
            title: test.title,
            projectName: test.projectName,
            expectedStatus: test.expectedStatus,
            finalStatus: finalResult?.status ?? 'not-run',
            attempts: test.results.length,
            retriesUsed: test.results.filter((result) => Number(result.retry ?? 0) > 0).length,
            annotations: test.annotations
        }
    })
    const skipped = summarized.filter((test) => test.finalStatus === 'skipped')
    const retried = summarized.filter((test) => test.attempts > 1 || test.retriesUsed > 0)
    const unexpected = summarized.filter(
        (test) => !['passed', 'skipped'].includes(test.finalStatus) || (test.expectedStatus !== 'passed' && test.finalStatus !== 'skipped')
    )
    const summary = {
        label,
        generatedAt: new Date().toISOString(),
        total: summarized.length,
        skipped,
        retried,
        unexpected,
        tests: summarized
    }
    const summaryPath = path.join(artifactRoot, label, 'playwright-outcomes.json')
    await fs.mkdir(path.dirname(summaryPath), { recursive: true })
    await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')

    process.stdout.write(
        `[marketing-page-verify] ${label}: tests=${summary.total}, skipped=${skipped.length}, retried=${retried.length}, unexpected=${unexpected.length}\n`
    )
    for (const test of skipped) {
        const reason = test.annotations.find((annotation) => annotation.type === 'skip')?.description ?? 'no skip reason reported'
        process.stdout.write(`[marketing-page-verify] SKIP ${test.projectName}: ${test.title} — ${reason}\n`)
    }
    for (const test of retried) {
        process.stdout.write(
            `[marketing-page-verify] RETRY ${test.projectName}: ${test.title} — attempts=${test.attempts}, retries=${test.retriesUsed}\n`
        )
    }
}

async function runPlaywrightBatch(label, args) {
    let commandError = null
    try {
        await run(args, { env: localSupabaseEnv })
    } catch (error) {
        commandError = error
    }

    try {
        await summarizePlaywrightResults(label)
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        process.stderr.write(`[marketing-page-verify] Unable to summarize ${label} Playwright outcomes: ${message}\n`)
    }
    await preserveRunnerArtifacts(label)

    if (commandError) throw commandError
}

let failed = false

try {
    await run(['supabase:e2e:start:minimal'])
    await run(['env:e2e:local-supabase'])
    await run(['doctor:e2e:local-supabase'])
    await run(['build:e2e'], { env: localSupabaseEnv })
    await run(['run', 'check:marketing-page-template-contract'], { env: localSupabaseEnv })

    await runPlaywrightBatch('chromium', [
        'exec',
        'node',
        'tools/testing/e2e/run-playwright-suite.mjs',
        'tools/testing/e2e/specs/flows/marketing-page-runtime.spec.ts',
        'tools/testing/e2e/specs/flows/application-aliases.spec.ts',
        'tools/testing/e2e/specs/flows/cross-template-runtime.spec.ts',
        'tools/testing/e2e/specs/flows/cross-template-scoped-layout.spec.ts',
        'tools/testing/e2e/specs/flows/cross-template-concurrency.spec.ts',
        'tools/testing/e2e/specs/flows/metahub-global-entity-layouts.spec.ts',
        'tools/testing/e2e/specs/flows/marketing-page-permissions.spec.ts',
        'tools/testing/e2e/specs/flows/marketing-page-workspace-management.spec.ts',
        'tools/testing/e2e/specs/flows/marketing-page-authoring.spec.ts',
        'tools/testing/e2e/specs/flows/marketing-page-widget-lifecycle.spec.ts',
        'tools/testing/e2e/specs/flows/marketing-page-snapshot-roundtrip.spec.ts',
        'tools/testing/e2e/specs/flows/application-layout-management.spec.ts',
        'tools/testing/e2e/specs/flows/marketing-page-standalone-runtime.spec.ts',
        '--project',
        'chromium'
    ])

    await runPlaywrightBatch('matrix', [
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
    ])

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
