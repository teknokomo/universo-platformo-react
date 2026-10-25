import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { preserveInterpretationNetworkPlaywrightRun } from './interpretationNetworkVerificationArtifacts.mjs'

test('preserves per-run reports, screenshots, test statuses, and execution provenance', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'interpretation-network-evidence-'))
    const repoRoot = path.join(root, 'repo')
    const artifactRoot = path.join(repoRoot, 'tools/testing/e2e/.artifacts/interpretation-network-verification/run-1')
    try {
        await fs.mkdir(path.join(repoRoot, 'test-results/screenshots'), { recursive: true })
        await fs.mkdir(path.join(repoRoot, 'playwright-report'), { recursive: true })
        await fs.writeFile(
            path.join(repoRoot, 'test-results/playwright-results.json'),
            JSON.stringify({
                suites: [
                    {
                        title: 'runtime UX',
                        specs: [
                            {
                                title: 'checks localized validation',
                                tests: [
                                    {
                                        projectName: 'en-light',
                                        expectedStatus: 'passed',
                                        annotations: [],
                                        results: [{ status: 'passed', retry: 0 }]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            })
        )
        await fs.writeFile(path.join(repoRoot, 'test-results/screenshots/validation.png'), 'png')
        await fs.writeFile(path.join(repoRoot, 'playwright-report/index.html'), '<html></html>')

        const run = await preserveInterpretationNetworkPlaywrightRun({
            repoRoot,
            artifactRoot,
            label: 'runtime-ux-oracles',
            command: ['pnpm', 'exec', 'playwright', 'test', 'runtime-ux-oracles.spec.ts'],
            project: 'en-light',
            startedAt: '2026-10-23T10:00:00.000Z',
            finishedAt: '2026-10-23T10:00:01.000Z',
            status: 'passed'
        })

        assert.equal(run.reportAvailable, true)
        assert.equal(run.summary.total, 1)
        assert.equal(run.summary.passed, 1)
        assert.deepEqual(run.tests.map((item) => [item.projectName, item.title, item.finalStatus]), [
            ['en-light', 'runtime UX > checks localized validation', 'passed']
        ])
        assert.deepEqual(run.screenshotPaths, ['runtime-ux-oracles/test-results/screenshots/validation.png'])
        assert.equal(
            await fs.readFile(path.join(artifactRoot, 'runtime-ux-oracles/playwright-report/index.html'), 'utf8'),
            '<html></html>'
        )
        const saved = JSON.parse(await fs.readFile(path.join(artifactRoot, 'runtime-ux-oracles/run-manifest.json'), 'utf8'))
        assert.equal(saved.command[0], 'pnpm')
        assert.equal(saved.project, 'en-light')
    } finally {
        await fs.rm(root, { recursive: true, force: true })
    }
})

test('rejects unsafe artifact labels', async () => {
    await assert.rejects(
        preserveInterpretationNetworkPlaywrightRun({
            repoRoot: os.tmpdir(),
            artifactRoot: os.tmpdir(),
            label: '../outside',
            command: [],
            project: 'default',
            startedAt: new Date(0).toISOString(),
            finishedAt: new Date(0).toISOString(),
            status: 'failed'
        }),
        /lowercase slug/
    )
})
