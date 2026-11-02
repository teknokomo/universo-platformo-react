import type { SqlQueryable } from '@universo-react/utils'

export type ApplicationControlAuditEventType = 'catalog_visibility_initialized'

export interface RecordApplicationControlAuditInput {
    applicationId: string
    eventType: ApplicationControlAuditEventType
    newVersion: number
    newShowInAppList: boolean
}

/** Records catalog visibility evidence through the database-owned audit boundary. */
export async function recordApplicationControlAudit(executor: SqlQueryable, input: RecordApplicationControlAuditInput): Promise<string> {
    const rows = await executor.query<{ id: string }>(
        `
        SELECT applications.record_application_catalog_visibility_audit(
            $1, $2, NULL, $3, NULL, $4
        ) AS id
        `,
        [input.applicationId, input.eventType, input.newVersion, input.newShowInAppList]
    )

    const id = rows[0]?.id
    if (!id) throw new Error('Application control audit record was not created')
    return id
}
