import React, { createContext, useContext, useMemo } from 'react'
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    KeyboardSensor,
    useSensors,
    useSensor,
    closestCenter,
    MeasuringStrategy,
    sortableKeyboardCoordinates
} from '@universo/template-mui'
import { pointerWithin } from '@dnd-kit/core'
import type { DragStartEvent, DragOverEvent, DragEndEvent } from '@universo/template-mui'
import { useComponentDnd } from './useComponentDnd'
import type { ContainerInfo, PendingTransfer } from './useComponentDnd'
import { DragOverlayRow } from './DragOverlayRow'
import { useRegisteredContainers } from './ComponentDndContainerRegistry'
import type { Component } from '../../../../../../types'
import { toComponentDisplay } from '../../../../../../types'

// ── DnD state context (for cross-list visual feedback) ──────────────────────

interface ComponentDndState {
    /** ID of the currently dragged item */
    activeId: string | null
    /** Container ID the dragged item belongs to */
    activeContainerId: string | null
    /** Container ID the item is currently being dragged over (cross-list only, null for same-list) */
    overContainerId: string | null
    /** Virtual cross-list transfer describing source, target, and insertion point (for ghost row) */
    pendingTransfer: PendingTransfer | null
    /** The full Component object being dragged (for ghost row data) */
    activeComponent: Component | undefined
}

const ComponentDndStateContext = createContext<ComponentDndState>({
    activeId: null,
    activeContainerId: null,
    overContainerId: null,
    pendingTransfer: null,
    activeComponent: undefined
})

/**
 * Hook to access the current DnD state (activeId, activeContainerId, overContainerId).
 * Use this in FlowListTable consumers to compute `isDropTarget`.
 */
export function useComponentDndState(): ComponentDndState {
    return useContext(ComponentDndStateContext)
}

interface ComponentDndProviderProps {
    children: React.ReactNode
    /** Root-level component items (always present) */
    rootItems: Component[]
    allowCrossListRootChildren: boolean
    allowCrossListBetweenChildren: boolean
    onReorder: (
        componentId: string,
        newSortOrder: number,
        newParentComponentId?: string | null,
        currentParentComponentId?: string | null,
        mergedOrderIds?: string[]
    ) => Promise<void>
    onValidateTransfer?: (fieldDef: Component, targetParentId: string | null, targetContainerItemCount: number) => Promise<boolean>
    uiLocale: string
}

export const ComponentDndProvider: React.FC<ComponentDndProviderProps> = ({
    children,
    rootItems,
    allowCrossListRootChildren,
    allowCrossListBetweenChildren,
    onReorder,
    onValidateTransfer,
    uiLocale
}) => {
    // Build combined container list: root + registered child containers
    const registeredChildContainers = useRegisteredContainers()
    const containers = useMemo<ContainerInfo[]>(() => {
        const rootContainer: ContainerInfo = {
            id: 'root',
            parentComponentId: null,
            items: rootItems
        }
        return [rootContainer, ...registeredChildContainers]
    }, [rootItems, registeredChildContainers])

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 } // Prevent accidental drags
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates
        })
    )

    const {
        activeId,
        activeComponent,
        activeContainerId,
        overContainerId,
        pendingTransfer,
        handleDragStart,
        handleDragOver,
        handleDragEnd,
        handleDragCancel
    } = useComponentDnd({
        containers,
        allowCrossListRootChildren,
        allowCrossListBetweenChildren,
        onReorder,
        onValidateTransfer
    })

    const dndState = useMemo<ComponentDndState>(
        () => ({ activeId, activeContainerId, overContainerId, pendingTransfer, activeComponent }),
        [activeId, activeContainerId, overContainerId, pendingTransfer, activeComponent]
    )

    const droppableIdToContainerId = useMemo(() => {
        const map = new Map<string, string>()
        for (const container of containers) {
            map.set(container.id, container.id)
            for (const item of container.items) {
                map.set(item.id, container.id)
            }
        }
        return map
    }, [containers])

    const containerIds = useMemo(() => new Set(containers.map((container) => container.id)), [containers])

    const isDebugEnabled = useMemo(() => {
        if (typeof window === 'undefined') return false
        return window.localStorage.getItem('debug:metahubs:components-dnd') === '1'
    }, [])

    const collisionDetection = useMemo(() => {
        type PointerCollision = ReturnType<typeof pointerWithin>[number]

        const prioritizeCrossContainerCollisions = (collisions: PointerCollision[], activeDroppableId: string): PointerCollision[] => {
            const activeContainerId = droppableIdToContainerId.get(activeDroppableId)
            if (!activeContainerId || collisions.length === 0) {
                return collisions
            }

            const crossContainerCollisions = collisions
                .map((collision, index) => {
                    const collisionId = String(collision.id)
                    const targetContainerId = droppableIdToContainerId.get(collisionId)
                    if (!targetContainerId || targetContainerId === activeContainerId) {
                        return null
                    }
                    return {
                        collision,
                        index,
                        targetContainerId,
                        isItemCollision: !containerIds.has(collisionId)
                    }
                })
                .filter((entry): entry is NonNullable<typeof entry> => entry !== null)

            if (crossContainerCollisions.length === 0) {
                return collisions
            }

            crossContainerCollisions.sort((a, b) => {
                if (a.isItemCollision !== b.isItemCollision) {
                    return a.isItemCollision ? -1 : 1
                }
                const aIsRootTarget = a.targetContainerId === 'root'
                const bIsRootTarget = b.targetContainerId === 'root'
                if (aIsRootTarget !== bIsRootTarget) {
                    return aIsRootTarget ? 1 : -1
                }
                return a.index - b.index
            })

            return crossContainerCollisions.map((entry) => entry.collision)
        }

        return (args: Parameters<typeof closestCenter>[0]) => {
            const pointerCollisions = pointerWithin(args)
            if (pointerCollisions.length > 0) {
                return prioritizeCrossContainerCollisions(pointerCollisions, String(args.active.id))
            }

            const centerCollisions = closestCenter(args)
            return prioritizeCrossContainerCollisions(centerCollisions, String(args.active.id))
        }
    }, [containerIds, droppableIdToContainerId])

    const debugLog = (eventName: string, payload: Record<string, unknown>) => {
        if (!isDebugEnabled) return
        console.info(`[components-dnd] ${eventName}`, payload)
    }

    const handleDragStartWithDebug = (event: DragStartEvent) => {
        debugLog('drag-start', {
            activeId: String(event.active.id),
            containersCount: containers.length,
            rootItemsCount: rootItems.length
        })
        handleDragStart(event)
    }

    const handleDragOverWithDebug = (event: DragOverEvent) => {
        debugLog('drag-over', {
            activeId: String(event.active.id),
            overId: event.over ? String(event.over.id) : null
        })
        handleDragOver(event)
    }

    const handleDragEndWithDebug = async (event: DragEndEvent) => {
        debugLog('drag-end', {
            activeId: String(event.active.id),
            overId: event.over ? String(event.over.id) : null
        })
        await handleDragEnd(event)
    }

    const handleDragCancelWithDebug = () => {
        debugLog('drag-cancel', { reason: 'cancelled' })
        handleDragCancel()
    }

    return (
        <ComponentDndStateContext.Provider value={dndState}>
            <DndContext
                sensors={sensors}
                collisionDetection={collisionDetection}
                onDragStart={handleDragStartWithDebug}
                onDragOver={handleDragOverWithDebug}
                onDragEnd={handleDragEndWithDebug}
                onDragCancel={handleDragCancelWithDebug}
                // Prevent validateDOMNesting warnings for <div> inside <table>
                accessibility={{ container: document.body }}
                measuring={{
                    droppable: { strategy: MeasuringStrategy.Always }
                }}
            >
                {children}
                <DragOverlay dropAnimation={null}>
                    {activeComponent ? <DragOverlayRow component={toComponentDisplay(activeComponent, uiLocale)} /> : null}
                </DragOverlay>
            </DndContext>
        </ComponentDndStateContext.Provider>
    )
}
