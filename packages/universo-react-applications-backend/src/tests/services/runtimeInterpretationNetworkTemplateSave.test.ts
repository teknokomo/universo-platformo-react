import { isUuidV7 } from '@universo-react/utils'
import { RuntimeModulesService } from '../../services/runtimeModulesService'
import {
    saveStructureAsTemplate,
    interpretationNetworkTemplateSaveRequestSchema
} from '../../services/interpretationNetwork/runtimeInterpretationNetworkService'
import {
    resolveTemplateMatrixRows,
    interpretationNetworkMatrixMembershipLockKey
} from '../../services/interpretationNetwork/runtimeInterpretationNetworkMatrixMembership'
import { createMockDbExecutor } from '../utils/dbMocks'
import { makeCtx, makeSurface, schemaName, workspaceId } from '../utils/interpretationNetworkTemplateFixtures'

const id = (suffix: number) => `019f2000-0000-7000-8000-${String(suffix).padStart(12, '0')}`
const structureId = id(201)
const interpretationId = id(202)
const root = id(301)
const branch = id(302)
const child = id(303)
const leaf = id(304)
const sibling = id(305)
const request = {
    sourceStructureId: structureId,
    templateName: 'Branch template',
    includeMaterials: false,
    expectedVersion: 2,
    scope: { kind: 'selectedBranch' as const, rootCellId: branch }
}
const makeRows = () => [
    { cell_id: root, parent_cell_id: null, cell_value: 'ancestor', material_ref: id(401) },
    { cell_id: branch, parent_cell_id: root, cell_value: 'selected', material_ref: id(402) },
    { cell_id: child, parent_cell_id: branch, cell_value: 'child', material_ref: id(403) },
    { cell_id: leaf, parent_cell_id: child, cell_value: 'leaf', material_ref: null },
    { cell_id: sibling, parent_cell_id: root, cell_value: 'sibling', material_ref: id(405) }
]

/** A transaction double with staged writes; no PostgreSQL concurrency proof is implied. */
const setup = () => {
    const { executor, txExecutor } = createMockDbExecutor()
    const surface = makeSurface('multiple')
    const ctx = makeCtx(executor)
    let rows: Array<Record<string, unknown>> = makeRows()
    let staged: Array<{ table: string; row: Record<string, unknown> }> = []
    const committed: typeof staged = []
    let failChildren = false
    let sourcePresent = true
    let version = 2
    executor.transaction.mockImplementation(async (run) => {
        staged = []
        try {
            const result = await run(txExecutor)
            committed.push(...staged)
            return result
        } finally {
            staged = []
        }
    })
    txExecutor.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
        if (sql.includes('pg_advisory_xact_lock')) return []
        if (sql.includes('INSERT INTO')) {
            const table = sql.match(/INSERT INTO "[^"]+"\."([^"]+)"/)?.[1] ?? ''
            if (table === 'table_template_rows' && failChildren) throw new Error('child insert failed')
            const columns = sql
                .slice(sql.indexOf('(') + 1, sql.indexOf(')'))
                .split(',')
                .map((value) => value.trim().replaceAll('"', ''))
            const result = []
            for (let offset = 0; offset < params.length; offset += columns.length) {
                const row = Object.fromEntries(columns.map((column, index) => [column, params[offset + index]]))
                staged.push({ table, row })
                result.push({ id: row.id })
            }
            return result
        }
        if (sql.includes(`FROM "${schemaName}"."structure"`)) {
            expect(params).toEqual([structureId, workspaceId])
            return sourcePresent ? [{ id: structureId, _upl_version: version }] : []
        }
        if (sql.includes(`FROM "${schemaName}"."interpretation"`)) return [{ id: interpretationId }]
        if (sql.includes(`FROM "${schemaName}"."interpretation_rows"`)) {
            expect(sql).toContain('FOR UPDATE')
            expect(params).toEqual([interpretationId, workspaceId])
            return rows.map((row) => ({ ...row }))
        }
        if (sql.includes(`FROM "${schemaName}"."material"`)) {
            const allowed = new Set((params[1] ?? []) as string[])
            return makeRows()
                .filter((row) => allowed.has(row.cell_id) && row.material_ref)
                .map((row) => ({
                    id: row.material_ref,
                    cell_id: row.cell_id,
                    interpretation_id: interpretationId,
                    title: row.cell_value,
                    body: { blocks: [] }
                }))
        }
        if (sql.includes(`FROM "${schemaName}"."table_template"`)) {
            return staged.filter((entry) => entry.table === 'table_template').map((entry) => entry.row)
        }
        return []
    })
    return {
        executor,
        txExecutor,
        ctx,
        surface,
        committed,
        setRows: (value: typeof rows) => {
            rows = value
        },
        failChildren: () => {
            failChildren = true
        },
        hideSource: () => {
            sourcePresent = false
        },
        setVersion: (value: number) => {
            version = value
        }
    }
}

describe('selected-branch template save', () => {
    let lifecycle: jest.SpyInstance
    beforeEach(() => {
        lifecycle = jest.spyOn(RuntimeModulesService.prototype, 'dispatchLifecycleEvent').mockResolvedValue([])
    })
    afterEach(() => {
        lifecycle.mockRestore()
    })

    it.each([
        {},
        { kind: 'unknown' },
        { kind: 'selectedBranch' },
        { kind: 'selectedBranch', rootCellId: '019f2000-0000-4000-8000-000000000302' },
        { kind: 'selectedBranch', rootCellId: branch, descendants: [child] },
        { kind: 'wholeStructure', rootCellId: branch }
    ])('rejects invalid or non-strict scope %j', (scope) => {
        expect(interpretationNetworkTemplateSaveRequestSchema.safeParse({ ...request, scope }).success).toBe(false)
    })

    it.each([{ kind: 'wholeStructure' }, request.scope])('accepts explicit scope %j and version/material inputs', (scope) => {
        const result = interpretationNetworkTemplateSaveRequestSchema.parse({ ...request, scope })
        expect(result).toMatchObject({ scope, includeMaterials: false, expectedVersion: 2 })
        expect(interpretationNetworkTemplateSaveRequestSchema.safeParse({ ...request, includeMaterials: undefined }).success).toBe(false)
        expect(interpretationNetworkTemplateSaveRequestSchema.safeParse({ ...request, expectedVersion: 0 }).success).toBe(false)
    })

    it.each([false, true])('copies only rebased branch and deep descendants, includeMaterials=%s', async (includeMaterials) => {
        const state = setup()
        const summary = await saveStructureAsTemplate(
            state.ctx,
            state.surface,
            interpretationNetworkTemplateSaveRequestSchema.parse({ ...request, includeMaterials })
        )
        const copied = state.committed.filter((entry) => entry.table === 'table_template_rows').map((entry) => entry.row)
        expect(copied.map((row) => row.cell_value)).toEqual(['selected', 'child', 'leaf'])
        expect(copied[0].parent_cell_id).toBeNull()
        expect(copied[1].parent_cell_id).toBe(copied[0].cell_id)
        expect(copied[2].parent_cell_id).toBe(copied[1].cell_id)
        expect(copied.every((row) => isUuidV7(row.id) && isUuidV7(row.cell_id))).toBe(true)
        expect(new Set(copied.flatMap((row) => [row.id, row.cell_id])).size).toBe(6)
        expect(copied.every((row) => !makeRows().some((source) => source.cell_id === row.cell_id))).toBe(true)
        const materials = state.committed.filter((entry) => entry.table === 'material').map((entry) => entry.row)
        expect(materials).toHaveLength(includeMaterials ? 2 : 0)
        if (includeMaterials) {
            expect(materials.map((row) => row.cell_id)).toEqual(copied.slice(0, 2).map((row) => row.cell_id))
            expect(copied.slice(0, 2).map((row) => row.material_ref)).toEqual(materials.map((row) => row.id))
            expect(materials.every((row) => row.template_owner_id === summary.id)).toBe(true)
            const materialRead = state.txExecutor.query.mock.calls.find(([sql]) => sql.includes(`FROM "${schemaName}"."material"`))
            expect(materialRead?.[1]).toEqual([[id(402), id(403)], [branch, child, leaf], interpretationId, workspaceId])
        } else {
            expect(copied.every((row) => row.material_ref === null)).toBe(true)
            expect(state.txExecutor.query.mock.calls.some(([sql]) => sql.includes(`FROM "${schemaName}"."material"`))).toBe(false)
        }
        expect(summary.includesMaterials).toBe(includeMaterials)
        const calls = state.txExecutor.query.mock.calls
        const membership = calls.findIndex(
            ([sql, params]) =>
                sql.includes('pg_advisory_xact_lock') &&
                params.includes(interpretationNetworkMatrixMembershipLockKey(state.surface, interpretationId))
        )
        const read = calls.findIndex(([sql]) => sql.includes(`FROM "${schemaName}"."interpretation_rows"`))
        expect(membership).toBeGreaterThan(-1)
        expect(membership).toBeLessThan(read)
    })

    it('keeps whole-Structure behavior explicit', async () => {
        const state = setup()
        await saveStructureAsTemplate(
            state.ctx,
            state.surface,
            interpretationNetworkTemplateSaveRequestSchema.parse({ ...request, scope: { kind: 'wholeStructure' } })
        )
        expect(state.committed.filter((entry) => entry.table === 'table_template_rows')).toHaveLength(5)
    })

    it('defaults an omitted scope to whole Structure for existing API callers', async () => {
        const legacyRequest: Record<string, unknown> = { ...request }
        delete legacyRequest.scope
        const parsedRequest = interpretationNetworkTemplateSaveRequestSchema.parse(legacyRequest)
        expect(parsedRequest.scope).toEqual({ kind: 'wholeStructure' })

        const state = setup()
        await saveStructureAsTemplate(state.ctx, state.surface, parsedRequest)
        expect(state.committed.filter((entry) => entry.table === 'table_template_rows')).toHaveLength(5)
    })

    it('copies every parentless row in independent-row mode', async () => {
        const state = setup()
        const rows = [
            { cell_id: id(311), parent_cell_id: null, cell_value: 'first', material_ref: null },
            { cell_id: id(312), parent_cell_id: null, cell_value: 'second', material_ref: null }
        ]
        state.setRows(rows)
        const surface = { ...state.surface, widgetConfig: { ...state.surface.widgetConfig, matrixMode: 'independentRows' } }

        await saveStructureAsTemplate(
            state.ctx,
            surface,
            interpretationNetworkTemplateSaveRequestSchema.parse({ ...request, scope: { kind: 'wholeStructure' } })
        )

        const copied = state.committed.filter((entry) => entry.table === 'table_template_rows').map((entry) => entry.row)
        expect(copied).toHaveLength(2)
        expect(copied.map((row) => row.cell_value)).toEqual(['first', 'second'])
        expect(copied.every((row) => row.parent_cell_id === null)).toBe(true)
        expect(copied.every((row) => isUuidV7(row.id) && isUuidV7(row.cell_id))).toBe(true)
    })

    it.each(['independentRows', 'invalid'])('rejects selected branch in mode %s without writes', async (matrixMode) => {
        const state = setup()
        await expect(
            saveStructureAsTemplate(
                state.ctx,
                { ...state.surface, widgetConfig: { matrixMode } },
                interpretationNetworkTemplateSaveRequestSchema.parse(request)
            )
        ).rejects.toMatchObject({ statusCode: 409, code: 'INTERPRETATION_NETWORK_UNSUPPORTED_STRUCTURE_MODE' })
        expect(state.committed).toEqual([])
    })

    it('rejects roots absent from the active source Structure/Workspace', async () => {
        const state = setup()
        await expect(
            saveStructureAsTemplate(
                state.ctx,
                state.surface,
                interpretationNetworkTemplateSaveRequestSchema.parse({ ...request, scope: { kind: 'selectedBranch', rootCellId: id(999) } })
            )
        ).rejects.toMatchObject({ statusCode: 404 })
        expect(state.committed).toEqual([])
    })

    it('rejects a source Structure outside the current Workspace', async () => {
        const state = setup()
        state.hideSource()
        await expect(
            saveStructureAsTemplate(state.ctx, state.surface, interpretationNetworkTemplateSaveRequestSchema.parse(request))
        ).rejects.toMatchObject({ statusCode: 404 })
        expect(state.committed).toEqual([])
    })

    it.each([
        [
            { cell_id: root, parent_cell_id: null },
            { cell_id: branch, parent_cell_id: id(999) }
        ],
        [
            { cell_id: root, parent_cell_id: null },
            { cell_id: branch, parent_cell_id: child },
            { cell_id: child, parent_cell_id: branch }
        ],
        [
            { cell_id: root, parent_cell_id: null },
            { cell_id: branch, parent_cell_id: null }
        ],
        [
            { cell_id: root, parent_cell_id: null },
            { cell_id: root, parent_cell_id: null }
        ],
        [{ cell_id: '', parent_cell_id: null }]
    ])('rejects damaged hierarchy before writing %j', async (...rows) => {
        const state = setup()
        state.setRows(rows)
        await expect(
            saveStructureAsTemplate(state.ctx, state.surface, interpretationNetworkTemplateSaveRequestSchema.parse(request))
        ).rejects.toMatchObject({ statusCode: 409, code: 'INTERPRETATION_NETWORK_INVALID_MATRIX' })
        expect(state.committed).toEqual([])
    })

    it('does not mutate the source snapshot while rebasing', () => {
        const state = setup()
        const rows = makeRows()
        const before = structuredClone(rows)
        const result = resolveTemplateMatrixRows(rows, state.surface.contracts.Interpretation, request.scope, 'hierarchicalCells')
        expect(result[0].parent_cell_id).toBeNull()
        expect(rows).toEqual(before)
    })

    it('rolls back template and material writes when the child insert fails', async () => {
        const state = setup()
        state.failChildren()
        await expect(
            saveStructureAsTemplate(
                state.ctx,
                state.surface,
                interpretationNetworkTemplateSaveRequestSchema.parse({ ...request, includeMaterials: true })
            )
        ).rejects.toThrow('child insert failed')
        expect(state.committed).toEqual([])
        expect(lifecycle.mock.calls.some(([event]) => event.payload.eventName === 'afterCreate')).toBe(false)
    })

    it('rejects stale source versions before snapshot or writes', async () => {
        const state = setup()
        state.setVersion(3)
        await expect(
            saveStructureAsTemplate(state.ctx, state.surface, interpretationNetworkTemplateSaveRequestSchema.parse(request))
        ).rejects.toMatchObject({ statusCode: 409, code: 'INTERPRETATION_NETWORK_VERSION_CONFLICT' })
        expect(state.committed).toEqual([])
        expect(state.txExecutor.query.mock.calls.some(([sql]) => sql.includes('interpretation_rows'))).toBe(false)
    })

    it.each(['create', 'delete', 'move', 'reparent'])(
        'waits for a competing %s membership change before reading the snapshot',
        async (change) => {
            const state = setup()
            const query = state.txExecutor.query.getMockImplementation()!
            const key = interpretationNetworkMatrixMembershipLockKey(state.surface, interpretationId)
            let release!: () => void
            let entered!: () => void
            const blocked = new Promise<void>((resolve) => {
                release = resolve
            })
            const reachedLock = new Promise<void>((resolve) => {
                entered = resolve
            })
            state.txExecutor.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
                if (sql.includes('pg_advisory_xact_lock') && params.includes(key)) {
                    entered()
                    await blocked
                }
                return query(sql, params)
            })
            const saving = saveStructureAsTemplate(state.ctx, state.surface, interpretationNetworkTemplateSaveRequestSchema.parse(request))
            await reachedLock
            expect(state.txExecutor.query.mock.calls.some(([sql]) => sql.includes('interpretation_rows'))).toBe(false)
            const next = makeRows()
            if (change === 'create') {
                next.push({ cell_id: id(306), parent_cell_id: child, cell_value: 'new child', material_ref: null })
            } else if (change === 'delete') {
                next.splice(3, 1)
            } else if (change === 'move') {
                next[2] = { ...next[2], parent_cell_id: sibling }
            } else {
                next[4] = { ...next[4], parent_cell_id: branch }
            }
            state.setRows(next)
            release()
            await saving
            const copied = state.committed.filter((entry) => entry.table === 'table_template_rows').map((entry) => entry.row.cell_value)
            expect(copied).toEqual(
                {
                    create: ['selected', 'child', 'leaf', 'new child'],
                    delete: ['selected', 'child'],
                    move: ['selected'],
                    reparent: ['selected', 'child', 'leaf', 'sibling']
                }[change]
            )
        }
    )

    it('partitions membership locks by schema, Workspace and Interpretation, independent of widget', () => {
        const state = setup()
        const key = interpretationNetworkMatrixMembershipLockKey(state.surface, interpretationId)
        expect(interpretationNetworkMatrixMembershipLockKey({ ...state.surface, widgetId: 'another' }, interpretationId)).toBe(key)
        expect(interpretationNetworkMatrixMembershipLockKey({ ...state.surface, workspaceId: id(99) }, interpretationId)).not.toBe(key)
        expect(interpretationNetworkMatrixMembershipLockKey({ ...state.surface, schemaName: 'app_other' }, interpretationId)).not.toBe(key)
        expect(interpretationNetworkMatrixMembershipLockKey(state.surface, id(99))).not.toBe(key)
    })
})
