import type { Knex } from 'knex'
import stableStringify from 'json-stable-stringify'
import { createKnexExecutor } from '@universo/database'
import type { PlatformMigrationFile } from '@universo/migrations-core'
import { builtinTemplateDefinitions } from '../../domains/templates/data'
import { seedTemplates } from '../../domains/templates/services/TemplateSeeder'

const builtinTemplateSeedChecksumSource =
    stableStringify({
        kind: 'builtin-metahub-template-seed-migration',
        templates: builtinTemplateDefinitions.map((template) => ({
            definitionType: template.definitionType,
            codename: template.manifest.codename,
            version: template.manifest.version,
            minStructureVersion: template.manifest.minStructureVersion
        }))
    }) ?? 'builtin-metahub-template-seed-migration'

export const seedBuiltinTemplatesMigration: PlatformMigrationFile = {
    id: 'SeedBuiltinMetahubTemplates1800000000250',
    version: '1800000000250',
    scope: {
        kind: 'platform_schema',
        key: 'metahubs'
    },
    sourceKind: 'template_seed',
    checksumSource: builtinTemplateSeedChecksumSource,
    transactionMode: 'single',
    lockMode: 'transaction_advisory',
    summary: 'Seed built-in metahub templates through the unified platform migration flow',
    async up(ctx) {
        await seedTemplates(createKnexExecutor(ctx.knex as Knex), {
            failFast: true
        })
    }
}
