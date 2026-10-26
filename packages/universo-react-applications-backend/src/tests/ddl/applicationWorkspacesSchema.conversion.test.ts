import { ensureWorkspaceSupportTables } from '../../ddl/applicationWorkspacesSchema'
import { createMockDbExecutor } from '../utils/dbMocks'

const SCHEMA_NAME = 'app_018f8a787b8f7c1da111222233334440'

describe('applicationWorkspacesSchema DDL', () => {
    it('creates the fresh workspace schema with target-aware setting columns and constraints', async () => {
        const { executor } = createMockDbExecutor()

        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('SELECT EXISTS (') && sql.includes('information_schema.tables')) {
                return [{ exists: false }]
            }
            if (sql.includes('FROM pg_constraint c')) return [{ exists: true }]
            return []
        })

        await ensureWorkspaceSupportTables(executor, SCHEMA_NAME)

        const executedSql = executor.query.mock.calls.map(([sql]) => String(sql)).join('\n')
        const createTableSql = (tableName: string) =>
            executor.query.mock.calls
                .map(([sql]) => String(sql))
                .find((sql) => sql.includes(`CREATE TABLE "${SCHEMA_NAME}"."${tableName}"`)) ?? ''

        expect(executedSql).toContain(`CREATE TABLE "${SCHEMA_NAME}"."_app_workspaces"`)
        expect(executedSql).toContain('converted_from_user_id UUID NULL')
        expect(executedSql).toContain('_app_workspaces_public_entry_ck')
        expect(createTableSql('_app_workspace_roles')).not.toContain('FOREIGN KEY')
        expect(createTableSql('_app_workspace_user_roles')).toContain('_app_workspace_user_roles_workspace_fk')
        expect(createTableSql('_app_workspace_user_roles')).toContain('_app_workspace_user_roles_role_fk')
        expect(createTableSql('_app_limits')).toContain('_app_limits_object_fk')
        expect(createTableSql('_app_workspace_settings')).toContain('_app_workspace_settings_workspace_fk')
        expect(createTableSql('_app_workspace_operation_audit')).toContain('_app_workspace_operation_audit_workspace_fk')
        expect(executedSql).toContain('target_kind TEXT NOT NULL')
        expect(executedSql).toContain('target_owner_id UUID NOT NULL')
        expect(executedSql).toContain('target_key TEXT NOT NULL')
        expect(executedSql).toContain(`CREATE UNIQUE INDEX IF NOT EXISTS "_app_workspace_settings_target_active_uidx"`)
        expect(executedSql).toContain(
            `ON "${SCHEMA_NAME}"."_app_workspace_settings"(workspace_id, target_kind, target_owner_id, target_key, key)`
        )
        expect(executedSql).toContain("target_kind = 'global' AND target_owner_id = workspace_id AND target_key = ''")
        expect(executedSql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "_app_workspaces_converted_user_active_uidx"')
        expect(executedSql).toContain(`ON "${SCHEMA_NAME}"."_app_workspaces"(converted_from_user_id)`)
        expect(executedSql).toContain('WHERE converted_from_user_id IS NOT NULL AND _upl_deleted = false AND _app_deleted = false')
        expect(executedSql).toContain(`CHECK (operation_kind IN ('seed_reset', 'personal_to_shared_conversion'))`)

        // The pre-existing personal-workspace arbiter stays untouched so the
        // never-converted majority keeps its duplicate protection.
        expect(executedSql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "_app_workspaces_personal_user_active_uidx"')
        expect(executedSql).toContain(`ON "${SCHEMA_NAME}"."_app_workspaces"(personal_user_id)`)
        expect(executedSql).toContain(`WHERE workspace_type = 'personal' AND _upl_deleted = false AND _app_deleted = false`)

        // Re-running against the fresh schema keeps its current table shape and
        // indexes without introducing a compatibility path for obsolete tables.
        executor.query.mockClear()
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('SELECT EXISTS (') && sql.includes('information_schema.tables')) {
                return [{ exists: true }]
            }
            if (sql.includes('FROM pg_constraint c')) return [{ exists: true }]
            return []
        })
        await expect(ensureWorkspaceSupportTables(executor, SCHEMA_NAME)).resolves.toBeUndefined()
        const rerunSql = executor.query.mock.calls.map(([sql]) => String(sql)).join('\n')
        expect(rerunSql).not.toContain('CREATE TABLE')
        expect(rerunSql).not.toContain('ADD COLUMN IF NOT EXISTS target_kind')
        expect(rerunSql).not.toContain('target_owner_id = COALESCE')
        expect(rerunSql).not.toContain('DROP INDEX')
        expect(rerunSql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "_app_workspace_settings_target_active_uidx"')
        expect(rerunSql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "_app_workspaces_converted_user_active_uidx"')
    })
})
