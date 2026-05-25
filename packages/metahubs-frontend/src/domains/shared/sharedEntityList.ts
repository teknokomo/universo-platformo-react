import type { SharedBehavior } from '@universo/types'

export type SharedEntityListMetadata = {
    isShared?: boolean
    isActive?: boolean
    isExcluded?: boolean
    effectiveSortOrder?: number | null
    sharedBehavior?: SharedBehavior | null
}

export const getEffectiveSortOrder = (value: { sortOrder?: number | null; effectiveSortOrder?: number | null }): number => {
    if (typeof value.effectiveSortOrder === 'number' && Number.isFinite(value.effectiveSortOrder)) {
        return value.effectiveSortOrder
    }
    if (typeof value.sortOrder === 'number' && Number.isFinite(value.sortOrder)) {
        return value.sortOrder
    }
    return Number.MAX_SAFE_INTEGER
}

export const sortSharedEntityList = <T extends { id: string; sortOrder?: number | null; effectiveSortOrder?: number | null }>(
    items: T[]
): T[] =>
    [...items].sort((left, right) => {
        const orderDelta = getEffectiveSortOrder(left) - getEffectiveSortOrder(right)
        if (orderDelta !== 0) {
            return orderDelta
        }
        return left.id.localeCompare(right.id)
    })

export const isSharedEntityRow = (value: SharedEntityListMetadata | null | undefined): boolean => value?.isShared === true

export const isSharedEntityActive = (value: SharedEntityListMetadata | null | undefined): boolean => value?.isActive !== false

export const isSharedEntityMovable = (value: SharedEntityListMetadata | null | undefined): boolean =>
    !isSharedEntityRow(value) || value?.sharedBehavior?.positionLocked !== true

export const getMovableSharedEntityIds = <T extends { id: string } & SharedEntityListMetadata>(items: T[]): string[] =>
    sortSharedEntityList(items)
        .filter((item) => isSharedEntityMovable(item))
        .map((item) => item.id)

export const reorderSharedEntityIds = (orderedIds: string[], activeId: string, overId: string): string[] => {
    const fromIndex = orderedIds.indexOf(activeId)
    const toIndex = orderedIds.indexOf(overId)
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
        return orderedIds
    }

    const nextIds = [...orderedIds]
    const [movedId] = nextIds.splice(fromIndex, 1)
    nextIds.splice(toIndex, 0, movedId)
    return nextIds
}

export const applyMergedSharedEntityOrder = <T extends { id: string; sortOrder?: number | null } & SharedEntityListMetadata>(
    items: T[],
    orderedMovableIds: string[]
): T[] => {
    const sortedItems = sortSharedEntityList(items)
    const movableItems = sortedItems.filter((item) => isSharedEntityMovable(item))
    if (movableItems.length !== orderedMovableIds.length) {
        return items
    }

    const movableById = new Map(movableItems.map((item) => [item.id, item]))
    if (orderedMovableIds.some((id) => !movableById.has(id))) {
        return items
    }

    let movableIndex = 0
    return sortedItems
        .map((item) => {
            if (!isSharedEntityMovable(item)) {
                return item
            }

            const nextItem = movableById.get(orderedMovableIds[movableIndex])
            movableIndex += 1
            return nextItem ?? item
        })
        .map((item, index) => ({
            ...item,
            effectiveSortOrder: index + 1
        }))
}
