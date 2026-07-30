import type { RuntimeSchemaContext } from '../../shared/runtimeHelpers'
import type { RuntimeLifecycleDispatchRequest } from '../runtimeLifecycleDispatch'
import type { ObjectContract } from './runtimeInterpretationNetworkCore'

export const buildLifecycleRequest = (
    ctx: RuntimeSchemaContext,
    surface: { applicationId: string },
    contract: ObjectContract,
    payload: RuntimeLifecycleDispatchRequest['payload'],
    componentIds?: string[]
): RuntimeLifecycleDispatchRequest => ({
    applicationId: surface.applicationId,
    schemaName: ctx.schemaName,
    objectCollection: contract.object,
    currentWorkspaceId: ctx.currentWorkspaceId,
    currentUserId: ctx.userId,
    permissions: ctx.permissions,
    componentIds,
    payload
})

export const collectLifecycleFieldIds = (contract: ObjectContract, values: Record<string, unknown>): string[] => {
    const valueColumns = new Set(Object.keys(values))
    return Object.values(contract.fields)
        .filter((field) => valueColumns.has(field.column_name))
        .map((field) => field.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
}
