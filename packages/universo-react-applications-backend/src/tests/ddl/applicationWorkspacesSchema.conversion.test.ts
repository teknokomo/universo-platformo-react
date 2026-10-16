import { ensureWorkspaceSupportTables } from '../../ddl/applicationWorkspacesSchema'
import { createMockDbExecutor } from '../utils/dbMocks'

const SCHEMA_NAME = 'app_018f8a787b8f7c1da111222233334440'

describe('applicationWorkspacesSchema conversion DDL', () => {
    it('adds the conversion marker column, hard-cap index, and two-kind audit constraint idempotently', async () => {
        const { executor } = createMockDbExecutor()

        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('SELECT EXISTS (') && sql.includes('information_schema.tables')) {
                return [{ exists: false }]
            }
            return []
        })

        await ensureWorkspaceSupportTables(executor, SCHEMA_NAME)

        const executedSql = executor.query.mock.calls.map(([sql]) => String(sql)).join('\n')

        expect(executedSql).toContain(`CREATE TABLE "${SCHEMA_NAME}"."_app_workspaces"`)
        expect(executedSql).toContain('ADD COLUMN IF NOT EXISTS converted_from_user_id UUID NULL')
        expect(executedSql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "_app_workspaces_converted_user_active_uidx"')
        expect(executedSql).toContain(`ON "${SCHEMA_NAME}"."_app_workspaces"(converted_from_user_id)`)
        expect(executedSql).toContain('WHERE converted_from_user_id IS NOT NULL AND _upl_deleted = false AND _app_deleted = false')
        expect(executedSql).toContain('DROP CONSTRAINT IF EXISTS "_app_workspace_operation_audit_kind_ck"')
        expect(executedSql).toContain(`CHECK (operation_kind IN ('seed_reset', 'personal_to_shared_conversion'))`)

        // The pre-existing personal-workspace arbiter stays untouched so the
        // never-converted majority keeps its duplicate protection.
        expect(executedSql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "_app_workspaces_personal_user_active_uidx"')
        expect(executedSql).toContain(`ON "${SCHEMA_NAME}"."_app_workspaces"(personal_user_id)`)
        expect(executedSql).toContain(`WHERE workspace_type = 'personal' AND _upl_deleted = false AND _app_deleted = false`)

        // Idempotent re-run: existing support tables skip CREATE TABLE; the
        // remaining ALTER/CREATE batches are IF NOT EXISTS / IF EXISTS safe.
        executor.query.mockClear()
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('SELECT EXISTS (') && sql.includes('information_schema.tables')) {
                return [{ exists: true }]
            }
            return []
        })
        await expect(ensureWorkspaceSupportTables(executor, SCHEMA_NAME)).resolves.toBeUndefined()
        const rerunSql = executor.query.mock.calls.map(([sql]) => String(sql)).join('\n')
        expect(rerunSql).not.toContain('CREATE TABLE')
        expect(rerunSql).toContain('ADD COLUMN IF NOT EXISTS converted_from_user_id UUID NULL')
        expect(rerunSql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "_app_workspaces_converted_user_active_uidx"')
    })
})
