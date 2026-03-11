import { writeFile } from 'fs/promises'
import { resolve } from 'path'
import { destroyKnex, getKnex } from '@universo/database'
import {
    diffRegisteredPlatformDefinitions,
    exportCatalogPlatformDefinitions,
    exportRegisteredPlatformDefinitions,
    planRegisteredPlatformMigrations
} from './platformMigrations'

type CliCommand = 'status' | 'plan' | 'diff' | 'export'

interface CliOptions {
    outFile: string | null
    source: 'catalog' | 'registered'
}

const parseArgs = (argv: string[]): { command: CliCommand; options: CliOptions } => {
    const [commandArg, ...rest] = argv
    const command = (commandArg ?? 'status') as CliCommand

    if (!['status', 'plan', 'diff', 'export'].includes(command)) {
        throw new Error(`Unknown migration command: ${commandArg ?? '<empty>'}`)
    }

    const options: CliOptions = {
        outFile: null,
        source: 'catalog'
    }

    for (const arg of rest) {
        if (arg.startsWith('--out=')) {
            options.outFile = resolve(arg.slice('--out='.length))
        }
        if (arg.startsWith('--source=')) {
            const source = arg.slice('--source='.length)
            if (source === 'catalog' || source === 'registered') {
                options.source = source
            }
        }
    }

    return { command, options }
}

const writeOutput = async (payload: unknown, options: CliOptions): Promise<void> => {
    const serialized = JSON.stringify(payload, null, 2)

    if (options.outFile) {
        await writeFile(options.outFile, `${serialized}\n`, 'utf8')
        console.log(options.outFile)
        return
    }

    console.log(serialized)
}

const main = async () => {
    const { command, options } = parseArgs(process.argv.slice(2))
    const knex = getKnex()

    try {
        if (command === 'status' || command === 'plan') {
            const plan = await planRegisteredPlatformMigrations(knex)
            const payload =
                command === 'status'
                    ? {
                          dryRun: plan.dryRun,
                          counts: {
                              apply: plan.planned.filter((entry) => entry.action === 'apply').length,
                              skip: plan.planned.filter((entry) => entry.action === 'skip').length,
                              drift: plan.planned.filter((entry) => entry.action === 'drift').length,
                              blocked: plan.planned.filter((entry) => entry.action === 'blocked').length
                          },
                          planned: plan.planned
                      }
                    : plan

            await writeOutput(payload, options)
            return
        }

        if (command === 'diff') {
            const diff = await diffRegisteredPlatformDefinitions(knex)
            await writeOutput(
                {
                    entries: diff,
                    summary: {
                        match: diff.filter((entry) => entry.status === 'match').length,
                        missingInCatalog: diff.filter((entry) => entry.status === 'missing_in_catalog').length,
                        checksumMismatch: diff.filter((entry) => entry.status === 'checksum_mismatch').length,
                        catalogOnly: diff.filter((entry) => entry.status === 'catalog_only').length
                    }
                },
                options
            )
            return
        }

        const payload =
            options.source === 'registered'
                ? exportRegisteredPlatformDefinitions()
                : await exportCatalogPlatformDefinitions(knex, options.outFile ?? 'stdout')

        await writeOutput(payload, options)
    } finally {
        await destroyKnex().catch(() => undefined)
    }
}

void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
})
