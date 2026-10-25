import { isUuidV7 } from '@universo-react/utils'
import { RuntimeModulesService } from '../../services/runtimeModulesService'
import {
    applyTableTemplateToMatrix,
    interpretationNetworkTemplateApplyRequestSchema,
    interpretationNetworkTemplateApplyResponseSchema
} from '../../services/interpretationNetwork/runtimeInterpretationNetworkService'
import { interpretationNetworkMatrixMembershipLockKey } from '../../services/interpretationNetwork/runtimeInterpretationNetworkMatrixMembership'
import { createMockDbExecutor } from '../utils/dbMocks'
import { makeCtx, makeSurface, schemaName, workspaceId } from '../utils/interpretationNetworkTemplateFixtures'

const id = (suffix: number) => '019f2000-0000-7000-8000-' + String(suffix).padStart(12, '0')
const templateId = id(201)
const structureId = id(202)
const interpretationId = id(203)
const targetCellId = id(301)
const existingSiblingCellId = id(302)
const templateRootCellId = id(401)
const templateChildCellId = id(402)
const templateMaterialId = id(501)

const request = {
    interpretationId,
    targetCellId,
    expectedTemplateVersion: 2,
    expectedTargetVersion: 3
}

const makeTargetRows = () => [
    {
        id: id(601),
        _tp_sort_order: 0,
        _upl_version: 3,
        cell_id: targetCellId,
        parent_cell_id: null,
        row_key: 'existing-target-row',
        col_key: 'existing-target-column',
        cell_value: 'target',
        cell_description: null,
        material_ref: null
    },
    {
        id: id(602),
        _tp_sort_order: 5,
        _upl_version: 1,
        cell_id: existingSiblingCellId,
        parent_cell_id: targetCellId,
        row_key: 'existing-sibling-row',
        col_key: 'existing-sibling-column',
        cell_value: 'existing sibling',
        cell_description: null,
        material_ref: null
    }
]

const makeTemplateRows = (includeMaterial = false) => [
    {
        id: id(701),
        _tp_sort_order: 0,
        cell_id: templateRootCellId,
        parent_cell_id: null,
        row_key: 'template-row',
        col_key: 'template-column',
        cell_value: 'template root',
        cell_description: null,
        material_ref: includeMaterial ? templateMaterialId : null
    },
    {
        id: id(702),
        _tp_sort_order: 1,
        cell_id: templateChildCellId,
        parent_cell_id: templateRootCellId,
        row_key: 'template-child-row',
        col_key: 'template-column',
        cell_value: 'template child',
        cell_description: null,
        material_ref: null
    }
]

type SetupOptions = {
    structureMode?: 'multiple' | 'singleSystem'
    matrixMode?: string
    materialPolicy?: 'structureOnly' | 'withMaterials'
    templateRows?: Array<Record<string, unknown>>
    targetRows?: Array<Record<string, unknown>>
    templatePresent?: boolean
    templateVersion?: number
    targetStructureId?: string
    maxRows?: number
    failMatrixInsert?: boolean
}

const setup = (options: SetupOptions = {}) => {
    const { executor, txExecutor } = createMockDbExecutor()
    const surface = makeSurface(options.structureMode ?? 'multiple')
    if (options.matrixMode !== undefined) surface.widgetConfig.matrixMode = options.matrixMode
    if (options.maxRows !== undefined) {
        Object.assign(surface.contracts.Interpretation.table!, { validation_rules: { maxRows: options.maxRows } })
    }
    const ctx = makeCtx(executor)
    const targetRows = options.targetRows ?? makeTargetRows()
    const templateRows = options.templateRows ?? makeTemplateRows(options.materialPolicy === 'withMaterials')
    const templateRow = {
        id: templateId,
        _upl_version: options.templateVersion ?? 2,
        material_policy: options.materialPolicy ?? 'structureOnly'
    }
    const targetInterpretation = {
        id: interpretationId,
        _upl_locked: false,
        parent_structure: options.targetStructureId ?? structureId
    }
    const targetStructure = {
        id: options.targetStructureId ?? structureId,
        _upl_locked: false,
        system_key: options.structureMode === 'singleSystem' ? 'primary' : null
    }
    const materials =
        options.materialPolicy === 'withMaterials'
            ? [
                  {
                      id: templateMaterialId,
                      template_owner_id: templateId,
                      interpretation_id: null,
                      cell_id: templateRootCellId,
                      title: 'Copied title',
                      description: null,
                      body: { blocks: [{ type: 'paragraph', content: 'Copied body' }] }
                  }
              ]
            : []
    const committed: Array<{ table: string; row: Record<string, unknown> }> = []
    let pending: Array<{ table: string; row: Record<string, unknown> }> | null = null
    executor.transaction.mockImplementation(async (run) => {
        const previousPending = pending
        pending = []
        try {
            const result = await run(txExecutor)
            committed.push(...pending)
            return result
        } finally {
            pending = previousPending
        }
    })
    txExecutor.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
        if (sql.includes('pg_advisory_xact_lock')) return []

        const insertMatch = sql.match(/INSERT INTO "[^"]+"\."([^"]+)"\s*\(([^)]+)\)/)
        if (insertMatch) {
            const table = insertMatch[1]
            if (table === 'interpretation_rows' && options.failMatrixInsert) throw new Error('matrix insert failed')
            const columns = insertMatch[2].split(',').map((column) => column.trim().replaceAll('"', ''))
            const rows = []
            for (let offset = 0; offset < params.length; offset += columns.length) {
                const row = Object.fromEntries(columns.map((column, index) => [column, params[offset + index]]))
                pending?.push({ table, row })
                rows.push({ id: row.id })
            }
            return rows
        }

        if (sql.includes('FROM "' + schemaName + '"."interpretation_rows"')) {
            return params[0] === interpretationId ? targetRows.map((row) => ({ ...row })) : templateRows.map((row) => ({ ...row }))
        }
        if (sql.includes('FROM "' + schemaName + '"."table_template_rows"')) {
            return templateRows.map((row) => ({ ...row }))
        }
        if (sql.includes('FROM "' + schemaName + '"."material"')) return materials.map((row) => ({ ...row }))
        if (sql.includes('FROM "' + schemaName + '"."table_template"')) {
            return options.templatePresent === false ? [] : [{ ...templateRow }]
        }
        if (sql.includes('FROM "' + schemaName + '"."interpretation"')) {
            if (sql.includes('WHERE "parent_structure" = $1')) return [{ ...targetInterpretation }]
            return params[0] === interpretationId ? [{ ...targetInterpretation }] : []
        }
        if (sql.includes('FROM "' + schemaName + '"."structure"')) {
            if (sql.includes('"system_key" = $1')) {
                return options.structureMode === 'singleSystem' ? [{ ...targetStructure }] : []
            }
            if (sql.includes('WHERE _upl_deleted = false')) {
                return options.structureMode === 'singleSystem' ? [{ ...targetStructure }] : []
            }
            return params[0] === targetStructure.id ? [{ ...targetStructure }] : []
        }
        return []
    })

    return { executor, txExecutor, ctx, surface, committed, targetRows, templateRows }
}

describe('Table Template apply contract', () => {
    it('requires a strict request with both expected versions and UUID v7 target identities', () => {
        expect(interpretationNetworkTemplateApplyRequestSchema.safeParse(request).success).toBe(true)
        expect(interpretationNetworkTemplateApplyRequestSchema.safeParse({ ...request, workspaceId }).success).toBe(false)
        expect(interpretationNetworkTemplateApplyRequestSchema.safeParse({ ...request, expectedTargetVersion: 0 }).success).toBe(false)
        expect(
            interpretationNetworkTemplateApplyRequestSchema.safeParse({ ...request, targetCellId: '019f2000-0000-4000-8000-000000000301' })
                .success
        ).toBe(false)
    })

    it('keeps the response strict and rejects non-v7 generated identities', () => {
        const response = {
            templateId,
            templateVersion: 2,
            interpretationId,
            targetCellId,
            targetCellVersion: 3,
            insertedRootCellId: templateRootCellId,
            insertedCellCount: 2,
            insertedMaterialCount: 0
        }
        expect(interpretationNetworkTemplateApplyResponseSchema.safeParse(response).success).toBe(true)
        expect(interpretationNetworkTemplateApplyResponseSchema.safeParse({ ...response, debug: true }).success).toBe(false)
        expect(
            interpretationNetworkTemplateApplyResponseSchema.safeParse({
                ...response,
                insertedRootCellId: id(401).replace('-7000-', '-4000-')
            }).success
        ).toBe(false)
    })
})

describe('applyTableTemplateToMatrix', () => {
    let lifecycle: jest.SpyInstance

    beforeEach(() => {
        lifecycle = jest.spyOn(RuntimeModulesService.prototype, 'dispatchLifecycleEvent').mockResolvedValue([])
    })

    afterEach(() => {
        lifecycle.mockRestore()
    })

    it('appends a remapped hierarchy under the selected cell using sibling order and collision-free axis keys', async () => {
        const state = setup()
        const result = await applyTableTemplateToMatrix(
            state.ctx,
            state.surface,
            templateId,
            interpretationNetworkTemplateApplyRequestSchema.parse(request)
        )
        const insertedRows = state.committed.filter((entry) => entry.table === 'interpretation_rows').map((entry) => entry.row)
        expect(result).toMatchObject({
            templateId,
            templateVersion: 2,
            interpretationId,
            targetCellId,
            targetCellVersion: 3,
            insertedCellCount: 2,
            insertedMaterialCount: 0
        })
        expect(isUuidV7(result.insertedRootCellId)).toBe(true)
        expect(insertedRows).toHaveLength(2)
        const root = insertedRows.find((row) => row.cell_id === result.insertedRootCellId)!
        const child = insertedRows.find((row) => row.parent_cell_id === result.insertedRootCellId)!
        expect(root.parent_cell_id).toBe(targetCellId)
        expect(root._tp_sort_order).toBe(6)
        expect(child.parent_cell_id).toBe(root.cell_id)
        expect(insertedRows.every((row) => isUuidV7(String(row.cell_id)))).toBe(true)
        expect(insertedRows.every((row) => !state.targetRows.some((existing) => existing.cell_id === row.cell_id))).toBe(true)
        expect(insertedRows.every((row) => !state.targetRows.some((existing) => existing.row_key === row.row_key))).toBe(true)
        expect(insertedRows.every((row) => !state.targetRows.some((existing) => existing.col_key === row.col_key))).toBe(true)
        expect(new Set(insertedRows.map((row) => row.cell_id)).size).toBe(2)

        const lockCalls = state.txExecutor.query.mock.calls.filter(([sql]) => sql.includes('pg_advisory_xact_lock'))
        const lockKeys = lockCalls.map(([, params]) => String(params?.[0] ?? ''))
        expect(lockKeys[0]).toContain('interpretation-network:structure-mode')
        expect(lockKeys[1]).toContain('interpretation-network:apply-template')
        expect(lockKeys[2]).toBe(interpretationNetworkMatrixMembershipLockKey(state.surface, interpretationId))
        const matrixReadIndex = state.txExecutor.query.mock.calls.findIndex(([sql]) =>
            sql.includes('FROM "' + schemaName + '"."interpretation_rows"')
        )
        expect(lockCalls[2][0]).toContain('pg_advisory_xact_lock')
        expect(
            state.txExecutor.query.mock.calls.findIndex(
                ([sql, params]) => sql.includes('pg_advisory_xact_lock') && params?.[0] === lockKeys[2]
            )
        ).toBeLessThan(matrixReadIndex)
        const scopedReads = state.txExecutor.query.mock.calls.filter(
            ([sql]) => sql.includes('FROM "') && !sql.includes('pg_advisory_xact_lock')
        )
        expect(scopedReads.every(([, params]) => params?.includes(workspaceId))).toBe(true)
    })

    it('applies to the primary Structure in singleSystem mode and validates that ownership', async () => {
        const state = setup({ structureMode: 'singleSystem' })
        const result = await applyTableTemplateToMatrix(
            state.ctx,
            state.surface,
            templateId,
            interpretationNetworkTemplateApplyRequestSchema.parse(request)
        )
        expect(result.insertedCellCount).toBe(2)
        expect(state.txExecutor.query.mock.calls.some(([sql]) => sql.includes('"system_key" = $1'))).toBe(true)
        expect(
            state.txExecutor.query.mock.calls.some(
                ([sql]) =>
                    sql.includes('FROM "' + schemaName + '"."structure"') &&
                    sql.includes('ORDER BY _upl_created_at ASC NULLS LAST, id ASC') &&
                    sql.includes('FOR UPDATE')
            )
        ).toBe(true)
    })

    it('clones template-owned Materials into the target Interpretation with remapped cell provenance', async () => {
        const state = setup({ materialPolicy: 'withMaterials' })
        const result = await applyTableTemplateToMatrix(
            state.ctx,
            state.surface,
            templateId,
            interpretationNetworkTemplateApplyRequestSchema.parse(request)
        )
        const material = state.committed.find((entry) => entry.table === 'material')?.row
        const insertedRows = state.committed.filter((entry) => entry.table === 'interpretation_rows').map((entry) => entry.row)
        const root = insertedRows.find((row) => row.cell_id === result.insertedRootCellId)
        expect(result.insertedMaterialCount).toBe(1)
        expect(material).toMatchObject({
            interpretation_id: interpretationId,
            title: 'Copied title',
            body: { blocks: [{ type: 'paragraph', content: 'Copied body' }] }
        })
        expect(material?.cell_id).toBe(result.insertedRootCellId)
        expect(material?.template_owner_id).toBeUndefined()
        expect(root?.material_ref).toBe(material?.id)
    })

    it('rolls back cloned Materials when the Matrix child insert fails', async () => {
        const state = setup({ materialPolicy: 'withMaterials', failMatrixInsert: true })
        await expect(
            applyTableTemplateToMatrix(state.ctx, state.surface, templateId, interpretationNetworkTemplateApplyRequestSchema.parse(request))
        ).rejects.toThrow('matrix insert failed')
        expect(state.committed).toEqual([])
    })

    it('fails closed for independentRows and unknown matrix modes before opening a transaction', async () => {
        for (const matrixMode of ['independentRows', 'unknown']) {
            const state = setup({ matrixMode })
            await expect(
                applyTableTemplateToMatrix(
                    state.ctx,
                    state.surface,
                    templateId,
                    interpretationNetworkTemplateApplyRequestSchema.parse(request)
                )
            ).rejects.toMatchObject({ code: 'INTERPRETATION_NETWORK_UNSUPPORTED_STRUCTURE_MODE' })
            expect(state.executor.transaction).not.toHaveBeenCalled()
        }
    })

    it('rejects stale template and target versions without committing writes', async () => {
        const staleTemplate = setup({ templateVersion: 1 })
        await expect(
            applyTableTemplateToMatrix(
                staleTemplate.ctx,
                staleTemplate.surface,
                templateId,
                interpretationNetworkTemplateApplyRequestSchema.parse(request)
            )
        ).rejects.toMatchObject({ code: 'INTERPRETATION_NETWORK_VERSION_CONFLICT' })
        expect(staleTemplate.committed).toEqual([])

        const staleTarget = setup()
        await expect(
            applyTableTemplateToMatrix(
                staleTarget.ctx,
                staleTarget.surface,
                templateId,
                interpretationNetworkTemplateApplyRequestSchema.parse({ ...request, expectedTargetVersion: 1 })
            )
        ).rejects.toMatchObject({ code: 'INTERPRETATION_NETWORK_VERSION_CONFLICT' })
        expect(staleTarget.committed).toEqual([])
    })

    it('rejects templates or target cells outside their workspace-scoped aggregate', async () => {
        const missingTemplate = setup({ templatePresent: false })
        await expect(
            applyTableTemplateToMatrix(
                missingTemplate.ctx,
                missingTemplate.surface,
                templateId,
                interpretationNetworkTemplateApplyRequestSchema.parse(request)
            )
        ).rejects.toMatchObject({ code: 'INTERPRETATION_NETWORK_TEMPLATE_NOT_FOUND' })

        const foreignTargetCell = setup({ targetRows: makeTargetRows().filter((row) => row.cell_id !== targetCellId) })
        await expect(
            applyTableTemplateToMatrix(
                foreignTargetCell.ctx,
                foreignTargetCell.surface,
                templateId,
                interpretationNetworkTemplateApplyRequestSchema.parse(request)
            )
        ).rejects.toMatchObject({ code: 'INTERPRETATION_NETWORK_ROW_NOT_FOUND' })
        expect(foreignTargetCell.committed).toEqual([])
    })

    it('validates configured row bounds and the complete resulting matrix before inserts', async () => {
        const bounded = setup({ maxRows: 3 })
        await expect(
            applyTableTemplateToMatrix(
                bounded.ctx,
                bounded.surface,
                templateId,
                interpretationNetworkTemplateApplyRequestSchema.parse(request)
            )
        ).rejects.toMatchObject({ code: 'INTERPRETATION_NETWORK_INVALID_MATRIX' })
        expect(bounded.committed).toEqual([])

        const malformed = setup({
            targetRows: makeTargetRows().map((row, index) => (index === 1 ? { ...row, parent_cell_id: id(999) } : row))
        })
        await expect(
            applyTableTemplateToMatrix(
                malformed.ctx,
                malformed.surface,
                templateId,
                interpretationNetworkTemplateApplyRequestSchema.parse(request)
            )
        ).rejects.toMatchObject({ code: 'INTERPRETATION_NETWORK_INVALID_CELL' })
        expect(malformed.committed).toEqual([])
    })
})
