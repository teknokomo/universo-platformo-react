import { writeFile } from 'fs/promises'
import { resolve } from 'path'
import { destroyKnex, getKnex } from '@universo/database'
import { isGlobalMigrationCatalogEnabled } from '@universo/utils'
import {
    type RegisteredPlatformDoctorResult,
    doctorRegisteredPlatformState,
    diffRegisteredPlatformDefinitions,
    diffRegisteredSystemAppCompiledDefinitions,
    diffRegisteredSystemAppManifestDefinitions,
    diffRegisteredSystemAppSchemaPlanDefinitions,
    exportCatalogSystemAppCompiledDefinitionBundle,
    exportCatalogSystemAppManifestDefinitionBundle,
    exportCatalogSystemAppSchemaPlanDefinitionBundle,
    exportCatalogPlatformDefinitionBundle,
    exportRegisteredPlatformDefinitionBundle,
    exportRegisteredSystemAppCompiledDefinitionBundle,
    exportRegisteredSystemAppManifestDefinitionBundle,
    exportRegisteredSystemAppSchemaPlanDefinitionBundle,
    importPlatformDefinitionsFromFile,
    lintRegisteredPlatformDefinitions,
    lintRegisteredSystemAppCompiledDefinitions,
    lintRegisteredSystemAppManifestDefinitions,
    lintRegisteredSystemAppSchemaPlanDefinitions,
    planRegisteredPlatformMigrations,
    globalMigrationCatalogDisabledMessage,
    syncRegisteredPlatformDefinitionsToCatalog,
    validateRegisteredPlatformMigrations
} from './platformMigrations'
import {
    applyRegisteredSystemAppSchemaGenerationPlans,
    bootstrapRegisteredSystemAppStructureMetadata,
    compileRegisteredSystemAppSchemaDefinitionArtifacts,
    planRegisteredSystemAppSchemaGenerationPlans
} from './systemAppSchemaCompiler'

const isGlobalMigrationCatalogEnabledForCli = (): boolean => isGlobalMigrationCatalogEnabled()

export type CliCommand =
    | 'status'
    | 'plan'
    | 'diff'
    | 'export'
    | 'validate'
    | 'lint'
    | 'doctor'
    | 'import'
    | 'sync'
    | 'system-app-schema-plan'
    | 'system-app-schema-apply'
    | 'system-app-schema-bootstrap'
export type CliSource =
    | 'catalog-platform'
    | 'registered-platform'
    | 'catalog-system-app-manifests'
    | 'registered-system-app-manifests'
    | 'catalog-system-app-schema-plans'
    | 'registered-system-app-schema-plans'
    | 'catalog-system-app-compiled'
    | 'registered-system-app-compiled'

export interface CliOptions {
    outFile: string | null
    inFile: string | null
    source: CliSource
    stage: 'current' | 'target'
    keys: string[] | null
}

export const definitionDiffSummary = (diff: Array<{ status: 'match' | 'missing_in_catalog' | 'checksum_mismatch' | 'catalog_only' }>) => ({
    match: diff.filter((entry) => entry.status === 'match').length,
    missingInCatalog: diff.filter((entry) => entry.status === 'missing_in_catalog').length,
    checksumMismatch: diff.filter((entry) => entry.status === 'checksum_mismatch').length,
    catalogOnly: diff.filter((entry) => entry.status === 'catalog_only').length
})

export const isSystemAppManifestSource = (source: CliSource): boolean =>
    source === 'catalog-system-app-manifests' || source === 'registered-system-app-manifests'

export const isSystemAppSchemaPlanSource = (source: CliSource): boolean =>
    source === 'catalog-system-app-schema-plans' || source === 'registered-system-app-schema-plans'

export const isSystemAppCompiledSource = (source: CliSource): boolean =>
    source === 'catalog-system-app-compiled' || source === 'registered-system-app-compiled'

const isCatalogBackedSource = (source: CliSource): boolean => source.startsWith('catalog-')

export const isDoctorResultHealthy = (doctor: RegisteredPlatformDoctorResult): boolean =>
    doctor.systemAppDefinitionsValidation.ok &&
    doctor.systemAppSchemaGenerationPlansValidation.ok &&
    (doctor.systemAppCompiledDefinitionsValidation?.ok ?? true) &&
    doctor.legacyFixedSchemaTables.ok &&
    doctor.systemAppStructureMetadataInspection.ok &&
    doctor.migrationsValidation.ok &&
    doctor.definitionsLint.ok &&
    doctor.systemAppManifestLint.ok &&
    doctor.systemAppSchemaPlanLint.ok &&
    doctor.systemAppCompiledLint.ok &&
    doctor.definitionsDiff.every((entry) => entry.status === 'match') &&
    doctor.systemAppManifestDiff.every((entry) => entry.status === 'match') &&
    doctor.systemAppSchemaPlanDiff.every((entry) => entry.status === 'match') &&
    doctor.systemAppCompiledDiff.every((entry) => entry.status === 'match') &&
    doctor.catalogLifecycle.ok &&
    doctor.systemAppManifestCatalogLifecycle.ok &&
    doctor.systemAppSchemaPlanCatalogLifecycle.ok &&
    doctor.systemAppCompiledCatalogLifecycle.ok

export const parseArgs = (argv: string[]): { command: CliCommand; options: CliOptions } => {
    const [commandArg, ...rest] = argv
    const command = (commandArg ?? 'status') as CliCommand

    if (
        ![
            'status',
            'plan',
            'diff',
            'export',
            'validate',
            'lint',
            'doctor',
            'import',
            'sync',
            'system-app-schema-plan',
            'system-app-schema-apply',
            'system-app-schema-bootstrap'
        ].includes(command)
    ) {
        throw new Error(`Unknown migration command: ${commandArg ?? '<empty>'}`)
    }

    const options: CliOptions = {
        outFile: null,
        inFile: null,
        source: 'catalog-platform',
        stage: 'target',
        keys: null
    }

    for (const arg of rest) {
        if (arg.startsWith('--out=')) {
            options.outFile = resolve(arg.slice('--out='.length))
        }
        if (arg.startsWith('--in=')) {
            options.inFile = resolve(arg.slice('--in='.length))
        }
        if (arg.startsWith('--source=')) {
            const source = arg.slice('--source='.length)
            if (
                source === 'catalog-platform' ||
                source === 'registered-platform' ||
                source === 'catalog-system-app-manifests' ||
                source === 'registered-system-app-manifests' ||
                source === 'catalog-system-app-schema-plans' ||
                source === 'registered-system-app-schema-plans' ||
                source === 'catalog-system-app-compiled' ||
                source === 'registered-system-app-compiled'
            ) {
                options.source = source
            }
        }
        if (arg.startsWith('--stage=')) {
            const stage = arg.slice('--stage='.length)
            if (stage === 'current' || stage === 'target') {
                options.stage = stage
            }
        }
        if (arg.startsWith('--keys=')) {
            const keys = arg
                .slice('--keys='.length)
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean)
            options.keys = keys.length > 0 ? keys : null
        }
    }

    return { command, options }
}

const writeOutput = async (payload: unknown, options: CliOptions): Promise<void> => {
    const serialized = JSON.stringify(payload, null, 2)

    if (options.outFile) {
        await writeFile(options.outFile, `${serialized}\n`, 'utf8')
        process.stdout.write(`${options.outFile}\n`)
        return
    }

    process.stdout.write(`${serialized}\n`)
}

const resolveExportPayload = async (knex: ReturnType<typeof getKnex>, options: CliOptions) => {
    if (options.source === 'registered-platform') {
        return exportRegisteredPlatformDefinitionBundle()
    }

    if (options.source === 'registered-system-app-manifests') {
        return exportRegisteredSystemAppManifestDefinitionBundle()
    }

    if (options.source === 'registered-system-app-schema-plans') {
        return exportRegisteredSystemAppSchemaPlanDefinitionBundle()
    }

    if (options.source === 'registered-system-app-compiled') {
        return exportRegisteredSystemAppCompiledDefinitionBundle()
    }

    if (options.source === 'catalog-system-app-manifests') {
        return exportCatalogSystemAppManifestDefinitionBundle(knex, options.outFile ?? 'stdout')
    }

    if (options.source === 'catalog-system-app-schema-plans') {
        return exportCatalogSystemAppSchemaPlanDefinitionBundle(knex, options.outFile ?? 'stdout')
    }

    if (options.source === 'catalog-system-app-compiled') {
        return exportCatalogSystemAppCompiledDefinitionBundle(knex, options.outFile ?? 'stdout')
    }

    return exportCatalogPlatformDefinitionBundle(knex, options.outFile ?? 'stdout')
}

const resolveDiffEntries = async (knex: ReturnType<typeof getKnex>, source: CliSource) => {
    if (isSystemAppManifestSource(source)) {
        return diffRegisteredSystemAppManifestDefinitions(knex)
    }

    if (isSystemAppSchemaPlanSource(source)) {
        return diffRegisteredSystemAppSchemaPlanDefinitions(knex)
    }

    if (isSystemAppCompiledSource(source)) {
        return diffRegisteredSystemAppCompiledDefinitions(knex)
    }

    return diffRegisteredPlatformDefinitions(knex)
}

const resolveLintResult = (source: CliSource) => {
    if (isSystemAppManifestSource(source)) {
        return lintRegisteredSystemAppManifestDefinitions()
    }

    if (isSystemAppSchemaPlanSource(source)) {
        return lintRegisteredSystemAppSchemaPlanDefinitions()
    }

    if (isSystemAppCompiledSource(source)) {
        return lintRegisteredSystemAppCompiledDefinitions()
    }

    return lintRegisteredPlatformDefinitions()
}

export const main = async () => {
    const { command, options } = parseArgs(process.argv.slice(2))
    const knex = getKnex()
    const globalCatalogEnabled = isGlobalMigrationCatalogEnabledForCli()

    try {
        if (!globalCatalogEnabled) {
            if (command === 'doctor') {
                const migrationPlan = await planRegisteredPlatformMigrations(knex)
                await writeOutput(
                    {
                        ok: true,
                        catalogEnabled: false,
                        status: 'disabled_by_config',
                        message: globalMigrationCatalogDisabledMessage,
                        migrationPlan
                    },
                    options
                )
                return
            }

            if (
                command === 'diff' ||
                command === 'import' ||
                command === 'sync' ||
                (command === 'export' && isCatalogBackedSource(options.source))
            ) {
                throw new Error(`${globalMigrationCatalogDisabledMessage}. This command requires catalog-backed definition storage.`)
            }
        }

        if (command === 'status' || command === 'plan') {
            const plan = await planRegisteredPlatformMigrations(knex)
            const payload =
                command === 'status'
                    ? {
                          dryRun: plan.dryRun,
                          counts: {
                              apply: plan.planned.filter((entry: (typeof plan.planned)[number]) => entry.action === 'apply').length,
                              skip: plan.planned.filter((entry: (typeof plan.planned)[number]) => entry.action === 'skip').length,
                              drift: plan.planned.filter((entry: (typeof plan.planned)[number]) => entry.action === 'drift').length,
                              blocked: plan.planned.filter((entry: (typeof plan.planned)[number]) => entry.action === 'blocked').length
                          },
                          planned: plan.planned
                      }
                    : plan

            await writeOutput(payload, options)
            return
        }

        if (command === 'diff') {
            const diff = await resolveDiffEntries(knex, options.source)
            await writeOutput(
                {
                    source: options.source,
                    entries: diff,
                    summary: definitionDiffSummary(diff)
                },
                options
            )
            return
        }

        if (command === 'validate') {
            const validation = validateRegisteredPlatformMigrations()
            await writeOutput(validation, options)
            if (!validation.ok) {
                process.exitCode = 1
            }
            return
        }

        if (command === 'lint') {
            const lint = resolveLintResult(options.source)
            await writeOutput(lint, options)
            if (!lint.ok) {
                process.exitCode = 1
            }
            return
        }

        if (command === 'doctor') {
            const doctor = await doctorRegisteredPlatformState(knex)
            await writeOutput(doctor, options)
            if (!isDoctorResultHealthy(doctor)) {
                process.exitCode = 1
            }
            return
        }

        if (command === 'import') {
            if (!options.inFile) {
                throw new Error('The import command requires --in=/absolute/path/to/definitions.json')
            }

            const imported = await importPlatformDefinitionsFromFile(knex, options.inFile, {
                importCommand: 'migration import'
            })
            await writeOutput(imported, options)
            return
        }

        if (command === 'sync') {
            const synced = await syncRegisteredPlatformDefinitionsToCatalog(knex, {
                source: 'migration-cli-sync',
                syncCommand: 'migration sync'
            })
            await writeOutput(synced, options)
            return
        }

        if (command === 'system-app-schema-apply') {
            const applied = await applyRegisteredSystemAppSchemaGenerationPlans(knex, {
                stage: options.stage,
                keys: options.keys ?? undefined
            })
            await writeOutput(applied, options)
            return
        }

        if (command === 'system-app-schema-bootstrap') {
            const bootstrapped = await bootstrapRegisteredSystemAppStructureMetadata(knex, {
                stage: options.stage,
                keys: options.keys ?? undefined
            })
            await writeOutput(bootstrapped, options)
            return
        }

        if (command === 'system-app-schema-plan') {
            const plans = planRegisteredSystemAppSchemaGenerationPlans(options.stage, options.keys ?? undefined)
            const compiledArtifacts = compileRegisteredSystemAppSchemaDefinitionArtifacts(options.stage, options.keys ?? undefined)
            await writeOutput({ stage: options.stage, plans, compiledArtifacts }, options)
            return
        }

        const payload = await resolveExportPayload(knex, options)
        await writeOutput(payload, options)
    } finally {
        try {
            await destroyKnex()
        } catch (destroyError) {
            process.stderr.write(
                `[migration-cli] Failed to destroy Knex runtime: ${
                    destroyError instanceof Error ? destroyError.message : String(destroyError)
                }\n`
            )
        }
    }
}

if (require.main === module) {
    void main().catch((error) => {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
        process.exitCode = 1
    })
}
