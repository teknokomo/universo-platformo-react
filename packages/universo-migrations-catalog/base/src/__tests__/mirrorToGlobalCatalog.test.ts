import { mirrorToGlobalCatalog } from '../mirrorToGlobalCatalog'
import { recordAppliedMigrationRun } from '../PlatformMigrationCatalog'

jest.mock('../PlatformMigrationCatalog', () => ({
    recordAppliedMigrationRun: jest.fn(async () => '01960000-0000-7000-8000-000000000001')
}))

const mockRecordAppliedMigrationRun = recordAppliedMigrationRun as jest.MockedFunction<typeof recordAppliedMigrationRun>

const mockKnex = {} as never

describe('mirrorToGlobalCatalog', () => {
    beforeEach(() => {
        mockRecordAppliedMigrationRun.mockClear()
    })

    it('delegates to recordAppliedMigrationRun and returns the global run id', async () => {
        const runId = await mirrorToGlobalCatalog({
            knex: mockKnex,
            scopeKind: 'metahub_sync',
            scopeKey: 'mhb_abc',
            sourceKind: 'system_sync',
            migrationName: 'MetahubStructure_v2',
            migrationVersion: '2',
            localHistoryTable: '_mhb_migrations',
            summary: 'Structure migration v1→v2'
        })

        expect(runId).toBe('01960000-0000-7000-8000-000000000001')
        expect(mockRecordAppliedMigrationRun).toHaveBeenCalledTimes(1)
    })

    it('returns null and skips catalog writes when the global catalog is disabled', async () => {
        const runId = await mirrorToGlobalCatalog({
            knex: mockKnex,
            scopeKind: 'metahub_sync',
            scopeKey: 'mhb_abc',
            sourceKind: 'system_sync',
            migrationName: 'MetahubStructure_v2',
            migrationVersion: '2',
            localHistoryTable: '_mhb_migrations',
            globalCatalogEnabled: false
        })

        expect(runId).toBeNull()
        expect(mockRecordAppliedMigrationRun).not.toHaveBeenCalled()
    })

    it('merges localHistoryTable into meta', async () => {
        await mirrorToGlobalCatalog({
            knex: mockKnex,
            scopeKind: 'application_sync',
            scopeKey: 'app_xyz',
            sourceKind: 'system_sync',
            migrationName: 'AppSync_001',
            migrationVersion: '1',
            localHistoryTable: '_app_migrations',
            meta: { schemaName: 'app_xyz', extra: true }
        })

        const call = mockRecordAppliedMigrationRun.mock.calls[0]![0]
        expect(call.meta).toEqual({
            localHistoryTable: '_app_migrations',
            schemaName: 'app_xyz',
            extra: true
        })
    })

    it('applies default transactionMode and lockMode when not specified', async () => {
        await mirrorToGlobalCatalog({
            knex: mockKnex,
            scopeKind: 'metahub_sync',
            scopeKey: 'mhb_abc',
            sourceKind: 'template_seed',
            migrationName: 'TemplateSeed_default',
            migrationVersion: '1',
            localHistoryTable: '_mhb_migrations'
        })

        const call = mockRecordAppliedMigrationRun.mock.calls[0]![0]
        expect(call.transactionMode).toBe('single')
        expect(call.lockMode).toBe('session_advisory')
    })

    it('passes through snapshot and plan fields', async () => {
        const snapshotBefore = { tables: ['t1'] }
        const snapshotAfter = { tables: ['t1', 't2'] }
        const plan = { steps: ['add_column'] }

        await mirrorToGlobalCatalog({
            knex: mockKnex,
            scopeKind: 'metahub_sync',
            scopeKey: 'mhb_abc',
            sourceKind: 'system_sync',
            migrationName: 'Mig_002',
            migrationVersion: '2',
            localHistoryTable: '_mhb_migrations',
            snapshotBefore,
            snapshotAfter,
            plan
        })

        const call = mockRecordAppliedMigrationRun.mock.calls[0]![0]
        expect(call.snapshotBefore).toEqual(snapshotBefore)
        expect(call.snapshotAfter).toEqual(snapshotAfter)
        expect(call.plan).toEqual(plan)
    })

    it('sets null for optional fields when omitted', async () => {
        await mirrorToGlobalCatalog({
            knex: mockKnex,
            scopeKind: 'metahub_sync',
            scopeKey: 'mhb_abc',
            sourceKind: 'system_sync',
            migrationName: 'Mig_minimal',
            migrationVersion: '1',
            localHistoryTable: '_mhb_migrations'
        })

        const call = mockRecordAppliedMigrationRun.mock.calls[0]![0]
        expect(call.snapshotBefore).toBeNull()
        expect(call.snapshotAfter).toBeNull()
        expect(call.plan).toBeNull()
    })
})
