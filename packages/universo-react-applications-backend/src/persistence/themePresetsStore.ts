import { OptimisticLockError, type SqlQueryable } from '@universo-react/utils'
import { qSchemaTable } from '@universo-react/database'

/**
 * SQL-first store for application-scoped theme presets (TZ §10.1). All queries are
 * schema-qualified and parameterized; mutations use RETURNING and fail closed
 * on zero-row results.
 */

export interface ThemePresetRecord {
    id: string
    applicationId: string
    codename: string
    name: Record<string, string>
    description: Record<string, string>
    tokens: unknown
    basePresetId: string | null
    basePresetCodename: string | null
    schemaVersion: number
    version: number
    archived: boolean
    createdAt: Date
    updatedAt: Date
}

export interface CreateThemePresetStoreInput {
    applicationId: string
    codename: string
    name: Record<string, string>
    description: Record<string, string>
    tokens: unknown
    basePresetId: string | null
    basePresetCodename: string | null
    actor: string
}

export interface UpdateThemePresetStoreInput {
    applicationId: string
    presetId: string
    expectedVersion: number
    name?: Record<string, string>
    description?: Record<string, string>
    tokens?: unknown
    actor: string
}

export interface ArchiveThemePresetStoreInput {
    applicationId: string
    presetId: string
    expectedVersion: number
    actor: string
}

export interface ThemePresetAuditInput {
    applicationId: string
    presetId: string | null
    eventType: string
    changedFields: string[]
    previousVersion: number | null
    newVersion: number | null
    actor: string
}

export class ThemePresetNotFoundError extends Error {
    readonly statusCode = 404
    readonly code = 'THEME_PRESET_NOT_FOUND'
    constructor() {
        super('Theme preset was not found in this application scope')
        this.name = 'ThemePresetNotFoundError'
    }
}

export class ThemePresetCodenameConflictError extends Error {
    readonly statusCode = 409
    readonly code = 'THEME_PRESET_CODENAME_CONFLICT'
    constructor(readonly codename: string) {
        super(`Theme preset codename "${codename}" is already used in this application scope`)
        this.name = 'ThemePresetCodenameConflictError'
    }
}

export class ThemePresetLimitReachedError extends Error {
    readonly statusCode = 409
    readonly code = 'THEME_PRESET_LIMIT_REACHED'
    constructor(readonly limit: number) {
        super(`Theme preset limit of ${limit} per application has been reached`)
        this.name = 'ThemePresetLimitReachedError'
    }
}

const THEME_PRESET_COLUMNS = `
    p.id,
    p.application_id AS "applicationId",
    p.codename,
    p.name,
    p.description,
    p.tokens,
    p.base_preset_id AS "basePresetId",
    p.base_preset_codename AS "basePresetCodename",
    COALESCE(p.schema_version, 1) AS "schemaVersion",
    COALESCE(p._upl_version, 1) AS "version",
    p._upl_archived AS "archived",
    p._upl_created_at AS "createdAt",
    p._upl_updated_at AS "updatedAt"
`

const mapDatabaseVersionConflict = (error: unknown): OptimisticLockError | null => {
    const databaseError = error as { code?: unknown }
    if (databaseError.code !== '40001') return null
    return new OptimisticLockError({
        entityId: 'theme_preset',
        entityType: 'theme_preset',
        expectedVersion: 0,
        actualVersion: 0,
        updatedAt: new Date(),
        updatedBy: null
    })
}

const throwIfPresetMissing = <T>(rows: T[]): T => {
    const row = rows[0]
    if (!row) throw new ThemePresetNotFoundError()
    return row
}

/**
 * The pre-check already verified existence and version; zero rows on the
 * version-guarded UPDATE means a concurrent modification between the read
 * and the write — a lock conflict (409), not a missing row (404).
 */
const throwIfPresetWriteConflict = <T>(rows: T[], current: ThemePresetRecord, expectedVersion: number): T => {
    const row = rows[0]
    if (!row) {
        throw new OptimisticLockError({
            entityId: current.id,
            entityType: 'theme_preset',
            expectedVersion,
            actualVersion: current.version,
            updatedAt: current.updatedAt,
            updatedBy: null
        })
    }
    return row
}

const assertPresetVersion = (current: ThemePresetRecord, expectedVersion: number): void => {
    if (current.version === expectedVersion) return
    throw new OptimisticLockError({
        entityId: current.id,
        entityType: 'theme_preset',
        expectedVersion,
        actualVersion: current.version,
        updatedAt: current.updatedAt,
        updatedBy: null
    })
}

export async function listThemePresets(
    executor: SqlQueryable,
    applicationId: string,
    includeArchived = false
): Promise<ThemePresetRecord[]> {
    return executor.query<ThemePresetRecord>(
        `
        SELECT ${THEME_PRESET_COLUMNS}
        FROM applications.obj_theme_presets p
        WHERE p.application_id = $1
          AND p._upl_deleted = false
          AND ($2 OR p._upl_archived = false)
        ORDER BY p.codename ASC
        `,
        [applicationId, includeArchived]
    )
}

export async function getThemePreset(executor: SqlQueryable, applicationId: string, presetId: string): Promise<ThemePresetRecord | null> {
    const rows = await executor.query<ThemePresetRecord>(
        `
        SELECT ${THEME_PRESET_COLUMNS}
        FROM applications.obj_theme_presets p
        WHERE p.application_id = $1
          AND p.id = $2
          AND p._upl_deleted = false
        LIMIT 1
        `,
        [applicationId, presetId]
    )
    return rows[0] ?? null
}

export async function countActiveThemePresets(executor: SqlQueryable, applicationId: string): Promise<number> {
    const rows = await executor.query<{ count: number }>(
        `
        SELECT COUNT(*)::int AS count
        FROM applications.obj_theme_presets p
        WHERE p.application_id = $1
          AND p._upl_deleted = false
          AND p._upl_archived = false
        `,
        [applicationId]
    )
    return rows[0]?.count ?? 0
}

/**
 * Counts layouts whose `appearance.preset.id` references the preset. Layouts
 * live in per-application schemas, so the caller passes the application's
 * schema names; identifier safety is enforced by `qSchemaTable` plus the
 * strict schema-name contract of the application record.
 */
export async function countThemePresetUsages(executor: SqlQueryable, layoutSchemas: readonly string[], presetId: string): Promise<number> {
    return (await findThemePresetUsageLayoutIds(executor, layoutSchemas, presetId)).length
}

/** FR-009: layout ids referencing the preset, for the delete-refusal usage list. */
export async function findThemePresetUsageLayoutIds(
    executor: SqlQueryable,
    layoutSchemas: readonly string[],
    presetId: string
): Promise<string[]> {
    if (layoutSchemas.length === 0) return []
    const schemas = layoutSchemas.map((schema) => qSchemaTable(schema, '_app_layouts'))
    const unions = schemas.map(
        (_, index) => `SELECT l.id FROM ${schemas[index]} l WHERE l.config->'appearance'->'preset'->>'id' = $1 AND l._upl_deleted = false`
    )
    const rows = await executor.query<{ id: string }>(`SELECT id FROM (${unions.join(' UNION ALL ')}) usages`, [presetId])
    return rows.map((row) => row.id)
}

export async function createThemePresetInTransaction(
    executor: SqlQueryable,
    input: CreateThemePresetStoreInput
): Promise<ThemePresetRecord> {
    try {
        const rows = await executor.query<ThemePresetRecord>(
            `
            INSERT INTO applications.obj_theme_presets (
                application_id, codename, name, description, tokens,
                base_preset_id, base_preset_codename, _upl_created_by, _upl_updated_by
            )
            VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7, $8, $8)
            RETURNING id,
            application_id AS "applicationId",
            codename,
            name,
            description,
            tokens,
            base_preset_id AS "basePresetId",
            base_preset_codename AS "basePresetCodename",
            COALESCE(schema_version, 1) AS "schemaVersion",
            COALESCE(_upl_version, 1) AS "version",
            _upl_archived AS "archived",
            _upl_created_at AS "createdAt",
            _upl_updated_at AS "updatedAt"
            `,
            [
                input.applicationId,
                input.codename,
                JSON.stringify(input.name),
                JSON.stringify(input.description),
                JSON.stringify(input.tokens),
                input.basePresetId,
                input.basePresetCodename,
                input.actor
            ]
        )
        return throwIfPresetMissing(rows)
    } catch (error) {
        const databaseError = error as { code?: unknown; constraint?: unknown }
        if (databaseError.code === '23505') {
            throw new ThemePresetCodenameConflictError(input.codename)
        }
        throw error
    }
}

export async function updateThemePresetInTransaction(
    executor: SqlQueryable,
    input: UpdateThemePresetStoreInput
): Promise<ThemePresetRecord> {
    const current = await getThemePreset(executor, input.applicationId, input.presetId)
    if (!current) throw new ThemePresetNotFoundError()
    assertPresetVersion(current, input.expectedVersion)
    try {
        const rows = await executor.query<ThemePresetRecord>(
            `
            UPDATE applications.obj_theme_presets p
            SET name = COALESCE($3::jsonb, p.name),
                description = COALESCE($4::jsonb, p.description),
                tokens = COALESCE($5::jsonb, p.tokens),
                _upl_updated_at = NOW(),
                _upl_updated_by = $6,
                _upl_version = COALESCE(p._upl_version, 1) + 1
            WHERE p.application_id = $1
              AND p.id = $2
              AND COALESCE(p._upl_version, 1) = $7
              AND p._upl_deleted = false
            RETURNING ${THEME_PRESET_COLUMNS}
            `,
            [
                input.applicationId,
                input.presetId,
                input.name === undefined ? null : JSON.stringify(input.name),
                input.description === undefined ? null : JSON.stringify(input.description),
                input.tokens === undefined ? null : JSON.stringify(input.tokens),
                input.actor,
                input.expectedVersion
            ]
        )
        return throwIfPresetWriteConflict(rows, current, input.expectedVersion)
    } catch (error) {
        const lockError = mapDatabaseVersionConflict(error)
        if (lockError) throw lockError
        const databaseError = error as { code?: unknown }
        if (databaseError.code === '23505') {
            throw new ThemePresetCodenameConflictError(current.codename)
        }
        throw error
    }
}

export async function archiveThemePresetInTransaction(
    executor: SqlQueryable,
    input: ArchiveThemePresetStoreInput
): Promise<ThemePresetRecord> {
    const current = await getThemePreset(executor, input.applicationId, input.presetId)
    if (!current) throw new ThemePresetNotFoundError()
    assertPresetVersion(current, input.expectedVersion)
    const rows = await executor.query<ThemePresetRecord>(
        `
        UPDATE applications.obj_theme_presets p
        SET _upl_archived = true,
            _upl_archived_at = NOW(),
            _upl_archived_by = $3,
            _upl_updated_at = NOW(),
            _upl_updated_by = $3,
            _upl_version = COALESCE(p._upl_version, 1) + 1
        WHERE p.application_id = $1
          AND p.id = $2
          AND COALESCE(p._upl_version, 1) = $4
          AND p._upl_deleted = false
        RETURNING ${THEME_PRESET_COLUMNS}
        `,
        [input.applicationId, input.presetId, input.actor, input.expectedVersion]
    )
    return throwIfPresetWriteConflict(rows, current, input.expectedVersion)
}

/** Soft-deletes an unused preset; `usageCount > 0` must be refused upstream. */
export async function deleteThemePresetInTransaction(
    executor: SqlQueryable,
    input: ArchiveThemePresetStoreInput
): Promise<ThemePresetRecord> {
    const current = await getThemePreset(executor, input.applicationId, input.presetId)
    if (!current) throw new ThemePresetNotFoundError()
    assertPresetVersion(current, input.expectedVersion)
    const rows = await executor.query<ThemePresetRecord>(
        `
        UPDATE applications.obj_theme_presets p
        SET _upl_deleted = true,
            _upl_deleted_at = NOW(),
            _upl_deleted_by = $3,
            _upl_updated_at = NOW(),
            _upl_updated_by = $3,
            _upl_version = COALESCE(p._upl_version, 1) + 1
        WHERE p.application_id = $1
          AND p.id = $2
          AND COALESCE(p._upl_version, 1) = $4
          AND p._upl_deleted = false
        RETURNING ${THEME_PRESET_COLUMNS}
        `,
        [input.applicationId, input.presetId, input.actor, input.expectedVersion]
    )
    return throwIfPresetWriteConflict(rows, current, input.expectedVersion)
}

export async function recordThemePresetAuditInTransaction(executor: SqlQueryable, input: ThemePresetAuditInput): Promise<void> {
    const rows = await executor.query<{ id: string }>(
        `
        INSERT INTO applications.rel_theme_preset_audits (
            application_id, preset_id, event_type, changed_fields, previous_version, new_version, actor
        )
        VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
        RETURNING id
        `,
        [
            input.applicationId,
            input.presetId,
            input.eventType,
            JSON.stringify(input.changedFields),
            input.previousVersion,
            input.newVersion,
            input.actor
        ]
    )
    if (!rows[0]) {
        throw new Error('Theme preset audit record was not written')
    }
}
