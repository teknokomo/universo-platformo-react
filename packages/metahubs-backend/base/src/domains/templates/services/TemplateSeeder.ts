import { createHash } from 'crypto'
import type { DataSource, Repository } from 'typeorm'
import stableStringify from 'json-stable-stringify'
import type { MetahubTemplateManifest } from '@universo/types'
import { Template } from '../../../database/entities/Template'
import { TemplateVersion } from '../../../database/entities/TemplateVersion'
import { validateTemplateManifest } from './TemplateManifestValidator'
import { builtinTemplates } from '../data'

/**
 * System seeder does not set audit user fields.
 * Undefined means "created by the system" — the DB column is UUID nullable,
 * and TypeORM will leave it as NULL when undefined is passed.
 */
const SYSTEM_SEEDER_ID = undefined

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
    private templateRepo: Repository<Template>
    private versionRepo: Repository<TemplateVersion>

    constructor(private dataSource: DataSource) {
        this.templateRepo = dataSource.getRepository(Template)
        this.versionRepo = dataSource.getRepository(TemplateVersion)
    }

    /**
     * Seed all built-in templates. Call once at application startup.
     */
    async seed(): Promise<void> {
        const stats = { created: 0, updated: 0, skipped: 0, errors: 0 }

        for (const manifest of builtinTemplates) {
            try {
                // Validate manifest structure
                validateTemplateManifest(manifest)

                const result = await this.seedTemplate(manifest)
                stats[result]++
            } catch (error) {
                stats.errors++
                console.error(`[TemplateSeeder] Error seeding template "${manifest.codename}":`, error)
            }
        }

        console.info(
            `[TemplateSeeder] Seed complete: ${stats.created} created, ${stats.updated} updated, ${stats.skipped} skipped, ${stats.errors} errors`
        )
    }

    private async seedTemplate(manifest: MetahubTemplateManifest): Promise<'created' | 'updated' | 'skipped'> {
        const hash = calculateManifestHash(manifest)

        // Look up existing template by codename (excluding soft-deleted)
        const existing = await this.templateRepo.findOne({
            where: { codename: manifest.codename, _uplDeleted: false }
        })

        if (!existing) {
            return this.createTemplate(manifest, hash)
        }

        return this.updateTemplateIfChanged(existing, manifest, hash)
    }

    private async createTemplate(manifest: MetahubTemplateManifest, hash: string): Promise<'created'> {
        return this.dataSource.transaction(async (manager) => {
            const templateRepo = manager.getRepository(Template)
            const versionRepo = manager.getRepository(TemplateVersion)

            // Create template record
            const template = templateRepo.create({
                codename: manifest.codename,
                name: manifest.name,
                description: manifest.description,
                icon: manifest.meta?.icon ?? null,
                isSystem: true,
                isActive: true,
                sortOrder: 0,
                _uplCreatedBy: SYSTEM_SEEDER_ID,
                _uplUpdatedBy: SYSTEM_SEEDER_ID
            })
            const savedTemplate = await templateRepo.save(template)

            // Create first version
            const version = versionRepo.create({
                templateId: savedTemplate.id,
                versionNumber: 1,
                versionLabel: manifest.version,
                minStructureVersion: manifest.minStructureVersion,
                manifestJson: manifest,
                manifestHash: hash,
                isActive: true,
                _uplCreatedBy: SYSTEM_SEEDER_ID,
                _uplUpdatedBy: SYSTEM_SEEDER_ID
            })
            const savedVersion = await versionRepo.save(version)

            // Set active version pointer
            await templateRepo.update(savedTemplate.id, { activeVersionId: savedVersion.id })

            console.info(`[TemplateSeeder] Created template "${manifest.codename}" v${manifest.version}`)
            return 'created' as const
        })
    }

    private async updateTemplateIfChanged(
        existing: Template,
        manifest: MetahubTemplateManifest,
        hash: string
    ): Promise<'updated' | 'skipped'> {
        // Check if active version has the same hash
        if (existing.activeVersionId) {
            const activeVersion = await this.versionRepo.findOne({
                where: { id: existing.activeVersionId }
            })
            if (activeVersion && activeVersion.manifestHash === hash) {
                return 'skipped'
            }
        }

        return this.dataSource.transaction(async (manager) => {
            const templateRepo = manager.getRepository(Template)
            const versionRepo = manager.getRepository(TemplateVersion)

            // Get max version number
            const maxVersion = await versionRepo
                .createQueryBuilder('v')
                .select('MAX(v.versionNumber)', 'max')
                .where('v.templateId = :templateId', { templateId: existing.id })
                .getRawOne()
            const nextVersionNumber = ((maxVersion?.max as number) ?? 0) + 1

            // Deactivate current active version
            await versionRepo
                .createQueryBuilder()
                .update()
                .set({ isActive: false })
                .where('templateId = :templateId AND isActive = true', { templateId: existing.id })
                .execute()

            // Create new version
            const version = versionRepo.create({
                templateId: existing.id,
                versionNumber: nextVersionNumber,
                versionLabel: manifest.version,
                minStructureVersion: manifest.minStructureVersion,
                manifestJson: manifest,
                manifestHash: hash,
                isActive: true,
                _uplCreatedBy: SYSTEM_SEEDER_ID,
                _uplUpdatedBy: SYSTEM_SEEDER_ID
            })
            const savedVersion = await versionRepo.save(version)

            // Update template metadata + active version pointer
            await templateRepo.update(existing.id, {
                name: manifest.name,
                description: manifest.description,
                icon: manifest.meta?.icon ?? null,
                activeVersionId: savedVersion.id,
                _uplUpdatedBy: SYSTEM_SEEDER_ID
            })

            console.info(`[TemplateSeeder] Updated template "${manifest.codename}" → v${manifest.version} (version #${nextVersionNumber})`)
            return 'updated' as const
        })
    }
}

/**
 * Convenience function to seed templates. Use in server startup.
 */
export async function seedTemplates(dataSource: DataSource): Promise<void> {
    const seeder = new TemplateSeeder(dataSource)
    await seeder.seed()
}
