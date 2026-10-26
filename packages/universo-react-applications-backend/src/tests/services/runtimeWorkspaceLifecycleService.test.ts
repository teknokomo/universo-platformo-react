import { createSharedWorkspace } from '../../services/runtimeWorkspaceLifecycleService'
import { RUNTIME_WORKSPACE_ERROR_CODES, RuntimeWorkspaceError } from '../../services/runtimeWorkspaceContracts'
import { createMockDbExecutor } from '../utils/dbMocks'

const SCHEMA_NAME = 'app_018f8a787b8f7c1da111222233334490'
const APPLICATION_ID = '018f8a78-7b8f-7c1d-a111-222233334491'
const USER_ID = '018f8a78-7b8f-7c1d-a111-222233334492'
const WORKSPACE_ID = '018f8a78-7b8f-7c1d-a111-222233334493'
const OWNER_ROLE_ID = '018f8a78-7b8f-7c1d-a111-222233334494'
const MEMBERSHIP_ID = '018f8a78-7b8f-7c1d-a111-222233334495'

describe('runtime workspace lifecycle', () => {
    it('serializes shared-workspace creation and validates the creator before inserting or assigning ownership', async () => {
        const { executor } = createMockDbExecutor()
        let uuidCalls = 0
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM "applications"."rel_application_users"')) return [{ user_id: USER_ID }]
            if (sql.includes('SELECT public.uuid_generate_v7() AS id')) {
                uuidCalls += 1
                return [{ id: uuidCalls === 1 ? WORKSPACE_ID : MEMBERSHIP_ID }]
            }
            if (sql.includes(`FROM "${SCHEMA_NAME}"."_app_workspace_roles"`)) return [{ id: OWNER_ROLE_ID }]
            if (sql.includes('WITH activeMembers')) return [{ inserted: 0 }]
            return []
        })

        await expect(
            createSharedWorkspace(executor, {
                schemaName: SCHEMA_NAME,
                applicationId: APPLICATION_ID,
                name: { en: 'Shared workspace' },
                description: null,
                userId: USER_ID,
                seedElements: false
            })
        ).resolves.toEqual({ id: WORKSPACE_ID })

        const statements = executor.query.mock.calls.map(([sql]) => String(sql))
        const lockCalls = executor.query.mock.calls.filter(([sql]) => String(sql).includes('pg_advisory_xact_lock'))
        const baselineLockIndex = statements.findIndex((sql) => sql.includes('pg_advisory_xact_lock'))
        const defaultMembershipLockIndex = statements.findIndex(
            (sql, index) => index > baselineLockIndex && sql.includes('pg_advisory_xact_lock')
        )
        const creatorMembershipIndex = statements.findIndex((sql) => sql.includes('FROM "applications"."rel_application_users"'))
        const workspaceInsertIndex = statements.findIndex((sql) => sql.includes(`INSERT INTO "${SCHEMA_NAME}"."_app_workspaces"`))
        expect(baselineLockIndex).toBeGreaterThanOrEqual(0)
        expect(lockCalls).toHaveLength(2)
        expect(lockCalls[0]?.[1]).toEqual([`workspace-baseline:${SCHEMA_NAME}:${APPLICATION_ID}`])
        expect(lockCalls[1]?.[1]).toEqual([`personal-workspace:${SCHEMA_NAME}:${USER_ID}`])
        expect(creatorMembershipIndex).toBeGreaterThan(defaultMembershipLockIndex)
        expect(statements[creatorMembershipIndex]).toContain('FOR SHARE')
        expect(statements[creatorMembershipIndex]).toContain('_upl_deleted = false AND _app_deleted = false')
        expect(workspaceInsertIndex).toBeGreaterThan(creatorMembershipIndex)
    })

    it('fails closed when the creator is no longer an active application member', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValue([])

        await expect(
            createSharedWorkspace(executor, {
                schemaName: SCHEMA_NAME,
                applicationId: APPLICATION_ID,
                name: { en: 'Shared workspace' },
                description: null,
                userId: USER_ID,
                seedElements: false
            })
        ).rejects.toMatchObject<Partial<RuntimeWorkspaceError>>({
            code: RUNTIME_WORKSPACE_ERROR_CODES.userNotMember
        })

        const statements = executor.query.mock.calls.map(([sql]) => String(sql))
        expect(statements.some((sql) => sql.includes('pg_advisory_xact_lock'))).toBe(true)
        expect(statements.some((sql) => sql.includes(`INSERT INTO "${SCHEMA_NAME}"."_app_workspaces"`))).toBe(false)
        expect(statements.some((sql) => sql.includes('SELECT public.uuid_generate_v7() AS id'))).toBe(false)
    })
})
