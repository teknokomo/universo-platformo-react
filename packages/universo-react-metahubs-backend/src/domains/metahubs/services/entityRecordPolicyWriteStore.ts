import type { EntityRecordPolicy } from '@universo-react/types'
import type { SqlQueryable } from '@universo-react/utils/database'
import { acquireWidgetBindingObjectLock } from '../../layouts/widgetBindingPolicyStore'
import { readEntityRecordPolicy } from '../../shared/entityRecordPolicy'

/** Lock an Entity before a record write and read its authoritative policy under that lock. */
export const lockEntityRecordPolicyForWrite = async (executor: SqlQueryable, schemaName: string, objectId: string) => {
    const object = await acquireWidgetBindingObjectLock(executor, schemaName, objectId)
    return {
        object,
        policy: object.kind === 'object' ? readEntityRecordPolicy(object.config) : undefined
    } satisfies { object: { kind: string }; policy: EntityRecordPolicy | undefined }
}
