/**
 * Cross-package SQL queries for Application-related data.
 *
 * These queries access tables in the `applications` schema directly via SQL,
 * avoiding entity class imports from @universo/applications-backend.
 * Used by metahubs-backend routes that need to read/write Application,
 * Connector, and ConnectorPublication records.
 */
import type { VersionedLocalizedContent, ApplicationSchemaStatus } from '@universo/types'
import type { SqlQueryable } from './types'

// ═══════════════════════════════════════════════════════════════════════════
// Row types (lightweight — only fields actually used by metahubs-backend)
// ═══════════════════════════════════════════════════════════════════════════

export interface AppRow {
    id: string
    name: VersionedLocalizedContent<string> | null
    description: VersionedLocalizedContent<string> | null
    slug: string | null
    schemaName: string | null
    schemaStatus: ApplicationSchemaStatus | null
    schemaError: string | null
    schemaSyncedAt: Date | null
    schemaSnapshot: Record<string, unknown> | null
    appStructureVersion: number | null
    lastSyncedPublicationVersionId: string | null
    version: number
}

export interface AppUserRow {
    id: string
    applicationId: string
    userId: string
    role: string
}

export interface ConnectorRow {
    id: string
    applicationId: string
    name: VersionedLocalizedContent<string> | null
    description: VersionedLocalizedContent<string> | null
    sortOrder: number
}

export interface ConnectorPublicationRow {
    id: string
    connectorId: string
    publicationId: string
    sortOrder: number
}

// ═══════════════════════════════════════════════════════════════════════════
// SQL fragments
// ═══════════════════════════════════════════════════════════════════════════

const APP_SELECT = `
    id,
    name,
    description,
    slug,
    schema_name         AS "schemaName",
    schema_status       AS "schemaStatus",
    schema_error        AS "schemaError",
    schema_synced_at    AS "schemaSyncedAt",
    schema_snapshot     AS "schemaSnapshot",
    app_structure_version AS "appStructureVersion",
    last_synced_publication_version_id AS "lastSyncedPublicationVersionId",
    _upl_version        AS "version"
`

const APP_USER_SELECT = `
    id,
    application_id AS "applicationId",
    user_id        AS "userId",
    role
`

const CONNECTOR_SELECT = `
    id,
    application_id AS "applicationId",
    name,
    description,
    sort_order     AS "sortOrder"
`

const CONNECTOR_PUB_SELECT = `
    id,
    connector_id   AS "connectorId",
    publication_id AS "publicationId",
    sort_order     AS "sortOrder"
`

// ═══════════════════════════════════════════════════════════════════════════
// Application queries
// ═══════════════════════════════════════════════════════════════════════════

export async function findApplicationById(exec: SqlQueryable, id: string): Promise<AppRow | null> {
    const rows = await exec.query<AppRow>(
        `SELECT ${APP_SELECT} FROM applications.applications WHERE id = $1 LIMIT 1`,
        [id]
    )
    return rows[0] ?? null
}

export async function updateApplicationFields(
    exec: SqlQueryable,
    id: string,
    fields: {
        schemaName?: string | null
        slug?: string | null
        schemaStatus?: ApplicationSchemaStatus | null
        schemaError?: string | null
        schemaSyncedAt?: Date | null
        schemaSnapshot?: Record<string, unknown> | null
        appStructureVersion?: number | null
        lastSyncedPublicationVersionId?: string | null
        userId?: string | null
    }
): Promise<AppRow | null> {
    const setClauses: string[] = []
    const params: unknown[] = []
    let idx = 1

    const push = (col: string, val: unknown) => {
        setClauses.push(`${col} = $${idx}`)
        params.push(val)
        idx++
    }

    if (fields.schemaName !== undefined) push('schema_name', fields.schemaName)
    if (fields.slug !== undefined) push('slug', fields.slug)
    if (fields.schemaStatus !== undefined) push('schema_status', fields.schemaStatus)
    if (fields.schemaError !== undefined) push('schema_error', fields.schemaError)
    if (fields.schemaSyncedAt !== undefined) push('schema_synced_at', fields.schemaSyncedAt)
    if (fields.schemaSnapshot !== undefined) push('schema_snapshot', fields.schemaSnapshot ? JSON.stringify(fields.schemaSnapshot) : null)
    if (fields.appStructureVersion !== undefined) push('app_structure_version', fields.appStructureVersion)
    if (fields.lastSyncedPublicationVersionId !== undefined) push('last_synced_publication_version_id', fields.lastSyncedPublicationVersionId)
    if (fields.userId !== undefined) push('_upl_updated_by', fields.userId)

    if (setClauses.length === 0) return findApplicationById(exec, id)

    setClauses.push('_upl_updated_at = NOW()')
    setClauses.push('_upl_version = COALESCE(_upl_version, 1) + 1')

    params.push(id)

    const rows = await exec.query<AppRow>(
        `UPDATE applications.applications
         SET ${setClauses.join(', ')}
         WHERE id = $${params.length}
         RETURNING ${APP_SELECT}`,
        params
    )
    return rows[0] ?? null
}

export async function createApplication(
    exec: SqlQueryable,
    input: {
        name: VersionedLocalizedContent<string>
        description?: VersionedLocalizedContent<string> | null
        userId: string
    }
): Promise<AppRow> {
    const rows = await exec.query<AppRow>(
        `INSERT INTO applications.applications (name, description, _upl_created_by, _upl_updated_by)
         VALUES ($1, $2, $3, $3)
         RETURNING ${APP_SELECT}`,
        [JSON.stringify(input.name), input.description ? JSON.stringify(input.description) : null, input.userId]
    )
    return rows[0]
}

// ═══════════════════════════════════════════════════════════════════════════
// ApplicationUser queries
// ═══════════════════════════════════════════════════════════════════════════

export async function findApplicationUser(
    exec: SqlQueryable,
    applicationId: string,
    userId: string
): Promise<AppUserRow | null> {
    const rows = await exec.query<AppUserRow>(
        `SELECT ${APP_USER_SELECT} FROM applications.applications_users
         WHERE application_id = $1 AND user_id = $2
         LIMIT 1`,
        [applicationId, userId]
    )
    return rows[0] ?? null
}

export async function createApplicationUser(
    exec: SqlQueryable,
    input: { applicationId: string; userId: string; role: string }
): Promise<AppUserRow> {
    const rows = await exec.query<AppUserRow>(
        `INSERT INTO applications.applications_users (application_id, user_id, role, _upl_created_by, _upl_updated_by)
         VALUES ($1, $2, $3, $2, $2)
         RETURNING ${APP_USER_SELECT}`,
        [input.applicationId, input.userId, input.role]
    )
    return rows[0]
}

// ═══════════════════════════════════════════════════════════════════════════
// Connector queries
// ═══════════════════════════════════════════════════════════════════════════

export async function findConnectorsByApplicationId(
    exec: SqlQueryable,
    applicationId: string
): Promise<ConnectorRow[]> {
    return exec.query<ConnectorRow>(
        `SELECT ${CONNECTOR_SELECT} FROM applications.connectors
         WHERE application_id = $1`,
        [applicationId]
    )
}

export async function findFirstConnectorByApplicationId(
    exec: SqlQueryable,
    applicationId: string
): Promise<ConnectorRow | null> {
    const rows = await exec.query<ConnectorRow>(
        `SELECT ${CONNECTOR_SELECT} FROM applications.connectors
         WHERE application_id = $1
         LIMIT 1`,
        [applicationId]
    )
    return rows[0] ?? null
}

export async function createConnector(
    exec: SqlQueryable,
    input: {
        applicationId: string
        name: VersionedLocalizedContent<string>
        description?: VersionedLocalizedContent<string> | null
        sortOrder?: number
        userId: string
    }
): Promise<ConnectorRow> {
    const rows = await exec.query<ConnectorRow>(
        `INSERT INTO applications.connectors (application_id, name, description, sort_order, _upl_created_by, _upl_updated_by)
         VALUES ($1, $2, $3, $4, $5, $5)
         RETURNING ${CONNECTOR_SELECT}`,
        [
            input.applicationId,
            JSON.stringify(input.name),
            input.description ? JSON.stringify(input.description) : null,
            input.sortOrder ?? 0,
            input.userId
        ]
    )
    return rows[0]
}

// ═══════════════════════════════════════════════════════════════════════════
// ConnectorPublication queries
// ═══════════════════════════════════════════════════════════════════════════

export async function findConnectorPublications(
    exec: SqlQueryable,
    connectorId: string
): Promise<ConnectorPublicationRow[]> {
    return exec.query<ConnectorPublicationRow>(
        `SELECT ${CONNECTOR_PUB_SELECT} FROM applications.connectors_publications
         WHERE connector_id = $1`,
        [connectorId]
    )
}

export async function findFirstConnectorPublication(
    exec: SqlQueryable,
    connectorId: string
): Promise<ConnectorPublicationRow | null> {
    const rows = await exec.query<ConnectorPublicationRow>(
        `SELECT ${CONNECTOR_PUB_SELECT} FROM applications.connectors_publications
         WHERE connector_id = $1
         LIMIT 1`,
        [connectorId]
    )
    return rows[0] ?? null
}

export async function createConnectorPublication(
    exec: SqlQueryable,
    input: {
        connectorId: string
        publicationId: string
        sortOrder?: number
        userId: string
    }
): Promise<ConnectorPublicationRow> {
    const rows = await exec.query<ConnectorPublicationRow>(
        `INSERT INTO applications.connectors_publications (connector_id, publication_id, sort_order, _upl_created_by, _upl_updated_by)
         VALUES ($1, $2, $3, $4, $4)
         RETURNING ${CONNECTOR_PUB_SELECT}`,
        [input.connectorId, input.publicationId, input.sortOrder ?? 0, input.userId]
    )
    return rows[0]
}

/**
 * Update all applications linked to a publication to UPDATE_AVAILABLE status.
 * Used when a publication version is activated/published.
 */
export async function notifyLinkedAppsUpdateAvailable(
    exec: SqlQueryable,
    publicationId: string,
    newActiveVersionId?: string
): Promise<number> {
    const params: unknown[] = [publicationId]
    let versionFilter = ''
    if (newActiveVersionId) {
        params.push(newActiveVersionId)
        versionFilter = ` AND (a.last_synced_publication_version_id IS NULL OR a.last_synced_publication_version_id != $${params.length})`
    }
    const rows = await exec.query<{ id: string }>(
        `UPDATE applications.applications a
         SET schema_status = 'update_available',
             _upl_updated_at = NOW(),
             _upl_version = COALESCE(a._upl_version, 1) + 1
         WHERE a.id IN (
             SELECT c.application_id
             FROM applications.connectors c
             INNER JOIN applications.connectors_publications cp ON cp.connector_id = c.id
             WHERE cp.publication_id = $1
         )
         AND a.schema_status = 'synced'${versionFilter}
         RETURNING a.id`,
        params
    )
    return rows.length
}

/**
 * Reset UPDATE_AVAILABLE status to SYNCED for all applications linked to a publication.
 * Used when a publication is being deleted.
 */
export async function resetLinkedAppsToSynced(
    exec: SqlQueryable,
    publicationId: string
): Promise<void> {
    await exec.query(
        `UPDATE applications.applications a
         SET schema_status = 'synced',
             _upl_updated_at = NOW(),
             _upl_version = COALESCE(a._upl_version, 1) + 1
         WHERE a.id IN (
             SELECT c.application_id
             FROM applications.connectors c
             INNER JOIN applications.connectors_publications cp ON cp.connector_id = c.id
             WHERE cp.publication_id = $1
         )
         AND a.schema_status = 'update_available'`,
        [publicationId]
    )
}
