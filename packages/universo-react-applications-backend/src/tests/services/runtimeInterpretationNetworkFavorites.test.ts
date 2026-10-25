import type { DbExecutor } from '@universo-react/utils'
import { uuidV7Schema } from '@universo-react/types'
import type { RuntimeSchemaContext } from '../../shared/runtimeHelpers'
import type { RuntimeSurfaceReady } from '../../services/interpretationNetwork/runtimeInterpretationNetworkCore'
import { listMatrixCellAncestorRows } from '../../persistence/interpretationNetworkFavoritesStore'
import {
    addInterpretationNetworkFavorite,
    InterpretationNetworkFavoriteError,
    listInterpretationNetworkFavorites,
    removeInterpretationNetworkFavorite,
    removeInterpretationNetworkFavoritesForCells,
    removeInterpretationNetworkFavoritesForTarget,
    type InterpretationNetworkFavoriteTarget
} from '../../services/interpretationNetwork/runtimeInterpretationNetworkFavorites'

const actorUserId = '019f7f10-0000-7000-8000-000000000010'
const workspaceId = '019f7f10-0000-7000-8000-000000000011'
const interpretationId = '019f7f10-0000-7000-8000-000000000012'
const rootCellId = '019f7f10-0000-7000-8000-000000000013'
const cellId = '019f7f10-0000-7000-8000-000000000014'
const staleInterpretationId = '019f7f10-0000-7000-8000-000000000015'
const staleCellId = '019f7f10-0000-7000-8000-000000000016'
const structureId = '019f7f10-0000-7000-8000-000000000017'
const favoriteId = '019f7f10-0000-7000-8000-000000000018'
const staleFavoriteId = '019f7f10-0000-7000-8000-000000000019'
const secondCellId = '019f7f10-0000-7000-8000-000000000023'
const secondFavoriteId = '019f7f10-0000-7000-8000-000000000024'
const rootCellRowId = '019f7f10-0000-7000-8000-000000000025'
const firstCellRowId = '019f7f10-0000-7000-8000-000000000026'
const secondCellRowId = '019f7f10-0000-7000-8000-000000000027'

const target: InterpretationNetworkFavoriteTarget = { interpretationId, cellId }

const localized = (en: string, ru: string) => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: { content: en },
        ru: { content: ru }
    }
})

const favoriteObject = {
    id: 'favorite-object',
    codename: 'Favorite',
    table_name: 'obj_favorites',
    config: {
        runtimeRecordAccess: { mode: 'ownerOnly', ownerFieldCodename: 'OwnerUserId' },
        recordPolicy: { version: 1, runtimeMutation: 'deny', workspaceCopy: 'exclude' }
    }
}

const favoriteAttrs = [
    { id: 'owner', codename: 'OwnerUserId', column_name: 'owner_user_id', data_type: 'STRING', ui_config: { serverOwned: true } },
    {
        id: 'interpretation',
        codename: 'TargetInterpretationId',
        column_name: 'target_interpretation_id',
        data_type: 'STRING',
        ui_config: { serverOwned: true }
    },
    { id: 'cell', codename: 'TargetCellId', column_name: 'target_cell_id', data_type: 'STRING', ui_config: { serverOwned: true } }
]

const makeSurface = (): RuntimeSurfaceReady =>
    ({
        applicationId: '019f7f10-0000-7000-8000-000000000020',
        schemaName: 'app_019f7f10000070008000000000000001',
        workspaceId,
        layoutId: '019f7f10-0000-7000-8000-000000000021',
        widgetId: '019f7f10-0000-7000-8000-000000000022',
        widgetKey: 'interpretationNetworkWorkspace',
        widgetConfig: {},
        structureMode: 'multiple',
        featureState: 'ready',
        missing: [],
        resolvedObjects: {
            Structure: 'structure-object',
            Interpretation: 'interpretation-object',
            Material: 'material-object',
            TableTemplate: 'table-template-object'
        },
        contracts: {
            Structure: {
                object: { id: 'structure-object', codename: 'Structure', table_name: 'obj_structures' },
                fields: { Name: { id: 'structure-name', codename: 'Name', column_name: 'name', data_type: 'STRING' } },
                childFields: {}
            },
            Interpretation: {
                object: { id: 'interpretation-object', codename: 'Interpretation', table_name: 'obj_interpretations' },
                fields: {
                    Title: { id: 'title', codename: 'Title', column_name: 'title', data_type: 'STRING' },
                    ParentStructure: {
                        id: 'parent-structure',
                        codename: 'ParentStructure',
                        column_name: 'parent_structure',
                        data_type: 'REF'
                    }
                },
                table: { id: 'matrix', codename: 'InterpretationMatrix', column_name: 'interpretation_matrix', data_type: 'TABLE' },
                childTableName: 'interpretation_matrix',
                childFields: {
                    CellId: { id: 'cell-id', codename: 'CellId', column_name: 'cell_id', data_type: 'STRING' },
                    ParentCellId: { id: 'parent-cell-id', codename: 'ParentCellId', column_name: 'parent_cell_id', data_type: 'STRING' },
                    RowLabel: { id: 'row-label', codename: 'RowLabel', column_name: 'row_label', data_type: 'STRING' },
                    ColLabel: { id: 'col-label', codename: 'ColLabel', column_name: 'col_label', data_type: 'STRING' },
                    CellValue: { id: 'cell-value', codename: 'CellValue', column_name: 'cell_value', data_type: 'STRING' }
                }
            },
            Material: { object: { id: 'material', codename: 'Material', table_name: 'obj_materials' }, fields: {}, childFields: {} },
            TableTemplate: {
                object: { id: 'template', codename: 'TableTemplate', table_name: 'obj_table_templates' },
                fields: {},
                childFields: {}
            }
        }
    } as RuntimeSurfaceReady)

const makeContext = (
    executor: DbExecutor,
    userId = actorUserId,
    currentWorkspaceId: string | null = workspaceId,
    workspacesEnabled = true
): RuntimeSchemaContext =>
    ({
        schemaName: 'app_019f7f10000070008000000000000001',
        schemaIdent: '"app_019f7f10000070008000000000000001"',
        manager: executor,
        userId,
        role: 'member',
        permissions: {},
        workflowCapabilities: {},
        currentWorkspaceId,
        workspacesEnabled,
        baseApplicationSettings: {},
        applicationSettings: {}
    } as RuntimeSchemaContext)

const makeExecutor = (
    handler: (sql: string, parameters: unknown[]) => unknown[] = () => []
): { executor: DbExecutor; calls: Array<{ sql: string; parameters: unknown[] }> } => {
    const calls: Array<{ sql: string; parameters: unknown[] }> = []
    const executor = {
        query: jest.fn(async (sql: string, parameters: unknown[] = []) => {
            calls.push({ sql, parameters })
            return handler(sql, parameters)
        }),
        transaction: jest.fn(async (callback: (tx: DbExecutor) => Promise<unknown>) => callback(executor as DbExecutor)),
        isReleased: jest.fn(() => false)
    } as unknown as DbExecutor
    return { executor, calls }
}

const favoriteMetadataResponse = (sql: string): unknown[] | undefined => {
    if (sql.includes('FROM "app_019f7f10000070008000000000000001"._app_objects')) return [favoriteObject]
    if (sql.includes('FROM "app_019f7f10000070008000000000000001"._app_components')) return favoriteAttrs
    return undefined
}

const activeFavoriteTargetLockResponse = (sql: string): unknown[] | undefined => {
    if (sql.includes('FROM "app_019f7f10000070008000000000000001"."obj_interpretations" i') && sql.includes('AS "structureId"')) {
        return [{ structureId }]
    }
    if (sql.includes('FROM "app_019f7f10000070008000000000000001"."obj_structures" s')) return [{ id: structureId }]
    if (sql.includes('FROM "app_019f7f10000070008000000000000001"."obj_interpretations" i') && sql.includes('FOR SHARE')) {
        return [{ id: interpretationId }]
    }
    if (sql.includes('FROM "app_019f7f10000070008000000000000001"."interpretation_matrix" c')) return [{ id: cellId }]
    return undefined
}

describe('Interpretation Network personal Favorites service', () => {
    it('uses the application scope without referencing Workspace columns when Workspaces are disabled', async () => {
        const { executor, calls } = makeExecutor((sql) => {
            const metadata = favoriteMetadataResponse(sql)
            if (metadata) return metadata
            if (sql.includes('SELECT pg_advisory_xact_lock')) return []
            const targetLockResponse = activeFavoriteTargetLockResponse(sql)
            if (targetLockResponse) return targetLockResponse
            if (sql.includes('FROM "app_019f7f10000070008000000000000001"."obj_favorites" favorite')) return [{ exists: false }]
            if (sql.includes('INSERT INTO "app_019f7f10000070008000000000000001"."obj_favorites"')) return [{ inserted: true }]
            return []
        })

        await expect(
            addInterpretationNetworkFavorite(makeContext(executor, actorUserId, null, false), makeSurface(), target)
        ).resolves.toEqual({
            target,
            created: true
        })

        const targetCheck = calls.find(({ sql }) => sql.includes('FROM "app_019f7f10000070008000000000000001"."obj_interpretations" i'))
        expect(targetCheck?.sql).not.toContain('workspace_id')
        expect(targetCheck?.parameters).toEqual([interpretationId])

        const favoriteExists = calls.find(({ sql }) => sql.includes('FROM "app_019f7f10000070008000000000000001"."obj_favorites" favorite'))
        expect(favoriteExists?.sql).not.toContain('workspace_id')
        expect(favoriteExists?.parameters).toEqual([actorUserId, interpretationId, cellId])

        const insert = calls.find(({ sql }) => sql.includes('INSERT INTO "app_019f7f10000070008000000000000001"."obj_favorites"'))
        expect(insert?.sql).not.toContain('workspace_id')
        expect(insert?.parameters).toEqual([expect.any(String), actorUserId, interpretationId, cellId, actorUserId, actorUserId])
    })

    it('lists and builds Favorite cell paths without Workspace columns when Workspaces are disabled', async () => {
        const { executor, calls } = makeExecutor((sql) => {
            const metadata = favoriteMetadataResponse(sql)
            if (metadata) return metadata
            if (sql.includes('FROM "app_019f7f10000070008000000000000001"."obj_favorites" favorite')) {
                return [{ favoriteId, interpretationId, cellId, createdAt: '2026-10-22T12:00:00.000Z' }]
            }
            if (sql.includes('FROM "app_019f7f10000070008000000000000001"."obj_interpretations" i')) {
                return [{ interpretationId, structureId, interpretationTitle: 'Meaning', structureName: 'Roots' }]
            }
            if (sql.includes('WITH RECURSIVE favorite_targets')) {
                return [
                    {
                        interpretationId,
                        rowId: rootCellRowId,
                        cellId,
                        parentCellId: null,
                        rowLabel: 'Root row',
                        columnLabel: 'Root column',
                        cellValue: 'Root value'
                    }
                ]
            }
            return []
        })

        const result = await listInterpretationNetworkFavorites(makeContext(executor, actorUserId, null, false), makeSurface(), {
            locale: 'en',
            limit: 20,
            offset: 0
        })

        expect(result.items[0]).toMatchObject({
            favoriteId,
            target: { interpretationId, cellId },
            availability: 'available',
            cellPath: [{ label: 'Root column / Root row' }]
        })
        const runtimeQueries = calls.filter(({ sql }) => !sql.includes('._app_objects') && !sql.includes('._app_components'))
        expect(runtimeQueries.length).toBeGreaterThan(0)
        expect(runtimeQueries.every(({ sql }) => !sql.includes('workspace_id'))).toBe(true)
        expect(calls.find(({ sql }) => sql.includes('WITH RECURSIVE favorite_targets'))?.parameters).toEqual([
            JSON.stringify([{ interpretation_id: interpretationId, cell_id: cellId }]),
            128
        ])
        const ancestorQuery = calls.find(({ sql }) => sql.includes('WITH RECURSIVE favorite_targets'))
        expect(ancestorQuery?.sql).toContain('ancestor.depth < $2')
    })

    it('keeps Favorite path resolution at a fixed SQL query count as the page grows', async () => {
        const makePage = async (targetCount: number) => {
            const uuidFor = (suffix: number) => `019f7f10-0000-7000-8000-${String(suffix).padStart(12, '0')}`
            const favorites = Array.from({ length: targetCount }, (_, index) => ({
                favoriteId: uuidFor(3000 + index),
                interpretationId,
                cellId: uuidFor(1000 + index),
                createdAt: '2026-10-22T12:00:00.000Z'
            }))
            const ancestorRows = favorites.flatMap(({ cellId }, index) => [
                {
                    interpretationId,
                    rowId: rootCellRowId,
                    cellId: rootCellId,
                    parentCellId: null,
                    rowLabel: 'Root row',
                    columnLabel: 'Root column',
                    cellValue: 'Root value'
                },
                {
                    interpretationId,
                    rowId: uuidFor(2000 + index),
                    cellId,
                    parentCellId: rootCellId,
                    rowLabel: `Favorite row ${index}`,
                    columnLabel: `Favorite column ${index}`,
                    cellValue: `Favorite value ${index}`
                }
            ])
            const { executor, calls } = makeExecutor((sql) => {
                const metadata = favoriteMetadataResponse(sql)
                if (metadata) return metadata
                if (sql.includes('FROM "app_019f7f10000070008000000000000001"."obj_favorites" favorite')) return favorites
                if (sql.includes('FROM "app_019f7f10000070008000000000000001"."obj_interpretations" i')) {
                    return [{ interpretationId, structureId, interpretationTitle: 'Meaning', structureName: 'Roots' }]
                }
                if (sql.includes('WITH RECURSIVE favorite_targets')) return ancestorRows
                return []
            })

            const result = await listInterpretationNetworkFavorites(makeContext(executor), makeSurface(), {
                locale: 'en',
                limit: targetCount,
                offset: 0
            })
            return { items: result.items, queryCount: calls.length }
        }

        const singleFavoritePage = await makePage(1)
        const populatedFavoritePage = await makePage(25)

        expect(singleFavoritePage.items).toHaveLength(1)
        expect(populatedFavoritePage.items).toHaveLength(25)
        expect(populatedFavoritePage.items.every((item) => item.availability === 'available')).toBe(true)
        expect([singleFavoritePage.queryCount, populatedFavoritePage.queryCount]).toEqual([5, 5])
    })

    it('rejects invalid Favorite Matrix path depth before querying', async () => {
        const { executor } = makeExecutor()

        await expect(listMatrixCellAncestorRows(executor, null, false, makeSurface(), [], -1)).rejects.toThrow(RangeError)
        expect(executor.query).not.toHaveBeenCalled()
    })

    it('removes Favorites without Workspace predicates when Workspaces are disabled', async () => {
        const { executor, calls } = makeExecutor((sql) => {
            const metadata = favoriteMetadataResponse(sql)
            if (metadata) return metadata
            if (sql.includes('SELECT pg_advisory_xact_lock')) return []
            if (sql.includes('UPDATE "app_019f7f10000070008000000000000001"."obj_favorites"')) return [{ removed: true }]
            return []
        })
        const context = makeContext(executor, actorUserId, null, false)

        await expect(removeInterpretationNetworkFavorite(context, favoriteId)).resolves.toEqual({ favoriteId, removed: true })
        await expect(
            removeInterpretationNetworkFavoritesForCells(context, executor, makeSurface(), { interpretationId, cellIds: [cellId] })
        ).resolves.toBeUndefined()

        const updates = calls.filter(({ sql }) => sql.includes('UPDATE "app_019f7f10000070008000000000000001"."obj_favorites"'))
        expect(updates).toHaveLength(2)
        expect(updates.every(({ sql }) => !sql.includes('workspace_id'))).toBe(true)
        expect(
            updates.every(
                ({ sql }) =>
                    sql.includes('"_app_deleted_at" = NOW()') &&
                    (sql.includes('"_app_deleted_by" = $2') || sql.includes('"_app_deleted_by" = $3'))
            )
        ).toBe(true)
        expect(updates[0]?.parameters).toEqual([favoriteId, actorUserId])
        expect(updates[1]?.parameters).toEqual([interpretationId, [cellId], actorUserId])
    })

    it('validates the locked target before acquiring the owner-target advisory lock', async () => {
        const { executor, calls } = makeExecutor((sql) => {
            const metadata = favoriteMetadataResponse(sql)
            if (metadata) return metadata
            if (sql.includes('SELECT pg_advisory_xact_lock')) return []
            const targetLockResponse = activeFavoriteTargetLockResponse(sql)
            if (targetLockResponse) return targetLockResponse
            if (sql.includes('SELECT EXISTS') && sql.includes('FROM "app_019f7f10000070008000000000000001"."obj_favorites" favorite'))
                return [{ exists: false }]
            if (sql.includes('INSERT INTO "app_019f7f10000070008000000000000001"."obj_favorites"')) return [{ inserted: true }]
            return []
        })

        await expect(addInterpretationNetworkFavorite(makeContext(executor), makeSurface(), target)).resolves.toEqual({
            target,
            created: true
        })

        const lockCalls = calls.filter(({ sql }) => sql.includes('pg_advisory_xact_lock'))
        expect(lockCalls).toHaveLength(1)
        expect(lockCalls[0]?.parameters[0]).toContain(actorUserId)
        expect(lockCalls[0]?.parameters[0]).toContain(interpretationId)
        expect(lockCalls[0]?.parameters[0]).toContain(cellId)

        const targetReadIndex = calls.findIndex(({ sql }) => sql.includes('AS "structureId"'))
        const structureLockIndex = calls.findIndex(({ sql }) => sql.includes('obj_structures" s') && sql.includes('FOR SHARE'))
        const interpretationLockIndex = calls.findIndex(({ sql }) => sql.includes('obj_interpretations" i') && sql.includes('FOR SHARE'))
        const cellLockIndex = calls.findIndex(({ sql }) => sql.includes('interpretation_matrix" c') && sql.includes('FOR SHARE'))
        const favoriteLockIndex = calls.findIndex(({ sql }) => sql.includes('pg_advisory_xact_lock'))
        expect([targetReadIndex, structureLockIndex, interpretationLockIndex, cellLockIndex]).toEqual([
            expect.any(Number),
            expect.any(Number),
            expect.any(Number),
            expect.any(Number)
        ])
        expect(targetReadIndex).toBeLessThan(structureLockIndex)
        expect(structureLockIndex).toBeLessThan(interpretationLockIndex)
        expect(interpretationLockIndex).toBeLessThan(cellLockIndex)
        expect(cellLockIndex).toBeLessThan(favoriteLockIndex)
        expect(calls[structureLockIndex]?.sql).toContain('s."workspace_id" = $')
        expect(calls[interpretationLockIndex]?.sql).toContain('i."workspace_id" = $')
        expect(calls[cellLockIndex]?.sql).toContain('c."workspace_id" = $')
        expect(calls[targetReadIndex]?.parameters).toEqual([interpretationId, workspaceId])
        expect(calls[structureLockIndex]?.parameters).toEqual([structureId, workspaceId])
        expect(calls[interpretationLockIndex]?.parameters).toEqual([interpretationId, structureId, workspaceId])
        expect(calls[cellLockIndex]?.parameters).toEqual([interpretationId, cellId, workspaceId])

        const favoriteExists = calls.find(({ sql }) => sql.includes('FROM "app_019f7f10000070008000000000000001"."obj_favorites" favorite'))
        expect(favoriteExists?.sql).toContain('favorite."owner_user_id" = $1')
        expect(favoriteExists?.sql).toContain('favorite."workspace_id" = $')

        const insert = calls.find(({ sql }) => sql.startsWith('\n            INSERT INTO'))
        expect(insert).toBeDefined()
        expect(uuidV7Schema.safeParse(insert?.parameters[0]).success).toBe(true)
        expect(insert?.parameters).toEqual([
            expect.any(String),
            workspaceId,
            actorUserId,
            interpretationId,
            cellId,
            actorUserId,
            actorUserId
        ])
        expect(insert?.sql).not.toContain('RETURNING id')
    })

    it('returns an existing Favorite without inserting another row', async () => {
        const { executor, calls } = makeExecutor((sql) => {
            const metadata = favoriteMetadataResponse(sql)
            if (metadata) return metadata
            if (sql.includes('SELECT pg_advisory_xact_lock')) return []
            const targetLockResponse = activeFavoriteTargetLockResponse(sql)
            if (targetLockResponse) return targetLockResponse
            if (sql.includes('FROM "app_019f7f10000070008000000000000001"."obj_favorites" favorite')) return [{ exists: true }]
            return []
        })

        await expect(addInterpretationNetworkFavorite(makeContext(executor), makeSurface(), target)).resolves.toEqual({
            target,
            created: false
        })
        expect(calls.some(({ sql }) => sql.startsWith('\n            INSERT INTO'))).toBe(false)
    })

    it('rejects an inactive or cross-Workspace target before creating a Favorite', async () => {
        const { executor, calls } = makeExecutor((sql) => {
            const metadata = favoriteMetadataResponse(sql)
            if (metadata) return metadata
            if (sql.includes('SELECT pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_019f7f10000070008000000000000001"."obj_interpretations" i') && sql.includes('AS "structureId"')) {
                return [{ structureId }]
            }
            if (sql.includes('FROM "app_019f7f10000070008000000000000001"."obj_structures" s')) return []
            return []
        })

        await expect(addInterpretationNetworkFavorite(makeContext(executor), makeSurface(), target)).rejects.toMatchObject({
            statusCode: 404,
            code: 'INTERPRETATION_NETWORK_FAVORITE_TARGET_UNAVAILABLE'
        })
        expect(calls.some(({ sql }) => sql.startsWith('\n            INSERT INTO'))).toBe(false)
        expect(calls.some(({ sql }) => sql.includes('FROM "app_019f7f10000070008000000000000001"."obj_favorites" favorite'))).toBe(false)
    })

    it('deduplicates shared ancestors across Favorites and keeps deleted targets unavailable without exposing physical row IDs', async () => {
        const { executor, calls } = makeExecutor((sql) => {
            const metadata = favoriteMetadataResponse(sql)
            if (metadata) return metadata
            if (sql.includes('FROM "app_019f7f10000070008000000000000001"."obj_favorites" favorite')) {
                return [
                    { favoriteId, interpretationId, cellId, createdAt: '2026-10-22T12:00:00.000Z' },
                    { favoriteId: secondFavoriteId, interpretationId, cellId: secondCellId, createdAt: '2026-10-22T11:00:00.000Z' },
                    {
                        favoriteId: staleFavoriteId,
                        interpretationId: staleInterpretationId,
                        cellId: staleCellId,
                        createdAt: '2026-10-21T12:00:00.000Z'
                    }
                ]
            }
            if (sql.includes('FROM "app_019f7f10000070008000000000000001"."obj_interpretations" i')) {
                return [
                    {
                        interpretationId,
                        structureId,
                        interpretationTitle: localized('Meaning', 'Смысл'),
                        structureName: localized('Roots', 'Корни')
                    }
                ]
            }
            if (sql.includes('WITH RECURSIVE favorite_targets')) {
                return [
                    {
                        interpretationId,
                        rowId: rootCellRowId,
                        cellId: rootCellId,
                        parentCellId: null,
                        rowLabel: localized('Root row', 'Корневая строка'),
                        columnLabel: localized('Root column', 'Корневой столбец'),
                        cellValue: localized('Root value', 'Корневое значение')
                    },
                    {
                        interpretationId,
                        rowId: firstCellRowId,
                        cellId,
                        parentCellId: rootCellId,
                        rowLabel: localized('Same child label', 'Одинаковая дочерняя строка'),
                        columnLabel: localized('Same child label', 'Одинаковая дочерняя строка'),
                        cellValue: localized('Child value', 'Дочернее значение')
                    },
                    {
                        interpretationId,
                        rowId: rootCellRowId,
                        cellId: rootCellId,
                        parentCellId: null,
                        rowLabel: localized('Root row', 'Корневая строка'),
                        columnLabel: localized('Root column', 'Корневой столбец'),
                        cellValue: localized('Root value', 'Корневое значение')
                    },
                    {
                        interpretationId,
                        rowId: secondCellRowId,
                        cellId: secondCellId,
                        parentCellId: rootCellId,
                        rowLabel: localized('Second child', 'Вторая дочерняя строка'),
                        columnLabel: localized('Second child column', 'Вторая дочерняя колонка'),
                        cellValue: localized('Second child value', 'Значение второй ячейки')
                    }
                ]
            }
            return []
        })

        const result = await listInterpretationNetworkFavorites(makeContext(executor), makeSurface(), {
            locale: 'ru',
            limit: 20,
            offset: 0
        })

        expect(result).toMatchObject({
            hasMore: false,
            items: [
                {
                    favoriteId,
                    target: { interpretationId, cellId },
                    structureId,
                    availability: 'available',
                    structureName: 'Корни',
                    interpretationTitle: 'Смысл',
                    cellPath: [
                        { label: 'Корневой столбец / Корневая строка', cellValue: 'Корневое значение' },
                        { label: 'Одинаковая дочерняя строка', cellValue: 'Дочернее значение' }
                    ],
                    addedAt: '2026-10-22T12:00:00.000Z'
                },
                {
                    favoriteId: secondFavoriteId,
                    target: { interpretationId, cellId: secondCellId },
                    structureId,
                    availability: 'available',
                    structureName: 'Корни',
                    interpretationTitle: 'Смысл',
                    cellPath: [
                        { label: 'Корневой столбец / Корневая строка', cellValue: 'Корневое значение' },
                        { label: 'Вторая дочерняя колонка / Вторая дочерняя строка', cellValue: 'Значение второй ячейки' }
                    ],
                    addedAt: '2026-10-22T11:00:00.000Z'
                },
                {
                    favoriteId: staleFavoriteId,
                    target: null,
                    structureId: null,
                    availability: 'unavailable',
                    structureName: null,
                    interpretationTitle: null,
                    cellPath: []
                }
            ]
        })
        expect(JSON.stringify(result)).not.toContain('matrixRowId')
        expect(JSON.stringify(result)).not.toContain('"id"')

        const favoriteList = calls.find(({ sql }) => sql.includes('FROM "app_019f7f10000070008000000000000001"."obj_favorites" favorite'))
        expect(favoriteList?.sql).toContain('favorite."owner_user_id" = $1')
        expect(favoriteList?.sql).toContain('favorite."workspace_id" = $2')
        expect(favoriteList?.parameters[0]).toBe(actorUserId)
        expect(favoriteList?.parameters[1]).toBe(workspaceId)
        const cellPathQuery = calls.find(({ sql }) => sql.includes('WITH RECURSIVE favorite_targets'))
        expect(cellPathQuery?.sql).toContain('c."workspace_id" = $2')
        expect(cellPathQuery?.sql).toContain('p."workspace_id" = $2')
        expect(cellPathQuery?.sql).toContain('c.id::text AS row_id')
        expect(JSON.stringify(result)).not.toContain('rowId')
    })

    it('removes a stale Favorite idempotently by its owner-scoped identity and current Workspace only', async () => {
        const { executor, calls } = makeExecutor((sql) => {
            const metadata = favoriteMetadataResponse(sql)
            if (metadata) return metadata
            if (sql.includes('SELECT pg_advisory_xact_lock')) return []
            if (sql.includes('UPDATE "app_019f7f10000070008000000000000001"."obj_favorites"')) return []
            return []
        })

        await expect(removeInterpretationNetworkFavorite(makeContext(executor), staleFavoriteId)).resolves.toEqual({
            favoriteId: staleFavoriteId,
            removed: false
        })
        const removeQuery = calls.find(({ sql }) => sql.includes('UPDATE "app_019f7f10000070008000000000000001"."obj_favorites"'))
        expect(removeQuery?.sql).toContain('favorite."id" = $1::uuid')
        expect(removeQuery?.sql).toContain('favorite."owner_user_id" = $2')
        expect(removeQuery?.sql).toContain('favorite."workspace_id" = $3')
        expect(removeQuery?.parameters).toEqual([staleFavoriteId, actorUserId, workspaceId])
        expect(calls.some(({ sql }) => sql.includes('FROM "app_019f7f10000070008000000000000001"."obj_interpretations" i'))).toBe(false)

        const otherUser = '019f7f10-0000-7000-8000-000000000099'
        await removeInterpretationNetworkFavorite(makeContext(executor, otherUser), staleFavoriteId)
        const otherUserRemove = calls
            .filter(({ sql }) => sql.includes('UPDATE "app_019f7f10000070008000000000000001"."obj_favorites"'))
            .at(-1)
        expect(otherUserRemove?.parameters[1]).toBe(otherUser)

        const otherWorkspace = '019f7f10-0000-7000-8000-000000000098'
        await removeInterpretationNetworkFavorite(makeContext(executor, actorUserId, otherWorkspace), staleFavoriteId)
        const otherWorkspaceRemove = calls
            .filter(({ sql }) => sql.includes('UPDATE "app_019f7f10000070008000000000000001"."obj_favorites"'))
            .at(-1)
        expect(otherWorkspaceRemove?.parameters[2]).toBe(otherWorkspace)
    })

    it('cleans all Favorites for a deleted semantic CellId inside the caller transaction and current Workspace', async () => {
        const { executor, calls } = makeExecutor((sql) => {
            const metadata = favoriteMetadataResponse(sql)
            if (metadata) return metadata
            if (sql.includes('SELECT pg_advisory_xact_lock')) return []
            if (sql.includes('UPDATE "app_019f7f10000070008000000000000001"."obj_favorites"')) {
                return [{ removed: true }, { removed: true }]
            }
            return []
        })

        await expect(
            removeInterpretationNetworkFavoritesForTarget(makeContext(executor), executor, makeSurface(), target)
        ).resolves.toBeUndefined()

        const membershipLock = calls.find(({ sql }) => sql.includes('pg_advisory_xact_lock'))
        expect(membershipLock?.parameters[0]).toContain(
            `interpretation-network:matrix:${makeSurface().schemaName}:${workspaceId}:${interpretationId}`
        )
        const cleanup = calls.find(({ sql }) => sql.includes('UPDATE "app_019f7f10000070008000000000000001"."obj_favorites"'))
        expect(cleanup?.sql).toContain('favorite."target_interpretation_id" = $1')
        expect(cleanup?.sql).toContain('favorite."target_cell_id" = ANY($2::text[])')
        expect(cleanup?.sql).toContain('favorite."workspace_id" = $4')
        expect(cleanup?.sql).not.toContain('favorite."owner_user_id"')
        expect(cleanup?.parameters).toEqual([interpretationId, [cellId], actorUserId, workspaceId])
        expect(executor.transaction).not.toHaveBeenCalled()
    })

    it('cleans many deleted Matrix cells with one owner-independent Workspace-scoped update', async () => {
        const secondCellId = '019f7f10-0000-7000-8000-000000000024'
        const { executor, calls } = makeExecutor((sql) => {
            const metadata = favoriteMetadataResponse(sql)
            if (metadata) return metadata
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('UPDATE "app_019f7f10000070008000000000000001"."obj_favorites"')) return [{ removed: true }]
            return []
        })

        await expect(
            removeInterpretationNetworkFavoritesForCells(makeContext(executor), executor, makeSurface(), {
                interpretationId,
                cellIds: [cellId, secondCellId, cellId]
            })
        ).resolves.toBeUndefined()

        const cleanupCalls = calls.filter(({ sql }) => sql.includes('UPDATE "app_019f7f10000070008000000000000001"."obj_favorites"'))
        expect(cleanupCalls).toHaveLength(1)
        expect(cleanupCalls[0]?.parameters).toEqual([interpretationId, [cellId, secondCellId], actorUserId, workspaceId])
        expect(cleanupCalls[0]?.sql).not.toContain('owner_user_id')
    })

    it('fails closed when Favorite owner-only or server-owned metadata is not valid', async () => {
        const malformedFavorite = {
            ...favoriteObject,
            config: { ...favoriteObject.config, runtimeRecordAccess: { mode: 'ownerOrShared' } }
        }
        const { executor } = makeExecutor((sql) => {
            if (sql.includes('FROM "app_019f7f10000070008000000000000001"._app_objects')) return [malformedFavorite]
            if (sql.includes('FROM "app_019f7f10000070008000000000000001"._app_components')) return favoriteAttrs
            return []
        })

        await expect(removeInterpretationNetworkFavorite(makeContext(executor), favoriteId)).rejects.toBeInstanceOf(
            InterpretationNetworkFavoriteError
        )
    })
})
