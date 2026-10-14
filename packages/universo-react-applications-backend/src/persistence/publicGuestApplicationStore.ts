import type { DbExecutor } from '@universo-react/utils'
import { activeAppRowCondition } from '@universo-react/utils'

export interface PublicGuestWithdrawalApplication {
    id: string
    schemaName: string | null
    settings: unknown
    isPublic: boolean
    workspacesEnabled: boolean
}

/** Serialize guest assessment operations with an application access withdrawal. */
export const lockPublicApplicationForGuestAssessment = async (executor: DbExecutor, applicationId: string): Promise<boolean> => {
    const rows = await executor.query<{ id: string }>(
        `SELECT a.id
         FROM applications.obj_applications a
         WHERE a.id = $1
           AND a.is_public = true
           AND a._app_published = true
           AND a._upl_archived = false
           AND a._app_archived = false
           AND ${activeAppRowCondition('a')}
         FOR SHARE`,
        [applicationId]
    )

    return rows.length === 1
}

/** Lock and read the current application state before an authorized withdrawal. */
export const lockApplicationForPublicGuestWithdrawal = async (
    executor: DbExecutor,
    applicationId: string
): Promise<PublicGuestWithdrawalApplication | null> => {
    const rows = await executor.query<PublicGuestWithdrawalApplication>(
        `SELECT a.id,
                a.schema_name AS "schemaName",
                a.settings,
                a.is_public AS "isPublic",
                a.workspaces_enabled AS "workspacesEnabled"
         FROM applications.obj_applications a
         WHERE a.id = $1
           AND ${activeAppRowCondition('a')}
         FOR UPDATE`,
        [applicationId]
    )

    return rows[0] ?? null
}
