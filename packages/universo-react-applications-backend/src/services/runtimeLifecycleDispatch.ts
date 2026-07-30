import type { ModuleLifecyclePayload } from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils'
import type { RolePermission } from '../routes/guards'
import { resolveRuntimeCodenameText } from '../shared/runtimeHelpers'
import { RuntimeModulesService } from './runtimeModulesService'

export type RuntimeLifecycleObject = {
    id: string
    codename: unknown
}

export type RuntimeLifecycleDispatchRequest = {
    applicationId: string
    schemaName: string
    objectCollection: RuntimeLifecycleObject
    currentWorkspaceId?: string | null
    currentUserId?: string | null
    permissions?: Record<RolePermission, boolean> | null
    componentIds?: string[]
    payload: Omit<ModuleLifecyclePayload, 'entityCodename'>
}

type RuntimeLifecycleDispatchRequestWithManager = RuntimeLifecycleDispatchRequest & {
    manager: DbExecutor
}

export const dispatchRuntimeLifecycle = async (
    managerOrRequest: DbExecutor | RuntimeLifecycleDispatchRequestWithManager,
    requestInput?: RuntimeLifecycleDispatchRequest
): Promise<unknown[]> => {
    const manager = requestInput
        ? (managerOrRequest as DbExecutor)
        : (managerOrRequest as RuntimeLifecycleDispatchRequestWithManager).manager
    const request = requestInput ?? (managerOrRequest as RuntimeLifecycleDispatchRequestWithManager)
    const modulesService = new RuntimeModulesService()

    return modulesService.dispatchLifecycleEvent({
        executor: manager,
        applicationId: request.applicationId,
        schemaName: request.schemaName,
        attachmentKind: 'object',
        attachmentId: request.objectCollection.id,
        entityCodename: resolveRuntimeCodenameText(request.objectCollection.codename),
        currentWorkspaceId: request.currentWorkspaceId ?? null,
        currentUserId: request.currentUserId ?? null,
        permissions: request.permissions ?? null,
        componentIds: request.componentIds,
        payload: request.payload
    })
}

export const dispatchRuntimeLifecycleAfterCommit = (
    manager: DbExecutor,
    request: RuntimeLifecycleDispatchRequest | null | undefined
): void => {
    if (!request) return

    void dispatchRuntimeLifecycle(manager, request).catch(() => {
        console.error('[runtimeLifecycleDispatch] lifecycle hook failed', {
            eventName: request.payload.eventName,
            applicationId: request.applicationId,
            objectId: request.objectCollection.id
        })
    })
}
