import { Buffer } from 'node:buffer'
import { createMockDbExecutor } from '../utils/dbMocks'
import { RuntimeModulesService } from '../../services/runtimeModulesService'
import {
    createMaterialForCell,
    deleteMaterialForCell,
    setPrimaryMaterialForCell,
    updateMaterialForCell,
    interpretationNetworkMaterialCreateRequestSchema,
    interpretationNetworkMaterialDeleteRequestSchema,
    interpretationNetworkMaterialPrimaryRequestSchema,
    interpretationNetworkMaterialUpdateRequestSchema
} from '../../services/interpretationNetwork/runtimeInterpretationNetworkService'
import { makeCtx, makeSurface, userId, workspaceId } from '../utils/interpretationNetworkRuntimeFixtures'
import { MAX_MATERIAL_BODY_BYTES } from '../../services/interpretationNetwork/runtimeInterpretationNetworkSchemas'

describe('runtime Interpretation Network Material commands', () => {
    let lifecycleSpy: jest.SpyInstance

    beforeEach(() => {
        lifecycleSpy = jest.spyOn(RuntimeModulesService.prototype, 'dispatchLifecycleEvent').mockResolvedValue([])
    })

    afterEach(() => {
        lifecycleSpy.mockRestore()
    })

    it('creates an attached non-primary material with a server-owned CellId transactionally', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        let materialInsertParams: unknown[] | undefined
        let matrixUpdateParams: unknown[] | undefined

        txExecutor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000701', _upl_locked: false }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000702', _upl_version: 7, cell_id: 'cell-selected', material_ref: null }]
            }
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."material"')) {
                materialInsertParams = params
                return [{ id: '019f2000-0000-7000-8000-000000000703' }]
            }
            if (sql.includes('UPDATE "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                matrixUpdateParams = params
                return [{ id: '019f2000-0000-7000-8000-000000000702' }]
            }
            return []
        })

        const result = await createMaterialForCell(makeCtx(executor), makeSurface('multiple'), {
            interpretationId: '019f2000-0000-7000-8000-000000000701',
            cellId: 'cell-selected',
            data: {
                title: 'Material title',
                description: 'Material description'
            },
            expectedCellVersion: 7
        })

        expect(result.id).toBe('019f2000-0000-7000-8000-000000000703')
        expect(result.matrixRowId).toBe('019f2000-0000-7000-8000-000000000702')
        expect(materialInsertParams).toContain('cell-selected')
        expect(materialInsertParams).not.toContain('019f2000-0000-7000-8000-000000000702')
        expect(matrixUpdateParams).toBeUndefined()
        expect(lifecycleSpy.mock.calls.map(([call]) => call.payload.eventName)).toEqual(['beforeCreate', 'afterCreate'])
        expect(lifecycleSpy.mock.calls.every(([call]) => call.attachmentId === 'Material-object')).toBe(true)
        expect(lifecycleSpy.mock.calls[1]?.[0].payload.metadata).toMatchObject({
            aggregateCommand: 'createMaterialForCell',
            cellId: 'cell-selected'
        })
    })

    it('preserves the v1 Matrix-row Primary write and response for legacy requests', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const interpretationId = '019f2000-0000-7000-8000-000000000704'
        const matrixRowId = '019f2000-0000-7000-8000-000000000705'
        const materialId = '019f2000-0000-7000-8000-000000000706'
        let matrixUpdateSql = ''
        let matrixUpdateParams: unknown[] | undefined

        txExecutor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                return [{ id: interpretationId, _upl_locked: false }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                return [{ id: matrixRowId, _upl_version: 7, cell_id: 'legacy-cell', material_ref: null }]
            }
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."material"')) {
                return [{ id: materialId }]
            }
            if (sql.includes('UPDATE "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                matrixUpdateSql = sql
                matrixUpdateParams = params
                return [{ id: matrixRowId, _upl_version: 8 }]
            }
            return []
        })

        const result = await createMaterialForCell(makeCtx(executor), makeSurface('multiple'), {
            interpretationId,
            matrixRowId: matrixRowId.toUpperCase(),
            cellId: 'legacy-cell',
            expectedCellVersion: 7,
            data: { Title: 'Legacy-compatible Primary material' }
        })

        expect(result).toEqual({ id: materialId, matrixRowId })
        expect(matrixUpdateSql).toContain('SET "material_ref" = $1')
        expect(matrixUpdateParams).toEqual(
            expect.arrayContaining([materialId, userId, matrixRowId, interpretationId, 'legacy-cell', workspaceId, 7])
        )
        expect(lifecycleSpy.mock.calls.map(([call]) => [call.attachmentId, call.payload.eventName])).toEqual([
            ['Material-object', 'beforeCreate'],
            ['Interpretation-object', 'beforeUpdate'],
            ['Material-object', 'afterCreate'],
            ['Interpretation-object', 'afterUpdate']
        ])
    })

    it('keeps the v1 single-Material conflict when a legacy request targets a cell with Primary Material', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000707', _upl_locked: false }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                return [
                    {
                        id: '019f2000-0000-7000-8000-000000000708',
                        _upl_version: 3,
                        cell_id: 'legacy-cell',
                        material_ref: '019f2000-0000-7000-8000-000000000709'
                    }
                ]
            }
            return []
        })

        await expect(
            createMaterialForCell(makeCtx(executor), makeSurface('multiple'), {
                interpretationId: '019f2000-0000-7000-8000-000000000707',
                matrixRowId: '019f2000-0000-7000-8000-000000000708',
                cellId: 'legacy-cell',
                data: { Title: 'Second legacy material' }
            })
        ).rejects.toMatchObject({ statusCode: 409, code: 'INTERPRETATION_NETWORK_INVALID_MATRIX' })
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
        expect(lifecycleSpy).not.toHaveBeenCalled()
    })

    it('rejects a legacy matrix row id that no longer identifies the selected cell', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000711', _upl_locked: false }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000712', _upl_version: 1, cell_id: 'cell-selected', material_ref: null }]
            }
            return []
        })

        await expect(
            createMaterialForCell(makeCtx(executor), makeSurface('multiple'), {
                interpretationId: '019f2000-0000-7000-8000-000000000711',
                matrixRowId: '019f2000-0000-7000-8000-000000000713',
                cellId: 'cell-selected',
                data: { Title: 'Material' }
            })
        ).rejects.toMatchObject({
            statusCode: 409,
            code: 'INTERPRETATION_NETWORK_INVALID_MATRIX'
        })
        expect(txExecutor.query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false)
        expect(lifecycleSpy).not.toHaveBeenCalled()
    })

    it('rejects an oversized UTF-8 Material Body on create before opening a transaction', async () => {
        const { executor } = createMockDbExecutor()
        const oversizedBody = {
            format: 'editorjs',
            data: { blocks: [{ type: 'paragraph', data: { text: '🧪'.repeat(Math.floor(MAX_MATERIAL_BODY_BYTES / 4) + 1) } }] }
        }
        const actualBytes = Buffer.byteLength(JSON.stringify(oversizedBody), 'utf8')
        expect(actualBytes).toBeGreaterThan(MAX_MATERIAL_BODY_BYTES)
        const input = {
            interpretationId: '019f2000-0000-7000-8000-000000000701',
            cellId: 'cell-selected',
            data: { Body: oversizedBody }
        }

        expect(interpretationNetworkMaterialCreateRequestSchema.safeParse(input).success).toBe(false)
        await expect(createMaterialForCell(makeCtx(executor), makeSurface('multiple'), input)).rejects.toMatchObject({
            statusCode: 413,
            code: 'INTERPRETATION_NETWORK_INVALID_MATERIAL',
            details: { maxBytes: MAX_MATERIAL_BODY_BYTES, actualBytes }
        })
        expect(executor.transaction).not.toHaveBeenCalled()
        expect(lifecycleSpy).not.toHaveBeenCalled()
    })

    it('fails closed when aggregate material creation receives a server-owned field by codename', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const surface = makeSurface('multiple')
        ;(surface.contracts.Material.fields.CellId as unknown as { ui_config: Record<string, unknown> }).ui_config = { serverOwned: true }

        await expect(
            createMaterialForCell(makeCtx(executor), surface, {
                interpretationId: '019f2000-0000-7000-8000-000000000711',
                cellId: 'cell-selected',
                data: { CellId: 'client-forged-cell' }
            })
        ).rejects.toMatchObject({ code: 'INTERPRETATION_NETWORK_INVALID_MATERIAL' })
        expect(txExecutor.query).not.toHaveBeenCalled()
    })

    it('fails closed without creating material when the matrix cell version changed', async () => {
        const { executor, txExecutor } = createMockDbExecutor()

        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000721', _upl_locked: false }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000722', _upl_version: 8, cell_id: 'cell-selected', material_ref: null }]
            }
            return []
        })

        await expect(
            createMaterialForCell(makeCtx(executor), makeSurface('multiple'), {
                interpretationId: '019f2000-0000-7000-8000-000000000721',
                cellId: 'cell-selected',
                data: { title: 'Material title' },
                expectedCellVersion: 7
            })
        ).rejects.toMatchObject({ code: 'INTERPRETATION_NETWORK_VERSION_CONFLICT' })
        expect(
            txExecutor.query.mock.calls.some(([sql]) =>
                String(sql).includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."material"')
            )
        ).toBe(false)
    })

    it('sets Primary Material only when the target belongs to the requested cell', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const interpretationId = '019f2000-0000-7000-8000-000000000731'
        const matrixRowId = '019f2000-0000-7000-8000-000000000732'
        const materialId = '019f2000-0000-7000-8000-000000000733'
        let matrixUpdateSql = ''
        let matrixUpdateParams: unknown[] | undefined
        txExecutor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                return [{ id: interpretationId, _upl_locked: false }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                return [{ id: matrixRowId, _upl_version: 5, cell_id: 'cell-1', material_ref: null }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."material"')) {
                return [{ id: materialId, _upl_version: 1, cell_id: 'cell-1', interpretation_id: interpretationId }]
            }
            if (sql.includes('UPDATE "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                matrixUpdateSql = sql
                matrixUpdateParams = params
                return [{ id: matrixRowId, _upl_version: 6 }]
            }
            return []
        })

        const result = await setPrimaryMaterialForCell(makeCtx(executor), makeSurface('multiple'), {
            interpretationId,
            cellId: 'cell-1',
            materialId,
            expectedCellVersion: 5
        })

        expect(result).toEqual({ primaryMaterialId: materialId, cellVersion: 6 })
        expect(matrixUpdateSql).toContain('SET "material_ref" = $1')
        expect(matrixUpdateParams).toEqual(
            expect.arrayContaining([materialId, userId, matrixRowId, interpretationId, 'cell-1', workspaceId, 5])
        )
    })

    it('edits only authored Material fields in the dedicated aggregate', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const interpretationId = '019f2000-0000-7000-8000-000000000741'
        const matrixRowId = '019f2000-0000-7000-8000-000000000742'
        const materialId = '019f2000-0000-7000-8000-000000000743'
        let updateSql = ''
        let updateParams: unknown[] | undefined
        txExecutor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                return [{ id: interpretationId, _upl_locked: false }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                return [{ id: matrixRowId, _upl_version: 5, cell_id: 'cell-1', material_ref: materialId }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."material"')) {
                return [
                    {
                        id: materialId,
                        _upl_version: 2,
                        title: 'Old title',
                        description: 'Description',
                        body: { blocks: [] },
                        cell_id: 'cell-1',
                        interpretation_id: interpretationId
                    }
                ]
            }
            if (sql.includes('UPDATE "app_018f8a787b8f7c1da111222233334440"."material"')) {
                updateSql = sql
                updateParams = params
                return [{ id: materialId, _upl_version: 3, title: 'New title' }]
            }
            return []
        })

        const result = await updateMaterialForCell(makeCtx(executor), makeSurface('multiple'), materialId, {
            interpretationId,
            cellId: 'cell-1',
            data: { Title: 'New title' },
            expectedCellVersion: 5,
            expectedMaterialVersion: 2
        })

        expect(result).toEqual({ id: materialId, version: 3 })
        expect(updateSql).toContain('SET "title" = $1')
        expect(updateSql).not.toContain('"cell_id" =')
        expect(updateParams).toEqual(expect.arrayContaining(['New title', userId, materialId, 2, workspaceId]))
    })

    it('rejects an oversized UTF-8 Material Body on update before opening a transaction', async () => {
        const { executor } = createMockDbExecutor()
        const oversizedBody = {
            format: 'editorjs',
            data: { blocks: [{ type: 'paragraph', data: { text: '🧪'.repeat(Math.floor(MAX_MATERIAL_BODY_BYTES / 4) + 1) } }] }
        }
        const actualBytes = Buffer.byteLength(JSON.stringify(oversizedBody), 'utf8')
        expect(actualBytes).toBeGreaterThan(MAX_MATERIAL_BODY_BYTES)
        const input = {
            interpretationId: '019f2000-0000-7000-8000-000000000741',
            cellId: 'cell-1',
            data: { body: oversizedBody },
            expectedCellVersion: 5,
            expectedMaterialVersion: 2
        }

        expect(interpretationNetworkMaterialUpdateRequestSchema.safeParse(input).success).toBe(false)
        await expect(
            updateMaterialForCell(makeCtx(executor), makeSurface('multiple'), '019f2000-0000-7000-8000-000000000743', input)
        ).rejects.toMatchObject({
            statusCode: 413,
            code: 'INTERPRETATION_NETWORK_INVALID_MATERIAL',
            details: { maxBytes: MAX_MATERIAL_BODY_BYTES, actualBytes }
        })
        expect(executor.transaction).not.toHaveBeenCalled()
        expect(lifecycleSpy).not.toHaveBeenCalled()
    })

    it('clears a deleted Primary Material in the same transaction as soft deletion', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const interpretationId = '019f2000-0000-7000-8000-000000000751'
        const matrixRowId = '019f2000-0000-7000-8000-000000000752'
        const materialId = '019f2000-0000-7000-8000-00000000075a'
        const writeQueries: string[] = []
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                return [{ id: interpretationId, _upl_locked: false }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                return [{ id: matrixRowId, _upl_version: 5, cell_id: 'cell-1', material_ref: materialId }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."material"')) {
                return [{ id: materialId, _upl_version: 2, title: 'Primary', cell_id: 'cell-1', interpretation_id: interpretationId }]
            }
            if (sql.includes('UPDATE "app_018f8a787b8f7c1da111222233334440".')) {
                writeQueries.push(sql)
                if (sql.includes('"interpretation_rows"')) return [{ id: matrixRowId, _upl_version: 6 }]
                if (sql.includes('"material"')) return [{ id: materialId }]
            }
            return []
        })

        const result = await deleteMaterialForCell(makeCtx(executor), makeSurface('multiple'), materialId.toUpperCase(), {
            interpretationId,
            cellId: 'cell-1',
            expectedCellVersion: 5,
            expectedMaterialVersion: 2
        })

        expect(result).toEqual({ primaryMaterialCleared: true, cellVersion: 6 })
        expect(writeQueries).toHaveLength(2)
        expect(writeQueries[0]).toContain('SET "material_ref" = $1')
        expect(writeQueries[1]).toContain('SET _upl_deleted = true')
    })

    it('rejects browser-supplied physical metadata identifiers in material commands', () => {
        const result = interpretationNetworkMaterialCreateRequestSchema.safeParse({
            interpretationId: '019f2000-0000-7000-8000-000000000701',
            cellId: 'cell-selected',
            data: { title: 'Material' },
            expectedCellVersion: 7,
            materialObjectCollectionId: '019f2000-0000-7000-8000-000000000703'
        })
        expect(result.success).toBe(false)
        expect(
            interpretationNetworkMaterialUpdateRequestSchema.safeParse({
                interpretationId: '019f2000-0000-7000-8000-000000000701',
                cellId: 'cell-selected',
                data: { CellId: 'forged' },
                expectedCellVersion: 1,
                expectedMaterialVersion: 1
            }).success
        ).toBe(true)
        expect(
            interpretationNetworkMaterialDeleteRequestSchema.safeParse({
                interpretationId: '019f2000-0000-7000-8000-000000000701',
                cellId: 'cell-selected',
                expectedCellVersion: 1,
                expectedMaterialVersion: 1
            }).success
        ).toBe(true)
        expect(
            interpretationNetworkMaterialPrimaryRequestSchema.safeParse({
                interpretationId: '019f2000-0000-7000-8000-000000000701',
                cellId: 'cell-selected',
                materialId: null,
                expectedCellVersion: 1
            }).success
        ).toBe(true)
    })

    it('normalizes the existing v1 material payload while preserving its cell identity and version fields', () => {
        const result = interpretationNetworkMaterialCreateRequestSchema.safeParse({
            interpretationId: '019f2000-0000-4000-8000-000000000701',
            matrixRowId: '019f2000-0000-7000-8000-000000000702',
            cellId: 'cell-selected',
            data: { title: 'Material' },
            expectedVersion: 7
        })

        expect(result).toEqual({
            success: true,
            data: {
                interpretationId: '019f2000-0000-4000-8000-000000000701',
                matrixRowId: '019f2000-0000-7000-8000-000000000702',
                cellId: 'cell-selected',
                data: { title: 'Material' },
                expectedCellVersion: 7
            }
        })
    })
})
