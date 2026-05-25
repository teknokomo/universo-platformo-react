import { resolveSharedBehavior, type SharedBehavior } from '@universo/types'
import type { SharedEntityOverrideRow } from './services/SharedEntityOverridesService'

export interface SharedEntityListMetadata {
    isShared: boolean
    isActive: boolean
    isExcluded: boolean
    effectiveSortOrder: number
    sharedBehavior: Required<SharedBehavior> | null
}

export type SharedEntityListItem<T> = T & SharedEntityListMetadata

type MergeSharedEntityListInput<T> = {
    localItems: T[]
    sharedItems: T[]
    overrides: SharedEntityOverrideRow[]
    getId: (item: T) => string
    getSortOrder: (item: T) => number | null | undefined
    getSharedBehavior?: (item: T) => SharedBehavior | null | undefined
    includeInactive?: boolean
}

type InternalMergedItem<T> = SharedEntityListItem<T> & {
    requestedPosition: number
    baseSortOrder: number
}

const normalizeSortOrder = (value: number | null | undefined): number => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
        return 1
    }
    return Math.trunc(value)
}

const compareByPosition = <T>(left: InternalMergedItem<T>, right: InternalMergedItem<T>): number => {
    if (left.requestedPosition !== right.requestedPosition) {
        return left.requestedPosition - right.requestedPosition
    }
    if (left.baseSortOrder !== right.baseSortOrder) {
        return left.baseSortOrder - right.baseSortOrder
    }
    return String((left as { id?: unknown }).id ?? '').localeCompare(String((right as { id?: unknown }).id ?? ''))
}

const compareLockedShared = <T>(left: InternalMergedItem<T>, right: InternalMergedItem<T>): number => {
    if (left.baseSortOrder !== right.baseSortOrder) {
        return left.baseSortOrder - right.baseSortOrder
    }
    return String((left as { id?: unknown }).id ?? '').localeCompare(String((right as { id?: unknown }).id ?? ''))
}

export function buildMergedSharedEntityList<T extends object>(input: MergeSharedEntityListInput<T>): SharedEntityListItem<T>[] {
    const overridesByEntityId = new Map(input.overrides.map((override) => [override.sharedEntityId, override]))

    const localItems: InternalMergedItem<T>[] = input.localItems.map((item) => ({
        ...item,
        isShared: false,
        isActive: true,
        isExcluded: false,
        effectiveSortOrder: 0,
        sharedBehavior: null,
        requestedPosition: normalizeSortOrder(input.getSortOrder(item)),
        baseSortOrder: normalizeSortOrder(input.getSortOrder(item))
    }))

    const unlockedSharedItems: InternalMergedItem<T>[] = []
    const lockedSharedItems: InternalMergedItem<T>[] = []

    for (const item of input.sharedItems) {
        const entityId = input.getId(item)
        const override = overridesByEntityId.get(entityId)
        const sharedBehavior = resolveSharedBehavior(input.getSharedBehavior?.(item) ?? undefined)
        const isExcluded = override?.isExcluded ?? false
        if (isExcluded) {
            continue
        }

        const isActive = override?.isActive ?? true
        if (!input.includeInactive && !isActive) {
            continue
        }

        const baseSortOrder = normalizeSortOrder(input.getSortOrder(item))
        const requestedPosition = normalizeSortOrder(override?.sortOrder ?? input.getSortOrder(item))
        const mergedItem: InternalMergedItem<T> = {
            ...item,
            isShared: true,
            isActive,
            isExcluded: false,
            effectiveSortOrder: 0,
            sharedBehavior,
            requestedPosition,
            baseSortOrder
        }

        if (sharedBehavior.positionLocked) {
            lockedSharedItems.push(mergedItem)
        } else {
            unlockedSharedItems.push(mergedItem)
        }
    }

    const mergedMovableItems = [...localItems]
    const sortedUnlockedSharedItems = [...unlockedSharedItems].sort(compareByPosition)

    for (const sharedItem of sortedUnlockedSharedItems) {
        const insertIndex = Math.max(0, Math.min(mergedMovableItems.length, sharedItem.requestedPosition - 1))
        mergedMovableItems.splice(insertIndex, 0, sharedItem)
    }

    const orderedItems = [...lockedSharedItems.sort(compareLockedShared), ...mergedMovableItems]
    return orderedItems.map((item, index) => ({
        ...item,
        effectiveSortOrder: index + 1
    }))
}

export type SharedEntityOrderAssignment = {
    localSortOrders: Array<{ id: string; sortOrder: number }>
    sharedSortOrders: Array<{ id: string; sortOrder: number }>
}

export function planMergedSharedEntityOrder<T extends { id: string } & SharedEntityListMetadata>(
    items: T[],
    orderedMovableIds: string[]
): SharedEntityOrderAssignment {
    const movableItems = items.filter((item) => !(item.isShared && item.sharedBehavior?.positionLocked))
    if (movableItems.length !== orderedMovableIds.length) {
        throw new Error('Merged order payload does not match the movable entity set')
    }

    const movableIdSet = new Set(movableItems.map((item) => item.id))
    if (movableIdSet.size !== orderedMovableIds.length) {
        throw new Error('Merged order payload contains duplicate ids')
    }
    for (const id of orderedMovableIds) {
        if (!movableIdSet.has(id)) {
            throw new Error('Merged order payload references an unknown movable entity')
        }
    }

    const itemById = new Map(movableItems.map((item) => [item.id, item]))
    const localSortOrders: Array<{ id: string; sortOrder: number }> = []
    const sharedSortOrders: Array<{ id: string; sortOrder: number }> = []

    let nextLocalSortOrder = 1
    orderedMovableIds.forEach((id, index) => {
        const item = itemById.get(id)
        if (!item) {
            throw new Error('Merged order payload references an unknown movable entity')
        }

        if (item.isShared) {
            sharedSortOrders.push({ id, sortOrder: index + 1 })
            return
        }

        localSortOrders.push({ id, sortOrder: nextLocalSortOrder })
        nextLocalSortOrder += 1
    })

    return {
        localSortOrders,
        sharedSortOrders
    }
}
