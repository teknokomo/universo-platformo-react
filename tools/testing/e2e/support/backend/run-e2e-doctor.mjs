import { hasProjectOwnedResidue, inspectE2eProjectState } from './e2eFullReset.mjs'
import { loadE2eEnvironment } from '../env/load-e2e-env.mjs'

const args = new Set(process.argv.slice(2))
const assertEmpty = args.has('--assert-empty')

inspectE2eProjectState({ sampleAuthUsers: 20 })
    .then((report) => {
        const env = loadE2eEnvironment()
        console.info(
            [
                `[e2e-doctor] App URL: ${env.baseURL}`,
                `[e2e-doctor] Backend env: ${env.backendEnvPath || 'not resolved'}`,
                `[e2e-doctor] Supabase: provider=${env.supabaseProvider || 'n/a'}, isolation=${
                    env.supabaseIsolation || 'n/a'
                }, localInstance=${env.localSupabaseInstance || 'n/a'}, localStack=${env.localSupabaseStack || 'n/a'}`
            ].join('\n')
        )
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
