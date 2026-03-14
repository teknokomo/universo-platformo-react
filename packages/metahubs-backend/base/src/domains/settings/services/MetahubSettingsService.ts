import type { DbExecutor, SqlQueryable } from '@universo/utils/database'
import { queryMany, queryOne, queryOneOrThrow } from '@universo/utils/database'
import { qSchemaTable } from '@universo/database'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { incrementVersion } from '../../../utils/optimisticLock'
import { getSettingDefinition } from '@universo/types'
import type { MetahubSettingRow } from '@universo/types'
import { validateSettingValue } from '../../shared/validateSettingValue'

const TABLE = '_mhb_settings'

/**
 * Service to manage Metahub Settings stored in isolated schemas (_mhb_settings).
 * Uses DbExecutor for all queries and MetahubSchemaService for schema resolution.
 */
export class MetahubSettingsService {
    constructor(private exec: DbExecutor, private schemaService: MetahubSchemaService) {}

    /**
     * Get all settings (non-deleted).
     * Returns raw DB rows; the route layer merges with registry defaults.
     */
    async findAll(metahubId: string, userId?: string): Promise<MetahubSettingRow[]> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, TABLE)
        return queryMany<MetahubSettingRow>(
            this.exec,
            `SELECT * FROM ${qt}
             WHERE _upl_deleted = false AND _mhb_deleted = false
             ORDER BY key ASC`
        )
    }

    /**
     * Get a single setting by key.
     */
    async findByKey(metahubId: string, key: string, userId?: string): Promise<MetahubSettingRow | null> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, TABLE)
        return queryOne<MetahubSettingRow>(
            this.exec,
            `SELECT * FROM ${qt}
             WHERE key = $1 AND _upl_deleted = false AND _mhb_deleted = false
             LIMIT 1`,
            [key]
        )
    }

    /**
     * Get a single setting by key including soft-deleted rows.
     * Used internally to revive existing rows instead of inserting duplicates.
     */
    private async findByKeyAnyState(schemaName: string, key: string): Promise<MetahubSettingRow | null> {
        const qt = qSchemaTable(schemaName, TABLE)
        return queryOne<MetahubSettingRow>(this.exec, `SELECT * FROM ${qt} WHERE key = $1 LIMIT 1`, [key])
    }

    /**
     * Upsert a single setting (insert or update).
     * Validates the value against the registry definition before persisting.
     * Returns the upserted row.
     */
    async upsert(metahubId: string, key: string, value: Record<string, unknown>, userId?: string): Promise<MetahubSettingRow> {
        const validationError = validateSettingValue(key, value)
        if (validationError) {
            throw new Error(validationError)
        }

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const existing = await this.findByKeyAnyState(schemaName, key)

        if (existing) {
            const updated = await incrementVersion(this.exec, schemaName, TABLE, existing.id, {
                value: JSON.stringify(value),
                _mhb_deleted: false,
                _mhb_deleted_at: null,
                _mhb_deleted_by: null,
                _upl_deleted: false,
                _upl_deleted_at: null,
                _upl_deleted_by: null,
                _upl_updated_at: new Date(),
                _upl_updated_by: userId ?? null
            })
            return updated as unknown as MetahubSettingRow
        }

        const qt = qSchemaTable(schemaName, TABLE)
        const now = new Date()
        return queryOneOrThrow<MetahubSettingRow>(
            this.exec,
            `INSERT INTO ${qt}
                (key, value, _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by,
                 _upl_version, _upl_archived, _upl_deleted, _upl_locked,
                 _mhb_published, _mhb_archived, _mhb_deleted)
             VALUES ($1, $2, $3, $4, $3, $4, 1, false, false, false, true, false, false)
             RETURNING *`,
            [key, JSON.stringify(value), now, userId ?? null],
            undefined,
            'Failed to insert setting'
        )
    }

    /**
     * Bulk upsert: update multiple settings in a single transaction.
     * Validates keys against METAHUB_SETTINGS_REGISTRY.
     * All-or-nothing: if any upsert fails, the entire batch is rolled back.
     */
    async bulkUpsert(
        metahubId: string,
        settings: Array<{ key: string; value: Record<string, unknown> }>,
        userId?: string
    ): Promise<MetahubSettingRow[]> {
        const unknownKeys = settings.map((s) => s.key).filter((k) => !getSettingDefinition(k))
        if (unknownKeys.length > 0) {
            throw new Error(`Unknown setting keys: ${unknownKeys.join(', ')}`)
        }

        const invalidValueErrors = settings
            .map((setting) => validateSettingValue(setting.key, setting.value))
            .filter((error): error is string => Boolean(error))

        if (invalidValueErrors.length > 0) {
            throw new Error(invalidValueErrors.join('; '))
        }

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, TABLE)
        const now = new Date()

        return this.exec.transaction(async (tx: SqlQueryable) => {
            const results: MetahubSettingRow[] = []
            for (const setting of settings) {
                const existing = await queryOne<MetahubSettingRow>(tx, `SELECT * FROM ${qt} WHERE key = $1 LIMIT 1`, [setting.key])

                if (existing) {
                    const updated = await queryOneOrThrow<MetahubSettingRow>(
                        tx,
                        `UPDATE ${qt}
                         SET value = $1, _mhb_deleted = false, _mhb_deleted_at = NULL, _mhb_deleted_by = NULL,
                             _upl_deleted = false, _upl_deleted_at = NULL, _upl_deleted_by = NULL,
                             _upl_updated_at = $2, _upl_updated_by = $3,
                             _upl_version = _upl_version + 1
                         WHERE id = $4
                         RETURNING *`,
                        [JSON.stringify(setting.value), now, userId ?? null, existing.id],
                        undefined,
                        'Failed to update setting'
                    )
                    results.push(updated)
                } else {
                    const created = await queryOneOrThrow<MetahubSettingRow>(
                        tx,
                        `INSERT INTO ${qt}
                            (key, value, _upl_created_at, _upl_created_by, _upl_updated_at, _upl_updated_by,
                             _upl_version, _upl_archived, _upl_deleted, _upl_locked,
                             _mhb_published, _mhb_archived, _mhb_deleted)
                         VALUES ($1, $2, $3, $4, $3, $4, 1, false, false, false, true, false, false)
                         RETURNING *`,
                        [setting.key, JSON.stringify(setting.value), now, userId ?? null],
                        undefined,
                        'Failed to insert setting'
                    )
                    results.push(created)
                }
            }
            return results
        })
    }

    /**
     * Reset a setting to its default value (soft-delete from DB).
     * The frontend will fall back to the registry default.
     * Only affects non-deleted rows to avoid redundant updates.
     */
    async resetToDefault(metahubId: string, key: string, userId?: string): Promise<void> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, TABLE)
        const now = new Date()
        await this.exec.query(
            `UPDATE ${qt}
             SET _mhb_deleted = true, _mhb_deleted_at = $1, _mhb_deleted_by = $2,
                 _upl_updated_at = $1, _upl_updated_by = $2
             WHERE key = $3 AND _mhb_deleted = false
             RETURNING id`,
            [now, userId ?? null, key]
        )
    }

    /**
     * Clears all parent-child hub nesting links by setting `config.parentHubId = null`
     * for every non-deleted hub object in `_mhb_objects`.
     */
    async clearHubNesting(metahubId: string, userId?: string): Promise<number> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_objects')
        const rows = await this.exec.query<{ id: string }>(
            `UPDATE ${qt}
             SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{parentHubId}', 'null'::jsonb, true),
                 _upl_updated_at = $1,
                 _upl_updated_by = $2,
                 _upl_version = _upl_version + 1
             WHERE kind = 'hub'
               AND _upl_deleted = false
               AND _mhb_deleted = false
               AND COALESCE(config->>'parentHubId', '') <> ''
             RETURNING id`,
            [new Date(), userId ?? null]
        )
        return rows.length
    }

    /**
     * Returns true when at least one active hub has a non-null parentHubId.
     */
    async hasHubNesting(metahubId: string, userId?: string): Promise<boolean> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const qt = qSchemaTable(schemaName, '_mhb_objects')
        const rows = await this.exec.query<{ total: string }>(
            `SELECT COUNT(*)::text AS total FROM ${qt}
             WHERE kind = 'hub'
               AND _upl_deleted = false
               AND _mhb_deleted = false
               AND COALESCE(config->>'parentHubId', '') <> ''`
        )
        const total = Number(rows[0]?.total ?? 0)
        return Number.isFinite(total) && total > 0
    }
}
