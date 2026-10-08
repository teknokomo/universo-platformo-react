import { UUID_REGEX, resolveRuntimeCodenameText } from '../shared/runtimeHelpers'
import { isRuntimeRecordHandle, resolveRuntimeRecordHandle } from '../services/runtimeRecordHandle'

export const isRuntimeChildParentReference = (value: string): boolean => UUID_REGEX.test(value) || isRuntimeRecordHandle(value)

export const resolveRuntimeChildParentRecordId = (params: {
    reference: string
    applicationId: string
    workspaceId: string | null
    entityCodename: unknown
}): string | null => {
    if (UUID_REGEX.test(params.reference)) return params.reference

    return resolveRuntimeRecordHandle(params.reference, {
        applicationId: params.applicationId,
        workspaceId: params.workspaceId,
        entityCodename: resolveRuntimeCodenameText(params.entityCodename)
    })
}
