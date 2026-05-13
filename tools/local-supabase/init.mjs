import { existsSync } from 'node:fs'
import path from 'node:path'
import { isMainModule, parseArgs, REPO_ROOT, runCommand } from './shared.mjs'

export function initSupabase({ force = false } = {}) {
    const configPath = path.join(REPO_ROOT, 'supabase/config.toml')
    if (existsSync(configPath) && !force) {
        return { initialized: false, configPath }
    }

    runCommand('supabase', ['init', '--yes', ...(force ? ['--force'] : [])])
    return { initialized: true, configPath }
}

export async function main(argv = process.argv.slice(2)) {
    const args = parseArgs(argv)
    const result = initSupabase({ force: args.get('force') === 'true' })
    process.stdout.write(
        `${
            result.initialized
                ? `Initialized Supabase config at ${result.configPath}.`
                : `Supabase config already exists at ${result.configPath}.`
        }\n`
    )
}

if (isMainModule(import.meta.url)) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : error)
        process.exitCode = 1
    })
}
