import { ensureLocalNetwork } from './network.mjs'
import { isMainModule, parseArgs } from './shared.mjs'
import {
    assertLocalSupabaseStack,
    ensureLocalSupabaseProject,
    getExcludeArgs,
    getLocalSupabaseProfile,
    runSupabaseCli
} from './profiles.mjs'

export function runLocalSupabaseAction({ action, target = 'dev', stack = 'full' }) {
    const profile = getLocalSupabaseProfile(target)
    const normalizedStack = assertLocalSupabaseStack(stack)

    if (action === 'start') {
        const project = ensureLocalSupabaseProject(profile)
        ensureLocalNetwork(profile.networkId)
        const output = runSupabaseCli(profile, ['start', '--network-id', profile.networkId, ...getExcludeArgs(normalizedStack)])
        return {
            output,
            message: [
                `Local Supabase ${target} profile started (${normalizedStack}).`,
                `Project id: ${profile.projectId}`,
                `Config: ${project.configPath}`,
                `API: http://127.0.0.1:${profile.ports.api}`,
                `Studio: http://127.0.0.1:${profile.ports.studio}`,
                `Database: postgresql://postgres:postgres@127.0.0.1:${profile.ports.db}/postgres`
            ].join('\n')
        }
    }

    if (action === 'status') {
        ensureLocalSupabaseProject(profile)
        const output = runSupabaseCli(profile, ['status'])
        return { output, message: `Local Supabase ${target} profile status completed.` }
    }

    if (action === 'stop' || action === 'nuke') {
        ensureLocalSupabaseProject(profile)
        const args = ['stop', '--project-id', profile.projectId]
        if (action === 'nuke') args.push('--no-backup')
        const output = runSupabaseCli(profile, args)
        return {
            output,
            message:
                action === 'nuke'
                    ? `Local Supabase ${target} profile stopped and data volumes removed.`
                    : `Local Supabase ${target} profile stopped.`
        }
    }

    throw new Error(`Unsupported local Supabase action "${action}". Use start, status, stop, or nuke.`)
}

export async function main(argv = process.argv.slice(2)) {
    const args = parseArgs(argv)
    const result = runLocalSupabaseAction({
        action: args.get('action') || 'status',
        target: args.get('target') || 'dev',
        stack: args.get('stack') || 'full'
    })

    if (result.output?.trim()) {
        process.stdout.write(`${result.output.trim()}\n`)
    }
    process.stdout.write(`${result.message}\n`)
}

if (isMainModule(import.meta.url)) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : error)
        process.exitCode = 1
    })
}
