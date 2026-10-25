import { createMockDbExecutor } from '../utils/dbMocks'
import { RuntimeModulesService } from '../../services/runtimeModulesService'
import {
    deleteInterpretationNetworkTemplate,
    deleteStructureAggregate
} from '../../services/interpretationNetwork/runtimeInterpretationNetworkService'
import { makeCtx, makeSurface } from '../utils/interpretationNetworkRuntimeFixtures'

describe('runtime Interpretation Network aggregate deletion commands', () => {
    let lifecycleSpy: jest.SpyInstance

    beforeEach(() => {
        lifecycleSpy = jest.spyOn(RuntimeModulesService.prototype, 'dispatchLifecycleEvent').mockResolvedValue([])
    })

    afterEach(() => {
        lifecycleSpy.mockRestore()
    })

    it('deletes template rows and only provenance-owned materials in one transaction', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const templateId = '019f2000-0000-7000-8000-000000000911'
        const materialId = '019f2000-0000-7000-8000-000000000912'
        const updateSql: string[] = []
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."table_template_rows"')) {
                return [{ id: 'row-1', cell_id: 'template-cell', parent_cell_id: null, material_ref: materialId }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."table_template"')) {
                return [{ id: templateId, material_policy: 'withMaterials', _upl_version: 2 }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."material"')) {
                return [{ id: materialId, cell_id: 'template-cell', template_owner_id: templateId }]
            }
            if (sql.includes('UPDATE ')) {
                updateSql.push(sql)
                if (sql.includes('"table_template_rows"')) return [{ id: 'row-1' }]
                if (sql.includes('"material"')) return [{ id: materialId }]
                return [{ id: templateId }]
            }
            return []
        })

        await deleteInterpretationNetworkTemplate(makeCtx(executor), makeSurface('multiple'), { templateId, expectedVersion: 2 })

        expect(updateSql.some((sql) => sql.includes('"table_template_rows"') && sql.includes('_tp_parent_id = ANY'))).toBe(true)
        expect(updateSql.some((sql) => sql.includes('"material"') && sql.includes('WHERE id = $2'))).toBe(true)
        expect(updateSql.some((sql) => sql.includes('"table_template"') && sql.includes('WHERE id = $2'))).toBe(true)
    })

    it('deletes Structure, Matrix children, attached Materials, and Interpretation transactionally', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const structureId = '019f2000-0000-7000-8000-000000000921'
        const interpretationId = '019f2000-0000-7000-8000-000000000922'
        const materialId = '019f2000-0000-7000-8000-000000000923'
        const cellId = '019f2000-0000-7000-8000-000000000924'
        const updateSql: string[] = []
        txExecutor.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('._app_objects') && params[0] === 'Favorite') {
                return [
                    {
                        id: 'favorite-object',
                        codename: 'Favorite',
                        table_name: 'favorite',
                        config: {
                            runtimeRecordAccess: { mode: 'ownerOnly', ownerFieldCodename: 'OwnerUserId' },
                            recordPolicy: { version: 1, runtimeMutation: 'deny', workspaceCopy: 'exclude' }
                        }
                    }
                ]
            }
            if (sql.includes('._app_components') && params[0] === 'favorite-object') {
                return [
                    {
                        id: 'owner',
                        codename: 'OwnerUserId',
                        column_name: 'owner_user_id',
                        data_type: 'STRING',
                        ui_config: { serverOwned: true }
                    },
                    {
                        id: 'interpretation',
                        codename: 'TargetInterpretationId',
                        column_name: 'target_interpretation_id',
                        data_type: 'STRING',
                        ui_config: { serverOwned: true }
                    },
                    {
                        id: 'cell',
                        codename: 'TargetCellId',
                        column_name: 'target_cell_id',
                        data_type: 'STRING',
                        ui_config: { serverOwned: true }
                    }
                ]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"')) {
                return [{ id: structureId, system_key: null, _upl_version: 4 }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation"')) {
                return [{ id: interpretationId }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                return [{ id: 'row-1', cell_id: cellId, parent_cell_id: null, material_ref: materialId }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."material"')) {
                return [{ id: materialId, cell_id: cellId, interpretation_id: interpretationId }]
            }
            if (sql.includes('UPDATE ')) {
                updateSql.push(sql)
                return [{ id: 'updated' }]
            }
            return []
        })

        await deleteStructureAggregate(makeCtx(executor), makeSurface('multiple'), structureId, { expectedVersion: 4 })

        expect(updateSql.map((sql) => sql.match(/"(favorite|interpretation_rows|material|interpretation|structure)"/)?.[1])).toEqual([
            'favorite',
            'interpretation_rows',
            'material',
            'interpretation',
            'structure'
        ])
        expect(updateSql.some((sql) => sql.includes('"favorite"') && sql.includes('ANY($2::text[])'))).toBe(true)
    })

    it('deletes the union of Materials referenced by row id or owned only by Matrix CellId exactly once', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const structureId = '019f2000-0000-7000-8000-000000000931'
        const interpretationId = '019f2000-0000-7000-8000-000000000932'
        const referencedMaterialId = '019f2000-0000-7000-8000-000000000933'
        const cellOnlyMaterialId = '019f2000-0000-7000-8000-000000000934'
        const firstCellId = '019f2000-0000-7000-8000-000000000935'
        const secondCellId = '019f2000-0000-7000-8000-000000000936'
        const deletedMaterialIds: string[] = []
        txExecutor.query.mockImplementation(async (sql: string, values?: unknown[]) => {
            if (sql.includes('pg_advisory_xact_lock')) return []
            if (sql.includes('._app_objects') && values?.[0] === 'Favorite') {
                return [
                    {
                        id: 'favorite-object',
                        codename: 'Favorite',
                        table_name: 'favorite',
                        config: {
                            runtimeRecordAccess: { mode: 'ownerOnly', ownerFieldCodename: 'OwnerUserId' },
                            recordPolicy: { version: 1, runtimeMutation: 'deny', workspaceCopy: 'exclude' }
                        }
                    }
                ]
            }
            if (sql.includes('._app_components') && values?.[0] === 'favorite-object') {
                return [
                    {
                        id: 'owner',
                        codename: 'OwnerUserId',
                        column_name: 'owner_user_id',
                        data_type: 'STRING',
                        ui_config: { serverOwned: true }
                    },
                    {
                        id: 'interpretation',
                        codename: 'TargetInterpretationId',
                        column_name: 'target_interpretation_id',
                        data_type: 'STRING',
                        ui_config: { serverOwned: true }
                    },
                    {
                        id: 'cell',
                        codename: 'TargetCellId',
                        column_name: 'target_cell_id',
                        data_type: 'STRING',
                        ui_config: { serverOwned: true }
                    }
                ]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."structure"')) {
                return [{ id: structureId, system_key: null, _upl_version: 1 }]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation"')) return [{ id: interpretationId }]
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."interpretation_rows"')) {
                return [
                    { id: 'row-1', cell_id: firstCellId, parent_cell_id: null, material_ref: referencedMaterialId },
                    { id: 'row-2', cell_id: secondCellId, parent_cell_id: firstCellId, material_ref: null }
                ]
            }
            if (sql.includes('FROM "app_018f8a787b8f7c1da111222233334440"."material"')) {
                return [
                    { id: referencedMaterialId, cell_id: firstCellId, interpretation_id: interpretationId },
                    { id: cellOnlyMaterialId, cell_id: secondCellId, interpretation_id: interpretationId }
                ]
            }
            if (sql.includes('UPDATE ') && sql.includes('"material"')) {
                deletedMaterialIds.push(String(values?.[1] ?? ''))
                return [{ id: String(values?.[1] ?? '') }]
            }
            if (sql.includes('UPDATE ')) return [{ id: 'updated' }]
            return []
        })

        await deleteStructureAggregate(makeCtx(executor), makeSurface('multiple'), structureId, { expectedVersion: 1 })

        expect(deletedMaterialIds).toEqual([referencedMaterialId, cellOnlyMaterialId])
    })
})
