import { useState, useCallback, useRef, useEffect } from 'react'
import type { DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core'
import type { Attribute } from '../../../../types'
import { isSharedEntityMovable, isSharedEntityRow, reorderSharedEntityIds } from '../../../shared/sharedEntityList'

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
        currentParentAttributeId?: string | null,
        mergedOrderIds?: string[]
    ) => Promise<void>
    onValidateTransfer?: (attribute: Attribute, targetParentId: string | null, targetContainerItemCount: number) => Promise<boolean>
}

/** Deferred cross-list transfer data, processed in a useEffect after DnD state cleanup. */
interface DeferredCrossTransfer {
    attribute: Attribute
    activeId: string
    targetParentId: string | null
    sourceParentId: string | null
    targetItemCount: number
    newSortOrder: number
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

    /** Deferred cross-list transfer waiting for validation + execution after DnD cleanup render */
    const [deferredCrossTransfer, setDeferredCrossTransfer] = useState<DeferredCrossTransfer | null>(null)

    // Ref to avoid stale closure reads in handleDragOver
    const pendingTransferRef = useRef<PendingTransfer | null>(null)

    // Stable refs for useEffect — avoid re-firing when callbacks change identity
    const onValidateTransferRef = useRef(onValidateTransfer)
    onValidateTransferRef.current = onValidateTransfer
    const onReorderRef = useRef(onReorder)
    onReorderRef.current = onReorder

    // Process deferred cross-list transfer AFTER React has committed the DnD cleanup render.
    // useEffect runs after DOM commit, so any state updates (like SHOW_CONFIRM from confirm())
    // happen in their own render cycle — unlike setTimeout which React 18 can still batch
    // with the preceding unstable_batchedUpdates from dnd-kit.
    useEffect(() => {
        if (!deferredCrossTransfer) return

        let cancelled = false
        const { attribute, activeId: xferId, targetParentId, sourceParentId, targetItemCount, newSortOrder } = deferredCrossTransfer

        const execute = async () => {
            if (onValidateTransferRef.current) {
                const allowed = await onValidateTransferRef.current(attribute, targetParentId, targetItemCount)
                if (!allowed || cancelled) {
                    if (!cancelled) setDeferredCrossTransfer(null)
                    return
                }
            }
            if (cancelled) return

            await onReorderRef.current(xferId, newSortOrder, targetParentId, sourceParentId)
            if (!cancelled) setDeferredCrossTransfer(null)
        }

        execute()
        return () => {
            cancelled = true
        }
    }, [deferredCrossTransfer])

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
                // Keep the last valid cross-list transfer while collisions are temporarily unstable.
                // This is critical for empty child containers where pointer collisions can briefly disappear.
                setOverId(null)
                setOverContainerId(pendingTransferRef.current ? pendingTransferRef.current.toContainerId : null)
                return
            }

            // Guard: if hovering over the ghost of the dragged item itself, preserve current pending transfer
            if (String(over.id) === String(active.id) && pendingTransferRef.current) {
                return
            }

            const activeContainer = findContainer(String(active.id))
            const overContainer = findContainer(String(over.id)) || containers.find((c) => c.id === String(over.id))

            if (!activeContainer || !overContainer) {
                setOverId(null)
                setOverContainerId(pendingTransferRef.current ? pendingTransferRef.current.toContainerId : null)
                return
            }

            if (activeContainer.id === overContainer.id) {
                // Ignore noisy container-level collisions (e.g. root table body overlapping nested child area)
                // when a valid cross-list target is already known.
                if (pendingTransferRef.current && String(over.id) === activeContainer.id) {
                    setOverId(String(over.id))
                    setOverContainerId(pendingTransferRef.current.toContainerId)
                    return
                }

                // Guard: preserve cross-list transfer when collision detection temporarily
                // resolves to a source-container item (not the container itself).
                // This prevents flickering when the child droppable rect shifts after ghost mount.
                if (pendingTransferRef.current && pendingTransferRef.current.toContainerId !== activeContainer.id) {
                    setOverId(String(over.id))
                    setOverContainerId(pendingTransferRef.current.toContainerId)
                    return
                }

                // Same container — no cross-list in progress, clear pending transfer.
                setOverId(String(over.id))
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

            // Prefer the last known cross-list target from drag-over when drop collision
            // falls back to the active source item/container.
            if (savedPendingTransfer && activeContainer && (!overContainer || overContainer.id === activeContainer.id)) {
                const overId = String(over.id)
                const shouldUsePendingTarget = !overContainer || overId === String(active.id) || overId === activeContainer.id
                if (shouldUsePendingTarget) {
                    const pendingTarget = containers.find((c) => c.id === savedPendingTransfer.toContainerId)
                    if (pendingTarget && pendingTarget.id !== activeContainer.id) {
                        overContainer = pendingTarget
                    }
                }
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
                const hasSharedRows = items.some((item) => isSharedEntityRow(item))
                const mergedOrderIds = hasSharedRows
                    ? reorderSharedEntityIds(
                          items.map((item) => item.id),
                          String(active.id),
                          String(over.id)
                      ).filter((id) => {
                          const item = items.find((entry) => entry.id === id)
                          return item ? isSharedEntityMovable(item) : false
                      })
                    : undefined

                await onReorder(String(active.id), newSortOrder, undefined, undefined, mergedOrderIds)
            } else {
                // Cross-list transfer
                if (!isCrossListAllowed(activeContainer, overContainer)) return

                // Capture all data needed for deferred execution
                const transferAttribute = attribute
                const targetParentId = overContainer.parentAttributeId
                const sourceParentId = activeContainer.parentAttributeId
                const targetItems = overContainer.items
                const targetItemCount = targetItems.length
                const activeIdStr = String(active.id)
                const overIdStr = String(over.id)
                const overIndex = targetItems.findIndex((i) => i.id === overIdStr)

                let newSortOrder: number
                if (overIndex >= 0) {
                    newSortOrder = targetItems[overIndex].sortOrder ?? overIndex + 1
                } else if (savedPendingTransfer) {
                    // Dropped on ghost row — use pending transfer's insertion index
                    newSortOrder = savedPendingTransfer.insertIndex + 1
                } else {
                    newSortOrder = targetItems.length + 1
                }

                // Set deferred cross-list transfer for processing in useEffect.
                // dnd-kit calls onDragEnd inside unstable_batchedUpdates, and React 18
                // auto-batches even setTimeout callbacks. useEffect runs AFTER React
                // commits DOM from the DnD cleanup render, so confirm() dialog dispatch
                // happens in a clean, independent render cycle.
                setDeferredCrossTransfer({
                    attribute: transferAttribute,
                    activeId: activeIdStr,
                    targetParentId,
                    sourceParentId,
                    targetItemCount,
                    newSortOrder
                })
            }
        },
        [containers, findContainer, findAttribute, isCrossListAllowed, onReorder]
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
