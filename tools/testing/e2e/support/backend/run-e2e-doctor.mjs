import { hasProjectOwnedResidue, inspectE2eProjectState } from './e2eFullReset.mjs'

const args = new Set(process.argv.slice(2))
const assertEmpty = args.has('--assert-empty')

inspectE2eProjectState({ sampleAuthUsers: 20 })
    .then((report) => {
        console.info(JSON.stringify(report, null, 2))

        if (assertEmpty && hasProjectOwnedResidue(report)) {
            process.exit(1)
        }
    })
    .catch((error) => {
        if (error && typeof error === 'object' && 'report' in error) {
            console.error(JSON.stringify(error.report, null, 2))
        }
        console.error(error instanceof Error ? error.message : error)
        process.exit(1)
    })