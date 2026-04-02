import { cleanupE2eRun } from './e2eCleanup.mjs'

cleanupE2eRun()
    .then((report) => {
        if (report?.runId) {
            console.info(`[e2e-cleanup] Completed cleanup for ${report.runId}`)
        }
        process.exit(0)
    })
    .catch((error) => {
        if (error && typeof error === 'object' && 'report' in error) {
            console.error(JSON.stringify(error.report, null, 2))
        }
        console.error(error instanceof Error ? error.message : error)
        process.exit(1)
    })
