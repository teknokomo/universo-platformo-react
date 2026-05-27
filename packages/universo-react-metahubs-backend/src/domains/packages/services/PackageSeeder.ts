import stableStringify from 'json-stable-stringify'
import type { DbExecutor } from '@universo-react/utils'
import { builtinPackageSeeds } from '../data'
import { upsertPackageRegistryItem } from '../../../persistence'

export interface PackageSeederLogger {
    info(message: string, ...meta: unknown[]): void
    error(message: string, ...meta: unknown[]): void
}

export interface PackageSeederOptions {
    failFast?: boolean
    logger?: PackageSeederLogger
}

export class PackageSeeder {
    constructor(private executor: DbExecutor, private options: PackageSeederOptions = {}) {}

    async seed(): Promise<void> {
        const logger = this.options.logger ?? console
        const stats = { upserted: 0, errors: 0 }

        for (const seed of builtinPackageSeeds) {
            try {
                await upsertPackageRegistryItem(this.executor, {
                    ...seed,
                    userId: null
                })
                stats.upserted++
            } catch (error) {
                stats.errors++
                logger.error(`[PackageSeeder] Error seeding package "${seed.packageName}" v${seed.version}:`, error)
                if (this.options.failFast) {
                    throw error
                }
            }
        }

        logger.info(`[PackageSeeder] Seed complete: ${stats.upserted} upserted, ${stats.errors} errors`)
    }
}

export async function seedPackages(executor: DbExecutor, options?: PackageSeederOptions): Promise<void> {
    const seeder = new PackageSeeder(executor, options)
    await seeder.seed()
}

export const builtinPackageSeedChecksumSource =
    stableStringify({
        kind: 'builtin-metahub-package-seed-migration',
        packages: builtinPackageSeeds.map((item) => ({
            packageName: item.packageName,
            version: item.version,
            source: item.source
        }))
    }) ?? 'builtin-metahub-package-seed-migration'
