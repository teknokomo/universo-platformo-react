import { qSchemaTable } from '@universo-react/database'
import type { DbExecutor } from '@universo-react/utils'
import { quoteIdentifier } from '../shared/runtimeHelpers'
import {
    assertColumn,
    childTableIdent,
    getChildField,
    getField,
    tableIdent,
    type RuntimeSurfaceReady
} from '../services/interpretationNetwork/runtimeInterpretationNetworkCore'
import { resolveRuntimeObjectCollectionByCodename } from '../services/runtimeRowSupport/objectMetadata'

const FAVORITE_OBJECT_CODENAME = 'Favorite'

export type FavoriteRuntimeObject = NonNullable<Awaited<ReturnType<typeof resolveRuntimeObjectCollectionByCodename>>>

export type FavoriteStoredRow = {
    favoriteId: unknown
    interpretationId: unknown
    cellId: unknown
    createdAt: unknown
}

export type ActiveInterpretationRow = {
    interpretationId: string
    structureId: unknown
    interpretationTitle: unknown
    structureName: unknown
}

export type MatrixCellAncestorRow = {
    interpretationId: string
    rowId: unknown
    cellId: unknown
    parentCellId: unknown
    rowLabel: unknown
    columnLabel: unknown
    cellValue: unknown
}

export type FavoriteColumnMetadata = {
    tableName: string
    ownerColumn: string
    interpretationColumn: string
    cellColumn: string
}

/** Load runtime Favorite metadata through the shared SQL metadata reader. */
export async function loadFavoriteRuntimeObject(executor: DbExecutor, schemaIdent: string): Promise<FavoriteRuntimeObject | null> {
    return resolveRuntimeObjectCollectionByCodename(executor, schemaIdent, FAVORITE_OBJECT_CODENAME)
}

const activeRowPredicate = (alias: string): string =>
    `${alias}.${quoteIdentifier('_upl_deleted')} = false AND ${alias}.${quoteIdentifier('_app_deleted')} = false`

const workspacePredicate = (alias: string, workspaceId: string | null, workspacesEnabled: boolean, values: unknown[]): string => {
    if (!workspacesEnabled) return 'TRUE'
    if (!workspaceId) return 'FALSE'
    const column = `${alias}.${quoteIdentifier('workspace_id')}`
    values.push(workspaceId)
    return `${column} = $${values.length}`
}

const resolveMatrixColumns = (surface: RuntimeSurfaceReady) => {
    const interpretation = surface.contracts.Interpretation
    const structure = surface.contracts.Structure
    return {
        interpretationTable: tableIdent(surface.schemaName, interpretation.object),
        structureTable: tableIdent(surface.schemaName, structure.object),
        cellTable: childTableIdent(surface.schemaName, interpretation),
        interpretationTitle: quoteIdentifier(assertColumn(getField(interpretation, 'Title'), 'Interpretation.Title')),
        parentStructure: quoteIdentifier(assertColumn(getField(interpretation, 'ParentStructure'), 'Interpretation.ParentStructure')),
        structureName: quoteIdentifier(assertColumn(getField(structure, 'Name'), 'Structure.Name')),
        cellId: quoteIdentifier(assertColumn(getChildField(interpretation, 'CellId'), 'Interpretation.InterpretationMatrix.CellId')),
        parentCellId: quoteIdentifier(
            assertColumn(getChildField(interpretation, 'ParentCellId'), 'Interpretation.InterpretationMatrix.ParentCellId')
        ),
        rowLabel: quoteIdentifier(assertColumn(getChildField(interpretation, 'RowLabel'), 'Interpretation.InterpretationMatrix.RowLabel')),
        columnLabel: quoteIdentifier(
            assertColumn(getChildField(interpretation, 'ColLabel'), 'Interpretation.InterpretationMatrix.ColLabel')
        ),
        cellValue: quoteIdentifier(
            assertColumn(getChildField(interpretation, 'CellValue'), 'Interpretation.InterpretationMatrix.CellValue')
        )
    }
}

/** Check that an Interpretation and Cell are active in the request's Workspace. */
export async function isActiveFavoriteTarget(
    executor: DbExecutor,
    workspaceId: string | null,
    workspacesEnabled: boolean,
    surface: RuntimeSurfaceReady,
    target: { interpretationId: string; cellId: string }
): Promise<boolean> {
    const columns = resolveMatrixColumns(surface)
    const interpretationValues: unknown[] = [target.interpretationId]
    const interpretationWorkspace = workspacePredicate('i', workspaceId, workspacesEnabled, interpretationValues)
    const targetRows = await executor.query<{ structureId: unknown }>(
        `
        SELECT i.${columns.parentStructure}::text AS "structureId"
        FROM ${columns.interpretationTable} i
        WHERE i.id::text = $1::text
          AND ${activeRowPredicate('i')}
          AND ${interpretationWorkspace}
        LIMIT 1
        `,
        interpretationValues
    )
    const structureId = targetRows[0]?.structureId
    if (typeof structureId !== 'string' || !structureId.trim()) return false

    // Acquire row locks in the same ancestor-to-descendant order as Structure
    // aggregate deletion: Structure -> Interpretation -> Matrix Cell. Keeping
    // each lock in its own statement makes the order independent of join plans.
    const structureValues: unknown[] = [structureId]
    const structureWorkspace = workspacePredicate('s', workspaceId, workspacesEnabled, structureValues)
    const structures = await executor.query<{ id: unknown }>(
        `
        SELECT s.id::text AS id
        FROM ${columns.structureTable} s
        WHERE s.id::text = $1::text
          AND ${activeRowPredicate('s')}
          AND ${structureWorkspace}
        FOR SHARE
        `,
        structureValues
    )
    if (!structures[0]?.id) return false

    const lockedInterpretationValues: unknown[] = [target.interpretationId, structureId]
    const lockedInterpretationWorkspace = workspacePredicate('i', workspaceId, workspacesEnabled, lockedInterpretationValues)
    const interpretations = await executor.query<{ id: unknown }>(
        `
        SELECT i.id::text AS id
        FROM ${columns.interpretationTable} i
        WHERE i.id::text = $1::text
          AND i.${columns.parentStructure}::text = $2::text
          AND ${activeRowPredicate('i')}
          AND ${lockedInterpretationWorkspace}
        FOR SHARE
        `,
        lockedInterpretationValues
    )
    if (!interpretations[0]?.id) return false

    const cellValues: unknown[] = [target.interpretationId, target.cellId]
    const cellWorkspace = workspacePredicate('c', workspaceId, workspacesEnabled, cellValues)
    const cells = await executor.query<{ id: unknown }>(
        `
        SELECT c.${columns.cellId}::text AS id
        FROM ${columns.cellTable} c
        WHERE c.${quoteIdentifier('_tp_parent_id')}::text = $1::text
          AND c.${columns.cellId}::text = $2::text
          AND ${activeRowPredicate('c')}
          AND ${cellWorkspace}
        FOR SHARE
        `,
        cellValues
    )
    return Boolean(cells[0]?.id)
}

/** Page the current user's active Favorite records. */
export async function listFavoriteRows(input: {
    executor: DbExecutor
    schemaName: string
    workspaceId: string | null
    workspacesEnabled: boolean
    actorUserId: string
    favorite: FavoriteColumnMetadata
    limit: number
    offset: number
}): Promise<FavoriteStoredRow[]> {
    const values: unknown[] = [input.actorUserId]
    const workspace = workspacePredicate('favorite', input.workspaceId, input.workspacesEnabled, values)
    values.push(input.limit + 1, input.offset)
    return input.executor.query<FavoriteStoredRow>(
        `
        SELECT favorite.${quoteIdentifier('id')}::text AS "favoriteId",
               favorite.${quoteIdentifier(input.favorite.interpretationColumn)}::text AS "interpretationId",
               favorite.${quoteIdentifier(input.favorite.cellColumn)}::text AS "cellId",
               favorite.${quoteIdentifier('_upl_created_at')} AS "createdAt"
        FROM ${qSchemaTable(input.schemaName, input.favorite.tableName)} favorite
        WHERE favorite.${quoteIdentifier(input.favorite.ownerColumn)} = $1
          AND ${activeRowPredicate('favorite')}
          AND ${workspace}
        ORDER BY favorite.${quoteIdentifier('_upl_created_at')} DESC NULLS LAST,
                 favorite.${quoteIdentifier('id')} DESC
        LIMIT $${values.length - 1} OFFSET $${values.length}
        `,
        values
    )
}

/** Load active Interpretation and Structure labels for Favorite projection. */
export async function listActiveInterpretationRows(
    executor: DbExecutor,
    workspaceId: string | null,
    workspacesEnabled: boolean,
    surface: RuntimeSurfaceReady,
    interpretationIds: string[]
): Promise<ActiveInterpretationRow[]> {
    if (interpretationIds.length === 0) return []
    const columns = resolveMatrixColumns(surface)
    const values: unknown[] = [interpretationIds]
    const interpretationWorkspace = workspacePredicate('i', workspaceId, workspacesEnabled, values)
    const structureWorkspace = workspacePredicate('s', workspaceId, workspacesEnabled, values)
    return executor.query<ActiveInterpretationRow>(
        `
        SELECT i.id::text AS "interpretationId",
               s.id::text AS "structureId",
               i.${columns.interpretationTitle} AS "interpretationTitle",
               s.${columns.structureName} AS "structureName"
        FROM ${columns.interpretationTable} i
        INNER JOIN ${columns.structureTable} s
            ON s.id::text = i.${columns.parentStructure}::text
           AND ${activeRowPredicate('s')}
           AND ${structureWorkspace}
        WHERE i.id = ANY($1::uuid[])
          AND ${activeRowPredicate('i')}
          AND ${interpretationWorkspace}
        `,
        values
    )
}

/** Load bounded ancestor chains for active Matrix cells. */
export async function listMatrixCellAncestorRows(
    executor: DbExecutor,
    workspaceId: string | null,
    workspacesEnabled: boolean,
    surface: RuntimeSurfaceReady,
    targets: Array<{ interpretationId: string; cellId: string }>,
    maxDepth: number
): Promise<MatrixCellAncestorRow[]> {
    if (!Number.isSafeInteger(maxDepth) || maxDepth < 0) {
        throw new RangeError('Favorite Matrix path depth must be a non-negative safe integer')
    }
    if (targets.length === 0) return []
    const columns = resolveMatrixColumns(surface)
    const targetRows = [...new Map(targets.map((target) => [`${target.interpretationId}:${target.cellId}`, target])).values()].map(
        (target) => ({ interpretation_id: target.interpretationId, cell_id: target.cellId })
    )
    const values: unknown[] = [JSON.stringify(targetRows)]
    let workspaceClause: string
    if (workspacesEnabled) {
        if (!workspaceId) {
            workspaceClause = 'FALSE'
        } else {
            values.push(workspaceId)
            workspaceClause = `c.${quoteIdentifier('workspace_id')} = $2`
        }
    } else {
        workspaceClause = 'TRUE'
    }
    const workspaceParentClause = workspaceClause.replace(/c\./g, 'p.')
    const maxDepthParameter = values.push(maxDepth)
    return executor.query<MatrixCellAncestorRow>(
        `
        WITH RECURSIVE favorite_targets AS (
            SELECT target.interpretation_id, target.cell_id::text AS cell_id
            FROM jsonb_to_recordset($1::jsonb) AS target(interpretation_id uuid, cell_id uuid)
        ), cell_ancestors AS (
            SELECT target.interpretation_id,
                   c.id::text AS row_id,
                   c.${columns.cellId}::text AS "cellId",
                   NULLIF(BTRIM(c.${columns.parentCellId}::text), '') AS "parentCellId",
                   c.${columns.rowLabel} AS "rowLabel",
                   c.${columns.columnLabel} AS "columnLabel",
                   c.${columns.cellValue} AS "cellValue",
                   ARRAY[c.${columns.cellId}::text]::text[] AS path,
                   1 AS depth
            FROM favorite_targets target
            INNER JOIN ${columns.cellTable} c
                ON c.${quoteIdentifier('_tp_parent_id')} = target.interpretation_id
               AND c.${columns.cellId}::text = target.cell_id
               AND ${activeRowPredicate('c')}
               AND ${workspaceClause}
            UNION ALL
            SELECT ancestor.interpretation_id,
                   p.id::text AS row_id,
                   p.${columns.cellId}::text AS "cellId",
                   NULLIF(BTRIM(p.${columns.parentCellId}::text), '') AS "parentCellId",
                   p.${columns.rowLabel} AS "rowLabel",
                   p.${columns.columnLabel} AS "columnLabel",
                   p.${columns.cellValue} AS "cellValue",
                   ancestor.path || p.${columns.cellId}::text,
                   ancestor.depth + 1
            FROM cell_ancestors ancestor
            INNER JOIN ${columns.cellTable} p
                ON p.${quoteIdentifier('_tp_parent_id')} = ancestor.interpretation_id
               AND p.${columns.cellId}::text = ancestor."parentCellId"
               AND ${activeRowPredicate('p')}
               AND ${workspaceParentClause}
            WHERE ancestor."parentCellId" IS NOT NULL
              AND ancestor.depth < $${maxDepthParameter}
              AND NOT (p.${columns.cellId}::text = ANY(ancestor.path))
        )
        SELECT interpretation_id::text AS "interpretationId",
               row_id AS "rowId",
               "cellId",
               "parentCellId",
               "rowLabel",
               "columnLabel",
               "cellValue"
        FROM cell_ancestors
        `,
        values
    )
}

/** Check for an existing active Favorite with the same owner, target, and Workspace. */
export async function favoriteRowExists(input: {
    executor: DbExecutor
    schemaName: string
    workspaceId: string | null
    workspacesEnabled: boolean
    actorUserId: string
    favorite: FavoriteColumnMetadata
    target: { interpretationId: string; cellId: string }
}): Promise<boolean> {
    const values: unknown[] = [input.actorUserId, input.target.interpretationId, input.target.cellId]
    const workspace = workspacePredicate('favorite', input.workspaceId, input.workspacesEnabled, values)
    const rows = await input.executor.query<{ exists: boolean }>(
        `
        SELECT EXISTS (
            SELECT 1
            FROM ${qSchemaTable(input.schemaName, input.favorite.tableName)} favorite
            WHERE favorite.${quoteIdentifier(input.favorite.ownerColumn)} = $1
              AND favorite.${quoteIdentifier(input.favorite.interpretationColumn)} = $2
              AND favorite.${quoteIdentifier(input.favorite.cellColumn)} = $3
              AND ${activeRowPredicate('favorite')}
              AND ${workspace}
        ) AS exists
        `,
        values
    )
    return rows[0]?.exists === true
}

/** Insert one Favorite and report whether PostgreSQL returned the inserted row. */
export async function insertFavoriteRow(input: {
    executor: DbExecutor
    schemaName: string
    workspaceId: string | null
    workspacesEnabled: boolean
    actorUserId: string
    favorite: FavoriteColumnMetadata
    target: { interpretationId: string; cellId: string }
    id: string
}): Promise<boolean> {
    const columns = ['id']
    const values: unknown[] = [input.id]
    if (input.workspacesEnabled) {
        if (!input.workspaceId) return false
        columns.push('workspace_id')
        values.push(input.workspaceId)
    }
    columns.push(
        input.favorite.ownerColumn,
        input.favorite.interpretationColumn,
        input.favorite.cellColumn,
        '_upl_created_by',
        '_upl_updated_by'
    )
    values.push(input.actorUserId, input.target.interpretationId, input.target.cellId, input.actorUserId, input.actorUserId)
    const rows = await input.executor.query<{ inserted: boolean }>(
        `
            INSERT INTO ${qSchemaTable(input.schemaName, input.favorite.tableName)} (${columns.map(quoteIdentifier).join(', ')})
        VALUES (${values.map((_, index) => `$${index + 1}`).join(', ')})
        RETURNING true AS inserted
        `,
        values
    )
    return rows[0]?.inserted === true
}

/** Soft-delete one owner-scoped Favorite and report whether a row matched. */
export async function softDeleteFavoriteRow(input: {
    executor: DbExecutor
    schemaName: string
    workspaceId: string | null
    workspacesEnabled: boolean
    actorUserId: string
    favorite: FavoriteColumnMetadata
    favoriteId: string
}): Promise<boolean> {
    const values: unknown[] = [input.favoriteId, input.actorUserId]
    const workspace = workspacePredicate('favorite', input.workspaceId, input.workspacesEnabled, values)
    const rows = await input.executor.query<{ removed: boolean }>(
        `
        UPDATE ${qSchemaTable(input.schemaName, input.favorite.tableName)} favorite
        SET ${quoteIdentifier('_upl_deleted')} = true,
            ${quoteIdentifier('_app_deleted')} = true,
            ${quoteIdentifier('_upl_deleted_at')} = NOW(),
            ${quoteIdentifier('_upl_deleted_by')} = $2,
            ${quoteIdentifier('_app_deleted_at')} = NOW(),
            ${quoteIdentifier('_app_deleted_by')} = $2,
            ${quoteIdentifier('_upl_updated_at')} = NOW(),
            ${quoteIdentifier('_upl_updated_by')} = $2
        WHERE favorite.${quoteIdentifier('id')} = $1::uuid
          AND favorite.${quoteIdentifier(input.favorite.ownerColumn)} = $2
          AND ${activeRowPredicate('favorite')}
          AND ${workspace}
        RETURNING true AS removed
        `,
        values
    )
    return rows.some((row) => row.removed === true)
}

/** Soft-delete all owners' Favorites matching deleted Matrix cells in the current Workspace. */
export async function softDeleteFavoriteRowsForCells(input: {
    executor: DbExecutor
    schemaName: string
    workspaceId: string | null
    workspacesEnabled: boolean
    actorUserId: string
    favorite: FavoriteColumnMetadata
    target: { interpretationId: string; cellIds: readonly string[] }
}): Promise<void> {
    const values: unknown[] = [input.target.interpretationId, input.target.cellIds, input.actorUserId]
    const workspace = workspacePredicate('favorite', input.workspaceId, input.workspacesEnabled, values)
    await input.executor.query<{ removed: boolean }>(
        `
        UPDATE ${qSchemaTable(input.schemaName, input.favorite.tableName)} favorite
        SET ${quoteIdentifier('_upl_deleted')} = true,
            ${quoteIdentifier('_app_deleted')} = true,
            ${quoteIdentifier('_upl_deleted_at')} = NOW(),
            ${quoteIdentifier('_upl_deleted_by')} = $3,
            ${quoteIdentifier('_app_deleted_at')} = NOW(),
            ${quoteIdentifier('_app_deleted_by')} = $3,
            ${quoteIdentifier('_upl_updated_at')} = NOW(),
            ${quoteIdentifier('_upl_updated_by')} = $3
        WHERE favorite.${quoteIdentifier(input.favorite.interpretationColumn)} = $1
          AND favorite.${quoteIdentifier(input.favorite.cellColumn)} = ANY($2::text[])
          AND ${activeRowPredicate('favorite')}
          AND ${workspace}
        RETURNING true AS removed
        `,
        values
    )
}
