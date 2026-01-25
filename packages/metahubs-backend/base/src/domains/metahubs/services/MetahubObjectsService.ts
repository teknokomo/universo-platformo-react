import { KnexClient, generateTableName } from '../../ddl'
import { MetahubSchemaService } from './MetahubSchemaService'

/**
 * Service to manage Metahub Objects (Catalogs) stored in isolated schemas (_mhb_objects).
 * Replaces the old TypeORM Catalog entity logic.
 */
export class MetahubObjectsService {
    constructor(private schemaService: MetahubSchemaService) { }

    private get knex() {
        return KnexClient.getInstance()
    }

    async findAll(metahubId: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        return this.knex
            .withSchema(schemaName)
            .from('_mhb_objects')
            .where({ kind: 'CATALOG' })
            .select('*')
            .orderBy('created_at', 'desc')
    }

    async countByKind(metahubId: string, kind: 'CATALOG' | 'HUB' | 'DOCUMENT', userId?: string): Promise<number> {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        const result = await this.knex
            .withSchema(schemaName)
            .from('_mhb_objects')
            .where({ kind })
            .count('* as count')
            .first()
        return result ? parseInt(result.count as string, 10) : 0
    }

    async findById(metahubId: string, id: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        return this.knex
            .withSchema(schemaName)
            .from('_mhb_objects')
            .where({ id })
            .first()
    }

    async findByCodename(metahubId: string, codename: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        return this.knex
            .withSchema(schemaName)
            .from('_mhb_objects')
            .where({ codename, kind: 'CATALOG' })
            .first()
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
                created_at: new Date(),
                updated_at: new Date()
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
    }, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)

        const updateData: any = { updated_at: new Date() }

        if (input.codename) {
            updateData.codename = input.codename
            // Note: table_name is based on entity UUID, not codename,
            // so changing codename does NOT change the table_name.
            // The DDL system uses entity.id (UUID) for generateTableName.
        }

        // We need to fetch existing to merge presentation/config if partial update is needed,
        // but knex update is partial by default for columns.
        // For jsonb columns, we should merge carefully if needed.
        // Here we assume input provides full new state for complex objects or we use jsonb_set.
        // For simplicity, we fetch and merge in app for now or assume full object replacement for nested fields.

        const existing = await this.findById(metahubId, id, userId)
        if (!existing) throw new Error('Catalog not found')

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

        const [updated] = await this.knex
            .withSchema(schemaName)
            .from('_mhb_objects')
            .where({ id })
            .update(updateData)
            .returning('*')
        return updated
    }

    async delete(metahubId: string, id: string, userId?: string) {
        const schemaName = await this.schemaService.ensureSchema(metahubId, userId)
        await this.knex
            .withSchema(schemaName)
            .from('_mhb_objects')
            .where({ id })
            .delete()
    }
}
