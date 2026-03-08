/**
 * Internal DnD building blocks for FlowListTable.
 *
 * These components are used internally by FlowListTable when `sortableRows` is enabled.
 * They should NOT be imported directly — use FlowListTable with DnD props instead.
 */
import React, { useCallback, useState } from 'react'
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
import type { DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useDroppable } from '@dnd-kit/core'
import { TableBody } from '@mui/material'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import { StyledTableCell, StyledTableRow } from './FlowListTable'
import type { SxProps, Theme } from '@mui/material/styles'

// ---------------------------------------------------------------------------
// SortableTableRow — wraps a single table row with useSortable
// ---------------------------------------------------------------------------

interface SortableTableRowProps {
    id: string
    disabled?: boolean
    children: React.ReactNode
    /** Hide bottom border when expansion content follows */
    hasExpansion?: boolean
    /** Accessible label for the drag handle */
    dragHandleAriaLabel?: string
    sx?: SxProps<Theme>
}

export const SortableTableRow: React.FC<SortableTableRowProps> = ({
    id,
    disabled = false,
    children,
    hasExpansion = false,
    dragHandleAriaLabel,
    sx
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })

    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        cursor: disabled ? 'default' : 'grab',
        position: 'relative',
        zIndex: isDragging ? 1 : 'auto'
    }

    const rowSx: SxProps<Theme> = hasExpansion
        ? Array.isArray(sx)
            ? [{ '& td, & th': { borderBottom: 0 } }, ...sx]
            : sx
            ? [{ '& td, & th': { borderBottom: 0 } }, sx]
            : { '& td, & th': { borderBottom: 0 } }
        : sx ?? {}

    return (
        <StyledTableRow ref={setNodeRef} style={style} sx={rowSx}>
            {/* Drag handle column — attributes + listeners must be on the same focusable element for keyboard DnD */}
            <StyledTableCell
                align='center'
                sx={{ width: 40, px: 0.5, cursor: disabled ? 'default' : 'grab', verticalAlign: 'middle' }}
                aria-label={dragHandleAriaLabel}
                {...attributes}
                {...listeners}
            >
                <DragIndicatorIcon
                    fontSize='small'
                    sx={{
                        color: disabled ? 'action.disabled' : 'action.active',
                        '&:hover': disabled ? {} : { color: 'primary.main' }
                    }}
                />
            </StyledTableCell>
            {children}
        </StyledTableRow>
    )
}

// ---------------------------------------------------------------------------
// SortableTableBody — wraps TableBody with SortableContext + optional droppable
// ---------------------------------------------------------------------------

interface SortableTableBodyProps {
    itemIds: string[]
    /** Container ID for useDroppable (for multi-container DnD). */
    droppableContainerId?: string
    children: React.ReactNode
}

/**
 * Droppable variant: uses useDroppable for multi-container DnD scenarios.
 */
const DroppableSortableBody: React.FC<SortableTableBodyProps & { containerId: string }> = ({ itemIds, containerId, children }) => {
    const { setNodeRef } = useDroppable({ id: containerId })
    return (
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <TableBody ref={setNodeRef}>{children}</TableBody>
        </SortableContext>
    )
}

/**
 * Standard variant: wraps rows in SortableContext without droppable.
 */
const SimpleSortableBody: React.FC<Omit<SortableTableBodyProps, 'droppableContainerId'>> = ({ itemIds, children }) => {
    return (
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
            <TableBody>{children}</TableBody>
        </SortableContext>
    )
}

export const SortableTableBody: React.FC<SortableTableBodyProps> = ({ itemIds, droppableContainerId, children }) => {
    if (droppableContainerId) {
        return (
            <DroppableSortableBody itemIds={itemIds} containerId={droppableContainerId}>
                {children}
            </DroppableSortableBody>
        )
    }
    return <SimpleSortableBody itemIds={itemIds}>{children}</SimpleSortableBody>
}

// ---------------------------------------------------------------------------
// InternalDndWrapper — wraps content with DndContext + sensors + DragOverlay
// Used when FlowListTable manages its own DnD context (externalDndContext=false)
// ---------------------------------------------------------------------------

interface InternalDndWrapperProps {
    children: React.ReactNode
    onDragStart?: (event: DragStartEvent) => void
    onDragEnd?: (event: DragEndEvent) => void
    onDragOver?: (event: DragOverEvent) => void
    onDragCancel?: () => void
    renderDragOverlay?: (activeId: string | null) => React.ReactNode
}

export const InternalDndWrapper: React.FC<InternalDndWrapperProps> = ({
    children,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDragCancel,
    renderDragOverlay
}) => {
    const [activeId, setActiveId] = useState<string | null>(null)

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 }
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates
        })
    )

    const handleDragStart = useCallback(
        (event: DragStartEvent) => {
            setActiveId(String(event.active.id))
            onDragStart?.(event)
        },
        [onDragStart]
    )

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            setActiveId(null)
            onDragEnd?.(event)
        },
        [onDragEnd]
    )

    const handleDragOver = useCallback(
        (event: DragOverEvent) => {
            onDragOver?.(event)
        },
        [onDragOver]
    )

    const handleDragCancel = useCallback(() => {
        setActiveId(null)
        onDragCancel?.()
    }, [onDragCancel])

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
            accessibility={{ container: document.body }}
            measuring={{
                droppable: { strategy: MeasuringStrategy.Always }
            }}
        >
            {children}
            <DragOverlay dropAnimation={null}>{renderDragOverlay ? renderDragOverlay(activeId) : null}</DragOverlay>
        </DndContext>
    )
}
