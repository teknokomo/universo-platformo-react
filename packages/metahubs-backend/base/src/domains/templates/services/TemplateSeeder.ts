import { createHash } from 'crypto'
import stableStringify from 'json-stable-stringify'
import type { MetahubTemplateManifest } from '@universo/types'
import type { DbExecutor } from '@universo/utils'
import {
    findTemplateByCodename,
    findTemplateVersionById,
    createTemplate,
    updateTemplate,
    createTemplateVersion,
    deactivateTemplateVersions,
    getMaxTemplateVersionNumber
} from '../../../persistence'
import type { SqlQueryable, TemplateRow } from '../../../persistence'
import { validateTemplateManifest } from './TemplateManifestValidator'
import { builtinTemplates } from '../data'

export interface TemplateSeederLogger {
    info(message: string, ...meta: unknown[]): void
    error(message: string, ...meta: unknown[]): void
}

export interface TemplateSeederOptions {
    failFast?: boolean
    logger?: TemplateSeederLogger
}

/**
 * Calculates SHA-256 hash of a template manifest for deduplication.
 * Uses json-stable-stringify for deterministic serialization.
 */
function calculateManifestHash(manifest: MetahubTemplateManifest): string {
    const payload = stableStringify(manifest)
    if (payload === undefined) {
        throw new Error('Failed to stringify manifest for hash calculation')
    }
    return createHash('sha256').update(payload).digest('hex')
}

/**
 * TemplateSeeder — seeds built-in templates into the database at startup.
 *
 * Idempotent: skips templates that haven't changed (via SHA-256 hash comparison).
 * Non-fatal: logs errors but does NOT crash the server if seeding fails.
 */
export class TemplateSeeder {
    constructor(private executor: DbExecutor, private options: TemplateSeederOptions = {}) {}

    /**
     * Seed all built-in templates. Call once at application startup.
     */
    async seed(): Promise<void> {
        const logger = this.options.logger ?? console
        const stats = { created: 0, updated: 0, skipped: 0, errors: 0 }

        for (const manifest of builtinTemplates) {
            try {
                // Validate manifest structure
                validateTemplateManifest(manifest)

                const result = await this.seedTemplate(manifest)
                stats[result]++
            } catch (error) {
                stats.errors++
                logger.error(`[TemplateSeeder] Error seeding template "${manifest.codename}":`, error)
                if (this.options.failFast) {
                    throw error
                }
            }
        }

        logger.info(
            `[TemplateSeeder] Seed complete: ${stats.created} created, ${stats.updated} updated, ${stats.skipped} skipped, ${stats.errors} errors`
        )
    }

    private async seedTemplate(manifest: MetahubTemplateManifest): Promise<'created' | 'updated' | 'skipped'> {
        const hash = calculateManifestHash(manifest)

        // Look up existing template by codename (excluding soft-deleted)
        const existing = await findTemplateByCodename(this.executor, manifest.codename)

        if (!existing) {
            return this.createNewTemplate(manifest, hash)
        }

        return this.updateTemplateIfChanged(existing, manifest, hash)
    }

    private async createNewTemplate(manifest: MetahubTemplateManifest, hash: string): Promise<'created'> {
        return this.executor.transaction(async (tx: SqlQueryable) => {
            // Create template record
            const savedTemplate = await createTemplate(tx, {
                codename: manifest.codename,
                name: manifest.name,
                description: manifest.description,
                icon: manifest.meta?.icon ?? null,
                isSystem: true,
                isActive: true,
                sortOrder: 0,
                userId: '' // system seeder — NULL in DB via empty string → store handles
            })

            // Create first version
            const savedVersion = await createTemplateVersion(tx, {
                templateId: savedTemplate.id,
                versionNumber: 1,
                versionLabel: manifest.version,
                minStructureVersion: manifest.minStructureVersion,
                manifestJson: manifest,
                manifestHash: hash,
                isActive: true,
                userId: '' // system seeder
            })

            // Set active version pointer
            await updateTemplate(tx, savedTemplate.id, {
                activeVersionId: savedVersion.id
            })
            ;(this.options.logger ?? console).info(`[TemplateSeeder] Created template "${manifest.codename}" v${manifest.version}`)
            return 'created' as const
        })
    }

    private async updateTemplateIfChanged(
        existing: TemplateRow,
        manifest: MetahubTemplateManifest,
        hash: string
    ): Promise<'updated' | 'skipped'> {
        // Check if active version has the same hash
        if (existing.activeVersionId) {
            const activeVersion = await findTemplateVersionById(this.executor, existing.activeVersionId)
            if (activeVersion && activeVersion.manifestHash === hash) {
                return 'skipped'
            }
        }

        return this.executor.transaction(async (tx: SqlQueryable) => {
            // Get max version number
            const maxVersionNum = await getMaxTemplateVersionNumber(tx, existing.id)
            const nextVersionNumber = maxVersionNum + 1

            // Deactivate current active versions
            await deactivateTemplateVersions(tx, existing.id)

            // Create new version
            const savedVersion = await createTemplateVersion(tx, {
                templateId: existing.id,
                versionNumber: nextVersionNumber,
                versionLabel: manifest.version,
                minStructureVersion: manifest.minStructureVersion,
                manifestJson: manifest,
                manifestHash: hash,
                isActive: true,
                userId: '' // system seeder
            })

            // Update template metadata + active version pointer
            await updateTemplate(tx, existing.id, {
                name: manifest.name,
                description: manifest.description,
                icon: manifest.meta?.icon ?? null,
                activeVersionId: savedVersion.id
            })
            ;(this.options.logger ?? console).info(
                `[TemplateSeeder] Updated template "${manifest.codename}" → v${manifest.version} (version #${nextVersionNumber})`
            )
            return 'updated' as const
        })
    }
}

/**
 * Convenience function to seed templates. Use in server startup.
 */
export async function seedTemplates(executor: DbExecutor, options?: TemplateSeederOptions): Promise<void> {
    const seeder = new TemplateSeeder(executor, options)
    await seeder.seed()
}
