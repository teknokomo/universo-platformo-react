import type { DbExecutor, SqlQueryable } from '@universo/utils/database'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { createLogger } from '../../../utils/logger'
import { EntityEventRouter, type EntityActionExecutor } from './EntityEventRouter'

const log = createLogger('EntityMutationService')

export type EntityMutationMode = 'interactive' | 'copy' | 'restore' | 'seed'

export interface RunEntityMutationInput<T> {
    metahubId: string
    objectId: string
    userId?: string
    mode?: EntityMutationMode
    beforeEvent?: string | null
    afterEvent?: string | null
    afterEventObjectId?: string | ((result: T) => string | null | undefined)
    payload?: Record<string, unknown>
    mutation: (tx: SqlQueryable) => Promise<T>
    actionExecutor?: EntityActionExecutor
}

interface AfterCommitDispatchParams {
    metahubId: string
    schemaName: string
    objectId: string
    eventName: string
    userId?: string
    payload?: Record<string, unknown>
    actionExecutor?: EntityActionExecutor
}

const resolveLifecycleEvents = (mode: EntityMutationMode, beforeEvent?: string | null, afterEvent?: string | null) => {
    if (mode === 'restore' || mode === 'seed') {
        return { beforeEvent: null, afterEvent: null }
    }

    if (mode === 'copy') {
        return {
            beforeEvent: beforeEvent ?? 'beforeCopy',
            afterEvent: afterEvent ?? 'afterCopy'
        }
    }

    return {
        beforeEvent: beforeEvent ?? null,
        afterEvent: afterEvent ?? null
    }
}

const resolveAfterEventObjectId = <T>(input: RunEntityMutationInput<T>, result: T): string => {
    if (typeof input.afterEventObjectId === 'function') {
        const resolvedObjectId = input.afterEventObjectId(result)
        if (typeof resolvedObjectId === 'string' && resolvedObjectId.trim().length > 0) {
            return resolvedObjectId
        }
    }

    if (typeof input.afterEventObjectId === 'string' && input.afterEventObjectId.trim().length > 0) {
        return input.afterEventObjectId
    }

    return input.objectId
}

export class EntityMutationService {
    constructor(
        private readonly exec: DbExecutor,
        private readonly schemaService: MetahubSchemaService,
        private readonly eventRouter: EntityEventRouter
    ) {}

    private dispatchAfterCommit(params: AfterCommitDispatchParams): void {
        void this.eventRouter
            .dispatchInSchema({
                metahubId: params.metahubId,
                schemaName: params.schemaName,
                objectId: params.objectId,
                eventName: params.eventName,
                executor: this.exec,
                userId: params.userId,
                payload: params.payload,
                actionExecutor: params.actionExecutor
            })
            .catch((error) => {
                log.error(`After-commit lifecycle dispatch failed for ${params.eventName} on object ${params.objectId}`, error)
            })
    }

    async run<T>(input: RunEntityMutationInput<T>): Promise<T> {
        const mode = input.mode ?? 'interactive'
        const schemaName = await this.schemaService.ensureSchema(input.metahubId, input.userId)
        const lifecycle = resolveLifecycleEvents(mode, input.beforeEvent, input.afterEvent)
        const afterEventName = lifecycle.afterEvent

        const result = await this.exec.transaction(async (tx) => {
            if (lifecycle.beforeEvent) {
                await this.eventRouter.dispatchInSchema({
                    metahubId: input.metahubId,
                    schemaName,
                    objectId: input.objectId,
                    eventName: lifecycle.beforeEvent,
                    executor: tx,
                    userId: input.userId,
                    payload: input.payload,
                    actionExecutor: input.actionExecutor
                })
            }

            const mutationResult = await input.mutation(tx)

            return mutationResult
        })

        if (afterEventName) {
            this.dispatchAfterCommit({
                metahubId: input.metahubId,
                schemaName,
                objectId: resolveAfterEventObjectId(input, result),
                eventName: afterEventName,
                userId: input.userId,
                payload: input.payload,
                actionExecutor: input.actionExecutor
            })
        }

        return result
    }
}
