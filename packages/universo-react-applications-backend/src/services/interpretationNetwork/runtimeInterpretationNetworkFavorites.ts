import { uuidV7Schema } from '@universo-react/types'
import { generateUuidV7, type DbExecutor } from '@universo-react/utils'
import { acquireAdvisoryXactLock } from '@universo-react/utils/database'
import type { RuntimeSchemaContext } from '../../shared/runtimeHelpers'
import { IDENTIFIER_REGEX } from '../../shared/runtimeHelpers'
import { resolveValidatedRuntimeEntityRecordPolicy } from '../../shared/entityMutationPolicy'
import type { RuntimeSurfaceReady } from './runtimeInterpretationNetworkCore'
import { acquireInterpretationNetworkMatrixMembershipLock } from './runtimeInterpretationNetworkMatrixMembership'
import { findRuntimeAttrByFieldKey, resolveRuntimeRecordOwnerColumnName } from '../runtimeRowSupport/objectMetadata'
import { isRuntimeServerOwnedAttr, readRuntimeRecordAccessConfig } from '../runtimeRowSupport/contracts'
import {
    favoriteRowExists,
    insertFavoriteRow,
    isActiveFavoriteTarget,
    listActiveInterpretationRows,
    listFavoriteRows,
    listMatrixCellAncestorRows,
    loadFavoriteRuntimeObject,
    softDeleteFavoriteRow,
    softDeleteFavoriteRowsForCells,
    type ActiveInterpretationRow
} from '../../persistence/interpretationNetworkFavoritesStore'

const FAVORITE_OWNER_FIELD = 'OwnerUserId'
const FAVORITE_INTERPRETATION_FIELD = 'TargetInterpretationId'
const FAVORITE_CELL_FIELD = 'TargetCellId'
const MAX_CELL_PATH_DEPTH = 128

export const interpretationNetworkFavoriteErrorCodes = {
    invalidMetadata: 'INTERPRETATION_NETWORK_FAVORITE_METADATA_INVALID',
    targetUnavailable: 'INTERPRETATION_NETWORK_FAVORITE_TARGET_UNAVAILABLE',
    invalidActor: 'INTERPRETATION_NETWORK_FAVORITE_ACTOR_INVALID',
    writeFailed: 'INTERPRETATION_NETWORK_FAVORITE_WRITE_FAILED'
} as const

export class InterpretationNetworkFavoriteError extends Error {
    constructor(
        public readonly statusCode: 401 | 404 | 409 | 500,
        public readonly code: (typeof interpretationNetworkFavoriteErrorCodes)[keyof typeof interpretationNetworkFavoriteErrorCodes],
        message: string
    ) {
        super(message)
        this.name = 'InterpretationNetworkFavoriteError'
    }
}

export type InterpretationNetworkFavoriteTarget = {
    interpretationId: string
    cellId: string
}

export type InterpretationNetworkFavoriteListItem = {
    favoriteId: string
    target: InterpretationNetworkFavoriteTarget | null
    structureId: string | null
    availability: 'available' | 'unavailable'
    structureName: string | null
    interpretationTitle: string | null
    cellPath: Array<{
        label: string
        rowLabel: string | null
        columnLabel: string | null
        cellValue: string | null
    }>
    addedAt: string | null
}

type FavoriteObjectMetadata = {
    tableName: string
    ownerColumn: string
    interpretationColumn: string
    cellColumn: string
}

type MatrixCellNode = {
    rowId: string
    cellId: string
    parentCellId: string | null
    rowLabel: unknown
    columnLabel: unknown
    cellValue: unknown
}

const failInvalidMetadata = (): never => {
    throw new InterpretationNetworkFavoriteError(
        409,
        interpretationNetworkFavoriteErrorCodes.invalidMetadata,
        'Favorite entity metadata is missing or invalid.'
    )
}

const requireColumn = (
    attrs: Parameters<typeof findRuntimeAttrByFieldKey>[0],
    codename: string,
    config: Record<string, unknown> | null | undefined
): string => {
    const attr = findRuntimeAttrByFieldKey(attrs, codename)
    if (!attr || attr.data_type !== 'STRING' || !IDENTIFIER_REGEX.test(attr.column_name) || !isRuntimeServerOwnedAttr(attr)) {
        return failInvalidMetadata()
    }
    if (config && codename === FAVORITE_OWNER_FIELD) {
        const accessConfig = readRuntimeRecordAccessConfig(config)
        if (accessConfig?.mode !== 'ownerOnly' || accessConfig.ownerFieldCodename !== FAVORITE_OWNER_FIELD) {
            return failInvalidMetadata()
        }
    }
    return attr.column_name
}

const resolveFavoriteObjectMetadata = async (executor: DbExecutor, schemaIdent: string): Promise<FavoriteObjectMetadata> => {
    const object = await loadFavoriteRuntimeObject(executor, schemaIdent)
    if (!object) return failInvalidMetadata()

    let policy: ReturnType<typeof resolveValidatedRuntimeEntityRecordPolicy>
    try {
        policy = resolveValidatedRuntimeEntityRecordPolicy(object.config)
    } catch {
        return failInvalidMetadata()
    }
    if (policy?.runtimeMutation !== 'deny' || policy.workspaceCopy !== 'exclude') return failInvalidMetadata()

    const accessConfig = readRuntimeRecordAccessConfig(object.config)
    if (accessConfig?.mode !== 'ownerOnly' || accessConfig.ownerFieldCodename !== FAVORITE_OWNER_FIELD) return failInvalidMetadata()
    const ownerColumn = resolveRuntimeRecordOwnerColumnName(object.attrs, object.config)
    if (!ownerColumn || !IDENTIFIER_REGEX.test(ownerColumn)) return failInvalidMetadata()

    const configuredOwnerColumn = requireColumn(object.attrs, FAVORITE_OWNER_FIELD, object.config)
    const interpretationColumn = requireColumn(object.attrs, FAVORITE_INTERPRETATION_FIELD, object.config)
    const cellColumn = requireColumn(object.attrs, FAVORITE_CELL_FIELD, object.config)
    if (configuredOwnerColumn !== ownerColumn || !IDENTIFIER_REGEX.test(object.tableName)) return failInvalidMetadata()

    return {
        tableName: object.tableName,
        ownerColumn,
        interpretationColumn,
        cellColumn
    }
}

const favoriteLockKey = (ctx: RuntimeSchemaContext, target: InterpretationNetworkFavoriteTarget): string =>
    `interpretation-network:favorite:${JSON.stringify([
        ctx.schemaName,
        ctx.currentWorkspaceId,
        ctx.userId,
        target.interpretationId.toLowerCase(),
        target.cellId.toLowerCase()
    ])}`

const requireActorId = (ctx: RuntimeSchemaContext): string => {
    const userId = ctx.userId.trim()
    if (!userId) {
        throw new InterpretationNetworkFavoriteError(
            401,
            interpretationNetworkFavoriteErrorCodes.invalidActor,
            'An authenticated user is required.'
        )
    }
    return userId
}

const assertActiveTarget = async (
    executor: DbExecutor,
    ctx: RuntimeSchemaContext,
    surface: RuntimeSurfaceReady,
    target: InterpretationNetworkFavoriteTarget
): Promise<void> => {
    const active = await isActiveFavoriteTarget(executor, ctx.currentWorkspaceId, ctx.workspacesEnabled, surface, target)
    if (!active) {
        throw new InterpretationNetworkFavoriteError(
            404,
            interpretationNetworkFavoriteErrorCodes.targetUnavailable,
            'The selected Matrix cell is unavailable in the current Workspace.'
        )
    }
}

const safeLocalizedText = (value: unknown, locale: string): string | null => {
    const parseLocalizedValue = (candidate: unknown): string | null => {
        if (typeof candidate === 'string') {
            const trimmed = candidate.trim()
            if (!trimmed) return null
            if (trimmed.startsWith('{')) {
                try {
                    return parseLocalizedValue(JSON.parse(trimmed))
                } catch {
                    return trimmed.slice(0, 2000)
                }
            }
            return trimmed.slice(0, 2000)
        }
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null

        const record = candidate as Record<string, unknown>
        const locales =
            record.locales && typeof record.locales === 'object' && !Array.isArray(record.locales)
                ? (record.locales as Record<string, unknown>)
                : null
        if (locales) {
            const primary = typeof record._primary === 'string' ? record._primary : null
            const keys = [locale, primary, 'en', ...Object.keys(locales)].filter((key): key is string => Boolean(key))
            for (const key of new Set(keys)) {
                const localized = locales[key]
                if (localized && typeof localized === 'object' && !Array.isArray(localized)) {
                    const text = parseLocalizedValue((localized as Record<string, unknown>).content)
                    if (text) return text
                }
            }
        }
        return typeof record.content === 'string' ? parseLocalizedValue(record.content) : null
    }

    return parseLocalizedValue(value)
}

const safeTimestamp = (value: unknown): string | null => {
    const date = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : null
    return date && Number.isFinite(date.getTime()) ? date.toISOString() : null
}

const normalizedUuidV7 = (value: unknown): string | null => {
    const result = uuidV7Schema.safeParse(typeof value === 'string' ? value.trim() : value)
    return result.success ? result.data.toLowerCase() : null
}

const loadActiveInterpretations = async (
    executor: DbExecutor,
    ctx: RuntimeSchemaContext,
    surface: RuntimeSurfaceReady,
    interpretationIds: string[]
): Promise<Map<string, ActiveInterpretationRow>> => {
    if (interpretationIds.length === 0) return new Map()
    const rows = await listActiveInterpretationRows(executor, ctx.currentWorkspaceId, ctx.workspacesEnabled, surface, interpretationIds)
    return new Map(rows.map((row) => [row.interpretationId.toLowerCase(), row]))
}

const loadMatrixCellAncestors = async (
    executor: DbExecutor,
    ctx: RuntimeSchemaContext,
    surface: RuntimeSurfaceReady,
    targets: InterpretationNetworkFavoriteTarget[]
): Promise<Map<string, Map<string, MatrixCellNode[]>>> => {
    if (targets.length === 0) return new Map()
    const rows = await listMatrixCellAncestorRows(
        executor,
        ctx.currentWorkspaceId,
        ctx.workspacesEnabled,
        surface,
        targets,
        MAX_CELL_PATH_DEPTH
    )

    const byInterpretation = new Map<string, Map<string, MatrixCellNode[]>>()
    for (const row of rows) {
        const interpretationId = row.interpretationId.toLowerCase()
        const rowId = String(row.rowId ?? '')
            .trim()
            .toLowerCase()
        const cellId = String(row.cellId ?? '')
            .trim()
            .toLowerCase()
        if (!rowId || !cellId) continue
        const byCell = byInterpretation.get(interpretationId) ?? new Map<string, MatrixCellNode[]>()
        const candidates = byCell.get(cellId) ?? []
        // A shared ancestor appears once for every Favorite target in the recursive SQL result.
        // Deduplicate that fan-out by physical row identity while keeping distinct rows with a
        // duplicate CellId ambiguous so buildCellPath continues to fail closed.
        if (!candidates.some((candidate) => candidate.rowId === rowId)) {
            candidates.push({
                rowId,
                cellId,
                parentCellId:
                    typeof row.parentCellId === 'string' && row.parentCellId.trim() ? row.parentCellId.trim().toLowerCase() : null,
                rowLabel: row.rowLabel,
                columnLabel: row.columnLabel,
                cellValue: row.cellValue
            })
            byCell.set(cellId, candidates)
        }
        byInterpretation.set(interpretationId, byCell)
    }
    return byInterpretation
}

const buildCellPath = (
    cells: Map<string, MatrixCellNode[]> | undefined,
    targetCellId: string,
    locale: string
): InterpretationNetworkFavoriteListItem['cellPath'] | null => {
    if (!cells) return null
    const path: InterpretationNetworkFavoriteListItem['cellPath'] = []
    const visited = new Set<string>()
    let currentCellId: string | null = targetCellId.toLowerCase()

    while (currentCellId) {
        if (visited.has(currentCellId) || path.length >= MAX_CELL_PATH_DEPTH) return null
        visited.add(currentCellId)
        const candidates = cells.get(currentCellId)
        if (!candidates || candidates.length !== 1) return null
        const cell = candidates[0]
        const rowLabel = safeLocalizedText(cell.rowLabel, locale)
        const columnLabel = safeLocalizedText(cell.columnLabel, locale)
        const cellValue = safeLocalizedText(cell.cellValue, locale)
        const labelParts = [columnLabel, rowLabel].filter((part): part is string => part !== null)
        const label = [...new Set(labelParts)].join(' / ') || cellValue
        if (!label) return null
        path.push({ label, rowLabel, columnLabel, cellValue })
        currentCellId = cell.parentCellId
    }

    return path.reverse()
}

export const listInterpretationNetworkFavorites = async (
    ctx: RuntimeSchemaContext,
    surface: RuntimeSurfaceReady,
    input: { locale: string; limit: number; offset: number }
): Promise<{ items: InterpretationNetworkFavoriteListItem[]; hasMore: boolean }> => {
    const actorUserId = requireActorId(ctx)
    return ctx.manager.transaction(async (tx) => {
        const favorite = await resolveFavoriteObjectMetadata(tx, ctx.schemaIdent)
        const rows = await listFavoriteRows({
            executor: tx,
            schemaName: ctx.schemaName,
            workspaceId: ctx.currentWorkspaceId,
            workspacesEnabled: ctx.workspacesEnabled,
            actorUserId,
            favorite,
            limit: input.limit,
            offset: input.offset
        })
        const hasMore = rows.length > input.limit
        const pageRows = hasMore ? rows.slice(0, input.limit) : rows
        const validRows = pageRows.map((row) => {
            const favoriteId = normalizedUuidV7(row.favoriteId)
            if (!favoriteId) return failInvalidMetadata()
            return {
                row,
                favoriteId,
                interpretationId: normalizedUuidV7(row.interpretationId),
                cellId: normalizedUuidV7(row.cellId)
            }
        })
        const validTargets = validRows.flatMap(({ interpretationId, cellId }) =>
            interpretationId && cellId ? [{ interpretationId, cellId }] : []
        )
        const interpretationIds = [...new Set(validTargets.map((target) => target.interpretationId))]
        const activeInterpretations = await loadActiveInterpretations(tx, ctx, surface, interpretationIds)
        const activeCellTargets = validTargets.filter((target) => activeInterpretations.has(target.interpretationId))
        const cellsByInterpretation = await loadMatrixCellAncestors(tx, ctx, surface, activeCellTargets)
        const items = validRows.map(({ row, favoriteId, interpretationId, cellId }): InterpretationNetworkFavoriteListItem => {
            if (!interpretationId || !cellId) {
                return {
                    favoriteId,
                    target: null,
                    structureId: null,
                    availability: 'unavailable',
                    structureName: null,
                    interpretationTitle: null,
                    cellPath: [],
                    addedAt: safeTimestamp(row.createdAt)
                }
            }
            const target = { interpretationId, cellId }
            const activeInterpretation = activeInterpretations.get(interpretationId)
            const cellPath = buildCellPath(cellsByInterpretation.get(interpretationId), cellId, input.locale)
            const structureId = normalizedUuidV7(activeInterpretation?.structureId)
            if (!activeInterpretation || !structureId || !cellPath) {
                return {
                    favoriteId,
                    target: null,
                    structureId: null,
                    availability: 'unavailable',
                    structureName: null,
                    interpretationTitle: null,
                    cellPath: [],
                    addedAt: safeTimestamp(row.createdAt)
                }
            }
            return {
                favoriteId,
                target,
                structureId,
                availability: 'available',
                structureName: safeLocalizedText(activeInterpretation.structureName, input.locale),
                interpretationTitle: safeLocalizedText(activeInterpretation.interpretationTitle, input.locale),
                cellPath,
                addedAt: safeTimestamp(row.createdAt)
            }
        })
        return { items, hasMore }
    })
}

export const addInterpretationNetworkFavorite = async (
    ctx: RuntimeSchemaContext,
    surface: RuntimeSurfaceReady,
    target: InterpretationNetworkFavoriteTarget
): Promise<{ target: InterpretationNetworkFavoriteTarget; created: boolean }> => {
    const actorUserId = requireActorId(ctx)
    return ctx.manager.transaction(async (tx) => {
        const favorite = await resolveFavoriteObjectMetadata(tx, ctx.schemaIdent)
        // The row-level SHARE locks acquired by this check serialize against
        // Matrix membership mutations. Do not take the membership advisory lock
        // here: Matrix commands acquire it after locking the Interpretation row.
        // The Favorite-specific lock below is sufficient to serialize duplicate adds.
        await assertActiveTarget(tx, ctx, surface, target)
        await acquireAdvisoryXactLock(tx, favoriteLockKey(ctx, target))

        const favoriteInput = {
            executor: tx,
            schemaName: ctx.schemaName,
            workspaceId: ctx.currentWorkspaceId,
            workspacesEnabled: ctx.workspacesEnabled,
            actorUserId,
            favorite,
            target
        }
        if (await favoriteRowExists(favoriteInput)) return { target, created: false }

        const id = generateUuidV7()
        const inserted = await insertFavoriteRow({ ...favoriteInput, id })
        if (!inserted) {
            throw new InterpretationNetworkFavoriteError(
                500,
                interpretationNetworkFavoriteErrorCodes.writeFailed,
                'The Favorite could not be saved.'
            )
        }
        return { target, created: true }
    })
}

export const removeInterpretationNetworkFavorite = async (
    ctx: RuntimeSchemaContext,
    favoriteId: string
): Promise<{ favoriteId: string; removed: boolean }> => {
    const actorUserId = requireActorId(ctx)
    return ctx.manager.transaction(async (tx) => {
        const favorite = await resolveFavoriteObjectMetadata(tx, ctx.schemaIdent)
        await acquireAdvisoryXactLock(
            tx,
            `interpretation-network:favorite-remove:${JSON.stringify([
                ctx.schemaName,
                ctx.currentWorkspaceId,
                actorUserId,
                favoriteId.toLowerCase()
            ])}`
        )
        const removed = await softDeleteFavoriteRow({
            executor: tx,
            schemaName: ctx.schemaName,
            workspaceId: ctx.currentWorkspaceId,
            workspacesEnabled: ctx.workspacesEnabled,
            actorUserId,
            favorite,
            favoriteId
        })
        return { favoriteId, removed }
    })
}

/**
 * Soft-deletes every Favorite for a Matrix target in the current Workspace.
 * Call with the active transaction executor after the caller authorizes and
 * deletes the target. This maintenance path deliberately spans owners so no
 * Favorites remain attached to a deleted CellId; user-facing removal remains
 * owner-scoped through removeInterpretationNetworkFavorite.
 */
export const removeInterpretationNetworkFavoritesForCells = async (
    ctx: RuntimeSchemaContext,
    executor: DbExecutor,
    surface: RuntimeSurfaceReady,
    target: { interpretationId: string; cellIds: readonly string[] }
): Promise<void> => {
    const cellIds = [...new Set(target.cellIds.map((cellId) => cellId.trim().toLowerCase()))].sort()
    if (cellIds.length === 0) return
    if (!uuidV7Schema.safeParse(target.interpretationId).success || cellIds.some((cellId) => !uuidV7Schema.safeParse(cellId).success)) {
        throw new InterpretationNetworkFavoriteError(
            409,
            interpretationNetworkFavoriteErrorCodes.invalidMetadata,
            'Favorite cleanup requires UUID v7 Matrix identities.'
        )
    }
    const actorUserId = requireActorId(ctx)
    await acquireInterpretationNetworkMatrixMembershipLock(executor, surface, target.interpretationId)
    const favorite = await resolveFavoriteObjectMetadata(executor, ctx.schemaIdent)
    await softDeleteFavoriteRowsForCells({
        executor,
        schemaName: ctx.schemaName,
        workspaceId: ctx.currentWorkspaceId,
        workspacesEnabled: ctx.workspacesEnabled,
        actorUserId,
        favorite,
        target: { interpretationId: target.interpretationId, cellIds }
    })
}

/** Soft-deletes every Favorite for one Matrix target in the current Workspace. */
export const removeInterpretationNetworkFavoritesForTarget = async (
    ctx: RuntimeSchemaContext,
    executor: DbExecutor,
    surface: RuntimeSurfaceReady,
    target: InterpretationNetworkFavoriteTarget
): Promise<void> =>
    removeInterpretationNetworkFavoritesForCells(ctx, executor, surface, {
        interpretationId: target.interpretationId,
        cellIds: [target.cellId]
    })
