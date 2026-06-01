import type { Knex } from 'knex'
import { createKnexExecutor } from '@universo-react/database'
import type { PlatformMigrationFile } from '@universo-react/migrations-core'
import {
    isLegacyBuiltinPackageSeed,
    legacyBuiltinPackageSeedChecksumSource,
    seedPackages
} from '../../domains/packages/services/PackageSeeder'

export const seedBuiltinPackagesMigration: PlatformMigrationFile = {
    id: 'SeedBuiltinMetahubPackages1800000000260',
    version: '1800000000260',
    scope: {
        kind: 'platform_schema',
        key: 'metahubs'
    },
    sourceKind: 'template_seed',
    checksumSource: legacyBuiltinPackageSeedChecksumSource,
    transactionMode: 'single',
    lockMode: 'transaction_advisory',
    summary: 'Seed built-in metahub packages through the unified platform migration flow',
    async up(ctx) {
        await seedPackages(createKnexExecutor(ctx.knex as Knex), {
            failFast: true,
            packageFilter: isLegacyBuiltinPackageSeed
        })
    }
}
