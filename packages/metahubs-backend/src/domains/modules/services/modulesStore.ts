import { qSchemaTable } from '@universo/database'
import { queryMany, queryOne, queryOneOrThrow, type SqlQueryable } from '@universo/utils/database'
import type { ModuleAttachmentKind, ModuleRole, ModuleSourceKind } from '@universo/types'
import { codenamePrimaryTextSql } from '../../shared/codename'

const TABLE = '_mhb_modules'
const ACTIVE_CLAUSE = '_upl_deleted = false AND _mhb_deleted = false'

export interface StoredMetahubModuleRow {
    id: string
    codename: unknown
    presentation: unknown
    attached_to_kind: ModuleAttachmentKind
    attached_to_id: string | null
    module_role: ModuleRole
    source_kind: ModuleSourceKind
    sdk_api_version: string
    source_code: string
    manifest: unknown
    server_bundle: string | null
    client_bundle: string | null
    checksum: string
    is_active: boolean
    config: unknown
    _upl_version: number
    _upl_updated_at?: string | Date | null
}

export interface ListStoredMetahubModulesOptions {
    attachedToKind?: ModuleAttachmentKind
    attachedToId?: string | null
    onlyActive?: boolean
}

export interface StoredMetahubModuleScope {
    codename: string
    attachedToKind: ModuleAttachmentKind
    attachedToId: string | null
    moduleRole: ModuleRole
}

export interface InsertStoredMetahubModuleInput {
    codename: unknown
    presentation: unknown
    attachedToKind: ModuleAttachmentKind
    attachedToId: string | null
    moduleRole: ModuleRole
    sourceKind: ModuleSourceKind
    sdkApiVersion: string
    sourceCode: string
    manifest: unknown
    serverBundle: string | null
    clientBundle: string | null
    checksum: string
    isActive: boolean
    config: Record<string, unknown>
    userId?: string | null
}

export async function listStoredMetahubModules(
    executor: SqlQueryable,
    schemaName: string,
    options: ListStoredMetahubModulesOptions = {}
): Promise<StoredMetahubModuleRow[]> {
    const qt = qSchemaTable(schemaName, TABLE)
    const conditions = [ACTIVE_CLAUSE]
    const params: unknown[] = []

    if (options.attachedToKind) {
        params.push(options.attachedToKind)
        conditions.push(`attached_to_kind = $${params.length}`)
    }

    if (options.attachedToId !== undefined) {
        if (options.attachedToId === null) {
            conditions.push('attached_to_id IS NULL')
        } else {
            params.push(options.attachedToId)
            conditions.push(`attached_to_id = $${params.length}`)
        }
    }

    if (options.onlyActive) {
        conditions.push('is_active = true')
    }

    return queryMany<StoredMetahubModuleRow>(
        executor,
        `SELECT * FROM ${qt}
         WHERE ${conditions.join(' AND ')}
         ORDER BY attached_to_kind ASC, attached_to_id ASC NULLS FIRST, _upl_updated_at DESC, id ASC`,
        params
    )
}

export async function findStoredMetahubModuleById(
    executor: SqlQueryable,
    schemaName: string,
    moduleId: string
): Promise<StoredMetahubModuleRow | null> {
    const qt = qSchemaTable(schemaName, TABLE)
    return queryOne<StoredMetahubModuleRow>(
        executor,
        `SELECT * FROM ${qt}
         WHERE id = $1 AND ${ACTIVE_CLAUSE}
         LIMIT 1`,
        [moduleId]
    )
}

export async function findStoredMetahubModuleByScope(
    executor: SqlQueryable,
    schemaName: string,
    scope: StoredMetahubModuleScope
): Promise<StoredMetahubModuleRow | null> {
    const qt = qSchemaTable(schemaName, TABLE)
    return queryOne<StoredMetahubModuleRow>(
        executor,
        `SELECT * FROM ${qt}
         WHERE ${codenamePrimaryTextSql('codename')} = $1
           AND attached_to_kind = $2
           AND (($3::uuid IS NULL AND attached_to_id IS NULL) OR attached_to_id = $3)
           AND module_role = $4
           AND ${ACTIVE_CLAUSE}
         LIMIT 1`,
        [scope.codename, scope.attachedToKind, scope.attachedToId, scope.moduleRole]
    )
}

export async function insertStoredMetahubModule(
    executor: SqlQueryable,
    schemaName: string,
    input: InsertStoredMetahubModuleInput
): Promise<StoredMetahubModuleRow> {
    const qt = qSchemaTable(schemaName, TABLE)
    const now = new Date()

    return queryOneOrThrow<StoredMetahubModuleRow>(
        executor,
        `INSERT INTO ${qt} (
            codename,
            presentation,
            attached_to_kind,
            attached_to_id,
            module_role,
            source_kind,
            sdk_api_version,
            source_code,
            manifest,
            server_bundle,
            client_bundle,
            checksum,
            is_active,
            config,
            _upl_created_at,
            _upl_created_by,
            _upl_updated_at,
            _upl_updated_by,
            _upl_version,
            _upl_archived,
            _upl_deleted,
            _upl_locked,
            _mhb_published,
            _mhb_archived,
            _mhb_deleted
         ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
            $15, $16, $15, $16, 1, false, false, false, true, false, false
         )
         RETURNING *`,
        [
            JSON.stringify(input.codename),
            JSON.stringify(input.presentation),
            input.attachedToKind,
            input.attachedToId,
            input.moduleRole,
            input.sourceKind,
            input.sdkApiVersion,
            input.sourceCode,
            JSON.stringify(input.manifest),
            input.serverBundle,
            input.clientBundle,
            input.checksum,
            input.isActive,
            JSON.stringify(input.config ?? {}),
            now,
            input.userId ?? null
        ]
    )
}

export { TABLE as METAHUB_MODULES_TABLE }
