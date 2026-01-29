import { KnexClient, generateTableName } from '../../ddl'
import { MetahubSchemaService } from './MetahubSchemaService'
import { updateWithVersionCheck, incrementVersion } from '../../../utils/optimisticLock'

/**
 * Options for querying objects
 */
interface QueryOptions {
    /** Include soft-deleted records */
    includeDeleted?: boolean
    /** Only return soft-deleted records (trash view) */
    onlyDeleted?: boolean
}

/**
 * Service to manage Metahub Objects (Catalogs) stored in isolated schemas (_mhb_objects).
 * Replaces the old TypeORM Catalog entity logic.
 */
export class MetahubObjectsService {
    constructor(private schemaService: MetahubSchemaService) { }

    private get knex() {
        return KnexClient.getInstance()
    }

    /**
     * Applies soft delete filter to a query.
     * Checks both platform-level (_upl_deleted) and metahub-level (_mhb_deleted) soft delete.
     */
    private applySoftDeleteFilter(query: any, options: QueryOptions = {}) {
        const { includeDeleted = false, onlyDeleted = false } = options
        if (onlyDeleted) {
            // Show records deleted at metahub level (but not platform level)
            return query.where('_mhb_deleted', true).where('_upl_deleted', false)
        }
        if (!includeDeleted) {
            // Exclude records deleted at either level
            return query.where('_mhb_deleted', false).where('_upl_deleted', false)
        }
        return query
    }

    async findAll(metahubId: string, userId?: string, options: QueryOptions = {}): Promise<any[]> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const query = this.knex
            .withSchema(schemaName)
            .from('_mhb_objects')
            .where({ kind: 'CATALOG' })
            .select('*')
            .orderBy('_upl_created_at', 'desc')
        return this.applySoftDeleteFilter(query, options)
    }

    async countByKind(metahubId: string, kind: 'CATALOG' | 'HUB' | 'DOCUMENT', userId?: string, options: QueryOptions = {}): Promise<number> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const query = this.knex
            .withSchema(schemaName)
            .from('_mhb_objects')
            .where({ kind })
        const filteredQuery = this.applySoftDeleteFilter(query, options)
        const result = await filteredQuery.count('* as count').first()
        return result ? parseInt(result.count as string, 10) : 0
    }

    async findById(metahubId: string, id: string, userId?: string, options: QueryOptions = {}) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const query = this.knex
            .withSchema(schemaName)
            .from('_mhb_objects')
            .where({ id })
        return this.applySoftDeleteFilter(query, options).first()
    }

    async findByCodename(metahubId: string, codename: string, userId?: string, options: QueryOptions = {}) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const query = this.knex
            .withSchema(schemaName)
            .from('_mhb_objects')
            .where({ codename, kind: 'CATALOG' })
        return this.applySoftDeleteFilter(query, options).first()
    }

    /**
     * Creates a new Catalog object.
     * Maps inputs to _mhb_objects structure and generates table_name from entity UUID.
     */
    async createCatalog(metahubId: string, input: {
        codename: string
        name: any // VLC
        description?: any // VLC
        config?: any
        createdBy?: string | null
    }, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        // First insert without table_name to get the generated UUID
        const [created] = await this.knex
            .withSchema(schemaName)
            .into('_mhb_objects')
            .insert({
                kind: 'CATALOG',
                codename: input.codename,
                table_name: null, // Will be set after we have the UUID
                presentation: {
                    name: input.name,
                    description: input.description
                },
                config: input.config || {},
                _upl_created_at: new Date(),
                _upl_created_by: input.createdBy ?? null,
                _upl_updated_at: new Date(),
                _upl_updated_by: input.createdBy ?? null
            })
            .returning('*')

        // Generate table_name using the entity UUID (matches DDL generateTableName behavior)
        const tableName = generateTableName(created.id, 'catalog')

        // Update with correct table_name
        const [updated] = await this.knex
            .withSchema(schemaName)
            .from('_mhb_objects')
            .where({ id: created.id })
            .update({ table_name: tableName })
            .returning('*')

        return updated
    }

    async updateCatalog(metahubId: string, id: string, input: {
        codename?: string
        name?: any
        description?: any
        config?: any
        updatedBy?: string | null
        expectedVersion?: number
    }, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        const existing = await this.findById(metahubId, id, userId)
        if (!existing) throw new Error('Catalog not found')

        const updateData: Record<string, unknown> = {
            _upl_updated_at: new Date(),
            _upl_updated_by: input.updatedBy ?? null
        }

        if (input.codename) {
            updateData.codename = input.codename
        }

        if (input.name || input.description) {
            updateData.presentation = {
                ...existing.presentation,
                ...(input.name ? { name: input.name } : {}),
                ...(input.description ? { description: input.description } : {})
            }
        }

        if (input.config) {
            updateData.config = {
                ...existing.config,
                ...input.config
            }
        }

        // If expectedVersion is provided, use version-checked update
        if (input.expectedVersion !== undefined) {
            return updateWithVersionCheck({
                knex: this.knex,
                schemaName,
                tableName: '_mhb_objects',
                entityId: id,
                entityType: 'catalog',
                expectedVersion: input.expectedVersion,
                updateData
            })
        }

        // Fallback: increment version without check (backwards compatibility)
        return incrementVersion(this.knex, schemaName, '_mhb_objects', id, updateData)
    }

    /**
     * Soft deletes a catalog object at the metahub level.
     * Sets _mhb_deleted=true, _mhb_deleted_at=now(), _mhb_deleted_by=userId
     */
    async delete(metahubId: string, id: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        await this.knex
            .withSchema(schemaName)
            .from('_mhb_objects')
            .where({ id })
            .update({
                _mhb_deleted: true,
                _mhb_deleted_at: new Date(),
                _mhb_deleted_by: userId ?? null,
                _upl_updated_at: new Date(),
                _upl_updated_by: userId ?? null
            })
    }

    /**
     * Restores a soft-deleted catalog object (metahub level).
     */
    async restore(metahubId: string, id: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        await this.knex
            .withSchema(schemaName)
            .from('_mhb_objects')
            .where({ id })
            .update({
                _mhb_deleted: false,
                _mhb_deleted_at: null,
                _mhb_deleted_by: null,
                _upl_updated_at: new Date(),
                _upl_updated_by: userId ?? null
            })
    }

    /**
     * Permanently deletes a catalog object (use with caution).
     */
    async permanentDelete(metahubId: string, id: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        await this.knex
            .withSchema(schemaName)
            .from('_mhb_objects')
            .where({ id })
            .delete()
    }

    /**
     * Returns all soft-deleted objects (trash view).
     */
    async findDeleted(metahubId: string, userId?: string) {
        return this.findAll(metahubId, userId, { onlyDeleted: true })
    }
}
