import type { DbExecutor } from '@universo-react/utils'
import { qSchemaTable } from '@universo-react/database'
import { activeAppRowCondition } from '@universo-react/utils'
import { applicationLayoutTablesExist } from './applicationLayoutCapabilitiesStore'
import { lockApplicationLayoutMutationFamilyShared } from './applicationLayoutStoreSupport'
import { buildPublicMarketingLifecyclePredicate } from '../shared/marketingRuntimeLifecycleSql'

export interface PublicGuestWithdrawalApplication {
    id: string
    schemaName: string | null
    settings: unknown
    isPublic: boolean
    workspacesEnabled: boolean
}

/** Return whether this published application contains an active Messenger layout. */
export const hasPublicMessengerApplicationLayout = async (executor: DbExecutor, schemaName: string): Promise<boolean> => {
    if (!(await applicationLayoutTablesExist(executor, schemaName))) return false

    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    const rows = await executor.query<{ id: string }>(
        `SELECT l.id
         FROM ${layoutsTable} l
         WHERE l.template_key = $1
           AND l.is_active = true
           AND ${buildPublicMarketingLifecyclePredicate('l')}
         ORDER BY l.id ASC
         LIMIT 1
         FOR SHARE`,
        ['messenger-app']
    )

    return rows.length > 0
}

/** Keep layout policy stable for the full anonymous guest-runtime transaction. */
export const lockPublicGuestRuntimeLayoutState = async (executor: DbExecutor, schemaName: string): Promise<void> => {
    await lockApplicationLayoutMutationFamilyShared(executor, schemaName)
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
