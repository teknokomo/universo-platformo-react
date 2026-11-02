import { activeAppRowCondition, type DbExecutor, type SqlQueryable } from '@universo-react/utils'
import type { VersionedLocalizedContent } from '@universo-react/types'
import { APPLICATION_RETURNING } from './applicationPersistenceSql'
import { recordApplicationControlAudit } from './applicationControlAuditStore'
import type { ApplicationRecord } from './applicationsStore'

const activeRowPredicate = (alias?: string): string => activeAppRowCondition(alias)

export async function createApplicationWithOwner(
    executor: DbExecutor,
    input: {
        name: VersionedLocalizedContent<string>
        description: VersionedLocalizedContent<string> | null
        isPublic: boolean
        showInAppList?: boolean
        workspacesEnabled: boolean
        userId: string
        resolveSchemaName: (applicationId: string) => string
        validateSchemaName?: (schemaName: string) => boolean
    }
): Promise<ApplicationRecord> {
    return executor.transaction(async (trx) => {
        const [{ id }] = await trx.query<{ id: string }>(`SELECT public.uuid_generate_v7() AS id`)
        const schemaName = input.resolveSchemaName(id)
        if (input.validateSchemaName && !input.validateSchemaName(schemaName)) {
            throw new Error(`Invalid generated application schema name: ${schemaName}`)
        }

        const insertedRows = await trx.query<ApplicationRecord>(
            `
            INSERT INTO applications.obj_applications (
                id,
                name,
                description,
                is_public,
                show_in_app_list,
                workspaces_enabled,
                schema_name,
                _upl_created_by,
                _upl_updated_by
            )
            VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, $6, $7, $8, $9)
            RETURNING ${APPLICATION_RETURNING}
            `,
            [
                id,
                JSON.stringify(input.name),
                JSON.stringify(input.description),
                input.isPublic,
                input.showInAppList ?? true,
                input.workspacesEnabled,
                schemaName,
                input.userId,
                input.userId
            ]
        )

        await trx.query(
            `
            INSERT INTO applications.rel_application_users (
                application_id,
                user_id,
                role,
                _upl_created_by,
                _upl_updated_by
            )
            VALUES ($1, $2, 'owner', $3, $4)
            `,
            [id, input.userId, input.userId, input.userId]
        )

        await recordApplicationControlAudit(trx, {
            applicationId: id,
            eventType: 'catalog_visibility_initialized',
            newVersion: insertedRows[0]?.version ?? 1,
            newShowInAppList: input.showInAppList ?? true
        })

        return insertedRows[0]
    })
}

export async function updateApplicationInTransaction(
    executor: SqlQueryable,
    input: {
        applicationId: string
        name?: VersionedLocalizedContent<string>
        description?: VersionedLocalizedContent<string> | null
        settings?: Record<string, unknown> | null
        isPublic?: boolean
        showInAppList?: boolean
        userId: string
        expectedVersion?: number
    }
): Promise<ApplicationRecord | null> {
    if (input.showInAppList !== undefined) {
        if (input.expectedVersion === undefined) {
            throw new Error('expectedVersion is required when changing showInAppList')
        }
    }

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

    if (input.settings !== undefined) {
        parameters.push(JSON.stringify(input.settings ?? {}))
        assignments.push(`settings = $${parameters.length}::jsonb`)
    }

    if (input.isPublic !== undefined) {
        parameters.push(input.isPublic)
        assignments.push(`is_public = $${parameters.length}`)
    }

    if (input.showInAppList !== undefined) {
        parameters.push(input.showInAppList)
        assignments.push(`show_in_app_list = $${parameters.length}`)
    }

    parameters.push(input.userId)
    assignments.push(`_upl_updated_by = $${parameters.length}`)
    assignments.push(`_upl_updated_at = NOW()`)
    assignments.push(`_upl_version = COALESCE(_upl_version, 1) + 1`)

    parameters.push(input.applicationId)
    let whereSql = `WHERE id = $${parameters.length}
        AND ${activeRowPredicate()}`

    if (input.expectedVersion !== undefined) {
        parameters.push(input.expectedVersion)
        whereSql += ` AND COALESCE(_upl_version, 1) = $${parameters.length}`
    }

    const rows = await executor.query<ApplicationRecord>(
        `
        UPDATE applications.obj_applications
        SET ${assignments.join(', ')}
        ${whereSql}
        RETURNING ${APPLICATION_RETURNING}
        `,
        parameters
    )

    const updated = rows[0]
    return updated ?? null
}

export async function updateApplication(
    executor: DbExecutor,
    input: {
        applicationId: string
        name?: VersionedLocalizedContent<string>
        description?: VersionedLocalizedContent<string> | null
        settings?: Record<string, unknown> | null
        isPublic?: boolean
        showInAppList?: boolean
        userId: string
        expectedVersion?: number
    }
): Promise<ApplicationRecord | null> {
    return executor.transaction((transaction) => updateApplicationInTransaction(transaction, input))
}
