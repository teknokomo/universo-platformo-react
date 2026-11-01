import { activeAppRowCondition, softDeleteSetClause, type DbExecutor, type SqlQueryable } from '@universo-react/utils'
import type { VersionedLocalizedContent } from '@universo-react/types'
import { quoteIdentifier } from '@universo-react/migrations-core'
import { isValidSchemaName } from '@universo-react/schema-ddl'
import { releaseActiveGlobalShortLinksForApplication } from './globalShortLinksStore'
import { revokeGuestSessionIdempotencyForApplication } from './guestSessionIdempotencyStore'
import { releaseActiveApplicationBotBindingsForApplication } from './applicationBotBindingsStore'
import { APPLICATION_RETURNING } from './applicationPersistenceSql'
import { acquireApplicationCopyLock } from './applicationCopyLocking'

export interface ApplicationRecord {
    id: string
    name: VersionedLocalizedContent<string>
    description: VersionedLocalizedContent<string> | null
    settings: Record<string, unknown> | null
    isPublic: boolean
    showInAppList: boolean
    workspacesEnabled: boolean
    schemaName: string | null
    schemaStatus: string | null
    schemaSyncedAt: Date | null
    schemaError: string | null
    version: number
    createdAt: Date
    updatedAt: Date
    updatedBy: string | null
}

export interface ApplicationDetailRecord extends ApplicationRecord {
    connectorsCount: number
    membersCount: number
}

export interface ApplicationListItemRecord extends ApplicationRecord {
    connectorsCount: number
    membersCount: number
    membershipRole: string | null
}

export interface ApplicationMemberRecord {
    id: string
    applicationId: string
    userId: string
    role: string
    comment: VersionedLocalizedContent<string> | null
    createdAt: Date
    email: string | null
    nickname: string | null
}

export interface ApplicationSchemaInfoRecord {
    id: string
    schemaName: string | null
    workspacesEnabled: boolean
    settings: Record<string, unknown> | null
}

export interface ApplicationCopySourceRecord extends ApplicationRecord {
    schemaSnapshot: Record<string, unknown> | null
    appStructureVersion: number | null
    lastSyncedPublicationVersionId: string | null
    installedReleaseMetadata?: Record<string, unknown> | null
}

export interface AuthUserRecord {
    id: string
    email: string | null
}

interface ApplicationListRow extends ApplicationListItemRecord {
    windowTotal: string
}

interface ApplicationMemberListRow extends ApplicationMemberRecord {
    windowTotal: string
}

const activeRowPredicate = (alias?: string): string => {
    return activeAppRowCondition(alias)
}

const assertApplicationSchemaName = (schemaName: string): void => {
    if (!schemaName.startsWith('app_') || !isValidSchemaName(schemaName)) {
        throw new Error(`Invalid application schema name: ${schemaName}`)
    }
}

const APPLICATION_SELECT = `
    a.id,
    a.name,
    a.description,
    a.settings,
    a.is_public AS "isPublic",
    a.show_in_app_list AS "showInAppList",
    a.workspaces_enabled AS "workspacesEnabled",
    a.schema_name AS "schemaName",
    a.schema_status AS "schemaStatus",
    a.schema_synced_at AS "schemaSyncedAt",
    a.schema_error AS "schemaError",
    COALESCE(a._upl_version, 1) AS "version",
    a._upl_created_at AS "createdAt",
    a._upl_updated_at AS "updatedAt",
    a._upl_updated_by AS "updatedBy"
`

const APPLICATION_DETAIL_SELECT = `
    ${APPLICATION_SELECT},
    COALESCE(connector_counts.count, 0)::int AS "connectorsCount",
    COALESCE(member_counts.count, 0)::int AS "membersCount"
`

const DETAILS_JOIN_SQL = `
    LEFT JOIN (
        SELECT application_id, COUNT(*)::int AS count
        FROM applications.obj_connectors
        WHERE ${activeRowPredicate()}
        GROUP BY application_id
    ) connector_counts ON connector_counts.application_id = a.id
    LEFT JOIN (
        SELECT application_id, COUNT(*)::int AS count
        FROM applications.rel_application_users
        WHERE ${activeRowPredicate()}
        GROUP BY application_id
    ) member_counts ON member_counts.application_id = a.id
`

const APPLICATION_MEMBER_SELECT = `
    au.id,
    au.application_id AS "applicationId",
    au.user_id AS "userId",
    au.role,
    au.comment,
    au._upl_created_at AS "createdAt",
    u.email,
    p.nickname
`

const APPLICATION_MEMBER_JOIN_SQL = `
    LEFT JOIN auth.users u ON u.id = au.user_id
    LEFT JOIN profiles.obj_profiles p ON p.user_id = au.user_id
`

const resolveSortDirection = (sortOrder: 'asc' | 'desc'): 'ASC' | 'DESC' => (sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC')

const resolveApplicationOrderColumn = (sortBy: 'name' | 'created' | 'updated'): string => {
    if (sortBy === 'name') {
        return `COALESCE(a.name->'locales'->(a.name->>'_primary')->>'content', a.name->'locales'->'en'->>'content', a.name #>> '{}', '')`
    }

    if (sortBy === 'created') {
        return 'a._upl_created_at'
    }

    return 'a._upl_updated_at'
}

const resolveApplicationMemberOrderColumn = (sortBy: string): string => {
    if (sortBy === 'email') {
        return 'u.email'
    }

    if (sortBy === 'role') {
        return 'au.role'
    }

    return 'au._upl_created_at'
}

export async function listApplications(
    executor: SqlQueryable,
    input: {
        userId: string
        showAll: boolean
        limit: number
        offset: number
        sortBy: 'name' | 'created' | 'updated'
        sortOrder: 'asc' | 'desc'
        search?: string
    }
): Promise<{ items: ApplicationListItemRecord[]; total: number }> {
    const parameters: unknown[] = [input.userId, input.showAll]
    let whereSql = `WHERE ${activeRowPredicate('a')}
        AND ($2::boolean = true OR membership.user_id IS NOT NULL OR (a.is_public = true AND a.show_in_app_list = true))`

    if (input.search) {
        parameters.push(`%${input.search}%`)
        whereSql += ` AND (a.name::text ILIKE $${parameters.length} OR COALESCE(a.description::text, '') ILIKE $${parameters.length})`
    }

    parameters.push(input.limit, input.offset)

    const rows = await executor.query<ApplicationListRow>(
        `
        SELECT
            ${APPLICATION_SELECT},
            COALESCE(connector_counts.count, 0)::int AS "connectorsCount",
            COALESCE(member_counts.count, 0)::int AS "membersCount",
            membership.role AS "membershipRole",
            COUNT(*) OVER() AS "windowTotal"
        FROM applications.obj_applications a
        LEFT JOIN applications.rel_application_users membership
            ON membership.application_id = a.id
           AND membership.user_id = $1
              AND ${activeRowPredicate('membership')}
        ${DETAILS_JOIN_SQL}
        ${whereSql}
        ORDER BY ${resolveApplicationOrderColumn(input.sortBy)} ${resolveSortDirection(input.sortOrder)}, a.id ASC
        LIMIT $${parameters.length - 1}
        OFFSET $${parameters.length}
        `,
        parameters
    )

    const total = rows.length > 0 ? parseInt(String(rows[0].windowTotal), 10) : 0
    const items = rows.map(({ windowTotal: _windowTotal, ...row }) => row)
    return { items, total }
}

export async function findApplicationDetails(executor: SqlQueryable, applicationId: string): Promise<ApplicationDetailRecord | null> {
    const rows = await executor.query<ApplicationDetailRecord>(
        `
        SELECT
            ${APPLICATION_DETAIL_SELECT}
        FROM applications.obj_applications a
        ${DETAILS_JOIN_SQL}
        WHERE a.id = $1
                    AND ${activeRowPredicate('a')}
        LIMIT 1
        `,
        [applicationId]
    )

    return rows[0] ?? null
}

export async function findApplicationSchemaInfo(
    executor: SqlQueryable,
    applicationId: string
): Promise<ApplicationSchemaInfoRecord | null> {
    const rows = await executor.query<ApplicationSchemaInfoRecord>(
        `
        SELECT id, schema_name AS "schemaName", workspaces_enabled AS "workspacesEnabled", settings
        FROM applications.obj_applications
        WHERE id = $1
                    AND ${activeRowPredicate()}
        LIMIT 1
        `,
        [applicationId]
    )

    return rows[0] ?? null
}

export async function findApplicationCopySource(
    executor: SqlQueryable,
    applicationId: string
): Promise<ApplicationCopySourceRecord | null> {
    const rows = await executor.query<ApplicationCopySourceRecord>(
        `
        SELECT
            ${APPLICATION_SELECT},
            a.schema_snapshot AS "schemaSnapshot",
            a.app_structure_version AS "appStructureVersion",
            a.last_synced_publication_version_id AS "lastSyncedPublicationVersionId",
            a.installed_release_metadata AS "installedReleaseMetadata"
        FROM applications.obj_applications a
        WHERE a.id = $1
                    AND ${activeRowPredicate('a')}
        LIMIT 1
        `,
        [applicationId]
    )

    return rows[0] ?? null
}

export async function listApplicationMembers(
    executor: SqlQueryable,
    input: {
        applicationId: string
        limit: number
        offset: number
        sortBy?: string
        sortOrder?: 'asc' | 'desc'
        search?: string
    }
): Promise<{ items: ApplicationMemberRecord[]; total: number }> {
    const parameters: unknown[] = [input.applicationId]
    let whereSql = `
        WHERE au.application_id = $1
            AND ${activeRowPredicate('au')}
    `

    if (input.search) {
        parameters.push(`%${input.search.toLowerCase()}%`)
        whereSql += `
          AND (
              LOWER(COALESCE(u.email, '')) LIKE $${parameters.length}
              OR LOWER(COALESCE(p.nickname, '')) LIKE $${parameters.length}
          )
        `
    }

    parameters.push(input.limit, input.offset)

    const rows = await executor.query<ApplicationMemberListRow>(
        `
        SELECT
            ${APPLICATION_MEMBER_SELECT},
            COUNT(*) OVER() AS "windowTotal"
        FROM applications.rel_application_users au
        ${APPLICATION_MEMBER_JOIN_SQL}
        ${whereSql}
        ORDER BY ${resolveApplicationMemberOrderColumn(input.sortBy ?? 'created')} ${resolveSortDirection(input.sortOrder ?? 'desc')}
        LIMIT $${parameters.length - 1}
        OFFSET $${parameters.length}
        `,
        parameters
    )

    const total = rows.length > 0 ? parseInt(String(rows[0].windowTotal), 10) : 0
    const items = rows.map(({ windowTotal: _windowTotal, ...row }) => row)
    return { items, total }
}

export async function findApplicationMemberById(
    executor: SqlQueryable,
    input: { applicationId: string; memberId: string }
): Promise<ApplicationMemberRecord | null> {
    const rows = await executor.query<ApplicationMemberRecord>(
        `
        SELECT ${APPLICATION_MEMBER_SELECT}
        FROM applications.rel_application_users au
        ${APPLICATION_MEMBER_JOIN_SQL}
        WHERE au.application_id = $1
          AND au.id = $2
                    AND ${activeRowPredicate('au')}
        LIMIT 1
        `,
        [input.applicationId, input.memberId]
    )

    return rows[0] ?? null
}

export async function findApplicationMemberByUserId(
    executor: SqlQueryable,
    input: { applicationId: string; userId: string }
): Promise<ApplicationMemberRecord | null> {
    const rows = await executor.query<ApplicationMemberRecord>(
        `
        SELECT ${APPLICATION_MEMBER_SELECT}
        FROM applications.rel_application_users au
        ${APPLICATION_MEMBER_JOIN_SQL}
        WHERE au.application_id = $1
          AND au.user_id = $2
                    AND ${activeRowPredicate('au')}
        LIMIT 1
        `,
        [input.applicationId, input.userId]
    )

    return rows[0] ?? null
}

export async function findAuthUserByEmail(executor: SqlQueryable, email: string): Promise<AuthUserRecord | null> {
    const rows = await executor.query<AuthUserRecord>(
        `
        SELECT id, email
        FROM auth.users
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
        `,
        [email]
    )

    return rows[0] ?? null
}

export async function insertApplicationMember(
    executor: SqlQueryable,
    input: {
        applicationId: string
        userId: string
        role: string
        comment: VersionedLocalizedContent<string> | null
        createdBy: string
        updatedBy: string
    }
): Promise<ApplicationMemberRecord | null> {
    const rows = await executor.query<ApplicationMemberRecord>(
        `
        WITH inserted AS (
            INSERT INTO applications.rel_application_users (
                application_id,
                user_id,
                role,
                comment,
                _upl_created_by,
                _upl_updated_by
            )
            VALUES ($1, $2, $3, $4::jsonb, $5, $6)
            RETURNING id, application_id, user_id, role, comment, _upl_created_at
        )
        SELECT
            inserted.id,
            inserted.application_id AS "applicationId",
            inserted.user_id AS "userId",
            inserted.role,
            inserted.comment,
            inserted._upl_created_at AS "createdAt",
            u.email,
            p.nickname
        FROM inserted
        LEFT JOIN auth.users u ON u.id = inserted.user_id
        LEFT JOIN profiles.obj_profiles p ON p.user_id = inserted.user_id
        `,
        [input.applicationId, input.userId, input.role, JSON.stringify(input.comment), input.createdBy, input.updatedBy]
    )

    return rows[0] ?? null
}

export async function updateApplicationMember(
    executor: SqlQueryable,
    input: {
        applicationId: string
        memberId: string
        role?: string
        comment?: VersionedLocalizedContent<string> | null
        updatedBy: string
    }
): Promise<ApplicationMemberRecord | null> {
    const assignments: string[] = []
    const parameters: unknown[] = []

    if (input.role !== undefined) {
        parameters.push(input.role)
        assignments.push(`role = $${parameters.length}`)
    }

    if (input.comment !== undefined) {
        parameters.push(JSON.stringify(input.comment))
        assignments.push(`comment = $${parameters.length}::jsonb`)
    }

    parameters.push(input.updatedBy)
    assignments.push(`_upl_updated_by = $${parameters.length}`)
    assignments.push(`_upl_updated_at = NOW()`)
    assignments.push(`_upl_version = COALESCE(_upl_version, 1) + 1`)

    parameters.push(input.applicationId, input.memberId)

    const rows = await executor.query<ApplicationMemberRecord>(
        `
        WITH updated AS (
            UPDATE applications.rel_application_users
            SET ${assignments.join(', ')}
            WHERE application_id = $${parameters.length - 1}
              AND id = $${parameters.length}
                            AND ${activeRowPredicate()}
            RETURNING id, application_id, user_id, role, comment, _upl_created_at
        )
        SELECT
            updated.id,
            updated.application_id AS "applicationId",
            updated.user_id AS "userId",
            updated.role,
            updated.comment,
            updated._upl_created_at AS "createdAt",
            u.email,
            p.nickname
        FROM updated
        LEFT JOIN auth.users u ON u.id = updated.user_id
        LEFT JOIN profiles.obj_profiles p ON p.user_id = updated.user_id
        `,
        parameters
    )

    return rows[0] ?? null
}

export async function deleteApplicationMember(
    executor: SqlQueryable,
    input: { applicationId: string; memberId: string; userId?: string }
): Promise<boolean> {
    const rows = await executor.query<{ id: string }>(
        `
        UPDATE applications.rel_application_users
                SET ${softDeleteSetClause('$3')},
            _upl_version = COALESCE(_upl_version, 1) + 1
        WHERE application_id = $1
          AND id = $2
          AND ${activeRowPredicate()}
        RETURNING id
        `,
        [input.applicationId, input.memberId, input.userId ?? null]
    )

    return rows.length > 0
}

export async function mergeApplicationGuestRuntimeConfig(
    executor: SqlQueryable,
    input: {
        applicationId: string
        guestRuntimeConfig: Record<string, unknown>
        userId: string
    }
): Promise<boolean> {
    const rows = await executor.query<{ id: string }>(
        `
        UPDATE applications.obj_applications AS application
        SET settings = jsonb_set(
                CASE
                    WHEN jsonb_typeof(application.settings) = 'object' THEN application.settings
                    ELSE '{}'::jsonb
                END,
                '{publicRuntime}',
                (
                    CASE
                        WHEN jsonb_typeof(application.settings->'publicRuntime') = 'object' THEN application.settings->'publicRuntime'
                        ELSE '{}'::jsonb
                    END
                ) || jsonb_build_object('guest', $2::jsonb),
                true
            ),
            _upl_updated_by = $3,
            _upl_updated_at = NOW(),
            _upl_version = COALESCE(application._upl_version, 1) + 1
        WHERE application.id = $1
          AND ${activeRowPredicate('application')}
          AND (
              application.settings #> '{publicRuntime,guest}' IS NULL
              OR application.settings #> '{publicRuntime,guest}' = 'null'::jsonb
              OR application.settings #> '{publicRuntime,guest}' = $2::jsonb
          )
        RETURNING application.id
        `,
        [input.applicationId, JSON.stringify(input.guestRuntimeConfig), input.userId]
    )

    return rows.length > 0
}

export async function updateApplicationSyncFields(
    executor: SqlQueryable,
    input: {
        applicationId: string
        schemaName?: string | null
        schemaStatus?: string | null
        schemaSyncedAt?: Date | null
        schemaError?: string | null
        schemaSnapshot?: Record<string, unknown> | null
        lastSyncedPublicationVersionId?: string | null
        appStructureVersion?: number | null
        installedReleaseMetadata?: Record<string, unknown> | null
        userId?: string | null
    }
): Promise<ApplicationCopySourceRecord | null> {
    const assignments: string[] = []
    const parameters: unknown[] = []

    if (input.schemaName !== undefined) {
        parameters.push(input.schemaName)
        assignments.push(`schema_name = $${parameters.length}`)
    }

    if (input.schemaStatus !== undefined) {
        parameters.push(input.schemaStatus)
        assignments.push(`schema_status = $${parameters.length}::applications.application_schema_status`)
    }

    if (input.schemaSyncedAt !== undefined) {
        parameters.push(input.schemaSyncedAt)
        assignments.push(`schema_synced_at = $${parameters.length}`)
    }

    if (input.schemaError !== undefined) {
        parameters.push(input.schemaError)
        assignments.push(`schema_error = $${parameters.length}`)
    }

    if (input.schemaSnapshot !== undefined) {
        parameters.push(JSON.stringify(input.schemaSnapshot))
        assignments.push(`schema_snapshot = $${parameters.length}::jsonb`)
    }

    if (input.lastSyncedPublicationVersionId !== undefined) {
        parameters.push(input.lastSyncedPublicationVersionId)
        assignments.push(`last_synced_publication_version_id = $${parameters.length}`)
    }

    if (input.appStructureVersion !== undefined) {
        parameters.push(input.appStructureVersion)
        assignments.push(`app_structure_version = $${parameters.length}`)
    }

    if (input.installedReleaseMetadata !== undefined) {
        parameters.push(JSON.stringify(input.installedReleaseMetadata))
        assignments.push(`installed_release_metadata = $${parameters.length}::jsonb`)
    }

    parameters.push(input.userId ?? null)
    assignments.push(`_upl_updated_by = $${parameters.length}`)
    assignments.push(`_upl_updated_at = NOW()`)
    assignments.push(`_upl_version = COALESCE(_upl_version, 1) + 1`)

    parameters.push(input.applicationId)

    const rows = await executor.query<ApplicationCopySourceRecord>(
        `
        UPDATE applications.obj_applications
        SET ${assignments.join(', ')}
        WHERE id = $${parameters.length}
          AND ${activeRowPredicate()}
        RETURNING
            ${APPLICATION_RETURNING},
            schema_snapshot AS "schemaSnapshot",
            app_structure_version AS "appStructureVersion",
            last_synced_publication_version_id AS "lastSyncedPublicationVersionId",
            installed_release_metadata AS "installedReleaseMetadata"
        `,
        parameters
    )

    return rows[0] ?? null
}

export async function deleteApplicationWithSchema(
    executor: DbExecutor,
    input: { applicationId: string; schemaName: string | null; userId?: string }
): Promise<boolean> {
    return executor.transaction(async (trx) => {
        if (input.schemaName) assertApplicationSchemaName(input.schemaName)

        // Serialize deletion with both copies and relation writers before taking
        // the application row lock. This preserves parent-before-child lock order.
        await acquireApplicationCopyLock(trx, input.applicationId)

        const applicationRows = await trx.query<{ id: string }>(
            `
            SELECT id
            FROM applications.obj_applications
            WHERE id = $1
              AND ${activeRowPredicate()}
            FOR UPDATE
            `,
            [input.applicationId]
        )

        if (applicationRows.length === 0) {
            throw new Error('Application was not found or is already deleted')
        }

        if (input.schemaName) {
            await trx.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(input.schemaName)} CASCADE`)
        }

        // Cascade soft-delete child rows (connectors, publication links, members)
        await trx.query(
            `
            UPDATE applications.rel_connector_publications cp
                        SET ${softDeleteSetClause('$2')},
                _upl_version = COALESCE(cp._upl_version, 1) + 1
            FROM applications.obj_connectors c
            WHERE cp.connector_id = c.id
              AND c.application_id = $1
                            AND ${activeRowPredicate('cp')}
            `,
            [input.applicationId, input.userId ?? null]
        )

        await trx.query(
            `
            UPDATE applications.obj_connectors
                        SET ${softDeleteSetClause('$2')},
                _upl_version = COALESCE(_upl_version, 1) + 1
            WHERE application_id = $1
              AND ${activeRowPredicate()}
            `,
            [input.applicationId, input.userId ?? null]
        )

        await releaseActiveApplicationBotBindingsForApplication(trx, input.applicationId)

        // Release links through their owning store before the application tombstone,
        // while RLS still recognizes the deleting actor as an active application manager.
        await releaseActiveGlobalShortLinksForApplication(trx, input.applicationId, input.userId ?? null)

        // The replay table stores encrypted session secrets centrally and is
        // soft-delete-owned by neither the application nor its runtime schema.
        // Purge those records atomically before tombstoning the application.
        await revokeGuestSessionIdempotencyForApplication(trx, input.applicationId)

        // Soft-delete the application while the active manager membership is
        // still present for the application's UPDATE RLS policy.
        const rows = await trx.query<{ id: string }>(
            `
            UPDATE applications.obj_applications
                        SET ${softDeleteSetClause('$2')},
                _upl_version = COALESCE(_upl_version, 1) + 1
            WHERE id = $1
              AND ${activeRowPredicate()}
            RETURNING id
            `,
            [input.applicationId, input.userId ?? null]
        )

        if (rows.length === 0) {
            throw new Error('Application was not soft-deleted')
        }

        // Membership policies authorize this cascade from the still-active
        // membership snapshot; run it only after the application tombstone.
        await trx.query(
            `
            UPDATE applications.rel_application_users
                        SET ${softDeleteSetClause('$2')},
                _upl_version = COALESCE(_upl_version, 1) + 1
            WHERE application_id = $1
              AND ${activeRowPredicate()}
            `,
            [input.applicationId, input.userId ?? null]
        )

        return true
    })
}
