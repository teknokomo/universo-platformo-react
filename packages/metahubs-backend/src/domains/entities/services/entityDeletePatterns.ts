export interface EntityDeleteOutcome {
    status: number
    body?: Record<string, unknown>
}

export interface EntityReorderOutcome {
    status: number
    body: {
        id?: string
        sortOrder?: number
        error?: string
    }
}

type MaybeDeleteOutcome = EntityDeleteOutcome | null | undefined

export interface ExecuteBlockedDeleteParams<TEntity, TBlocker> {
    entity: TEntity | null | undefined
    entityLabel: string
    notFoundMessage?: string
    beforeDelete?: () => Promise<MaybeDeleteOutcome> | MaybeDeleteOutcome
    findBlockingReferences?: () => Promise<TBlocker[]>
    blockedOutcome?: (blockers: TBlocker[]) => EntityDeleteOutcome
    deleteEntity: () => Promise<void>
}

export interface ExecuteHubScopedDeleteParams<TEntity, TBlocker> extends ExecuteBlockedDeleteParams<TEntity, TBlocker> {
    treeEntityId: string
    forceDelete: boolean
    getTreeEntityIds: (entity: TEntity) => string[]
    notFoundInHubMessage?: string
    isRequiredHub?: (entity: TEntity) => boolean
    lastHubConflictMessage?: string
    detachFromHub: (nextTreeEntityIds: string[]) => Promise<void>
    detachConflictOutcome?: (error: unknown) => MaybeDeleteOutcome
    detachedMessage: string
}

export interface ExecuteEntityReorderParams<TUpdated> {
    entityLabel: string
    notFoundErrorMessage: string
    notFoundResponseMessage?: string
    reorderEntity: () => Promise<TUpdated>
    getId: (updated: TUpdated) => string
    getSortOrder: (updated: TUpdated) => number
}

const buildNotFoundOutcome = (entityLabel: string, notFoundMessage?: string): EntityDeleteOutcome => ({
    status: 404,
    body: { error: notFoundMessage ?? `${entityLabel} not found` }
})

export async function executeBlockedDelete<TEntity, TBlocker>(
    params: ExecuteBlockedDeleteParams<TEntity, TBlocker>
): Promise<EntityDeleteOutcome> {
    if (!params.entity) {
        return buildNotFoundOutcome(params.entityLabel, params.notFoundMessage)
    }

    const preDeleteOutcome = await params.beforeDelete?.()
    if (preDeleteOutcome) {
        return preDeleteOutcome
    }

    if (params.findBlockingReferences && params.blockedOutcome) {
        const blockers = await params.findBlockingReferences()
        if (blockers.length > 0) {
            return params.blockedOutcome(blockers)
        }
    }

    await params.deleteEntity()
    return { status: 204 }
}

export async function executeHubScopedDelete<TEntity, TBlocker>(
    params: ExecuteHubScopedDeleteParams<TEntity, TBlocker>
): Promise<EntityDeleteOutcome> {
    if (!params.entity) {
        return buildNotFoundOutcome(params.entityLabel, params.notFoundMessage)
    }

    const currentTreeEntityIds = params.getTreeEntityIds(params.entity)
    if (!currentTreeEntityIds.includes(params.treeEntityId)) {
        return {
            status: 404,
            body: {
                error: params.notFoundInHubMessage ?? `${params.entityLabel} not found in this hub`
            }
        }
    }

    if (params.isRequiredHub?.(params.entity) && currentTreeEntityIds.length === 1 && !params.forceDelete) {
        return {
            status: 409,
            body: {
                error: params.lastHubConflictMessage ?? `Cannot remove ${params.entityLabel.toLowerCase()} from its last hub`
            }
        }
    }

    if (currentTreeEntityIds.length > 1 && !params.forceDelete) {
        const nextTreeEntityIds = currentTreeEntityIds.filter((id) => id !== params.treeEntityId)

        try {
            await params.detachFromHub(nextTreeEntityIds)
        } catch (error) {
            const mappedOutcome = params.detachConflictOutcome?.(error)
            if (mappedOutcome) {
                return mappedOutcome
            }
            throw error
        }

        return {
            status: 200,
            body: {
                message: params.detachedMessage,
                remainingHubs: nextTreeEntityIds.length
            }
        }
    }

    return executeBlockedDelete(params)
}

export async function executeEntityReorder<TUpdated>(params: ExecuteEntityReorderParams<TUpdated>): Promise<EntityReorderOutcome> {
    try {
        const updated = await params.reorderEntity()
        return {
            status: 200,
            body: {
                id: params.getId(updated),
                sortOrder: params.getSortOrder(updated)
            }
        }
    } catch (error) {
        if (error instanceof Error && error.message === params.notFoundErrorMessage) {
            return {
                status: 404,
                body: {
                    error: params.notFoundResponseMessage ?? `${params.entityLabel} not found`
                }
            }
        }

        throw error
    }
}
