import React, { createContext, useContext, useMemo } from 'react'
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    KeyboardSensor,
    useSensors,
    useSensor,
    closestCenter,
    MeasuringStrategy
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useAttributeDnd } from './useAttributeDnd'
import type { ContainerInfo, PendingTransfer } from './useAttributeDnd'
import { DragOverlayRow } from './DragOverlayRow'
import { useRegisteredContainers } from './AttributeDndContainerRegistry'
import type { Attribute } from '../../../../types'
import { toAttributeDisplay } from '../../../../types'

// ── DnD state context (for cross-list visual feedback) ──────────────────────

interface AttributeDndState {
    /** ID of the currently dragged item */
    activeId: string | null
    /** Container ID the dragged item belongs to */
    activeContainerId: string | null
    /** Container ID the item is currently being dragged over (cross-list only, null for same-list) */
    overContainerId: string | null
    /** Virtual cross-list transfer describing source, target, and insertion point (for ghost row) */
    pendingTransfer: PendingTransfer | null
    /** The full Attribute object being dragged (for ghost row data) */
    activeAttribute: Attribute | undefined
}

const AttributeDndStateContext = createContext<AttributeDndState>({
    activeId: null,
    activeContainerId: null,
    overContainerId: null,
    pendingTransfer: null,
    activeAttribute: undefined
})

/**
 * Hook to access the current DnD state (activeId, activeContainerId, overContainerId).
 * Use this in FlowListTable consumers to compute `isDropTarget`.
 */
export function useAttributeDndState(): AttributeDndState {
    return useContext(AttributeDndStateContext)
}

interface AttributeDndProviderProps {
    children: React.ReactNode
    /** Root-level attribute items (always present) */
    rootItems: Attribute[]
    allowCrossListRootChildren: boolean
    allowCrossListBetweenChildren: boolean
    onReorder: (
        attributeId: string,
        newSortOrder: number,
        newParentAttributeId?: string | null,
        currentParentAttributeId?: string | null
    ) => Promise<void>
    onValidateTransfer?: (attribute: Attribute, targetParentId: string | null, targetContainerItemCount: number) => Promise<boolean>
    uiLocale: string
}

export const AttributeDndProvider: React.FC<AttributeDndProviderProps> = ({
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
            parentAttributeId: null,
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
        activeAttribute,
        activeContainerId,
        overContainerId,
        pendingTransfer,
        handleDragStart,
        handleDragOver,
        handleDragEnd,
        handleDragCancel
    } = useAttributeDnd({
        containers,
        allowCrossListRootChildren,
        allowCrossListBetweenChildren,
        onReorder,
        onValidateTransfer
    })

    const dndState = useMemo<AttributeDndState>(
        () => ({ activeId, activeContainerId, overContainerId, pendingTransfer, activeAttribute }),
        [activeId, activeContainerId, overContainerId, pendingTransfer, activeAttribute]
    )

    return (
        <AttributeDndStateContext.Provider value={dndState}>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
                // Prevent validateDOMNesting warnings for <div> inside <table>
                accessibility={{ container: document.body }}
                measuring={{
                    droppable: { strategy: MeasuringStrategy.Always }
                }}
            >
                {children}
                <DragOverlay dropAnimation={null}>
                    {activeAttribute ? <DragOverlayRow attribute={toAttributeDisplay(activeAttribute, uiLocale)} /> : null}
                </DragOverlay>
            </DndContext>
        </AttributeDndStateContext.Provider>
    )
}
