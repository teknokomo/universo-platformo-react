import { resolveApplicationLifecycleContractFromConfig } from '@universo-react/utils'
import { loadRuntimeReadRows } from '../../controllers/runtimeRowReadHandlers/dataLoaders'
import type { RuntimeReadQuery } from '../../controllers/runtimeRowReadHandlers/types'
import { runtimeQuerySchema } from '../../services/runtimeRowSupport/contracts'
import type { RuntimeSchemaContext } from '../../shared/runtimeHelpers'
import { createMockDbExecutor } from '../utils/dbMocks'

type TrashRow = {
    id: string
    deletedBy: string
    workspaceId: string
}

const objectConfig: Record<string, unknown> = {}
const actorOne = '019f2000-0000-7000-8000-000000000201'
const actorTwo = '019f2000-0000-7000-8000-000000000202'
const workspaceOne = '019f2000-0000-7000-8000-000000000301'
const workspaceTwo = '019f2000-0000-7000-8000-000000000302'

const createHarness = (params: { actorId: string; workspaceId: string; rows: TrashRow[]; config?: Record<string, unknown> }) => {
    const { executor } = createMockDbExecutor()
    executor.query.mockImplementation(async (sql: string, values: unknown[] = []) => {
        const ownerMatch = sql.match(/"_upl_deleted_by"\s*=\s*\$(\d+)/)
        const actorFilter = ownerMatch ? values[Number(ownerMatch[1]) - 1] : undefined
        const workspaceScoped = sql.includes("workspace_id = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid")
        const accessDenied = /\bFALSE\b/.test(sql)
        const matchingRows = params.rows.filter((row) => {
            if (accessDenied) return false
            if (ownerMatch && row.deletedBy !== actorFilter) return false
            if (workspaceScoped && row.workspaceId !== params.workspaceId) return false
            return true
        })

        if (sql.includes('SELECT COUNT(*)::int AS total')) {
            return [{ total: matchingRows.length }]
        }

        return matchingRows.map((row) => ({ id: row.id, _upl_version: 1 }))
    })

    const config = params.config ?? objectConfig
    const runtimeContext = {
        manager: executor,
        userId: params.actorId,
        currentWorkspaceId: params.workspaceId,
        permissions: {
            manageMembers: false,
            manageApplication: false,
            createContent: true,
            editContent: true,
            deleteContent: true,
            readReports: true
        }
    } as unknown as RuntimeSchemaContext

    const load = (lifecycleState: RuntimeReadQuery['lifecycleState'] = 'deleted') =>
        loadRuntimeReadRows({
            manager: executor,
            schemaIdent: '"app_trash_test"',
            runtimeContext,
            activeObjectCollection: {
                id: '019f2000-0000-7000-8000-000000000401',
                kind: 'object',
                codename: 'orders',
                table_name: 'orders',
                config,
                lifecycleContract: resolveApplicationLifecycleContractFromConfig(config)
            },
            physicalComponents: [],
            safeComponents: [],
            tableAttrs: [],
            activeRecordBehaviorEnabled: false,
            includeRuntimeRowVersion: false,
            reorderFieldAttr: null,
            activeObjectCollectionRuntimeConfig: {} as never,
            query: runtimeQuerySchema.parse({ lifecycleState }),
            requestedLocale: 'en'
        })

    return { executor, load }
}

const deletedRows: TrashRow[] = [
    { id: '019f2000-0000-7000-8000-000000000501', deletedBy: actorOne, workspaceId: workspaceOne },
    { id: '019f2000-0000-7000-8000-000000000502', deletedBy: actorTwo, workspaceId: workspaceOne },
    { id: '019f2000-0000-7000-8000-000000000503', deletedBy: actorOne, workspaceId: workspaceTwo }
]

describe('loadRuntimeReadRows Trash isolation', () => {
    it('lists only the authenticated actor’s deleted rows within the current workspace', async () => {
        const actorOneHarness = createHarness({ actorId: actorOne, workspaceId: workspaceOne, rows: deletedRows })
        const actorTwoHarness = createHarness({ actorId: actorTwo, workspaceId: workspaceOne, rows: deletedRows })

        const [actorOneResult, actorTwoResult] = await Promise.all([actorOneHarness.load(), actorTwoHarness.load()])

        expect('failure' in actorOneResult ? actorOneResult.failure : actorOneResult.rows.map((row) => row.id)).toEqual([
            '019f2000-0000-7000-8000-000000000501'
        ])
        expect('failure' in actorTwoResult ? actorTwoResult.failure : actorTwoResult.rows.map((row) => row.id)).toEqual([
            '019f2000-0000-7000-8000-000000000502'
        ])

        for (const harness of [actorOneHarness, actorTwoHarness]) {
            const listQuery = harness.executor.query.mock.calls.find(([sql]) => String(sql).includes('SELECT id, "_upl_version"'))
            expect(listQuery).toBeDefined()
            expect(String(listQuery?.[0])).toContain('"_upl_deleted_by" = $1')
            expect(String(listQuery?.[0])).not.toContain('"_app_deleted_by"')
            expect(String(listQuery?.[0])).toContain("workspace_id = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid")
            expect(listQuery?.[1]).toEqual([harness === actorOneHarness ? actorOne : actorTwo, 100, 0])
        }
    })

    it('denies a deleted row from another workspace while retaining the workspace predicate', async () => {
        const harness = createHarness({ actorId: actorOne, workspaceId: workspaceOne, rows: [deletedRows[2]] })

        const result = await harness.load()

        expect(result).toEqual({ total: 0, rows: [] })
        const listQuery = harness.executor.query.mock.calls.find(([sql]) => String(sql).includes('SELECT id, "_upl_version"'))
        expect(String(listQuery?.[0])).toContain("workspace_id = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid")
        expect(listQuery?.[1]).toEqual([actorOne, 100, 0])
    })

    it('fails closed without actor identity or platform deletion-owner tracking', async () => {
        const noActorHarness = createHarness({ actorId: '', workspaceId: workspaceOne, rows: deletedRows })
        const noActorResult = await noActorHarness.load()
        expect(noActorResult).toEqual({
            failure: {
                statusCode: 401,
                body: {
                    error: 'Authenticated actor is required to view deleted runtime rows',
                    code: 'RUNTIME_TRASH_ACTOR_REQUIRED'
                }
            }
        })
        expect(noActorHarness.executor.query).not.toHaveBeenCalled()

        const trackingDisabledHarness = createHarness({
            actorId: actorOne,
            workspaceId: workspaceOne,
            rows: deletedRows,
            config: {
                systemFields: {
                    fields: [{ key: 'upl.deleted_by', enabled: false }]
                }
            }
        })
        const trackingDisabledResult = await trackingDisabledHarness.load()
        expect(trackingDisabledResult).toEqual({
            failure: {
                statusCode: 409,
                body: {
                    error: 'Platform deletion owner tracking is required to view deleted runtime rows',
                    code: 'RUNTIME_TRASH_OWNER_TRACKING_REQUIRED'
                }
            }
        })
        expect(trackingDisabledHarness.executor.query).not.toHaveBeenCalled()
    })

    it('keeps the existing record-access predicate alongside actor and workspace scoping', async () => {
        const harness = createHarness({
            actorId: actorOne,
            workspaceId: workspaceOne,
            rows: deletedRows,
            config: { runtimeRecordAccess: false }
        })

        const result = await harness.load()

        expect(result).toEqual({ total: 0, rows: [] })
        const countQuery = harness.executor.query.mock.calls.find(([sql]) => String(sql).includes('SELECT COUNT(*)::int AS total'))
        expect(String(countQuery?.[0])).toContain('FALSE')
        expect(String(countQuery?.[0])).toContain('"_upl_deleted_by" = $1')
        expect(String(countQuery?.[0])).toContain("workspace_id = NULLIF(current_setting('app.current_workspace_id', true), '')::uuid")
    })
})
