import { createMockDbExecutor } from '../utils/dbMocks'
import {
    InterpretationNetworkCommandError,
    instantiateStructureFromTemplate,
    saveStructureAsTemplate
} from '../../services/interpretationNetwork/runtimeInterpretationNetworkService'
import { isUuidV7 } from '@universo-react/utils'
import { planMatrixRowsCopy } from '../../services/interpretationNetwork/runtimeInterpretationNetworkMatrixCopy'
import { makeCtx, makeField, makeSurface, vlcText } from '../utils/interpretationNetworkRuntimeFixtures'

describe('runtime Interpretation Network template commands', () => {
    it('copies materials with remapped cell ids when saving a structure as a template', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const sourceStructureId = '019f2000-0000-7000-8000-000000000201'
        const sourceInterpretationId = '019f2000-0000-7000-8000-000000000202'
        const sourceMaterialId = '019f2000-0000-7000-8000-000000000203'
        let insertCount = 0
        let clonedMaterialCellId: unknown = null
        txExecutor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"')) {
                return [{ id: sourceStructureId, _upl_version: 2 }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                return [{ id: sourceInterpretationId }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                return [
                    {
                        id: 'row-1',
                        cell_id: 'cell-root',
                        parent_cell_id: null,
                        row_key: 'axis-root',
                        col_key: 'axis-root',
                        cell_value: { locales: { en: { content: 'Root' } }, _primary: 'en' },
                        material_ref: sourceMaterialId
                    }
                ]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."material"')) {
                return [
                    {
                        id: sourceMaterialId,
                        title: 'Material',
                        description: 'D',
                        body: { blocks: [] },
                        cell_id: 'cell-root',
                        interpretation_id: sourceInterpretationId
                    }
                ]
            }
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."material"')) {
                clonedMaterialCellId = params?.[4]
                return [{ id: '019f2000-0000-7000-8000-000000000301' }]
            }
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."table_template"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000302' }]
            }
            if (sql.includes('UPDATE "app_018f8a787b8f7c1da111222233334440"."table_template"')) return [{ id: params?.[1] }]
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."table_template_rows"')) {
                insertCount += 1
                expect(params).toContain('019f2000-0000-7000-8000-000000000301')
                expect(params).not.toContain('cell-root')
                return [{ id: '019f2000-0000-7000-8000-000000000401' }]
            }
            return []
        })

        await saveStructureAsTemplate(makeCtx(executor), makeSurface('singleSystem'), {
            sourceStructureId,
            templateName: vlcText('Reusable'),
            scope: { kind: 'wholeStructure' },
            includeMaterials: true,
            expectedVersion: 2
        })

        expect(insertCount).toBe(1)
        expect(clonedMaterialCellId).not.toBe('cell-root')
    })

    it('keeps cloned template materials owned by the copied matrix cells when saving a structure as a template', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const sourceStructureId = '019f2000-0000-7000-8000-000000000251'
        const sourceInterpretationId = '019f2000-0000-7000-8000-000000000252'
        const sourceMaterialId = '019f2000-0000-7000-8000-000000000253'
        const clonedMaterialId = '019f2000-0000-7000-8000-000000000351'
        let materialInsertSql = ''
        let materialInsertParams: unknown[] | undefined
        let templateRowInsertSql = ''
        let templateRowParams: unknown[] | undefined

        const readInsertParamByColumn = (sql: string, params: unknown[] | undefined, columnName: string): unknown => {
            const columnList = sql.slice(sql.indexOf('(') + 1, sql.indexOf(')'))
            const columns = columnList.split(',').map((column) => column.trim().replace(/"/g, ''))
            const index = columns.indexOf(columnName)
            return index >= 0 ? params?.[index] : undefined
        }

        txExecutor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"')) {
                return [{ id: sourceStructureId, _upl_version: 1 }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                return [{ id: sourceInterpretationId }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                return [
                    {
                        id: 'row-1',
                        cell_id: 'cell-root',
                        parent_cell_id: null,
                        row_key: 'axis-root',
                        col_key: 'axis-root',
                        cell_value: { locales: { en: { content: 'Root' } }, _primary: 'en' },
                        material_ref: sourceMaterialId
                    }
                ]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."material"')) {
                return [
                    {
                        id: sourceMaterialId,
                        title: 'Material',
                        description: 'D',
                        body: { blocks: [] },
                        cell_id: 'cell-root',
                        interpretation_id: sourceInterpretationId
                    }
                ]
            }
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."material"')) {
                materialInsertSql = sql
                materialInsertParams = params
                return [{ id: clonedMaterialId }]
            }
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."table_template"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000352' }]
            }
            if (sql.includes('UPDATE "app_018f8a787b8f7c1da111222233334440"."table_template"')) return [{ id: params?.[1] }]
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."table_template_rows"')) {
                templateRowInsertSql = sql
                templateRowParams = params
                return [{ id: '019f2000-0000-7000-8000-000000000451' }]
            }
            return []
        })

        await saveStructureAsTemplate(makeCtx(executor), makeSurface('singleSystem'), {
            sourceStructureId,
            templateName: vlcText('Reusable with materials'),
            scope: { kind: 'wholeStructure' },
            includeMaterials: true
        })

        const clonedMaterialCellId = readInsertParamByColumn(materialInsertSql, materialInsertParams, 'cell_id')
        const templateRowCellId = readInsertParamByColumn(templateRowInsertSql, templateRowParams, 'cell_id')

        expect(clonedMaterialCellId).toMatch(/^0[0-9a-f]{7}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
        expect(clonedMaterialCellId).not.toBe('cell-root')
        expect(templateRowCellId).toBe(clonedMaterialCellId)
        expect(readInsertParamByColumn(templateRowInsertSql, templateRowParams, 'material_ref')).toBe(clonedMaterialId)
    })

    it('copies materials linked only by Material.CellId when saving a structure as a template', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const sourceStructureId = '019f2000-0000-7000-8000-000000000211'
        const sourceInterpretationId = '019f2000-0000-7000-8000-000000000212'
        const sourceMaterialId = '019f2000-0000-7000-8000-000000000213'
        let materialLookupParams: unknown[] | undefined
        let materialInsertParams: unknown[] | undefined
        let templateRowParams: unknown[] | undefined

        txExecutor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"')) {
                return [{ id: sourceStructureId, _upl_version: 1 }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                return [{ id: sourceInterpretationId }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                return [
                    {
                        id: 'row-cell-only-material',
                        cell_id: 'cell-with-material',
                        parent_cell_id: null,
                        row_key: 'axis-root',
                        col_key: 'axis-root',
                        cell_value: { locales: { en: { content: 'Root' } }, _primary: 'en' },
                        material_ref: null
                    }
                ]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."material"')) {
                materialLookupParams = params
                return [
                    {
                        id: sourceMaterialId,
                        title: 'Cell-only material',
                        description: 'Linked by Material.CellId',
                        body: { blocks: [] },
                        cell_id: 'cell-with-material',
                        interpretation_id: sourceInterpretationId
                    }
                ]
            }
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."material"')) {
                materialInsertParams = params
                return [{ id: '019f2000-0000-7000-8000-000000000313' }]
            }
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."table_template"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000312' }]
            }
            if (sql.includes('UPDATE "app_018f8a787b8f7c1da111222233334440"."table_template"')) return [{ id: params?.[1] }]
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."table_template_rows"')) {
                templateRowParams = params
                return [{ id: '019f2000-0000-7000-8000-000000000411' }]
            }
            return []
        })

        await saveStructureAsTemplate(makeCtx(executor), makeSurface('multiple'), {
            sourceStructureId,
            templateName: vlcText('Reusable from CellId'),
            scope: { kind: 'wholeStructure' },
            includeMaterials: true
        })

        expect(materialLookupParams).toContainEqual(['cell-with-material'])
        expect(materialInsertParams).not.toContain('cell-with-material')
        expect(templateRowParams).not.toContain('019f2000-0000-7000-8000-000000000313')
        expect(templateRowParams).toContain(null)
    })

    it('fails closed when a matrix MaterialRef points to a missing material', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const sourceStructureId = '019f2000-0000-7000-8000-000000000221'
        const sourceInterpretationId = '019f2000-0000-7000-8000-000000000222'
        const missingMaterialId = '019f2000-0000-7000-8000-000000000223'

        txExecutor.query.mockImplementation(async (sql: string, _params?: unknown[]) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"')) {
                return [{ id: sourceStructureId, _upl_version: 1 }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                return [{ id: sourceInterpretationId }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                return [
                    {
                        id: 'row-missing-material',
                        cell_id: 'cell-missing-material',
                        parent_cell_id: null,
                        row_key: 'axis-root',
                        col_key: 'axis-root',
                        cell_value: { locales: { en: { content: 'Root' } }, _primary: 'en' },
                        material_ref: missingMaterialId
                    }
                ]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."material"')) return []
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."table_template"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000322' }]
            }
            return []
        })

        await expect(
            saveStructureAsTemplate(makeCtx(executor), makeSurface('multiple'), {
                sourceStructureId,
                templateName: vlcText('Broken material'),
                scope: { kind: 'wholeStructure' },
                includeMaterials: true
            })
        ).rejects.toMatchObject({ code: 'INTERPRETATION_NETWORK_INVALID_MATERIAL' })
        expect(
            txExecutor.query.mock.calls.some(([sql]) =>
                String(sql).includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."table_template_rows"')
            )
        ).toBe(false)
    })

    it('fails closed when a matrix MaterialRef is not a valid UUID', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const sourceStructureId = '019f2000-0000-7000-8000-000000000231'
        const sourceInterpretationId = '019f2000-0000-7000-8000-000000000232'

        txExecutor.query.mockImplementation(async (sql: string, _params?: unknown[]) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"')) {
                return [{ id: sourceStructureId, _upl_version: 1 }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                return [{ id: sourceInterpretationId }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                return [
                    {
                        id: 'row-invalid-material',
                        cell_id: 'cell-invalid-material',
                        parent_cell_id: null,
                        row_key: 'axis-root',
                        col_key: 'axis-root',
                        cell_value: { locales: { en: { content: 'Root' } }, _primary: 'en' },
                        material_ref: 'not-a-material-id'
                    }
                ]
            }
            return []
        })

        await expect(
            saveStructureAsTemplate(makeCtx(executor), makeSurface('multiple'), {
                sourceStructureId,
                templateName: vlcText('Invalid material'),
                scope: { kind: 'wholeStructure' },
                includeMaterials: true
            })
        ).rejects.toMatchObject({ code: 'INTERPRETATION_NETWORK_INVALID_MATRIX' })
        expect(
            txExecutor.query.mock.calls.some(([sql]) =>
                String(sql).includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."table_template"')
            )
        ).toBe(false)
    })

    it('copies all materials attached to a CellId without inferring a Primary Material', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const sourceStructureId = '019f2000-0000-7000-8000-000000000241'
        const sourceInterpretationId = '019f2000-0000-7000-8000-000000000242'
        let materialInsertCount = 0
        let templateRowParams: unknown[] | undefined

        txExecutor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"')) {
                return [{ id: sourceStructureId, _upl_version: 1 }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                return [{ id: sourceInterpretationId }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                return [
                    {
                        id: 'row-duplicate-cell-material',
                        cell_id: 'cell-duplicate-material',
                        parent_cell_id: null,
                        row_key: 'axis-root',
                        col_key: 'axis-root',
                        cell_value: { locales: { en: { content: 'Root' } }, _primary: 'en' },
                        material_ref: null
                    }
                ]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."material"')) {
                return [
                    {
                        id: '019f2000-0000-7000-8000-000000000243',
                        title: 'A',
                        cell_id: 'cell-duplicate-material',
                        interpretation_id: sourceInterpretationId
                    },
                    {
                        id: '019f2000-0000-7000-8000-000000000244',
                        title: 'B',
                        cell_id: 'cell-duplicate-material',
                        interpretation_id: sourceInterpretationId
                    }
                ]
            }
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."material"')) {
                materialInsertCount += 1
                return [{ id: `019f2000-0000-7000-8000-00000000024${materialInsertCount}` }]
            }
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."table_template"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000245' }]
            }
            if (sql.includes('UPDATE "app_018f8a787b8f7c1da111222233334440"."table_template"')) return [{ id: params?.[1] }]
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."table_template_rows"')) {
                templateRowParams = params
                return [{ id: '019f2000-0000-7000-8000-000000000246' }]
            }
            return []
        })

        await saveStructureAsTemplate(makeCtx(executor), makeSurface('multiple'), {
            sourceStructureId,
            templateName: vlcText('Multiple materials'),
            scope: { kind: 'wholeStructure' },
            includeMaterials: true
        })

        expect(materialInsertCount).toBe(2)
        expect(templateRowParams).toContain(null)
    })

    it('copies materials linked only by Material.CellId when instantiating a template', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const templateId = '019f2000-0000-7000-8000-000000000251'
        const templatePrimaryMaterialId = '019f2000-0000-7000-8000-000000000252'
        const templateSecondaryMaterialId = '019f2000-0000-7000-8000-000000000253'
        let materialLookupParams: unknown[] | undefined
        const materialInsertParams: unknown[][] = []
        let matrixRowParams: unknown[] | undefined

        txExecutor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."table_template"')) {
                return [{ id: templateId, name: 'Template', material_policy: 'withMaterials', _upl_version: 1 }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."table_template_rows"')) {
                return [
                    {
                        id: 'template-row-cell-material',
                        cell_id: 'template-cell-with-material',
                        parent_cell_id: null,
                        row_key: 'axis-root',
                        col_key: 'axis-root',
                        cell_value: { locales: { en: { content: 'Root' } }, _primary: 'en' },
                        material_ref: templatePrimaryMaterialId
                    }
                ]
            }
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."structure"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000351' }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."material"')) {
                materialLookupParams = params
                return [
                    {
                        id: templatePrimaryMaterialId,
                        title: 'Template primary material',
                        description: 'Primary material',
                        body: { blocks: [] },
                        cell_id: 'template-cell-with-material',
                        template_owner_id: templateId
                    },
                    {
                        id: templateSecondaryMaterialId,
                        title: 'Template secondary material',
                        description: 'Secondary material',
                        body: { blocks: [] },
                        cell_id: 'template-cell-with-material',
                        template_owner_id: templateId
                    }
                ]
            }
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."material"')) {
                materialInsertParams.push(params ?? [])
                return [
                    {
                        id:
                            materialInsertParams.length === 1
                                ? '019f2000-0000-7000-8000-000000000352'
                                : '019f2000-0000-7000-8000-000000000355'
                    }
                ]
            }
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000353' }]
            }
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                matrixRowParams = params
                return [{ id: '019f2000-0000-7000-8000-000000000354' }]
            }
            return []
        })

        await instantiateStructureFromTemplate(makeCtx(executor), makeSurface('multiple'), {
            templateId,
            structureName: vlcText('From template')
        })

        expect(materialLookupParams).toContain(templateId)
        expect(materialInsertParams).toHaveLength(2)
        expect(materialInsertParams.flat()).not.toContain('template-cell-with-material')
        expect(matrixRowParams).toContain('019f2000-0000-7000-8000-000000000352')
        expect(matrixRowParams).not.toContain('019f2000-0000-7000-8000-000000000355')
        expect(matrixRowParams).not.toContain(templatePrimaryMaterialId)
        expect(matrixRowParams).not.toContain(templateSecondaryMaterialId)
    })

    it('instantiates multiple independent template rows without inventing hierarchy', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const templateId = '019f2000-0000-7000-8000-000000000356'
        const templateRows = [
            { id: 'template-row-a', cell_id: 'template-cell-a', parent_cell_id: null, row_key: 'a', col_key: 'a', cell_value: 'A' },
            { id: 'template-row-b', cell_id: 'template-cell-b', parent_cell_id: null, row_key: 'b', col_key: 'b', cell_value: 'B' }
        ]
        let insertedRows: Array<Record<string, unknown>> = []

        txExecutor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."table_template"')) {
                return [{ id: templateId, name: 'Independent template', material_policy: 'structureOnly', _upl_version: 1 }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."table_template_rows"')) return templateRows
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."structure"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000357' }]
            }
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000358' }]
            }
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                const columns = sql
                    .slice(sql.indexOf('(') + 1, sql.indexOf(')'))
                    .split(',')
                    .map((column) => column.trim().replaceAll('"', ''))
                insertedRows = []
                for (let offset = 0; offset < (params?.length ?? 0); offset += columns.length) {
                    insertedRows.push(Object.fromEntries(columns.map((column, index) => [column, params?.[offset + index]])))
                }
                return insertedRows.map((row) => ({ id: row.id }))
            }
            return []
        })

        const surface = { ...makeSurface('multiple'), widgetConfig: { structureMode: 'multiple', matrixMode: 'independentRows' } }
        await instantiateStructureFromTemplate(makeCtx(executor), surface, {
            templateId,
            structureName: vlcText('From independent template')
        })

        expect(insertedRows).toHaveLength(2)
        expect(insertedRows.every((row) => row.parent_cell_id === null)).toBe(true)
        expect(new Set(insertedRows.map((row) => row.cell_id)).size).toBe(2)
        expect(insertedRows.every((row) => isUuidV7(row.id) && isUuidV7(row.cell_id))).toBe(true)
        expect(insertedRows.map((row) => row.cell_value)).toEqual(['A', 'B'])
    })

    it('does not copy unknown matching child fields into template rows', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const sourceStructureId = '019f2000-0000-7000-8000-000000000261'
        const sourceInterpretationId = '019f2000-0000-7000-8000-000000000262'
        let templateRowSql = ''
        let templateRowParams: unknown[] | undefined

        const surfaceWithInternalField = makeSurface('multiple') as ReturnType<typeof makeSurface> & {
            contracts: {
                Interpretation: { childFields: Record<string, ReturnType<typeof makeField>> }
                TableTemplate: { childFields: Record<string, ReturnType<typeof makeField>> }
            }
        }
        surfaceWithInternalField.contracts.Interpretation.childFields.InternalRef = makeField('InternalRef', 'internal_ref', 'REF')
        surfaceWithInternalField.contracts.TableTemplate.childFields.InternalRef = makeField('InternalRef', 'internal_ref', 'REF')

        txExecutor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"')) {
                return [{ id: sourceStructureId, _upl_version: 1 }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                return [{ id: sourceInterpretationId }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                return [
                    {
                        id: 'row-with-internal-ref',
                        cell_id: 'cell-with-internal-ref',
                        parent_cell_id: null,
                        row_key: 'axis-root',
                        col_key: 'axis-root',
                        cell_value: { locales: { en: { content: 'Root' } }, _primary: 'en' },
                        internal_ref: '019f2000-0000-7000-8000-000000000999'
                    }
                ]
            }
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."table_template"')) {
                return [{ id: '019f2000-0000-7000-8000-000000000362' }]
            }
            if (sql.includes('UPDATE "app_018f8a787b8f7c1da111222233334440"."table_template"')) return [{ id: params?.[1] }]
            if (sql.includes('INSERT INTO "app_018f8a787b8f7c1da111222233334440"."table_template_rows"')) {
                templateRowSql = sql
                templateRowParams = params
                return [{ id: '019f2000-0000-7000-8000-000000000363' }]
            }
            return []
        })

        await saveStructureAsTemplate(makeCtx(executor), surfaceWithInternalField, {
            sourceStructureId,
            templateName: vlcText('Allowlisted fields'),
            scope: { kind: 'wholeStructure' },
            includeMaterials: false
        })

        expect(templateRowSql).not.toContain('"internal_ref"')
        expect(templateRowParams).not.toContain('019f2000-0000-7000-8000-000000000999')
    })

    it('rejects template instantiation in single-system mode', async () => {
        const { executor } = createMockDbExecutor()

        await expect(
            instantiateStructureFromTemplate(makeCtx(executor), makeSurface('singleSystem'), {
                templateId: '019f2000-0000-7000-8000-000000000999',
                structureName: vlcText('New')
            })
        ).rejects.toBeInstanceOf(InterpretationNetworkCommandError)
    })

    it.each([
        {
            label: 'duplicate CellId',
            rows: [
                { cell_id: 'duplicate', parent_cell_id: null },
                { cell_id: 'duplicate', parent_cell_id: null }
            ]
        },
        {
            label: 'dangling parent',
            rows: [{ cell_id: 'child', parent_cell_id: 'missing-parent' }]
        },
        {
            label: 'hierarchy cycle',
            rows: [
                { cell_id: 'a', parent_cell_id: 'b' },
                { cell_id: 'b', parent_cell_id: 'a' }
            ]
        }
    ])('rejects a source matrix with $label before copying', ({ rows }) => {
        const surface = makeSurface('multiple')
        expect(() => planMatrixRowsCopy(rows, surface.contracts.Interpretation, surface.contracts.TableTemplate, new Map(), false)).toThrow(
            expect.objectContaining({ code: 'INTERPRETATION_NETWORK_INVALID_MATRIX' })
        )
    })

    it('rejects parent references in independent-row templates', () => {
        const surface = makeSurface('multiple')
        expect(() =>
            planMatrixRowsCopy(
                [
                    { cell_id: 'row-a', parent_cell_id: null },
                    { cell_id: 'row-b', parent_cell_id: 'row-a' }
                ],
                surface.contracts.Interpretation,
                surface.contracts.TableTemplate,
                new Map(),
                false,
                new Map(),
                'independentRows'
            )
        ).toThrow(expect.objectContaining({ code: 'INTERPRETATION_NETWORK_INVALID_MATRIX' }))
    })

    it('remaps matrix MaterialRef by source material row id when the source row has both MaterialRef and CellId ownership', () => {
        const surface = makeSurface('multiple')
        const materialIdMap = new Map([
            ['019f2000-0000-7000-8000-000000000a01', '019f2000-0000-7000-8000-000000000b01'],
            ['source-cell-1', '019f2000-0000-7000-8000-000000000b02']
        ])

        const plan = planMatrixRowsCopy(
            [
                {
                    id: 'row-1',
                    cell_id: 'source-cell-1',
                    parent_cell_id: null,
                    row_key: 'source-row',
                    col_key: 'source-col',
                    cell_value: { locales: { en: { content: 'Root' } }, _primary: 'en' },
                    material_ref: '019f2000-0000-7000-8000-000000000a01'
                }
            ],
            surface.contracts.Interpretation,
            surface.contracts.TableTemplate,
            materialIdMap,
            true
        )

        expect(plan.rows[0].material_ref).toBe('019f2000-0000-7000-8000-000000000b01')
        expect(plan.rows[0].material_ref).not.toBe('019f2000-0000-7000-8000-000000000b02')
        expect(plan.rows[0].cell_id).toMatch(/^0[0-9a-f]{7}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })

    it('does not infer a Primary Material from a cell-id clone map', () => {
        const surface = makeSurface('multiple')
        const plan = planMatrixRowsCopy(
            [
                {
                    id: 'row-1',
                    cell_id: 'source-cell-1',
                    parent_cell_id: null,
                    row_key: 'source-row',
                    col_key: 'source-col',
                    cell_value: { locales: { en: { content: 'Root' } }, _primary: 'en' },
                    material_ref: null
                }
            ],
            surface.contracts.Interpretation,
            surface.contracts.TableTemplate,
            new Map([['source-cell-1', '019f2000-0000-7000-8000-000000000b02']]),
            true
        )

        expect(plan.rows[0].material_ref).toBeNull()
    })

    it('rechecks template mutation permissions inside the service boundary', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const ctx = makeCtx(executor)
        ctx.permissions.createContent = false

        await expect(
            saveStructureAsTemplate(ctx, makeSurface('multiple'), {
                sourceStructureId: '019f2000-0000-7000-8000-000000000901',
                templateName: vlcText('Denied'),
                scope: { kind: 'wholeStructure' },
                includeMaterials: false
            })
        ).rejects.toMatchObject({ statusCode: 403, code: 'INTERPRETATION_NETWORK_PERMISSION_DENIED' })
        expect(txExecutor.query).not.toHaveBeenCalled()
    })
})
