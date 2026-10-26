import { acquireAdvisoryXactLock } from '@universo-react/utils/database'
import type { z } from 'zod'
import type { DbExecutor } from '@universo-react/utils'
import {
    assertColumn,
    getChildField,
    InterpretationNetworkCommandError,
    interpretationNetworkCommandErrorCodes,
    type ObjectContract,
    type RuntimeSurfaceReady
} from './runtimeInterpretationNetworkCore'

export type InterpretationNetworkTemplateSaveScope = z.infer<
    typeof import('./runtimeInterpretationNetworkCore').interpretationNetworkTemplateSaveRequestSchema
>['scope']

/** Shared lock identity, independent of widget instance and command kind. */
export const interpretationNetworkMatrixMembershipLockKey = (surface: RuntimeSurfaceReady, interpretationId: string): string =>
    `interpretation-network:matrix:${surface.schemaName}:${surface.workspaceId ?? 'global'}:${interpretationId.toLowerCase()}`

/** Serializes all changes to one Interpretation's Matrix membership and snapshot reads. */
export const acquireInterpretationNetworkMatrixMembershipLock = async (
    executor: DbExecutor,
    surface: RuntimeSurfaceReady,
    interpretationId: string
): Promise<void> => {
    await acquireAdvisoryXactLock(executor, interpretationNetworkMatrixMembershipLockKey(surface, interpretationId))
}

const invalidMatrix = (message: string, details?: Record<string, unknown>): never => {
    throw new InterpretationNetworkCommandError(409, interpretationNetworkCommandErrorCodes.invalidMatrix, message, details)
}

/**
 * Validates the active Matrix snapshot, selects a requested branch, and rebases
 * its root so the copied subtree becomes a valid standalone Matrix hierarchy.
 */
export const resolveTemplateMatrixRows = (
    sourceRows: Array<Record<string, unknown>>,
    contract: ObjectContract,
    scope: InterpretationNetworkTemplateSaveScope,
    matrixMode: unknown
): Array<Record<string, unknown>> => {
    if (scope.kind === 'wholeStructure') return sourceRows

    if (matrixMode === 'independentRows') {
        throw new InterpretationNetworkCommandError(
            409,
            interpretationNetworkCommandErrorCodes.unsupportedMode,
            'Selected Matrix branches are unavailable in independentRows mode',
            { matrixMode }
        )
    }
    if (matrixMode !== 'hierarchicalCells') {
        throw new InterpretationNetworkCommandError(
            409,
            interpretationNetworkCommandErrorCodes.unsupportedMode,
            'Selected Matrix branches require hierarchicalCells mode',
            { matrixMode }
        )
    }

    const cellIdColumn = assertColumn(getChildField(contract, 'CellId'), 'InterpretationMatrix.CellId')
    const parentCellIdColumn = assertColumn(getChildField(contract, 'ParentCellId'), 'InterpretationMatrix.ParentCellId')
    const parentByCellId = new Map<string, string | null>()

    for (const row of sourceRows) {
        const cellId = String(row[cellIdColumn] ?? '')
            .trim()
            .toLowerCase()
        if (!cellId) invalidMatrix('Source matrix contains a row without CellId')
        if (parentByCellId.has(cellId)) {
            invalidMatrix('Source matrix contains duplicate CellId values', { cellId })
        }

        const parentValue = row[parentCellIdColumn]
        const parentCellId = parentValue === null || parentValue === undefined ? '' : String(parentValue).trim().toLowerCase()
        parentByCellId.set(cellId, parentCellId || null)
    }

    const roots = [...parentByCellId.entries()].filter(([, parentCellId]) => parentCellId === null).map(([cellId]) => cellId)
    if (roots.length !== 1) {
        invalidMatrix('Source matrix must contain exactly one root cell', { rootCount: roots.length })
    }

    const childrenByParent = new Map<string, string[]>()
    for (const [cellId, parentCellId] of parentByCellId) {
        if (!parentCellId) continue
        if (!parentByCellId.has(parentCellId)) {
            invalidMatrix('Source matrix references a parent cell that does not exist', { cellId, parentCellId })
        }
        const children = childrenByParent.get(parentCellId) ?? []
        children.push(cellId)
        childrenByParent.set(parentCellId, children)
    }

    const validated = new Set<string>()
    for (const startCellId of parentByCellId.keys()) {
        const path = new Set<string>()
        let cursor: string | null = startCellId
        while (cursor && !validated.has(cursor)) {
            if (path.has(cursor)) {
                invalidMatrix('Source matrix hierarchy contains a cycle', { cellId: startCellId })
            }
            path.add(cursor)
            cursor = parentByCellId.get(cursor) ?? null
        }
        for (const cellId of path) validated.add(cellId)
    }

    const rootCellId = scope.rootCellId.trim().toLowerCase()
    if (!parentByCellId.has(rootCellId)) {
        throw new InterpretationNetworkCommandError(
            404,
            interpretationNetworkCommandErrorCodes.rowNotFound,
            'Selected Matrix root was not found in the active source Structure',
            { rootCellId: scope.rootCellId }
        )
    }

    const selectedCellIds = new Set<string>()
    const pending = [rootCellId]
    while (pending.length > 0) {
        const cellId = pending.pop() as string
        if (selectedCellIds.has(cellId)) continue
        selectedCellIds.add(cellId)
        pending.push(...(childrenByParent.get(cellId) ?? []))
    }

    return sourceRows
        .filter((row) =>
            selectedCellIds.has(
                String(row[cellIdColumn] ?? '')
                    .trim()
                    .toLowerCase()
            )
        )
        .map((row) => {
            const cellId = String(row[cellIdColumn]).trim().toLowerCase()
            return { ...row, [cellIdColumn]: cellId, [parentCellIdColumn]: cellId === rootCellId ? null : parentByCellId.get(cellId) }
        })
}
