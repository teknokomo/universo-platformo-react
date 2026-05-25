import type { VersionedLocalizedContent } from '@universo/types'
import { activeAppRowCondition, softDeleteSetClause, type SqlQueryable } from '@universo/utils'

export interface ConnectorListQuery {
    applicationId: string
    limit: number
    offset: number
    sortBy: 'name' | 'created' | 'updated'
    sortOrder: 'asc' | 'desc'
    search?: string
}

export interface ConnectorRecord {
    id: string
    applicationId: string
    name: VersionedLocalizedContent<string> | null
    description: VersionedLocalizedContent<string> | null
    sortOrder: number
    isSingleMetahub: boolean
    isRequiredMetahub: boolean
    version: number
    createdAt: Date
    updatedAt: Date
    updatedBy?: string | null
}

export interface ConnectorLinkRecord {
    id: string
    connectorId: string
    publicationId: string
    schemaOptions: Record<string, unknown>
    sortOrder: number
    version: number
    createdAt: Date
    updatedAt: Date
}

export interface ConnectorPublicationListItem {
    id: string
    connectorId: string
    publicationId: string
    schemaOptions: Record<string, unknown>
    sortOrder: number
    createdAt: Date
    publication: {
        id: string
        name: unknown
        description: unknown
        metahubId: string | null
        metahub: {
            id: string | null
            codename: string | null
            name: unknown
        }
    } | null
}

interface ConnectorListRow extends ConnectorRecord {
    windowTotal: string
}

interface ApplicationStatusRow {
    id: string
    schemaStatus: string | null
}

const activeRowPredicate = (alias?: string): string => {
    return activeAppRowCondition(alias)
}

const metahubActiveRowPredicate = (alias?: string): string => {
    return activeAppRowCondition(alias)
}

const CONNECTOR_SELECT = `
    id,
    application_id AS "applicationId",
    name,
    description,
    sort_order AS "sortOrder",
    is_single_metahub AS "isSingleMetahub",
    is_required_metahub AS "isRequiredMetahub",
    _upl_version AS "version",
    _upl_created_at AS "createdAt",
    _upl_updated_at AS "updatedAt",
    _upl_updated_by AS "updatedBy"
`

const CONNECTOR_RETURNING = CONNECTOR_SELECT

function resolveConnectorOrderColumn(sortBy: ConnectorListQuery['sortBy']): string {
    if (sortBy === 'name') {
        return `COALESCE(name->>(name->>'_primary'), name->>'en', '')`
    }

    if (sortBy === 'created') {
        return '_upl_created_at'
    }

    return '_upl_updated_at'
}

function resolveSortDirection(sortOrder: ConnectorListQuery['sortOrder']): 'ASC' | 'DESC' {
    return sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC'
}

export async function listConnectors(
    executor: SqlQueryable,
    query: ConnectorListQuery
): Promise<{ items: ConnectorRecord[]; total: number }> {
    const orderColumn = resolveConnectorOrderColumn(query.sortBy)
    const direction = resolveSortDirection(query.sortOrder)
    const parameters: unknown[] = [query.applicationId]

    let whereSql = `WHERE application_id = $1
        AND ${activeRowPredicate()}`

    if (query.search) {
        parameters.push(`%${query.search}%`)
        whereSql += ` AND (name::text ILIKE $${parameters.length} OR COALESCE(description::text, '') ILIKE $${parameters.length})`
    }

    parameters.push(query.limit, query.offset)

    const rows = await executor.query<ConnectorListRow>(
        `
        SELECT
            ${CONNECTOR_SELECT},
            COUNT(*) OVER() AS "windowTotal"
        FROM applications.obj_connectors
        ${whereSql}
        ORDER BY ${orderColumn} ${direction}
        LIMIT $${parameters.length - 1}
        OFFSET $${parameters.length}
        `,
        parameters
    )

    const total = rows.length > 0 ? Math.max(0, parseInt(String(rows[0].windowTotal || '0'), 10)) : 0
    const items = rows.map(({ windowTotal: _windowTotal, ...row }) => row)

    return { items, total }
}

export async function findConnector(executor: SqlQueryable, applicationId: string, connectorId: string): Promise<ConnectorRecord | null> {
    const rows = await executor.query<ConnectorRecord>(
        `
        SELECT ${CONNECTOR_SELECT}
        FROM applications.obj_connectors
        WHERE id = $1
          AND application_id = $2
                    AND ${activeRowPredicate()}
        LIMIT 1
        `,
        [connectorId, applicationId]
    )

    return rows[0] ?? null
}

export async function findFirstConnectorByApplicationId(executor: SqlQueryable, applicationId: string): Promise<ConnectorRecord | null> {
    const rows = await executor.query<ConnectorRecord>(
        `
        SELECT ${CONNECTOR_SELECT}
        FROM applications.obj_connectors
        WHERE application_id = $1
          AND ${activeRowPredicate()}
        ORDER BY sort_order ASC, _upl_created_at ASC, id ASC
        LIMIT 1
        `,
        [applicationId]
    )

    return rows[0] ?? null
}

export async function findApplicationStatus(executor: SqlQueryable, applicationId: string): Promise<ApplicationStatusRow | null> {
    const rows = await executor.query<ApplicationStatusRow>(
        `
        SELECT
            id,
            schema_status AS "schemaStatus"
        FROM applications.obj_applications
        WHERE id = $1
                    AND ${activeRowPredicate()}
        LIMIT 1
        `,
        [applicationId]
    )

    return rows[0] ?? null
}

export async function insertConnector(
    executor: SqlQueryable,
    input: {
        applicationId: string
        name: VersionedLocalizedContent<string>
        description: VersionedLocalizedContent<string> | null
        sortOrder: number
        userId?: string
    }
): Promise<ConnectorRecord> {
    const rows = await executor.query<ConnectorRecord>(
        `
        INSERT INTO applications.obj_connectors (
            application_id,
            name,
            description,
            sort_order,
            _upl_created_by,
            _upl_updated_by
        )
        VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, $6)
        RETURNING ${CONNECTOR_RETURNING}
        `,
        [
            input.applicationId,
            JSON.stringify(input.name),
            JSON.stringify(input.description),
            input.sortOrder,
            input.userId ?? null,
            input.userId ?? null
        ]
    )

    return rows[0]
}

export async function updateConnector(
    executor: SqlQueryable,
    input: {
        connectorId: string
        applicationId: string
        name?: VersionedLocalizedContent<string> | null
        description?: VersionedLocalizedContent<string> | null
        sortOrder?: number
        userId?: string
    }
): Promise<ConnectorRecord | null> {
    const assignments: string[] = []
    const parameters: unknown[] = []

    if (input.name !== undefined) {
        parameters.push(JSON.stringify(input.name))
        assignments.push(`name = $${parameters.length}::jsonb`)
    }

    if (input.description !== undefined) {
        parameters.push(JSON.stringify(input.description))
        assignments.push(`description = $${parameters.length}::jsonb`)
    }

    if (input.sortOrder !== undefined) {
        parameters.push(input.sortOrder)
        assignments.push(`sort_order = $${parameters.length}`)
    }

    parameters.push(input.userId ?? null)
    assignments.push(`_upl_updated_by = $${parameters.length}`)
    assignments.push(`_upl_updated_at = now()`)
    assignments.push(`_upl_version = _upl_version + 1`)

    parameters.push(input.connectorId, input.applicationId)

    const rows = await executor.query<ConnectorRecord>(
        `
        UPDATE applications.obj_connectors
        SET ${assignments.join(', ')}
        WHERE id = $${parameters.length - 1}
          AND application_id = $${parameters.length}
                    AND ${activeRowPredicate()}
        RETURNING ${CONNECTOR_RETURNING}
        `,
        parameters
    )

    return rows[0] ?? null
}

export async function deleteConnector(
    executor: SqlQueryable,
    applicationId: string,
    connectorId: string,
    userId?: string
): Promise<boolean> {
    const rows = await executor.query<{ id: string }>(
        `
        UPDATE applications.obj_connectors
                SET ${softDeleteSetClause('$3')},
            _upl_version = COALESCE(_upl_version, 1) + 1
        WHERE id = $1
          AND application_id = $2
          AND ${activeRowPredicate()}
        RETURNING id
        `,
        [connectorId, applicationId, userId ?? null]
    )

    return rows.length > 0
}

export async function touchApplicationSchemaSyncedIfUpdateAvailable(
    executor: SqlQueryable,
    applicationId: string,
    userId?: string
): Promise<boolean> {
    const rows = await executor.query<{ id: string }>(
        `
        UPDATE applications.obj_applications
        SET schema_status = 'synced',
            _upl_updated_at = now(),
            _upl_updated_by = $2,
            _upl_version = _upl_version + 1
        WHERE id = $1
          AND schema_status = 'update_available'
                    AND ${activeRowPredicate()}
        RETURNING id
        `,
        [applicationId, userId ?? null]
    )

    return rows.length > 0
}

export async function countConnectorPublicationLinks(executor: SqlQueryable, connectorId: string): Promise<number> {
    const rows = await executor.query<Array<{ count: string }>[number]>(
        `
        SELECT COUNT(*)::text AS count
        FROM applications.rel_connector_publications
        WHERE connector_id = $1
                    AND ${activeRowPredicate()}
        `,
        [connectorId]
    )

    return rows[0] ? parseInt(rows[0].count, 10) : 0
}

export async function findConnectorPublicationLink(
    executor: SqlQueryable,
    connectorId: string,
    publicationId: string
): Promise<ConnectorLinkRecord | null> {
    const rows = await executor.query<ConnectorLinkRecord>(
        `
        SELECT
            id,
            connector_id AS "connectorId",
            publication_id AS "publicationId",
            schema_options AS "schemaOptions",
            sort_order AS "sortOrder",
            _upl_version AS "version",
            _upl_created_at AS "createdAt",
            _upl_updated_at AS "updatedAt"
        FROM applications.rel_connector_publications
        WHERE connector_id = $1
          AND publication_id = $2
                    AND ${activeRowPredicate()}
        LIMIT 1
        `,
        [connectorId, publicationId]
    )

    return rows[0] ?? null
}

export async function findFirstConnectorPublicationLinkByConnectorId(
    executor: SqlQueryable,
    connectorId: string
): Promise<ConnectorLinkRecord | null> {
    const rows = await executor.query<ConnectorLinkRecord>(
        `
        SELECT
            id,
            connector_id AS "connectorId",
            publication_id AS "publicationId",
            schema_options AS "schemaOptions",
            sort_order AS "sortOrder",
            _upl_version AS "version",
            _upl_created_at AS "createdAt",
            _upl_updated_at AS "updatedAt"
        FROM applications.rel_connector_publications
        WHERE connector_id = $1
          AND ${activeRowPredicate()}
        ORDER BY sort_order ASC, _upl_created_at ASC, id ASC
        LIMIT 1
        `,
        [connectorId]
    )

    return rows[0] ?? null
}

export async function findConnectorPublicationLinkById(
    executor: SqlQueryable,
    connectorId: string,
    linkId: string
): Promise<ConnectorLinkRecord | null> {
    const rows = await executor.query<ConnectorLinkRecord>(
        `
        SELECT
            id,
            connector_id AS "connectorId",
            publication_id AS "publicationId",
            schema_options AS "schemaOptions",
            sort_order AS "sortOrder",
            _upl_version AS "version",
            _upl_created_at AS "createdAt",
            _upl_updated_at AS "updatedAt"
        FROM applications.rel_connector_publications
        WHERE id = $1
          AND connector_id = $2
                    AND ${activeRowPredicate()}
        LIMIT 1
        `,
        [linkId, connectorId]
    )

    return rows[0] ?? null
}

export async function insertConnectorPublicationLink(
    executor: SqlQueryable,
    input: {
        connectorId: string
        publicationId: string
        sortOrder: number
        schemaOptions?: Record<string, unknown> | null
        userId?: string
    }
): Promise<ConnectorLinkRecord> {
    const rows = await executor.query<ConnectorLinkRecord>(
        `
        INSERT INTO applications.rel_connector_publications (
            connector_id,
            publication_id,
            schema_options,
            sort_order,
            _upl_created_by,
            _upl_updated_by
        )
        VALUES ($1, $2, $3::jsonb, $4, $5, $6)
        RETURNING
            id,
            connector_id AS "connectorId",
            publication_id AS "publicationId",
            schema_options AS "schemaOptions",
            sort_order AS "sortOrder",
            _upl_version AS "version",
            _upl_created_at AS "createdAt",
            _upl_updated_at AS "updatedAt"
        `,
        [
            input.connectorId,
            input.publicationId,
            JSON.stringify(input.schemaOptions ?? {}),
            input.sortOrder,
            input.userId ?? null,
            input.userId ?? null
        ]
    )

    return rows[0]
}

export async function deleteConnectorPublicationLink(
    executor: SqlQueryable,
    connectorId: string,
    linkId: string,
    userId?: string
): Promise<boolean> {
    const rows = await executor.query<{ id: string }>(
        `
        UPDATE applications.rel_connector_publications
                SET ${softDeleteSetClause('$3')},
            _upl_version = COALESCE(_upl_version, 1) + 1
        WHERE id = $1
          AND connector_id = $2
          AND ${activeRowPredicate()}
        RETURNING id
        `,
        [linkId, connectorId, userId ?? null]
    )

    return rows.length > 0
}

export async function updateConnectorPublicationSchemaOptions(
    executor: SqlQueryable,
    input: {
        connectorId: string
        linkId: string
        schemaOptions: Record<string, unknown>
        userId?: string | null
    }
): Promise<ConnectorLinkRecord | null> {
    const rows = await executor.query<ConnectorLinkRecord>(
        `
        UPDATE applications.rel_connector_publications
        SET schema_options = $3::jsonb,
            _upl_updated_at = NOW(),
            _upl_updated_by = $4,
            _upl_version = COALESCE(_upl_version, 1) + 1
        WHERE id = $1
          AND connector_id = $2
          AND ${activeRowPredicate()}
        RETURNING
            id,
            connector_id AS "connectorId",
            publication_id AS "publicationId",
            schema_options AS "schemaOptions",
            sort_order AS "sortOrder",
            _upl_version AS "version",
            _upl_created_at AS "createdAt",
            _upl_updated_at AS "updatedAt"
        `,
        [input.linkId, input.connectorId, JSON.stringify(input.schemaOptions), input.userId ?? null]
    )

    return rows[0] ?? null
}

export async function listConnectorPublicationLinks(executor: SqlQueryable, connectorId: string): Promise<ConnectorPublicationListItem[]> {
    const rows = await executor.query<
        Array<{
            id: string
            connectorId: string
            publicationId: string
            schemaOptions: Record<string, unknown>
            sortOrder: number
            createdAt: Date
            publication_id: string | null
            publication_name: unknown
            publication_description: unknown
            metahubId: string | null
            metahub_codename: string | null
            metahub_name: unknown
        }>[number]
    >(
        `
        SELECT
            cp.id,
            cp.connector_id AS "connectorId",
            cp.publication_id AS "publicationId",
            cp.schema_options AS "schemaOptions",
            cp.sort_order AS "sortOrder",
            cp._upl_created_at AS "createdAt",
            p.id AS publication_id,
            p.name AS publication_name,
            p.description AS publication_description,
            p.metahub_id AS "metahubId",
            m.codename AS metahub_codename,
            m.name AS metahub_name
        FROM applications.rel_connector_publications cp
                LEFT JOIN metahubs.doc_publications p ON p.id = cp.publication_id
                    AND ${metahubActiveRowPredicate('p')}
                LEFT JOIN metahubs.obj_metahubs m ON m.id = p.metahub_id
                    AND ${metahubActiveRowPredicate('m')}
        WHERE cp.connector_id = $1
                    AND ${activeRowPredicate('cp')}
        ORDER BY cp.sort_order ASC
        `,
        [connectorId]
    )

    return rows.map((row) => ({
        id: row.id,
        connectorId: row.connectorId,
        publicationId: row.publicationId,
        schemaOptions: row.schemaOptions ?? {},
        sortOrder: row.sortOrder,
        createdAt: row.createdAt,
        publication: row.publication_id
            ? {
                  id: row.publication_id,
                  name: row.publication_name,
                  description: row.publication_description,
                  metahubId: row.metahubId,
                  metahub: {
                      id: row.metahubId,
                      codename: row.metahub_codename,
                      name: row.metahub_name
                  }
              }
            : null
    }))
}
