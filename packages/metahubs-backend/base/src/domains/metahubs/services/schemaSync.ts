import { DataSource } from 'typeorm'
import { MetahubSchemaService } from './MetahubSchemaService'

/**
 * Ensures the Design-Time schema (mhb_<uuid>) exists with system tables.
 *
 * IMPORTANT: This function does NOT create physical data tables (cat_*, doc_*, etc.)
 * in Design-Time schemas. Physical tables are only created during Publication sync
 * to Application schemas (app_<uuid>).
 *
 * Design-Time schemas contain only metadata tables:
 * - _mhb_objects: Registry of all objects (Catalogs, Hubs, Documents)
 * - _mhb_attributes: Attribute definitions for objects
 * - _mhb_records: Predefined data for catalogs
 *
 * @param metahubId - The Metahub UUID
 * @param ds - TypeORM DataSource
 * @returns The schema name (mhb_<uuid>)
 */
export async function syncMetahubSchema(metahubId: string, ds: DataSource): Promise<string> {
    const schemaService = new MetahubSchemaService(ds)

    // Only ensure schema and system tables exist - NO physical table creation
    const schemaName = await schemaService.ensureSchema(metahubId)

    return schemaName
}
