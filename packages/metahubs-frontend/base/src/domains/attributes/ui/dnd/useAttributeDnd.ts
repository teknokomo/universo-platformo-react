import { useState, useCallback, useRef } from 'react'
import type { DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core'
import type { Attribute } from '../../../../types'

export interface ContainerInfo {
    id: string // 'root' | `child-${parentId}`
    parentAttributeId: string | null
    items: Attribute[]
}

/** Describes a virtual cross-list item transfer (used for ghost row rendering). */
export interface PendingTransfer {
    itemId: string
    fromContainerId: string
    toContainerId: string
    /** Insertion index within the ORIGINAL target items array */
    insertIndex: number
}

interface UseAttributeDndOptions {
    containers: ContainerInfo[]
    allowCrossListRootChildren: boolean
    allowCrossListBetweenChildren: boolean
    onReorder: (
        attributeId: string,
        newSortOrder: number,
        newParentAttributeId?: string | null,
        currentParentAttributeId?: string | null
    ) => Promise<void>
    onValidateTransfer?: (attribute: Attribute, targetParentId: string | null, targetContainerItemCount: number) => Promise<boolean>
}

export function useAttributeDnd({
    containers,
    allowCrossListRootChildren,
    allowCrossListBetweenChildren,
    onReorder,
    onValidateTransfer
}: UseAttributeDndOptions) {
    const [activeId, setActiveId] = useState<string | null>(null)
    const [overId, setOverId] = useState<string | null>(null)
    /** Container ID the active (dragged) item belongs to */
    const [activeContainerId, setActiveContainerId] = useState<string | null>(null)
    /** Container ID the item is currently being dragged over (cross-list only) */
    const [overContainerId, setOverContainerId] = useState<string | null>(null)
    /** Virtual cross-list transfer for ghost row rendering */
    const [pendingTransfer, setPendingTransfer] = useState<PendingTransfer | null>(null)

    // Ref to avoid stale closure reads in handleDragOver
    const pendingTransferRef = useRef<PendingTransfer | null>(null)

    const findContainer = useCallback(
        (itemId: string): ContainerInfo | undefined => {
            return containers.find((c) => c.items.some((item) => item.id === itemId))
        },
        [containers]
    )

    const findAttribute = useCallback(
        (itemId: string): Attribute | undefined => {
            for (const c of containers) {
                const found = c.items.find((item) => item.id === itemId)
                if (found) return found
            }
            return undefined
        },
        [containers]
    )

    const isCrossListAllowed = useCallback(
        (sourceContainer: ContainerInfo, targetContainer: ContainerInfo): boolean => {
            if (sourceContainer.id === targetContainer.id) return true

            const sourceIsRoot = sourceContainer.parentAttributeId === null
            const targetIsRoot = targetContainer.parentAttributeId === null

            if (sourceIsRoot || targetIsRoot) {
                return allowCrossListRootChildren
            }
            return allowCrossListBetweenChildren
        },
        [allowCrossListRootChildren, allowCrossListBetweenChildren]
    )

    const handleDragStart = useCallback(
        (event: DragStartEvent) => {
            const id = String(event.active.id)
            setActiveId(id)
            const container = findContainer(id)
            setActiveContainerId(container?.id ?? null)
        },
        [findContainer]
    )

    const handleDragOver = useCallback(
        (event: DragOverEvent) => {
            const { active, over } = event
            if (!over) {
                setOverContainerId(null)
                if (pendingTransferRef.current) {
                    pendingTransferRef.current = null
                    setPendingTransfer(null)
                }
                return
            }

            // Guard: if hovering over the ghost of the dragged item itself, preserve current pending transfer
            if (String(over.id) === String(active.id) && pendingTransferRef.current) {
                return
            }

            const activeContainer = findContainer(String(active.id))
            const overContainer = findContainer(String(over.id)) || containers.find((c) => c.id === String(over.id))

            if (!activeContainer || !overContainer) {
                setOverContainerId(null)
                if (pendingTransferRef.current) {
                    pendingTransferRef.current = null
                    setPendingTransfer(null)
                }
                return
            }

            if (activeContainer.id === overContainer.id) {
                // Same container — no cross-list highlight, clear pending transfer
                setOverContainerId(null)
                if (pendingTransferRef.current) {
                    pendingTransferRef.current = null
                    setPendingTransfer(null)
                }
                return
            }

            if (!isCrossListAllowed(activeContainer, overContainer)) {
                setOverContainerId(null)
                if (pendingTransferRef.current) {
                    pendingTransferRef.current = null
                    setPendingTransfer(null)
                }
                return
            }

            setOverId(String(over.id))
            setOverContainerId(overContainer.id)

            // Compute insertion index in the target container
            const targetItems = overContainer.items
            const overItemIndex = targetItems.findIndex((i) => i.id === String(over.id))

            let insertIndex: number
            if (overItemIndex < 0) {
                // Over the container itself (not an item) → insert at end
                insertIndex = targetItems.length
            } else {
                // Determine if cursor is below the center of the over item
                const translated = active.rect.current.translated
                const isBelowCenter = translated != null && over.rect != null && translated.top > over.rect.top + over.rect.height / 2
                insertIndex = isBelowCenter ? overItemIndex + 1 : overItemIndex
            }

            // Only update state if something changed to avoid unnecessary re-renders
            const prev = pendingTransferRef.current
            if (
                prev &&
                prev.toContainerId === overContainer.id &&
                prev.insertIndex === insertIndex &&
                prev.fromContainerId === activeContainer.id
            ) {
                return
            }

            const newTransfer: PendingTransfer = {
                itemId: String(active.id),
                fromContainerId: activeContainer.id,
                toContainerId: overContainer.id,
                insertIndex
            }
            pendingTransferRef.current = newTransfer
            setPendingTransfer(newTransfer)
        },
        [containers, findContainer, isCrossListAllowed]
    )

    const handleDragEnd = useCallback(
        async (event: DragEndEvent) => {
            const { active, over } = event
            // Save pending transfer before clearing state (needed when dropping on ghost row)
            const savedPendingTransfer = pendingTransferRef.current

            setActiveId(null)
            setOverId(null)
            setActiveContainerId(null)
            setOverContainerId(null)
            pendingTransferRef.current = null
            setPendingTransfer(null)

            if (!over) return

            const activeContainer = findContainer(String(active.id))
            let overContainer: ContainerInfo | undefined =
                findContainer(String(over.id)) || containers.find((c) => c.id === String(over.id))

            // If dropped on the ghost of the dragged item itself, resolve target from saved pending transfer
            if (String(over.id) === String(active.id) && savedPendingTransfer) {
                overContainer = containers.find((c) => c.id === savedPendingTransfer.toContainerId)
            }

            if (!activeContainer || !overContainer) return

            const attribute = findAttribute(String(active.id))
            if (!attribute) return

            if (activeContainer.id === overContainer.id) {
                // Same-list reorder
                const items = activeContainer.items
                const oldIndex = items.findIndex((i) => i.id === String(active.id))
                const overItem = items.findIndex((i) => i.id === String(over.id))

                if (oldIndex === -1 || overItem === -1 || oldIndex === overItem) return

                const newSortOrder = items[overItem].sortOrder ?? overItem + 1
                await onReorder(String(active.id), newSortOrder)
            } else {
                // Cross-list transfer
                if (!isCrossListAllowed(activeContainer, overContainer)) return

                if (onValidateTransfer) {
                    const allowed = await onValidateTransfer(attribute, overContainer.parentAttributeId, overContainer.items.length)
                    if (!allowed) return
                }

                const targetItems = overContainer.items
                const overIndex = targetItems.findIndex((i) => i.id === String(over.id))

                let newSortOrder: number
                if (overIndex >= 0) {
                    newSortOrder = targetItems[overIndex].sortOrder ?? overIndex + 1
                } else if (savedPendingTransfer) {
                    // Dropped on ghost row — use pending transfer's insertion index
                    newSortOrder = savedPendingTransfer.insertIndex + 1
                } else {
                    newSortOrder = targetItems.length + 1
                }

                await onReorder(String(active.id), newSortOrder, overContainer.parentAttributeId, activeContainer.parentAttributeId)
            }
        },
        [containers, findContainer, findAttribute, isCrossListAllowed, onReorder, onValidateTransfer]
    )

    const handleDragCancel = useCallback(() => {
        setActiveId(null)
        setOverId(null)
        setActiveContainerId(null)
        setOverContainerId(null)
        pendingTransferRef.current = null
        setPendingTransfer(null)
    }, [])

    const activeAttribute = activeId ? findAttribute(activeId) : undefined

    return {
        activeId,
        activeAttribute,
        activeContainerId,
        overContainerId,
        overId,
        pendingTransfer,
        handleDragStart,
        handleDragOver,
        handleDragEnd,
        handleDragCancel
    }
}
