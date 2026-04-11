import type { SqlQueryable } from '@universo/utils/database'
import { ActionService, type MetahubEntityAction } from './ActionService'
import { EventBindingService, type MetahubEventBinding } from './EventBindingService'

export interface EntityActionExecutionRequest {
    metahubId: string
    schemaName: string
    objectId: string
    eventName: string
    binding: MetahubEventBinding
    action: MetahubEntityAction
    payload?: Record<string, unknown>
    userId?: string
    executor: SqlQueryable
}

export type EntityActionExecutor = (request: EntityActionExecutionRequest) => Promise<void>

export interface EntityEventDispatchResult {
    binding: MetahubEventBinding
    action: MetahubEntityAction
}

export class EntityEventRouter {
    constructor(private readonly eventBindingService: EventBindingService, private readonly actionService: ActionService) {}

    async dispatchInSchema(params: {
        metahubId: string
        schemaName: string
        objectId: string
        eventName: string
        executor: SqlQueryable
        userId?: string
        payload?: Record<string, unknown>
        actionExecutor?: EntityActionExecutor
    }): Promise<EntityEventDispatchResult[]> {
        const bindings = await this.eventBindingService.listActiveBindingsInSchema(
            params.schemaName,
            params.objectId,
            params.eventName,
            params.executor
        )

        const dispatches: EntityEventDispatchResult[] = []
        for (const binding of bindings) {
            const action = await this.actionService.findByIdInSchema(params.schemaName, binding.actionId, params.executor)
            if (!action) {
                continue
            }

            dispatches.push({ binding, action })
            if (params.actionExecutor) {
                await params.actionExecutor({
                    metahubId: params.metahubId,
                    schemaName: params.schemaName,
                    objectId: params.objectId,
                    eventName: params.eventName,
                    binding,
                    action,
                    payload: params.payload,
                    userId: params.userId,
                    executor: params.executor
                })
            }
        }

        return dispatches
    }
}
