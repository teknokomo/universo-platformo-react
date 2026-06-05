import stableStringify from 'json-stable-stringify'
import type { DbExecutor } from '@universo-react/utils'
import { builtinPackageSeeds } from '../data'
import { upsertPackageRegistryItem } from '../../../persistence'
import { resolvePackageAuthoringSurface } from './packageConfigValidation'

export const playCanvasEditorPackageName = `@universo-react/${'playcanvas-editor-frontend'}`
type BuiltinPackageSeed = (typeof builtinPackageSeeds)[number]

export interface PackageSeederLogger {
    info(message: string, ...meta: unknown[]): void
    error(message: string, ...meta: unknown[]): void
}

export interface PackageSeederOptions {
    failFast?: boolean
    logger?: PackageSeederLogger
    packageFilter?: (seed: BuiltinPackageSeed) => boolean
}

export class PackageSeeder {
    constructor(private executor: DbExecutor, private options: PackageSeederOptions = {}) {}

    async seed(): Promise<void> {
        const logger = this.options.logger ?? console
        const stats = { upserted: 0, errors: 0 }
        const packageSlugOwners = new Map<string, string>()

        const seeds = this.options.packageFilter ? builtinPackageSeeds.filter(this.options.packageFilter) : builtinPackageSeeds

        for (const seed of seeds) {
            try {
                const authoringSurface = resolvePackageAuthoringSurface(seed.authoringSurface)
                if (authoringSurface.kind === 'playcanvasEditor') {
                    const owner = packageSlugOwners.get(authoringSurface.packageSlug)
                    if (owner && owner !== seed.packageName) {
                        throw new Error(`Package authoring surface slug "${authoringSurface.packageSlug}" is already used by "${owner}"`)
                    }
                    packageSlugOwners.set(authoringSurface.packageSlug, seed.packageName)
                }

                await upsertPackageRegistryItem(this.executor, {
                    ...seed,
                    authoringSurface,
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

export const legacyBuiltinPackageSeedChecksumSource =
    stableStringify({
        kind: 'builtin-metahub-package-seed-migration',
        packages: builtinPackageSeeds
            .filter((item) => item.packageName !== playCanvasEditorPackageName)
            .map((item) => ({
                packageName: item.packageName,
                version: item.version,
                source: item.source
            }))
    }) ?? 'builtin-metahub-package-seed-migration'

export const packageAuthoringSettingsSeedChecksumSource =
    stableStringify({
        kind: 'builtin-metahub-package-authoring-settings-seed-migration',
        package: builtinPackageSeeds.find((item) => item.packageName === playCanvasEditorPackageName)
    }) ?? 'builtin-metahub-package-authoring-settings-seed-migration'

export const isLegacyBuiltinPackageSeed = (seed: BuiltinPackageSeed): boolean => seed.packageName !== playCanvasEditorPackageName
