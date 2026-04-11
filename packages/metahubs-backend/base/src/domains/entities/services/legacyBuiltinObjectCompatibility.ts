export interface LegacyBuiltinDeleteOutcome {
    status: number
    body?: Record<string, unknown>
}

export interface LegacyBuiltinReorderOutcome {
    status: number
    body: {
        id?: string
        sortOrder?: number
        error?: string
    }
}

type MaybeDeleteOutcome = LegacyBuiltinDeleteOutcome | null | undefined

export interface ExecuteBlockedDeleteParams<TEntity, TBlocker> {
    entity: TEntity | null | undefined
    entityLabel: string
    notFoundMessage?: string
    beforeDelete?: () => Promise<MaybeDeleteOutcome> | MaybeDeleteOutcome
    findBlockingReferences?: () => Promise<TBlocker[]>
    blockedOutcome?: (blockers: TBlocker[]) => LegacyBuiltinDeleteOutcome
    deleteEntity: () => Promise<void>
}

export interface ExecuteHubScopedDeleteParams<TEntity, TBlocker> extends ExecuteBlockedDeleteParams<TEntity, TBlocker> {
    hubId: string
    forceDelete: boolean
    getHubIds: (entity: TEntity) => string[]
    notFoundInHubMessage?: string
    isRequiredHub?: (entity: TEntity) => boolean
    lastHubConflictMessage?: string
    detachFromHub: (nextHubIds: string[]) => Promise<void>
    detachConflictOutcome?: (error: unknown) => MaybeDeleteOutcome
    detachedMessage: string
}

export interface ExecuteLegacyReorderParams<TUpdated> {
    entityLabel: string
    notFoundErrorMessage: string
    notFoundResponseMessage?: string
    reorderEntity: () => Promise<TUpdated>
    getId: (updated: TUpdated) => string
    getSortOrder: (updated: TUpdated) => number
}

const buildNotFoundOutcome = (entityLabel: string, notFoundMessage?: string): LegacyBuiltinDeleteOutcome => ({
    status: 404,
    body: { error: notFoundMessage ?? `${entityLabel} not found` }
})

export async function executeBlockedDelete<TEntity, TBlocker>(
    params: ExecuteBlockedDeleteParams<TEntity, TBlocker>
): Promise<LegacyBuiltinDeleteOutcome> {
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
): Promise<LegacyBuiltinDeleteOutcome> {
    if (!params.entity) {
        return buildNotFoundOutcome(params.entityLabel, params.notFoundMessage)
    }

    const currentHubIds = params.getHubIds(params.entity)
    if (!currentHubIds.includes(params.hubId)) {
        return {
            status: 404,
            body: {
                error: params.notFoundInHubMessage ?? `${params.entityLabel} not found in this hub`
            }
        }
    }

    if (params.isRequiredHub?.(params.entity) && currentHubIds.length === 1 && !params.forceDelete) {
        return {
            status: 409,
            body: {
                error: params.lastHubConflictMessage ?? `Cannot remove ${params.entityLabel.toLowerCase()} from its last hub`
            }
        }
    }

    if (currentHubIds.length > 1 && !params.forceDelete) {
        const nextHubIds = currentHubIds.filter((id) => id !== params.hubId)

        try {
            await params.detachFromHub(nextHubIds)
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
                remainingHubs: nextHubIds.length
            }
        }
    }

    return executeBlockedDelete(params)
}

export async function executeLegacyReorder<TUpdated>(params: ExecuteLegacyReorderParams<TUpdated>): Promise<LegacyBuiltinReorderOutcome> {
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
