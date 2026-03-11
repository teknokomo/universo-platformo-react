import type { SqlQueryable } from '../../../persistence/types'
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
 * - _mhb_elements: Predefined data for catalogs
 *
 * @param metahubId - The Metahub UUID
 * @param exec - SQL executor (RLS-scoped or admin)
 * @returns The schema name (mhb_<uuid>)
 */
export async function syncMetahubSchema(metahubId: string, exec: SqlQueryable, userId?: string): Promise<string> {
    const schemaService = new MetahubSchemaService(exec)

    // Only ensure schema and system tables exist - NO physical table creation
    const schemaName = await schemaService.ensureSchema(metahubId, userId)

    return schemaName
}
