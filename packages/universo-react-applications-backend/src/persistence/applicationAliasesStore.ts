import type { ApplicationAliasRoutingMode } from '@universo-react/types'
import { escapeLikeWildcards, type DbExecutor, type SqlQueryable } from '@universo-react/utils'

export const APPLICATION_ALIAS_ACTIVE_UNIQUE_INDEX = 'uq_application_aliases_active_alias'
export const APPLICATION_ALIAS_PRIMARY_UNIQUE_INDEX = 'uq_application_aliases_active_primary'

export interface ApplicationAliasRow {
    id: string
    applicationId: string
    alias: string
    isPrimary: boolean
    releasedAt: Date | string | null
    createdAt: Date | string
    updatedAt: Date | string
}

export interface ApplicationAliasManagementRow extends ApplicationAliasRow {
    applicationNameValue: unknown
    applicationContextValue: unknown
    routingMode: string
    status: 'active' | 'inactive' | 'released'
}

export interface ApplicationAliasPolicyRow {
    applicationId: string
    routingMode: string
}

export interface ListApplicationAliasesInput {
    limit: number
    offset: number
    sortBy: 'alias' | 'application' | 'created'
    sortOrder: 'asc' | 'desc'
    search?: string
    applicationId?: string
    includeReleased: boolean
    /** Preferred display locale for human application labels resolved server-side. */
    locale?: 'en' | 'ru'
}

export interface ListApplicationAliasApplicationOptionsInput {
    limit: number
    offset: number
    search?: string
}

export interface ApplicationAliasApplicationOptionRow {
    id: string
    nameValue: unknown
    contextValue: unknown
}

const ALIAS_RETURNING = `
    id,
    application_id AS "applicationId",
    alias,
    is_primary AS "isPrimary",
    released_at AS "releasedAt",
    _upl_created_at AS "createdAt",
    _upl_updated_at AS "updatedAt"
`

const ALIAS_MANAGEMENT_SELECT = `
    aa.id,
    aa.application_id AS "applicationId",
    aa.alias,
    aa.is_primary AS "isPrimary",
    aa.released_at AS "releasedAt",
    aa._upl_created_at AS "createdAt",
    aa._upl_updated_at AS "updatedAt",
    a.name AS "applicationNameValue",
    a.description AS "applicationContextValue",
    COALESCE(a.alias_routing_mode::text, 'direct') AS "routingMode",
    CASE
        WHEN aa.released_at IS NOT NULL THEN 'released'
        WHEN a.id IS NULL
          OR a._upl_deleted = true
          OR a._app_deleted = true
          OR a._upl_archived = true
          OR a._app_archived = true THEN 'inactive'
        ELSE 'active'
    END AS status
`

const activeApplicationPredicate = (alias = 'a'): string => `
    ${alias}._upl_deleted = false
    AND ${alias}._app_deleted = false
    AND ${alias}._upl_archived = false
    AND ${alias}._app_archived = false
`

const activeAliasPredicate = (alias = ''): string => `
    ${alias ? `${alias}.` : ''}_upl_deleted = false
    AND ${alias ? `${alias}.` : ''}_app_deleted = false
    AND ${alias ? `${alias}.` : ''}_upl_archived = false
    AND ${alias ? `${alias}.` : ''}_app_archived = false
`

const resolveAliasOrderColumn = (sortBy: ListApplicationAliasesInput['sortBy']): string => {
    if (sortBy === 'alias') return 'aa.alias'
    if (sortBy === 'application') return `COALESCE(a.name::text, '')`
    return 'aa._upl_created_at'
}

const resolveSortDirection = (sortOrder: ListApplicationAliasesInput['sortOrder']): 'ASC' | 'DESC' => (sortOrder === 'asc' ? 'ASC' : 'DESC')

const buildAliasListFilter = (
    input: Pick<ListApplicationAliasesInput, 'search' | 'applicationId' | 'includeReleased'>
): { whereSql: string; parameters: unknown[] } => {
    const conditions: string[] = []
    const parameters: unknown[] = []

    if (!input.includeReleased) {
        conditions.push('aa.released_at IS NULL')
    }

    conditions.push(activeAliasPredicate('aa').trim())

    if (input.applicationId) {
        parameters.push(input.applicationId)
        conditions.push(`aa.application_id = $${parameters.length}`)
    }

    if (input.search) {
        parameters.push(`%${escapeLikeWildcards(input.search)}%`)
        const placeholder = `$${parameters.length}`
        conditions.push(`(
            aa.alias ILIKE ${placeholder}
            OR COALESCE(a.name::text, '') ILIKE ${placeholder}
            OR COALESCE(a.description::text, '') ILIKE ${placeholder}
        )`)
    }

    return {
        whereSql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
        parameters
    }
}

export async function listApplicationAliases(
    executor: SqlQueryable,
    input: ListApplicationAliasesInput
): Promise<{ items: ApplicationAliasManagementRow[]; total: number }> {
    const { whereSql, parameters } = buildAliasListFilter(input)
    const countRows = await executor.query<{ count: number | string }>(
        `
        SELECT COUNT(*)::int AS count
        FROM applications.obj_application_aliases aa
        LEFT JOIN applications.obj_applications a ON a.id = aa.application_id
        ${whereSql}
        `,
        parameters
    )

    const dataParameters = [...parameters, input.limit, input.offset]
    const limitPlaceholder = `$${dataParameters.length - 1}`
    const offsetPlaceholder = `$${dataParameters.length}`
    const items = await executor.query<ApplicationAliasManagementRow>(
        `
        SELECT ${ALIAS_MANAGEMENT_SELECT}
        FROM applications.obj_application_aliases aa
        LEFT JOIN applications.obj_applications a ON a.id = aa.application_id
        ${whereSql}
        ORDER BY ${resolveAliasOrderColumn(input.sortBy)} ${resolveSortDirection(input.sortOrder)}, aa.id ASC
        LIMIT ${limitPlaceholder}
        OFFSET ${offsetPlaceholder}
        `,
        dataParameters
    )

    return { items, total: Number(countRows[0]?.count ?? 0) }
}

export async function listApplicationAliasApplicationOptions(
    executor: SqlQueryable,
    input: ListApplicationAliasApplicationOptionsInput
): Promise<{ items: ApplicationAliasApplicationOptionRow[]; total: number }> {
    const parameters: unknown[] = []
    let whereSql = `WHERE ${activeApplicationPredicate('a')}`

    if (input.search) {
        parameters.push(`%${escapeLikeWildcards(input.search)}%`)
        whereSql += ` AND (a.name::text ILIKE $${parameters.length} OR COALESCE(a.description::text, '') ILIKE $${parameters.length})`
    }

    const countRows = await executor.query<{ count: number | string }>(
        `
        SELECT COUNT(*)::int AS count
        FROM applications.obj_applications a
        ${whereSql}
        `,
        parameters
    )

    const dataParameters = [...parameters, input.limit, input.offset]
    const items = await executor.query<ApplicationAliasApplicationOptionRow>(
        `
        SELECT a.id, a.name AS "nameValue", a.description AS "contextValue"
        FROM applications.obj_applications a
        ${whereSql}
        ORDER BY a._upl_created_at DESC, a.id ASC
        LIMIT $${dataParameters.length - 1}
        OFFSET $${dataParameters.length}
        `,
        dataParameters
    )

    return { items, total: Number(countRows[0]?.count ?? 0) }
}

export async function listApplicationAliasesByApplication(
    executor: SqlQueryable,
    applicationId: string
): Promise<ApplicationAliasManagementRow[]> {
    return executor.query<ApplicationAliasManagementRow>(
        `
        SELECT ${ALIAS_MANAGEMENT_SELECT}
        FROM applications.obj_application_aliases aa
        LEFT JOIN applications.obj_applications a ON a.id = aa.application_id
        WHERE aa.application_id = $1
          AND aa.released_at IS NULL
          AND ${activeAliasPredicate('aa')}
        ORDER BY aa.is_primary DESC, aa._upl_created_at ASC, aa.id ASC
        `,
        [applicationId]
    )
}

export async function findApplicationAliasById(executor: SqlQueryable, aliasId: string): Promise<ApplicationAliasRow | null> {
    const rows = await executor.query<ApplicationAliasRow>(
        `
        SELECT ${ALIAS_RETURNING}
        FROM applications.obj_application_aliases
        WHERE id = $1
          AND ${activeAliasPredicate()}
        LIMIT 1
        `,
        [aliasId]
    )
    return rows[0] ?? null
}

/**
 * Resolve an active alias to its application without returning alias metadata.
 * The SECURITY DEFINER resolver bypasses the alias SELECT policy (which is
 * reserved for global alias managers), so a plain member can reach the normal
 * application access guard for private and public applications alike.
 */
export async function findApplicationIdByActiveAlias(executor: SqlQueryable, alias: string): Promise<string | null> {
    const rows = await executor.query<{ applicationId: string | null }>(
        `
        SELECT applications.resolve_application_alias($1) AS "applicationId"
        `,
        [alias]
    )

    return rows[0]?.applicationId ?? null
}

export async function findApplicationAliasByIdForUpdate(executor: DbExecutor, aliasId: string): Promise<ApplicationAliasRow | null> {
    const rows = await executor.query<ApplicationAliasRow>(
        `
        SELECT ${ALIAS_RETURNING}
        FROM applications.obj_application_aliases
        WHERE id = $1
          AND ${activeAliasPredicate()}
        LIMIT 1
        FOR UPDATE
        `,
        [aliasId]
    )
    return rows[0] ?? null
}

export async function listActiveApplicationAliasesForUpdate(executor: DbExecutor, applicationId: string): Promise<ApplicationAliasRow[]> {
    return executor.query<ApplicationAliasRow>(
        `
        SELECT ${ALIAS_RETURNING}
        FROM applications.obj_application_aliases
        WHERE application_id = $1
          AND released_at IS NULL
          AND ${activeAliasPredicate()}
        ORDER BY _upl_created_at ASC, id ASC
        FOR UPDATE
        `,
        [applicationId]
    )
}

export async function lockApplicationAliasTransitions(executor: DbExecutor, applicationId: string): Promise<void> {
    // The published `applications.create_application_alias` migration function
    // takes the same lock key with 32-bit `hashtext`, and applied migrations are
    // immutable, so this pair intentionally stays in that hash space.
    await executor.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`application-aliases:${applicationId}`])
}

export async function getApplicationAliasPolicy(executor: SqlQueryable, applicationId: string): Promise<ApplicationAliasPolicyRow | null> {
    const rows = await executor.query<ApplicationAliasPolicyRow>(
        `
        SELECT id AS "applicationId", alias_routing_mode::text AS "routingMode"
        FROM applications.obj_applications a
        WHERE id = $1
          AND ${activeApplicationPredicate('a')}
        LIMIT 1
        `,
        [applicationId]
    )
    return rows[0] ?? null
}

export async function getApplicationAliasPolicyForUpdate(
    executor: DbExecutor,
    applicationId: string,
    includeInactive = false
): Promise<ApplicationAliasPolicyRow | null> {
    const activePredicate = includeInactive ? '' : `AND ${activeApplicationPredicate('a')}`
    const rows = await executor.query<ApplicationAliasPolicyRow>(
        `
        SELECT id AS "applicationId", alias_routing_mode::text AS "routingMode"
        FROM applications.obj_applications a
        WHERE id = $1
          ${activePredicate}
        LIMIT 1
        FOR UPDATE
        `,
        [applicationId]
    )
    return rows[0] ?? null
}

/**
 * Create an alias and perform the optional primary transition inside the
 * guarded SECURITY DEFINER function. Create permission therefore never needs
 * UPDATE access to the alias table.
 */
export async function createApplicationAliasAtomically(
    executor: DbExecutor,
    input: { applicationId: string; alias: string; makePrimary: boolean; userId: string }
): Promise<ApplicationAliasRow> {
    const rows = await executor.query<ApplicationAliasRow>(
        `
        SELECT
            id,
            application_id AS "applicationId",
            alias,
            is_primary AS "isPrimary",
            released_at AS "releasedAt",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        FROM applications.create_application_alias($1, $2, $3, $4)
        `,
        [input.applicationId, input.alias, input.makePrimary, input.userId]
    )
    if (!rows[0]) throw new Error('Application alias atomic create returned no row')
    return rows[0]
}

export async function updateApplicationAliasValue(
    executor: DbExecutor,
    aliasId: string,
    alias: string,
    userId: string
): Promise<ApplicationAliasRow | null> {
    const rows = await executor.query<ApplicationAliasRow>(
        `
        UPDATE applications.obj_application_aliases
        SET alias = $2,
            _upl_updated_at = now(),
            _upl_updated_by = $3,
            _upl_version = _upl_version + 1
        WHERE id = $1
          AND released_at IS NULL
          AND ${activeAliasPredicate()}
        RETURNING ${ALIAS_RETURNING}
        `,
        [aliasId, alias, userId]
    )
    return rows[0] ?? null
}

export async function clearOtherPrimaryApplicationAliases(
    executor: DbExecutor,
    applicationId: string,
    keepAliasId: string,
    userId: string
): Promise<string[]> {
    const rows = await executor.query<{ id: string }>(
        `
        UPDATE applications.obj_application_aliases
        SET is_primary = false,
            _upl_updated_at = now(),
            _upl_updated_by = $3,
            _upl_version = _upl_version + 1
        WHERE application_id = $1
          AND id <> $2
          AND released_at IS NULL
          AND is_primary = true
          AND ${activeAliasPredicate()}
        RETURNING id
        `,
        [applicationId, keepAliasId, userId]
    )
    return rows.map((row) => row.id)
}

export async function clearApplicationAliasPrimaries(executor: DbExecutor, applicationId: string, userId: string): Promise<string[]> {
    const rows = await executor.query<{ id: string }>(
        `
        UPDATE applications.obj_application_aliases
        SET is_primary = false,
            _upl_updated_at = now(),
            _upl_updated_by = $2,
            _upl_version = _upl_version + 1
        WHERE application_id = $1
          AND released_at IS NULL
          AND is_primary = true
          AND ${activeAliasPredicate()}
        RETURNING id
        `,
        [applicationId, userId]
    )
    return rows.map((row) => row.id)
}

export async function setApplicationAliasPrimary(
    executor: DbExecutor,
    applicationId: string,
    aliasId: string,
    userId: string
): Promise<ApplicationAliasRow | null> {
    const rows = await executor.query<ApplicationAliasRow>(
        `
        UPDATE applications.obj_application_aliases
        SET is_primary = true,
            _upl_updated_at = now(),
            _upl_updated_by = $3,
            _upl_version = _upl_version + 1
        WHERE id = $2
          AND application_id = $1
          AND released_at IS NULL
          AND ${activeAliasPredicate()}
        RETURNING ${ALIAS_RETURNING}
        `,
        [applicationId, aliasId, userId]
    )
    return rows[0] ?? null
}

export async function releaseApplicationAlias(executor: DbExecutor, aliasId: string, userId: string): Promise<ApplicationAliasRow | null> {
    const rows = await executor.query<ApplicationAliasRow>(
        `
        UPDATE applications.obj_application_aliases
        SET is_primary = false,
            released_at = now(),
            _upl_updated_at = now(),
            _upl_updated_by = $2,
            _upl_version = _upl_version + 1
        WHERE id = $1
          AND released_at IS NULL
          AND ${activeAliasPredicate()}
        RETURNING ${ALIAS_RETURNING}
        `,
        [aliasId, userId]
    )
    return rows[0] ?? null
}

export async function updateApplicationAliasPolicy(
    executor: DbExecutor,
    applicationId: string,
    routingMode: ApplicationAliasRoutingMode,
    userId: string
): Promise<ApplicationAliasPolicyRow | null> {
    const rows = await executor.query<ApplicationAliasPolicyRow>(
        `
        SELECT "applicationId", "routingMode"
        FROM applications.update_application_alias_routing_mode($1, $2, $3)
        `,
        [applicationId, routingMode, userId]
    )
    return rows[0] ?? null
}
