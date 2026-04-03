import { cleanupE2eRun } from './e2eCleanup.mjs'
import { fullResetE2eProject } from './e2eFullReset.mjs'

const args = new Set(process.argv.slice(2))
const manifestOnly = args.has('--manifest-only')
const dryRun = args.has('--dry-run')

async function main() {
    try {
        if (!dryRun) {
            try {
                const manifestReport = await cleanupE2eRun({ quiet: false })
                if (manifestReport?.runId) {
                    console.info(`[e2e-cleanup] Completed manifest cleanup for ${manifestReport.runId}`)
                }
            } catch (error) {
                console.warn(`[e2e-cleanup] Manifest cleanup warning: ${error instanceof Error ? error.message : String(error)}`)
            }
        }

        if (manifestOnly) {
            process.exit(0)
        }

        const resetReport = await fullResetE2eProject({
            dryRun,
            quiet: false,
            reason: dryRun ? 'manual-cleanup-command-dry-run' : 'manual-cleanup-command'
        })
        console.info(
            `[e2e-cleanup] Full reset ${dryRun ? 'dry-run ' : ''}complete: dropped ${resetReport.droppedSchemas.length} schema(s), deleted ${resetReport.deletedAuthUsers.length} auth user(s)`
        )
        process.exit(0)
    } catch (error) {
        if (error && typeof error === 'object' && 'report' in error) {
            console.error(JSON.stringify(error.report, null, 2))
        }
        console.error(error instanceof Error ? error.message : error)
        process.exit(1)
    }
}

main()
