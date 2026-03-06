import { KnexClient } from '../../ddl'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { incrementVersion } from '../../../utils/optimisticLock'
import { getSettingDefinition } from '@universo/types'
import type { MetahubSettingRow } from '@universo/types'
import { validateSettingValue } from '../../shared/validateSettingValue'

const TABLE = '_mhb_settings'

/**
 * Service to manage Metahub Settings stored in isolated schemas (_mhb_settings).
 * Follows the MetahubObjectsService pattern — uses MetahubSchemaService for
 * schema resolution and Knex for queries.
 */
export class MetahubSettingsService {
    constructor(private schemaService: MetahubSchemaService) {}

    private get knex() {
        return KnexClient.getInstance()
    }

    /**
     * Get all settings (non-deleted).
     * Returns raw DB rows; the route layer merges with registry defaults.
     */
    async findAll(metahubId: string, userId?: string): Promise<MetahubSettingRow[]> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        return this.knex
            .withSchema(schemaName)
            .from(TABLE)
            .where({ _upl_deleted: false, _mhb_deleted: false })
            .select('*')
            .orderBy('key', 'asc')
    }

    /**
     * Get a single setting by key.
     */
    async findByKey(metahubId: string, key: string, userId?: string): Promise<MetahubSettingRow | null> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const row = await this.knex.withSchema(schemaName).from(TABLE).where({ key, _upl_deleted: false, _mhb_deleted: false }).first()
        return (row as MetahubSettingRow | undefined) ?? null
    }

    /**
     * Get a single setting by key including soft-deleted rows.
     * Used internally to revive existing rows instead of inserting duplicates.
     */
    private async findByKeyAnyState(metahubId: string, key: string, userId?: string): Promise<MetahubSettingRow | null> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const row = await this.knex.withSchema(schemaName).from(TABLE).where({ key }).first()
        return (row as MetahubSettingRow | undefined) ?? null
    }

    /**
     * Upsert a single setting (insert or update).
     * Validates the value against the registry definition before persisting.
     * Returns the upserted row.
     */
    async upsert(metahubId: string, key: string, value: Record<string, unknown>, userId?: string): Promise<MetahubSettingRow> {
        // Validate value against registry definition
        const validationError = validateSettingValue(key, value)
        if (validationError) {
            throw new Error(validationError)
        }

        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const existing = await this.findByKeyAnyState(metahubId, key, userId)

        if (existing) {
            const updated = await incrementVersion(this.knex, schemaName, TABLE, existing.id, {
                value,
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

        const now = new Date()
        const [created] = await this.knex
            .withSchema(schemaName)
            .into(TABLE)
            .insert({
                key,
                value,
                _upl_created_at: now,
                _upl_created_by: userId ?? null,
                _upl_updated_at: now,
                _upl_updated_by: userId ?? null,
                _upl_version: 1,
                _upl_archived: false,
                _upl_deleted: false,
                _upl_locked: false,
                _mhb_published: true,
                _mhb_archived: false,
                _mhb_deleted: false
            })
            .returning('*')
        return created as MetahubSettingRow
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
        // Validate all keys are known (before starting transaction)
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
        const now = new Date()

        return this.knex.transaction(async (trx) => {
            const results: MetahubSettingRow[] = []
            for (const setting of settings) {
                const existing = await trx.withSchema(schemaName).from(TABLE).where({ key: setting.key }).first()

                if (existing) {
                    const [updated] = await trx
                        .withSchema(schemaName)
                        .from(TABLE)
                        .where({ id: existing.id })
                        .update({
                            value: setting.value,
                            _mhb_deleted: false,
                            _mhb_deleted_at: null,
                            _mhb_deleted_by: null,
                            _upl_deleted: false,
                            _upl_deleted_at: null,
                            _upl_deleted_by: null,
                            _upl_updated_at: now,
                            _upl_updated_by: userId ?? null,
                            _upl_version: trx.raw('_upl_version + 1')
                        })
                        .returning('*')
                    results.push(updated as MetahubSettingRow)
                } else {
                    const [created] = await trx
                        .withSchema(schemaName)
                        .into(TABLE)
                        .insert({
                            key: setting.key,
                            value: setting.value,
                            _upl_created_at: now,
                            _upl_created_by: userId ?? null,
                            _upl_updated_at: now,
                            _upl_updated_by: userId ?? null,
                            _upl_version: 1,
                            _upl_archived: false,
                            _upl_deleted: false,
                            _upl_locked: false,
                            _mhb_published: true,
                            _mhb_archived: false,
                            _mhb_deleted: false
                        })
                        .returning('*')
                    results.push(created as MetahubSettingRow)
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
        const now = new Date()
        await this.knex
            .withSchema(schemaName)
            .from(TABLE)
            .where({ key, _mhb_deleted: false })
            .update({
                _mhb_deleted: true,
                _mhb_deleted_at: now,
                _mhb_deleted_by: userId ?? null,
                _upl_updated_at: now,
                _upl_updated_by: userId ?? null
            })
    }

    /**
     * Clears all parent-child hub nesting links by setting `config.parentHubId = null`
     * for every non-deleted hub object in `_mhb_objects`.
     */
    async clearHubNesting(metahubId: string, userId?: string): Promise<number> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const now = new Date()
        const rows = await this.knex
            .withSchema(schemaName)
            .from('_mhb_objects')
            .where({ kind: 'hub' })
            .andWhere('_upl_deleted', false)
            .andWhere('_mhb_deleted', false)
            .andWhereRaw(`COALESCE(config->>'parentHubId', '') <> ''`)
            .select('id', 'config')

        if (!rows.length) return 0

        await this.knex.transaction(async (trx) => {
            for (const row of rows as Array<{ id: string; config?: Record<string, unknown> }>) {
                const nextConfig = {
                    ...((row.config as Record<string, unknown> | undefined) ?? {}),
                    parentHubId: null
                }
                await trx
                    .withSchema(schemaName)
                    .from('_mhb_objects')
                    .where({ id: row.id })
                    .update({
                        config: nextConfig,
                        _upl_updated_at: now,
                        _upl_updated_by: userId ?? null,
                        _upl_version: trx.raw('_upl_version + 1')
                    })
            }
        })

        return rows.length
    }

    /**
     * Returns true when at least one active hub has a non-null parentHubId.
     */
    async hasHubNesting(metahubId: string, userId?: string): Promise<boolean> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const row = await this.knex
            .withSchema(schemaName)
            .from('_mhb_objects')
            .where({ kind: 'hub' })
            .andWhere('_upl_deleted', false)
            .andWhere('_mhb_deleted', false)
            .andWhereRaw(`COALESCE(config->>'parentHubId', '') <> ''`)
            .count<{ total: string | number }[]>('* as total')
            .first()

        const total = Number(row?.total ?? 0)
        return Number.isFinite(total) && total > 0
    }
}
