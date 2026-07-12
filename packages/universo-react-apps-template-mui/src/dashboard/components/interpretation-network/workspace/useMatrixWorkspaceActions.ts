import {
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragMoveEvent,
    type DragOverEvent,
    type DragStartEvent
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useMutation, type QueryClient } from '@tanstack/react-query'
import { useCallback, useRef, type MutableRefObject } from 'react'
import type { TFunction } from 'i18next'
import type { InterpretationNetworkTableProjection } from '@universo-react/types'
import { batchUpdateTabularRows } from '../../../../api/api'
import { buildMatrixMoveUpdates } from '../matrixMove'
import { resolveMatrixDropState, type MatrixDropDestination, type MatrixDropPlacement, type MatrixDropState } from '../matrixDrag'
import {
    toMatrixTableSlotId,
    type MatrixCell,
    type MatrixTableDropSlot,
    type MatrixView,
    type RuntimeColumnLike,
    type RuntimeRow
} from '../model'
import { EMPTY_MATRIX_DROP_STATE } from './workspaceState'

export type SelectMatrixCell = (cellId: string | null, options?: { replace?: boolean; updateRoute?: boolean }) => void
type MoveHierarchyLayout = 'horizontalRows' | 'verticalTree'

export const resolveMoveHierarchyLayout = (
    effectiveMatrixView: MatrixView,
    widgetMatrixMode: 'hierarchicalCells' | 'independentRows',
    tableProjection: InterpretationNetworkTableProjection
): MoveHierarchyLayout =>
    effectiveMatrixView === 'verticalTree' ||
    (effectiveMatrixView === 'table' && widgetMatrixMode === 'hierarchicalCells' && tableProjection === 'hierarchicalPath')
        ? 'verticalTree'
        : 'horizontalRows'

type MatrixRowsSnapshotRef = MutableRefObject<{
    cells: MatrixCell[]
    rawRowsByCellId: Map<string, RuntimeRow>
}>

export function useMatrixWorkspaceActions({
    t,
    queryClient,
    canEditContent,
    apiBaseUrl,
    applicationId,
    workspaceId,
    interpretationSectionId,
    selectedInterpretationId,
    matrixColumnId,
    matrixChildColumns,
    matrixRowsSnapshotRef,
    setMatrixDropState,
    matrixMutationsDisabled,
    effectiveMatrixView,
    tableProjection,
    widgetMatrixMode,
    locale,
    visibleMatrixCells,
    matrixCellIds,
    selectedCell,
    selectMatrixCell,
    readRuntimeRowVersion,
    readSubmittedText,
    setCellDialogError
}: {
    t: TFunction<'interpretationNetwork'>
    queryClient: QueryClient
    canEditContent: boolean
    apiBaseUrl?: string | null
    applicationId?: string | null
    workspaceId?: string | null
    interpretationSectionId?: string | null
    selectedInterpretationId?: string | null
    matrixColumnId?: string | null
    matrixChildColumns?: RuntimeColumnLike[]
    matrixRowsSnapshotRef: MatrixRowsSnapshotRef
    setMatrixDropState: (state: MatrixDropState) => void
    matrixMutationsDisabled: boolean
    effectiveMatrixView: MatrixView
    tableProjection: InterpretationNetworkTableProjection
    widgetMatrixMode: 'hierarchicalCells' | 'independentRows'
    locale: string
    visibleMatrixCells: MatrixCell[]
    matrixCellIds: string[]
    selectedCell: MatrixCell | undefined
    selectMatrixCell: SelectMatrixCell
    readRuntimeRowVersion: (row: RuntimeRow | null | undefined) => number | undefined
    readSubmittedText: (value: unknown, locale: string) => string
    setCellDialogError: (error: string | null) => void
}) {
    const pendingMoveKeyRef = useRef<string | null>(null)
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )
    const effectiveMoveHierarchyLayout = resolveMoveHierarchyLayout(effectiveMatrixView, widgetMatrixMode, tableProjection)

    const moveCellMutation = useMutation({
        mutationFn: async ({
            sourceCellId,
            targetCellId,
            placement = 'after',
            destination
        }: {
            sourceCellId: string
            targetCellId: string
            placement?: MatrixDropPlacement
            destination?: MatrixDropDestination
        }) => {
            if (!canEditContent) throw new Error('permission-denied')
            if (
                !apiBaseUrl ||
                !applicationId ||
                !interpretationSectionId ||
                !selectedInterpretationId ||
                !matrixColumnId ||
                sourceCellId === targetCellId
            ) {
                return null
            }
            const { cells: currentMatrixCells, rawRowsByCellId: currentRawMatrixRowsByCellId } = matrixRowsSnapshotRef.current
            const movePlan = buildMatrixMoveUpdates({
                mode: widgetMatrixMode,
                sourceCellId,
                targetCellId,
                placement,
                cells: currentMatrixCells,
                rawRowsByCellId: currentRawMatrixRowsByCellId,
                childColumns: matrixChildColumns,
                locale,
                readRuntimeRowVersion,
                readSubmittedText,
                hierarchyLayout: effectiveMoveHierarchyLayout,
                destination
            })
            if (!movePlan) return null

            await batchUpdateTabularRows({
                apiBaseUrl,
                applicationId,
                workspaceId,
                parentRecordId: selectedInterpretationId,
                componentId: matrixColumnId,
                objectCollectionId: interpretationSectionId,
                updates: movePlan.updates
            })
            return { selectedCellIdAfterMove: movePlan.selectedCellIdAfterMove }
        },
        onSuccess: async (result) => {
            if (result?.selectedCellIdAfterMove) {
                selectMatrixCell(result.selectedCellIdAfterMove, { replace: true })
            }
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspaceMatrix'] })
        },
        onSettled: async () => {
            pendingMoveKeyRef.current = null
            await queryClient.invalidateQueries({ queryKey: ['interpretationNetworkWorkspaceMatrix'] })
        }
    })

    const handleMoveCell = useCallback(
        (sourceCellId: string, targetCellId: string, placement: MatrixDropPlacement = 'after', destination?: MatrixDropDestination) => {
            if (!sourceCellId || !targetCellId || sourceCellId === targetCellId) return
            if (matrixMutationsDisabled || moveCellMutation.isPending) return
            const moveKey = `${sourceCellId}:${targetCellId}:${placement}`
            if (pendingMoveKeyRef.current === moveKey) return
            pendingMoveKeyRef.current = moveKey
            moveCellMutation.mutate({ sourceCellId, targetCellId, placement, destination })
        },
        [matrixMutationsDisabled, moveCellMutation]
    )

    const calculateDropState = useCallback(
        (sourceCellId: string, targetCellId: string | null, event?: Pick<DragOverEvent, 'active' | 'over'>): MatrixDropState => {
            const activeCellIds = effectiveMatrixView === 'table' ? visibleMatrixCells.map((cell) => cell.id) : matrixCellIds
            return resolveMatrixDropState({
                mode: widgetMatrixMode,
                cells: matrixRowsSnapshotRef.current.cells,
                cellIds: activeCellIds,
                sourceCellId,
                targetCellId,
                translatedRect: event?.active.rect.current.translated,
                targetRect: event?.over?.rect,
                hierarchyLayout: effectiveMoveHierarchyLayout,
                tableSlot: event?.over?.data.current?.matrixTableSlot as MatrixTableDropSlot | undefined
            })
        },
        [effectiveMatrixView, effectiveMoveHierarchyLayout, matrixCellIds, matrixRowsSnapshotRef, visibleMatrixCells, widgetMatrixMode]
    )

    const handleMatrixDragStart = useCallback(
        (event: DragStartEvent) => {
            const sourceCellId = typeof event.active.id === 'string' ? event.active.id : String(event.active.id)
            setMatrixDropState({ activeCellId: sourceCellId, overCellId: null, placement: null, isValid: false, destination: null })
        },
        [setMatrixDropState]
    )

    const handleMatrixDragMove = useCallback(
        (event: DragMoveEvent) => {
            const sourceCellId = typeof event.active.id === 'string' ? event.active.id : String(event.active.id)
            const targetCellId = event.over ? (typeof event.over.id === 'string' ? event.over.id : String(event.over.id)) : null
            setMatrixDropState(calculateDropState(sourceCellId, targetCellId, event))
        },
        [calculateDropState, setMatrixDropState]
    )

    const handleMatrixDragOver = useCallback(
        (event: DragOverEvent) => {
            const sourceCellId = typeof event.active.id === 'string' ? event.active.id : String(event.active.id)
            const targetCellId = event.over ? (typeof event.over.id === 'string' ? event.over.id : String(event.over.id)) : null
            setMatrixDropState(calculateDropState(sourceCellId, targetCellId, event))
        },
        [calculateDropState, setMatrixDropState]
    )

    const handleMatrixDragCancel = useCallback(() => {
        setMatrixDropState(EMPTY_MATRIX_DROP_STATE)
    }, [setMatrixDropState])

    const handleMatrixDragEnd = useCallback(
        (event: DragEndEvent) => {
            const sourceCellId = typeof event.active.id === 'string' ? event.active.id : String(event.active.id)
            const targetCellId = event.over ? (typeof event.over.id === 'string' ? event.over.id : String(event.over.id)) : null
            const dropState = calculateDropState(sourceCellId, targetCellId, event)
            setMatrixDropState(EMPTY_MATRIX_DROP_STATE)
            if (!dropState.overCellId || !dropState.placement || !dropState.isValid) return
            handleMoveCell(sourceCellId, dropState.overCellId, dropState.placement, dropState.destination ?? undefined)
        },
        [calculateDropState, handleMoveCell, setMatrixDropState]
    )

    const moveSelectedToTableSlot = useCallback(
        (slot: MatrixTableDropSlot) => {
            if (!selectedCell) {
                setCellDialogError(
                    t('workspace.table.selectCellBeforeMove', 'Select a cell before moving it into an empty table position.')
                )
                return
            }
            setCellDialogError(null)
            const targetCellId = toMatrixTableSlotId(slot)
            handleMoveCell(selectedCell.id, targetCellId, 'child', {
                placement: 'child',
                targetCellId,
                parentCellId: widgetMatrixMode === 'hierarchicalCells' ? selectedCell.parentCellId ?? null : null,
                insertionIndex: 0,
                tableSlot: slot
            })
        },
        [handleMoveCell, selectedCell, setCellDialogError, t, widgetMatrixMode]
    )

    return {
        sensors,
        moveCellMutation,
        handleMoveCell,
        moveSelectedToTableSlot,
        matrixDragHandlers: {
            dragStart: handleMatrixDragStart,
            dragMove: handleMatrixDragMove,
            dragOver: handleMatrixDragOver,
            dragCancel: handleMatrixDragCancel,
            dragEnd: handleMatrixDragEnd
        }
    }
}
