import type { DbExecutor } from '@universo-react/utils'
import {
    findPublicInterpretationNetworkRuntimeRecord,
    listPublicInterpretationNetworkMatrixRows,
    listPublicInterpretationNetworkRuntimeRows
} from '../../persistence/publicInterpretationNetworkRuntimeStore'
import type { RuntimeSurfaceReady } from '../../shared/interpretationNetworkRuntimeContracts'
import { MAX_PUBLIC_BODY_BYTES } from '../../services/publicInterpretationNetwork/contracts'

const workspaceId = '019f2000-0000-7000-8000-000000000001'
const structureContract = {
    object: { id: '019f2000-0000-7000-8000-000000000002', codename: 'Structure', table_name: 'obj_structure' },
    fields: {},
    childFields: {}
}
const interpretationContract = {
    object: { id: '019f2000-0000-7000-8000-000000000003', codename: 'Interpretation', table_name: 'obj_interpretation' },
    fields: {},
    childFields: {},
    childTableName: 'obj_interpretation_matrix'
}
const surface = {
    schemaName: 'app_019f2000000070008000000000000001',
    workspaceId,
    contracts: { Structure: structureContract, Interpretation: interpretationContract }
} as RuntimeSurfaceReady

const captureExecutor = () => {
    const query = jest.fn().mockResolvedValue([])
    return { executor: { query } as unknown as DbExecutor, query }
}

const firstQuery = (query: jest.Mock): { sql: string; values: unknown[] } => {
    const [sql, values] = query.mock.calls[0] as unknown as [string, unknown[]]
    return { sql: String(sql), values }
}

describe('publicInterpretationNetworkRuntimeStore publication predicates', () => {
    it('requires published active entity rows in single-record projections', async () => {
        const { executor, query } = captureExecutor()

        await findPublicInterpretationNetworkRuntimeRecord(
            executor,
            surface,
            structureContract as RuntimeSurfaceReady['contracts']['Structure'],
            '019f2000-0000-7000-8000-000000000004',
            [{ field: 'name', alias: 'name' }]
        )

        const { sql, values } = firstQuery(query)
        expect(sql).toContain('FROM "app_019f2000000070008000000000000001"."obj_structure"')
        expect(sql).toContain('"_app_published" = true')
        expect(sql).toContain('"_upl_deleted" = false')
        expect(sql).toContain('"_app_deleted" = false')
        expect(values).toEqual(['019f2000-0000-7000-8000-000000000004', workspaceId])
    })

    it('filters unpublished rows before paging and keeps filter values parameterized', async () => {
        const { executor, query } = captureExecutor()
        const injectedValue = "draft' OR TRUE --"

        await listPublicInterpretationNetworkRuntimeRows({
            executor,
            surface,
            contract: structureContract as RuntimeSurfaceReady['contracts']['Structure'],
            columns: [{ field: 'name', alias: 'name' }],
            filters: [{ field: 'kind', operator: 'equals', value: injectedValue }],
            limit: 5,
            offset: 10
        })

        const { sql, values } = firstQuery(query)
        expect(sql).toContain('"_app_published" = true')
        expect(sql).toContain('LIMIT $3 OFFSET $4')
        expect(sql).not.toContain(injectedValue)
        expect(values).toEqual([injectedValue, workspaceId, 6, 10])
    })

    it('projects a bounded public Body and emits a size sentinel without returning oversized content', async () => {
        const secretBody = 'oversized-material-body-secret'.repeat(10_000)
        const { executor, query } = captureExecutor()
        query.mockResolvedValueOnce([{ id: 'material-id', body: null, bodyOversized: true }])

        const rows = await listPublicInterpretationNetworkRuntimeRows({
            executor,
            surface,
            contract: structureContract as RuntimeSurfaceReady['contracts']['Structure'],
            columns: [{ field: 'body', alias: 'body', maxBytes: MAX_PUBLIC_BODY_BYTES, oversizedAlias: 'bodyOversized' }],
            filters: [{ field: 'kind', operator: 'equals', value: 'material' }],
            limit: 1,
            offset: 0
        })

        const { sql, values } = firstQuery(query)
        expect(sql).toContain('CASE WHEN "body" IS NULL OR octet_length("body"::text) <= $1 THEN "body" ELSE NULL END AS "body"')
        expect(sql).toContain('("body" IS NOT NULL AND octet_length("body"::text) > $1) AS "bodyOversized"')
        expect(values).toEqual([MAX_PUBLIC_BODY_BYTES, 'material', workspaceId, 2, 0])
        expect(rows).toEqual([{ id: 'material-id', body: null, bodyOversized: true }])
        expect(rows[0]?.body).toBeNull()
        expect(JSON.stringify(rows)).not.toContain(secretBody)
    })

    it('requires published Matrix cells and a published active Interpretation parent', async () => {
        const { executor, query } = captureExecutor()

        await listPublicInterpretationNetworkMatrixRows({
            executor,
            surface,
            columns: [{ field: 'cell_value', alias: 'value' }],
            parentId: '019f2000-0000-7000-8000-000000000005',
            limit: 5,
            offset: 2,
            cellIdentity: 'cell-a',
            cellIdentityColumn: 'cell_id'
        })

        const { sql, values } = firstQuery(query)
        expect(sql).toContain('FROM "app_019f2000000070008000000000000001"."obj_interpretation_matrix" AS "cell"')
        expect(sql).toContain('INNER JOIN "app_019f2000000070008000000000000001"."obj_interpretation" AS "parent"')
        expect(sql).toContain('"cell"."_app_published" = true')
        expect(sql).toContain('"parent"."_app_published" = true')
        expect(sql).toContain('"cell"."_upl_deleted" = false')
        expect(sql).toContain('"parent"."_app_deleted" = false')
        expect(sql).toContain('LIMIT $5 OFFSET $6')
        expect(values).toEqual(['019f2000-0000-7000-8000-000000000005', workspaceId, workspaceId, 'cell-a', 6, 2])
    })
})
