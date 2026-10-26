import fs from 'node:fs/promises'
import path from 'node:path'
import { collectPlaywrightTests } from './playwrightResults.mjs'

const isMissingFile = (error) => error && typeof error === 'object' && error.code === 'ENOENT'

async function listPngFiles(directory) {
    let entries
    try {
        entries = await fs.readdir(directory, { withFileTypes: true })
    } catch (error) {
        if (isMissingFile(error)) return []
        throw error
    }

    const nested = await Promise.all(
        entries.map(async (entry) => {
            const entryPath = path.join(directory, entry.name)
            if (entry.isDirectory()) return listPngFiles(entryPath)
            return entry.isFile() && entry.name.toLowerCase().endsWith('.png') ? [entryPath] : []
        })
    )
    return nested.flat()
}

export async function preserveInterpretationNetworkPlaywrightRun({
    repoRoot,
    artifactRoot,
    label,
    command,
    project,
    startedAt,
    finishedAt,
    status
}) {
    if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Playwright artifact label must be a lowercase slug')

    const runRoot = path.join(artifactRoot, label)
    await fs.mkdir(runRoot, { recursive: true })
    for (const directory of ['test-results', 'playwright-report']) {
        const source = path.join(repoRoot, directory)
        const target = path.join(runRoot, directory)
        try {
            await fs.cp(source, target, { recursive: true, force: true })
        } catch (error) {
            if (!isMissingFile(error)) throw error
        }
    }

    const reportPath = path.join(runRoot, 'test-results', 'playwright-results.json')
    let tests = []
    let reportAvailable = false
    try {
        const report = JSON.parse(await fs.readFile(reportPath, 'utf8'))
        tests = collectPlaywrightTests(report.suites).map((test) => {
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
        reportAvailable = true
    } catch (error) {
        if (!isMissingFile(error)) throw error
    }

    const screenshotPaths = (await listPngFiles(path.join(runRoot, 'test-results'))).map((absolutePath) =>
        path.relative(artifactRoot, absolutePath).split(path.sep).join('/')
    )
    let htmlReportPath = null
    try {
        await fs.access(path.join(runRoot, 'playwright-report', 'index.html'))
        htmlReportPath = path.join(label, 'playwright-report', 'index.html').split(path.sep).join('/')
    } catch (error) {
        if (!isMissingFile(error)) throw error
    }
    const result = {
        label,
        command,
        project,
        startedAt,
        finishedAt,
        status,
        reportAvailable,
        reportPaths: {
            json: reportAvailable ? path.relative(artifactRoot, reportPath).split(path.sep).join('/') : null,
            html: htmlReportPath
        },
        screenshotPaths,
        summary: {
            total: tests.length,
            passed: tests.filter((test) => test.finalStatus === 'passed').length,
            failed: tests.filter((test) => ['failed', 'timedOut', 'interrupted', 'not-run'].includes(test.finalStatus)).length,
            skipped: tests.filter((test) => test.finalStatus === 'skipped').length
        },
        tests
    }

    await fs.writeFile(path.join(runRoot, 'run-manifest.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8')
    return result
}
