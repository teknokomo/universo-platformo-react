import type { DbExecutor } from '@universo/utils/database'
import type { BranchCopyOptions, MetahubCreateOptions, MetahubTemplateManifest, VersionedLocalizedContent } from '@universo/types'
import { normalizeBranchCopyOptions } from '@universo/utils'
import type { SqlQueryable, MetahubBranchRow, MetahubRow } from '../../../persistence/types'
import {
    findMetahubById,
    findMetahubForUpdate,
    findMetahubMembership,
    updateMetahubFieldsRaw,
    updateMetahubMember,
    findBranchByIdAndMetahub,
    findBranchByCodename,
    findBranchBySchemaName,
    findBranchForUpdate,
    createBranch as createBranchRow,
    updateBranch as updateBranchRow,
    deleteBranchById,
    getMaxBranchNumber,
    countMembersOnBranch,
    clearMemberActiveBranch,
    findTemplateVersionById
} from '../../../persistence'
import { validateTemplateManifest } from '../../templates/services/TemplateManifestValidator'
import { KnexClient, getDDLServices, uuidToLockKey, acquireAdvisoryLock, releaseAdvisoryLock } from '../../ddl'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { CURRENT_STRUCTURE_VERSION, semverToStructureVersion, structureVersionToSemver } from '../../metahubs/services/structureVersions'
import { escapeLikeWildcards } from '../../../utils'
import { OptimisticLockError } from '@universo/utils'
import { buildManagedDynamicSchemaName, isManagedDynamicSchemaName, quoteIdentifier } from '@universo/migrations-core'

export interface BranchListOptions {
    limit?: number
    offset?: number
    sortBy?: 'name' | 'codename' | 'created' | 'updated'
    sortOrder?: 'asc' | 'desc'
    search?: string
}

export interface BranchListAllOptions {
    sortBy?: 'name' | 'codename' | 'created' | 'updated'
    sortOrder?: 'asc' | 'desc'
    search?: string
}

export interface BlockingBranchUser {
    id: string
    userId: string
    email: string | null
    nickname: string | null
    role: string
}

type BranchCopyCompatibilityErrorCode = 'BRANCH_COPY_ENUM_REFERENCES' | 'BRANCH_COPY_DANGLING_REFERENCES'

class BranchCopyCompatibilityError extends Error {
    constructor(public readonly code: BranchCopyCompatibilityErrorCode) {
        super(code)
        this.name = 'BranchCopyCompatibilityError'
    }
}

export class MetahubBranchesService {
    constructor(private exec: DbExecutor) {}

    private get knex() {
        return KnexClient.getInstance()
    }

    private buildSchemaName(metahubId: string, branchNumber: number): string {
        return buildManagedDynamicSchemaName({ prefix: 'mhb', ownerId: metahubId, branchNumber })
    }

    private assertSafeSchemaName(schemaName: string): void {
        if (!schemaName.startsWith('mhb_') || !isManagedDynamicSchemaName(schemaName)) {
            throw new Error(`Invalid metahub schema name: ${schemaName}`)
        }
    }

    private async assertCopyCompatibility(exec: SqlQueryable, schemaName: string, options: BranchCopyOptions): Promise<void> {
        const keptKinds: string[] = []
        if (options.copyCatalogs) keptKinds.push('catalog')
        if (options.copySets) keptKinds.push('set')
        if (options.copyHubs) keptKinds.push('hub')
        if (options.copyEnumerations) keptKinds.push('enumeration')

        const removedKinds: string[] = []
        if (!options.copyCatalogs) removedKinds.push('catalog')
        if (!options.copySets) removedKinds.push('set')
        if (!options.copyHubs) removedKinds.push('hub')
        if (!options.copyEnumerations) removedKinds.push('enumeration')

        if (keptKinds.length === 0 || removedKinds.length === 0) return

        this.assertSafeSchemaName(schemaName)
        const schemaIdent = quoteIdentifier(schemaName)

        const rows = await exec.query<{ target_kind: string | null }>(
            `
                SELECT DISTINCT COALESCE(target.kind, attr.target_object_kind)::text AS target_kind
                FROM ${schemaIdent}._mhb_attributes attr
                INNER JOIN ${schemaIdent}._mhb_objects obj
                    ON obj.id = attr.object_id
                LEFT JOIN ${schemaIdent}._mhb_objects target
                    ON target.id = attr.target_object_id
                WHERE obj.kind = ANY($1::text[])
                  AND (
                      (attr.target_object_id IS NOT NULL AND target.kind = ANY($2::text[]))
                      OR attr.target_object_kind = ANY($2::text[])
                  )
                  AND COALESCE(attr._upl_deleted, false) = false
                  AND COALESCE(attr._mhb_deleted, false) = false
                  AND COALESCE(obj._upl_deleted, false) = false
                  AND COALESCE(obj._mhb_deleted, false) = false
                  AND (
                      attr.target_object_id IS NULL
                      OR (
                          COALESCE(target._upl_deleted, false) = false
                          AND COALESCE(target._mhb_deleted, false) = false
                      )
                  )
            `,
            [keptKinds, removedKinds]
        )

        const incompatibleKinds = new Set(rows.map((row) => row.target_kind).filter((kind): kind is string => typeof kind === 'string'))
        if (incompatibleKinds.size === 0) return

        if (incompatibleKinds.has('enumeration')) {
            throw new BranchCopyCompatibilityError('BRANCH_COPY_ENUM_REFERENCES')
        }

        throw new BranchCopyCompatibilityError('BRANCH_COPY_DANGLING_REFERENCES')
    }

    private async sanitizeHubReferencesInObjectConfigs(exec: SqlQueryable, schemaIdent: string, options: BranchCopyOptions): Promise<void> {
        if (options.copyHubs) return

        const kindsWithHubConfig: string[] = []
        if (options.copyCatalogs) kindsWithHubConfig.push('catalog')
        if (options.copySets) kindsWithHubConfig.push('set')
        if (options.copyEnumerations) kindsWithHubConfig.push('enumeration')
        if (kindsWithHubConfig.length === 0) return

        await exec.query(
            `
                UPDATE ${schemaIdent}._mhb_objects
                SET config = jsonb_set(
                    jsonb_set(
                        jsonb_set(COALESCE(config, '{}'::jsonb), '{hubs}', '[]'::jsonb, true),
                        '{isRequiredHub}',
                        'false'::jsonb,
                        true
                    ),
                    '{isSingleHub}',
                    'false'::jsonb,
                    true
                )
                WHERE kind = ANY($1::text[])
                  AND COALESCE(_upl_deleted, false) = false
                  AND COALESCE(_mhb_deleted, false) = false
            `,
            [kindsWithHubConfig]
        )
    }

    private async sanitizeHubParentReferences(exec: SqlQueryable, schemaIdent: string): Promise<void> {
        await exec.query(`
            UPDATE ${schemaIdent}._mhb_objects AS child
            SET config = jsonb_set(COALESCE(child.config, '{}'::jsonb), '{parentHubId}', 'null'::jsonb, true)
            WHERE child.kind = 'hub'
              AND COALESCE(child._upl_deleted, false) = false
              AND COALESCE(child._mhb_deleted, false) = false
              AND COALESCE(child.config->>'parentHubId', '') <> ''
              AND (
                  child.config->>'parentHubId' = child.id
                  OR NOT EXISTS (
                      SELECT 1
                      FROM ${schemaIdent}._mhb_objects AS parent
                      WHERE parent.kind = 'hub'
                        AND COALESCE(parent._upl_deleted, false) = false
                        AND COALESCE(parent._mhb_deleted, false) = false
                        AND parent.id = child.config->>'parentHubId'
                  )
              )
        `)
    }

    private async pruneClonedSchema(exec: SqlQueryable, schemaName: string, options: BranchCopyOptions): Promise<void> {
        this.assertSafeSchemaName(schemaName)
        const schemaIdent = quoteIdentifier(schemaName)

        if (!options.copyLayouts) {
            await exec.query(`DELETE FROM ${schemaIdent}._mhb_layouts`)
        }

        await this.sanitizeHubReferencesInObjectConfigs(exec, schemaIdent, options)

        const kindsToDelete: string[] = []
        if (!options.copyHubs) kindsToDelete.push('hub')
        if (!options.copyCatalogs) kindsToDelete.push('catalog')
        if (!options.copySets) kindsToDelete.push('set')
        if (!options.copyEnumerations) kindsToDelete.push('enumeration')

        if (kindsToDelete.length > 0) {
            await exec.query(`DELETE FROM ${schemaIdent}._mhb_objects WHERE kind = ANY($1::text[])`, [kindsToDelete])
        }

        // Ensure hubs never keep dangling/self parent links after prune.
        await this.sanitizeHubParentReferences(exec, schemaIdent)
    }

    private async cleanupSchemaWithDiagnostics(schemaName: string, context: string): Promise<string | null> {
        const { generator } = getDDLServices()
        try {
            await generator.dropSchema(schemaName)
            return null
        } catch (cleanupError) {
            const message = cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
            process.stderr.write(
                `[metahub-branches] Failed to cleanup schema after branch rollback: ${JSON.stringify({
                    schemaName,
                    context,
                    cleanupError: message
                })}\n`
            )
            return message
        }
    }

    /**
     * Loads the template manifest for a metahub entity with runtime validation.
     * Returns undefined if no template is assigned (initializeSchema will use default).
     */
    private async loadManifestForMetahub(
        metahub: MetahubRow,
        exec: SqlQueryable = this.exec
    ): Promise<MetahubTemplateManifest | undefined> {
        if (!metahub.templateVersionId) {
            return undefined
        }
        const version = await findTemplateVersionById(exec, metahub.templateVersionId)
        if (version?.manifestJson) {
            try {
                return validateTemplateManifest(version.manifestJson)
            } catch (error) {
                console.warn(`[MetahubBranchesService] Invalid manifest in template version ${version.id}, falling back to default:`, error)
                return undefined
            }
        }
        return undefined
    }

    private async resolveTemplateVersionInfo(
        templateVersionId: string | null | undefined,
        exec: SqlQueryable = this.exec
    ): Promise<{ templateVersionId: string | null; templateVersionLabel: string | null }> {
        if (!templateVersionId) {
            return { templateVersionId: null, templateVersionLabel: null }
        }

        const version = await findTemplateVersionById(exec, templateVersionId)
        return {
            templateVersionId,
            templateVersionLabel: version?.versionLabel ?? null
        }
    }

    async listBranches(metahubId: string, options: BranchListOptions = {}) {
        const { limit = 100, offset = 0, sortBy = 'updated', sortOrder = 'desc', search } = options
        const params: unknown[] = [metahubId]
        const conditions: string[] = ['b.metahub_id = $1']

        if (search) {
            const escapedSearch = escapeLikeWildcards(search.toLowerCase())
            params.push(`%${escapedSearch}%`)
            conditions.push(
                `(
                    COALESCE(b.name::text, '') ILIKE $${params.length}
                    OR COALESCE(b.description::text, '') ILIKE $${params.length}
                    OR COALESCE(b.codename, '') ILIKE $${params.length}
                )`
            )
        }

        const orderColumn =
            sortBy === 'name'
                ? "COALESCE(b.name->'locales'->>(b.name->>'_primary'), b.name->'locales'->>'en', '')"
                : sortBy === 'codename'
                ? 'b.codename'
                : sortBy === 'created'
                ? 'b._upl_created_at'
                : 'b._upl_updated_at'
        const orderDir = (sortOrder ?? 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

        params.push(limit, offset)
        const limitIdx = params.length - 1
        const offsetIdx = params.length

        const rows = await this.exec.query<MetahubBranchRow & { windowTotal: string }>(
            `SELECT
                b.id, b.metahub_id AS "metahubId", b.source_branch_id AS "sourceBranchId",
                b.name, b.description, b.codename, b.codename_localized AS "codenameLocalized",
                b.branch_number AS "branchNumber", b.schema_name AS "schemaName",
                b.structure_version AS "structureVersion",
                b.last_template_version_id AS "lastTemplateVersionId",
                b.last_template_version_label AS "lastTemplateVersionLabel",
                b.last_template_synced_at AS "lastTemplateSyncedAt",
                b._upl_created_at AS "_uplCreatedAt", b._upl_created_by AS "_uplCreatedBy",
                b._upl_updated_at AS "_uplUpdatedAt", b._upl_updated_by AS "_uplUpdatedBy",
                b._upl_version AS "_uplVersion",
                b._upl_archived AS "_uplArchived", b._upl_archived_at AS "_uplArchivedAt",
                b._upl_archived_by AS "_uplArchivedBy",
                b._upl_deleted AS "_uplDeleted", b._upl_deleted_at AS "_uplDeletedAt",
                b._upl_deleted_by AS "_uplDeletedBy",
                b._upl_purge_after AS "_uplPurgeAfter",
                b._upl_locked AS "_uplLocked", b._upl_locked_at AS "_uplLockedAt",
                b._upl_locked_by AS "_uplLockedBy", b._upl_locked_reason AS "_uplLockedReason",
                b._app_published AS "_appPublished", b._app_published_at AS "_appPublishedAt",
                b._app_published_by AS "_appPublishedBy",
                b._app_archived AS "_appArchived", b._app_archived_at AS "_appArchivedAt",
                b._app_archived_by AS "_appArchivedBy",
                b._app_deleted AS "_appDeleted", b._app_deleted_at AS "_appDeletedAt",
                b._app_deleted_by AS "_appDeletedBy",
                b._app_owner_id AS "_appOwnerId",
                b._app_access_level AS "_appAccessLevel",
                COUNT(*) OVER() AS "windowTotal"
             FROM metahubs.cat_metahub_branches b
             WHERE ${conditions.join(' AND ')}
             ORDER BY ${orderColumn} ${orderDir}
             LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
            params
        )

        const total = rows.length > 0 ? parseInt(String(rows[0].windowTotal), 10) : 0
        const branches: MetahubBranchRow[] = rows.map(({ windowTotal: _wt, ...row }) => row)
        return { branches, total }
    }

    async listAllBranches(metahubId: string, options: BranchListAllOptions = {}) {
        const { sortBy = 'updated', sortOrder = 'desc', search } = options
        const params: unknown[] = [metahubId]
        const conditions: string[] = ['b.metahub_id = $1']

        if (search) {
            const escapedSearch = escapeLikeWildcards(search.toLowerCase())
            params.push(`%${escapedSearch}%`)
            conditions.push(
                `(
                    COALESCE(b.name::text, '') ILIKE $${params.length}
                    OR COALESCE(b.description::text, '') ILIKE $${params.length}
                    OR COALESCE(b.codename, '') ILIKE $${params.length}
                )`
            )
        }

        const orderColumn =
            sortBy === 'name'
                ? "COALESCE(b.name->'locales'->>(b.name->>'_primary'), b.name->'locales'->>'en', '')"
                : sortBy === 'codename'
                ? 'b.codename'
                : sortBy === 'created'
                ? 'b._upl_created_at'
                : 'b._upl_updated_at'
        const orderDir = (sortOrder ?? 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC'

        const branches = await this.exec.query<MetahubBranchRow>(
            `SELECT
                b.id, b.metahub_id AS "metahubId", b.source_branch_id AS "sourceBranchId",
                b.name, b.description, b.codename, b.codename_localized AS "codenameLocalized",
                b.branch_number AS "branchNumber", b.schema_name AS "schemaName",
                b.structure_version AS "structureVersion",
                b.last_template_version_id AS "lastTemplateVersionId",
                b.last_template_version_label AS "lastTemplateVersionLabel",
                b.last_template_synced_at AS "lastTemplateSyncedAt",
                b._upl_created_at AS "_uplCreatedAt", b._upl_created_by AS "_uplCreatedBy",
                b._upl_updated_at AS "_uplUpdatedAt", b._upl_updated_by AS "_uplUpdatedBy",
                b._upl_version AS "_uplVersion",
                b._upl_archived AS "_uplArchived", b._upl_archived_at AS "_uplArchivedAt",
                b._upl_archived_by AS "_uplArchivedBy",
                b._upl_deleted AS "_uplDeleted", b._upl_deleted_at AS "_uplDeletedAt",
                b._upl_deleted_by AS "_uplDeletedBy",
                b._upl_purge_after AS "_uplPurgeAfter",
                b._upl_locked AS "_uplLocked", b._upl_locked_at AS "_uplLockedAt",
                b._upl_locked_by AS "_uplLockedBy", b._upl_locked_reason AS "_uplLockedReason",
                b._app_published AS "_appPublished", b._app_published_at AS "_appPublishedAt",
                b._app_published_by AS "_appPublishedBy",
                b._app_archived AS "_appArchived", b._app_archived_at AS "_appArchivedAt",
                b._app_archived_by AS "_appArchivedBy",
                b._app_deleted AS "_appDeleted", b._app_deleted_at AS "_appDeletedAt",
                b._app_deleted_by AS "_appDeletedBy",
                b._app_owner_id AS "_appOwnerId",
                b._app_access_level AS "_appAccessLevel"
             FROM metahubs.cat_metahub_branches b
             WHERE ${conditions.join(' AND ')}
             ORDER BY ${orderColumn} ${orderDir}`,
            params
        )
        return { branches, total: branches.length }
    }

    async getBranchById(metahubId: string, branchId: string): Promise<MetahubBranchRow | null> {
        return findBranchByIdAndMetahub(this.exec, branchId, metahubId)
    }

    async findByCodename(metahubId: string, codename: string): Promise<MetahubBranchRow | null> {
        return findBranchByCodename(this.exec, metahubId, codename)
    }

    async getDefaultBranchId(metahubId: string): Promise<string | null> {
        const metahub = await findMetahubById(this.exec, metahubId)
        return metahub?.defaultBranchId ?? null
    }

    async getUserActiveBranchId(metahubId: string, userId: string): Promise<string | null> {
        const member = await findMetahubMembership(this.exec, metahubId, userId)
        return member?.activeBranchId ?? null
    }

    async createInitialBranch(params: {
        metahubId: string
        name: VersionedLocalizedContent<string>
        description?: VersionedLocalizedContent<string> | null
        codename?: string
        createdBy?: string | null
        createOptions?: MetahubCreateOptions
    }): Promise<MetahubBranchRow> {
        const { metahubId, name, description, codename = 'main', createdBy, createOptions } = params
        const schemaService = new MetahubSchemaService(this.exec)
        const lockKey = uuidToLockKey(`${metahubId}:initial-branch`)
        const acquired = await acquireAdvisoryLock(this.knex, lockKey)
        if (!acquired) {
            throw new Error('Initial branch creation in progress')
        }

        const branchNumber = 1
        const schemaName = this.buildSchemaName(metahubId, branchNumber)
        try {
            const metahub = await findMetahubById(this.exec, metahubId)
            if (!metahub) {
                throw new Error('Metahub not found')
            }
            if (metahub.defaultBranchId) {
                throw new Error('Default branch is already configured')
            }

            // Load template manifest from the metahub's assigned template (if any)
            const manifest = await this.loadManifestForMetahub(metahub)
            const templateVersionInfo = await this.resolveTemplateVersionInfo(metahub.templateVersionId ?? null)
            await schemaService.initializeSchema(schemaName, manifest, createOptions)

            const structureVersion = structureVersionToSemver(
                manifest ? semverToStructureVersion(manifest.minStructureVersion) : CURRENT_STRUCTURE_VERSION
            )

            const savedBranch = await this.exec.transaction(async (tx) => {
                const lockedMetahub = await findMetahubForUpdate(tx, metahubId)
                if (!lockedMetahub) {
                    throw new Error('Metahub not found')
                }
                if (lockedMetahub.defaultBranchId) {
                    throw new Error('Default branch is already configured')
                }

                const saved = await createBranchRow(tx, {
                    metahubId,
                    name,
                    description: description ?? null,
                    codename,
                    branchNumber,
                    schemaName,
                    structureVersion,
                    lastTemplateVersionId: templateVersionInfo.templateVersionId,
                    lastTemplateVersionLabel: templateVersionInfo.templateVersionLabel,
                    lastTemplateSyncedAt: templateVersionInfo.templateVersionId ? new Date() : null,
                    userId: createdBy ?? ''
                })

                // Use raw update to avoid incrementing _upl_version
                await updateMetahubFieldsRaw(tx, metahubId, { defaultBranchId: saved.id, lastBranchNumber: branchNumber })

                return saved
            })

            return savedBranch
        } catch (error) {
            const existingBranch = await findBranchBySchemaName(this.exec, schemaName)
            if (!existingBranch) {
                const cleanupError = await this.cleanupSchemaWithDiagnostics(schemaName, 'createDefaultBranch')
                if (cleanupError) {
                    throw new Error(`Branch rollback cleanup failed for schema "${schemaName}": ${cleanupError}`)
                }
            }
            throw error
        } finally {
            await releaseAdvisoryLock(this.knex, lockKey)
        }
    }

    async createBranch(params: {
        metahubId: string
        sourceBranchId?: string | null
        codename: string
        codenameLocalized?: VersionedLocalizedContent<string> | null
        name: VersionedLocalizedContent<string>
        description?: VersionedLocalizedContent<string> | null
        copyOptions?: Partial<BranchCopyOptions>
        createdBy?: string | null
    }): Promise<MetahubBranchRow> {
        const { metahubId, sourceBranchId, codename, codenameLocalized, name, description, createdBy, copyOptions } = params
        const normalizedCopyOptions = normalizeBranchCopyOptions(copyOptions)
        const schemaService = new MetahubSchemaService(this.exec)

        // Use a dedicated lock namespace for branch creation.
        // This avoids contention with ensureSchema() read paths that use metahub-wide lock keys.
        const lockKey = uuidToLockKey(`${metahubId}:branch-create`)
        const acquired = await acquireAdvisoryLock(this.knex, lockKey)
        if (!acquired) {
            throw new Error('Branch creation in progress')
        }

        let schemaName: string | null = null
        let savedBranch: MetahubBranchRow | null = null
        try {
            await this.exec.transaction(async (tx) => {
                const metahub = await findMetahubForUpdate(tx, metahubId)
                if (!metahub) {
                    throw new Error('Metahub not found')
                }

                const sourceBranch = sourceBranchId ? await findBranchByIdAndMetahub(tx, sourceBranchId, metahubId) : null
                if (sourceBranchId && !sourceBranch) {
                    throw new Error('Source branch not found')
                }

                const maxBranchNumber = await getMaxBranchNumber(tx, metahubId)
                const baseBranchNumber = Math.max(metahub.lastBranchNumber ?? 0, Number.isFinite(maxBranchNumber) ? maxBranchNumber : 0)
                const nextNumber = baseBranchNumber + 1
                schemaName = this.buildSchemaName(metahubId, nextNumber)

                let branchStructureVersion: string
                let templateVersionSyncId: string | null = null
                let templateVersionSyncLabel: string | null = null
                let templateSyncedAt: Date | null = null

                if (sourceBranch) {
                    const { cloner } = getDDLServices()
                    await cloner.clone({
                        sourceSchema: sourceBranch.schemaName,
                        targetSchema: schemaName,
                        dropTargetSchemaIfExists: true,
                        createTargetSchema: true,
                        copyData: true
                    })
                    await this.assertCopyCompatibility(tx, schemaName, normalizedCopyOptions)
                    if (!normalizedCopyOptions.fullCopy) {
                        await this.pruneClonedSchema(tx, schemaName, normalizedCopyOptions)
                    }
                    branchStructureVersion = structureVersionToSemver(sourceBranch.structureVersion)
                    templateVersionSyncId = sourceBranch.lastTemplateVersionId ?? null
                    templateVersionSyncLabel = sourceBranch.lastTemplateVersionLabel ?? null
                    templateSyncedAt = sourceBranch.lastTemplateSyncedAt ?? null
                } else {
                    // Load template manifest for new branch from scratch
                    const manifest = await this.loadManifestForMetahub(metahub, tx)
                    await schemaService.initializeSchema(schemaName, manifest)
                    branchStructureVersion = structureVersionToSemver(
                        manifest ? semverToStructureVersion(manifest.minStructureVersion) : CURRENT_STRUCTURE_VERSION
                    )
                    const templateVersionInfo = await this.resolveTemplateVersionInfo(metahub.templateVersionId ?? null, tx)
                    templateVersionSyncId = templateVersionInfo.templateVersionId
                    templateVersionSyncLabel = templateVersionInfo.templateVersionLabel
                    templateSyncedAt = templateVersionInfo.templateVersionId ? new Date() : null
                }

                savedBranch = await createBranchRow(tx, {
                    metahubId,
                    sourceBranchId: sourceBranch?.id ?? null,
                    name,
                    description: description ?? null,
                    codename,
                    codenameLocalized: codenameLocalized ?? null,
                    branchNumber: nextNumber,
                    schemaName,
                    structureVersion: branchStructureVersion,
                    lastTemplateVersionId: templateVersionSyncId,
                    lastTemplateVersionLabel: templateVersionSyncLabel,
                    lastTemplateSyncedAt: templateSyncedAt,
                    userId: createdBy ?? ''
                })

                // Use raw update to avoid incrementing _upl_version on metahub
                await updateMetahubFieldsRaw(tx, metahubId, { lastBranchNumber: nextNumber })
            })

            if (!savedBranch) {
                throw new Error('Branch creation failed')
            }
            return savedBranch
        } catch (error) {
            if (schemaName) {
                const cleanupError = await this.cleanupSchemaWithDiagnostics(schemaName, 'createBranch')
                if (cleanupError) {
                    throw new Error(`Branch rollback cleanup failed for schema "${schemaName}": ${cleanupError}`)
                }
            }
            throw error
        } finally {
            await releaseAdvisoryLock(this.knex, lockKey)
        }
    }

    async updateBranch(
        metahubId: string,
        branchId: string,
        data: {
            codename?: string
            codenameLocalized?: VersionedLocalizedContent<string> | null
            name?: VersionedLocalizedContent<string>
            description?: VersionedLocalizedContent<string> | null
            expectedVersion?: number
            updatedBy?: string | null
        }
    ) {
        const branch = await findBranchByIdAndMetahub(this.exec, branchId, metahubId)
        if (!branch) {
            throw new Error('Branch not found')
        }

        // Optimistic locking check
        if (data.expectedVersion !== undefined) {
            const currentVersion = branch._uplVersion || 1
            if (currentVersion !== data.expectedVersion) {
                throw new OptimisticLockError({
                    entityId: branchId,
                    entityType: 'branch',
                    expectedVersion: data.expectedVersion,
                    actualVersion: currentVersion,
                    updatedAt: branch._uplUpdatedAt,
                    updatedBy: branch._uplUpdatedBy ?? null
                })
            }
        }

        const updated = await updateBranchRow(this.exec, branchId, {
            codename: data.codename,
            codenameLocalized: data.codenameLocalized,
            name: data.name,
            description: data.description,
            userId: data.updatedBy ?? undefined,
            expectedVersion: data.expectedVersion
        })

        return updated ?? branch
    }

    async activateBranch(metahubId: string, branchId: string, userId: string) {
        const branch = await findBranchByIdAndMetahub(this.exec, branchId, metahubId)
        if (!branch) {
            throw new Error('Branch not found')
        }

        const membership = await findMetahubMembership(this.exec, metahubId, userId)
        if (!membership) {
            throw new Error('Membership not found')
        }

        await updateMetahubMember(this.exec, membership.id, { activeBranchId: branch.id })
        MetahubSchemaService.setUserBranchCache(metahubId, userId, branch.id)

        return branch
    }

    async setDefaultBranch(metahubId: string, branchId: string): Promise<MetahubBranchRow> {
        const branch = await findBranchByIdAndMetahub(this.exec, branchId, metahubId)
        if (!branch) {
            throw new Error('Branch not found')
        }

        await updateMetahubFieldsRaw(this.exec, metahubId, { defaultBranchId: branchId })
        MetahubSchemaService.clearUserBranchCache(metahubId)
        return branch
    }

    async getBranchLineage(
        metahubId: string,
        branchId: string
    ): Promise<{
        sourceBranchId: string | null
        sourceChain: Array<{
            id: string
            codename?: string | null
            name?: VersionedLocalizedContent<string> | null
            isMissing?: boolean
        }>
    }> {
        const branch = await findBranchByIdAndMetahub(this.exec, branchId, metahubId)
        if (!branch) {
            throw new Error('Branch not found')
        }

        const chain: Array<{
            id: string
            codename?: string | null
            name?: VersionedLocalizedContent<string> | null
            isMissing?: boolean
        }> = []

        let currentId = branch.sourceBranchId ?? null
        const visited = new Set<string>()

        while (currentId) {
            if (visited.has(currentId)) break
            visited.add(currentId)

            const source = await findBranchByIdAndMetahub(this.exec, currentId, metahubId)
            if (!source) {
                chain.push({ id: currentId, isMissing: true })
                break
            }

            chain.push({
                id: source.id,
                codename: source.codename,
                name: source.name
            })

            currentId = source.sourceBranchId ?? null
        }

        return {
            sourceBranchId: branch.sourceBranchId ?? null,
            sourceChain: chain
        }
    }

    async getBlockingUsers(metahubId: string, branchId: string, excludeUserId?: string): Promise<BlockingBranchUser[]> {
        const params: unknown[] = [metahubId, branchId]
        let excludeClause = ''
        if (excludeUserId) {
            params.push(excludeUserId)
            excludeClause = `AND mu.user_id <> $${params.length}`
        }

        return this.exec.query<BlockingBranchUser>(
            `SELECT
                mu.id,
                mu.user_id AS "userId",
                au.email,
                p.nickname,
                mu.role
             FROM metahubs.rel_metahub_users mu
             LEFT JOIN auth.users au ON au.id = mu.user_id
             LEFT JOIN profiles.cat_profiles p ON p.user_id = mu.user_id AND p._upl_deleted = false AND p._app_deleted = false
             WHERE mu.metahub_id = $1
               AND mu.active_branch_id = $2
               ${excludeClause}`,
            params
        )
    }

    async deleteBranch(params: { metahubId: string; branchId: string; requesterId: string }): Promise<void> {
        const { metahubId, branchId, requesterId } = params
        const lockKey = uuidToLockKey(`${metahubId}:${branchId}:branch-delete`)
        const acquired = await acquireAdvisoryLock(this.knex, lockKey)
        if (!acquired) {
            throw new Error('Branch deletion in progress')
        }

        try {
            await this.exec.transaction(async (tx) => {
                const metahub = await findMetahubForUpdate(tx, metahubId)
                if (!metahub) {
                    throw new Error('Metahub not found')
                }
                if (metahub.defaultBranchId === branchId) {
                    throw new Error('Default branch cannot be deleted')
                }

                const branch = await findBranchForUpdate(tx, branchId, metahubId)
                if (!branch) {
                    throw new Error('Branch not found')
                }

                const blockingUsersCount = await countMembersOnBranch(tx, metahubId, branchId, requesterId)
                if (blockingUsersCount > 0) {
                    throw new Error('Branch is active for other users')
                }

                // Clear active branch for requester if it matches this branch.
                await clearMemberActiveBranch(tx, metahubId, requesterId, branchId)

                // Drop schema and delete branch row in the same DB transaction to avoid divergent states.
                this.assertSafeSchemaName(branch.schemaName)
                await tx.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(branch.schemaName)} CASCADE`)
                await deleteBranchById(tx, branchId, metahubId, requesterId)
            })

            MetahubSchemaService.clearCache(metahubId)
        } finally {
            await releaseAdvisoryLock(this.knex, lockKey)
        }
    }
}
