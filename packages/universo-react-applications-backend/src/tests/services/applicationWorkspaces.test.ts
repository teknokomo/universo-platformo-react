import { generateChildTableName } from '@universo-react/schema-ddl'
import {
    ensureApplicationRuntimeWorkspaceSchema,
    ensurePersonalWorkspaceForUser,
    ensureSharedWorkspaceBaselineMembership,
    removeSharedWorkspaceBaselineMembership,
    resetWorkspaceSeededElements,
    resolveRuntimeWorkspaceAccess
} from '../../services/applicationWorkspaces'
import { assertUserIsNotLastSharedWorkspaceOwner } from '../../services/runtimeWorkspaceService'
import { lockActiveRuntimeWorkspaceContext } from '../../services/runtimeWorkspaceContext'
import { createMockDbExecutor } from '../utils/dbMocks'

describe('applicationWorkspaces access and schema behavior', () => {
    it('locks an active personal workspace for authenticated scoped reports', async () => {
        const { executor } = createMockDbExecutor()
        const schemaName = 'app_018f8a787b8f7c1da111222233334480'
        const workspaceId = '018f8a78-7b8f-7c1d-a111-222233334481'
        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) return [{ id: workspaceId }]
            return []
        })

        await expect(lockActiveRuntimeWorkspaceContext(executor, schemaName, workspaceId)).resolves.toBe(true)

        const [lookupSql, lookupParams] = executor.query.mock.calls[0]
        expect(String(lookupSql)).toContain("COALESCE(status, 'active') = 'active'")
        expect(String(lookupSql)).toContain('FOR SHARE')
        expect(String(lookupSql)).not.toContain("workspace_type <> 'personal'")
        expect(lookupParams).toEqual([workspaceId])
        expect(executor.query.mock.calls[1][0]).toContain("set_config('app.current_workspace_id'")
        expect(executor.query.mock.calls[1][1]).toEqual([workspaceId])
    })

    it('does not bind an inactive or missing workspace context', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValue([])

        await expect(
            lockActiveRuntimeWorkspaceContext(executor, 'app_018f8a787b8f7c1da111222233334480', '018f8a78-7b8f-7c1d-a111-222233334481')
        ).resolves.toBe(false)
        expect(executor.query).toHaveBeenCalledTimes(1)
    })

    it('keeps read-only Entity tables and their TABLE children untouched during an owner seed reset', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const schemaName = 'app_018f8a787b8f7c1da111222233334480'
        const workspaceId = '018f8a78-7b8f-7c1d-a111-222233334481'
        const entityId = '018f8a78-7b8f-7c1d-a111-222233334482'
        const tableComponentId = '018f8a78-7b8f-7c1d-a111-222233334483'
        const childTableName = generateChildTableName(tableComponentId)
        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes(`INSERT INTO "${schemaName}"."_app_workspace_operation_audit"`)) {
                return [{ id: '018f8a78-7b8f-7c1d-a111-222233334484' }]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) return [{ id: workspaceId }]
            if (sql.includes('FROM information_schema.columns c')) return [{ tableName: 'obj_records', objectId: entityId }]
            if (sql.includes('SELECT DISTINCT c.id AS "componentId"')) return [{ componentId: tableComponentId }]
            if (sql.includes('FROM information_schema.tables')) return [{ tableName: 'obj_records' }, { tableName: childTableName }]
            if (sql.includes('SELECT id AS "entityId"') && sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                return [
                    {
                        entityId,
                        tableName: 'obj_records',
                        config: {
                            recordPolicy: {
                                version: 1,
                                denyDeleteWhenBound: false,
                                immutableSemanticKeyWhenBound: false,
                                runtimeMutation: 'deny'
                            }
                        }
                    }
                ]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_settings"`)) return [{ value: { version: 1, elements: {} } }]
            if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                return [{ objectId: entityId, codename: 'MarketingPageHero', tableName: 'obj_records' }]
            }
            if (sql.includes('SELECT id AS "componentId"') && sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                return [
                    {
                        objectId: entityId,
                        componentId: tableComponentId,
                        parentComponentId: null,
                        codename: 'Children',
                        columnName: 'children',
                        dataType: 'TABLE',
                        uiConfig: null,
                        validationRules: null,
                        targetObjectId: null,
                        targetObjectKind: null
                    }
                ]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                return [
                    {
                        objectId: entityId,
                        componentId: tableComponentId,
                        parentComponentId: null,
                        codename: 'Children',
                        columnName: 'children',
                        dataType: 'TABLE',
                        uiConfig: null,
                        validationRules: null,
                        targetObjectId: null,
                        targetObjectKind: null
                    }
                ]
            }
            return []
        })

        await expect(
            resetWorkspaceSeededElements(executor, {
                schemaName,
                workspaceId,
                actorUserId: '018f8a78-7b8f-7c1d-a111-222233334485',
                currentUserId: '018f8a78-7b8f-7c1d-a111-222233334485'
            })
        ).resolves.toEqual({ resetRows: 0, operationId: '018f8a78-7b8f-7c1d-a111-222233334484' })

        const attemptedSql = txExecutor.query.mock.calls.map(([sql]) => String(sql)).join('\n')
        expect(attemptedSql).toContain('_app_workspace_operation_audit')
        expect(attemptedSql).toContain('FOR SHARE')
        expect(attemptedSql).toContain("AND jsonb_exists(config, 'recordPolicy')")
        expect(attemptedSql).not.toMatch(
            new RegExp(`\\b(?:UPDATE|INSERT INTO|FROM)\\s+"${schemaName}"\\."(?:obj_records|${childTableName})"`, 'i')
        )
    })

    it('can resolve runtime workspace access without creating personal workspace rows', async () => {
        const { executor } = createMockDbExecutor()
        const schemaName = 'app_018f8a787b8f7c1da111222233334480'

        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM information_schema.tables')) {
                return [{ exists: true }]
            }
            if (sql.includes(`"${schemaName}"."_app_workspace_user_roles"`)) {
                return [{ workspaceId: '018f8a78-7b8f-7c1d-a111-222233334481', isDefaultWorkspace: true }]
            }
            return []
        })

        await expect(
            resolveRuntimeWorkspaceAccess(executor, {
                schemaName,
                workspacesEnabled: true,
                userId: '018f8a78-7b8f-7c1d-a111-222233334482',
                actorUserId: '018f8a78-7b8f-7c1d-a111-222233334482',
                ensurePersonalWorkspace: false
            })
        ).resolves.toEqual({
            membershipState: 'joined',
            defaultWorkspaceId: '018f8a78-7b8f-7c1d-a111-222233334481',
            allowedWorkspaceIds: ['018f8a78-7b8f-7c1d-a111-222233334481']
        })

        const executedSql = executor.query.mock.calls.map(([sql]) => String(sql)).join('\n')
        expect(executedSql).not.toContain(`INSERT INTO "${schemaName}"."_app_workspaces"`)
        expect(executedSql).not.toContain(`INSERT INTO "${schemaName}"."_app_workspace_user_roles"`)
    })

    it('includes only non-personal active workspaces for an application administrator without membership', async () => {
        const { executor } = createMockDbExecutor()
        const schemaName = 'app_018f8a787b8f7c1da111222233334480'
        const sharedWorkspaceId = '018f8a78-7b8f-7c1d-a111-222233334483'

        executor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('FROM information_schema.tables')) {
                return [{ exists: true }]
            }
            if (sql.includes(`"${schemaName}"."_app_workspace_user_roles"`)) {
                // The isolation-safe lookup only returns workspaces the admin
                // explicitly holds or unassigned shared ones; another user's
                // personal workspace must never appear in the allowed list.
                return [{ workspaceId: sharedWorkspaceId, isDefaultWorkspace: false }]
            }
            return []
        })

        await expect(
            resolveRuntimeWorkspaceAccess(executor, {
                schemaName,
                workspacesEnabled: true,
                userId: '018f8a78-7b8f-7c1d-a111-222233334482',
                ensurePersonalWorkspace: false,
                allowUnassigned: true
            })
        ).resolves.toEqual({
            membershipState: 'joined',
            defaultWorkspaceId: sharedWorkspaceId,
            allowedWorkspaceIds: [sharedWorkspaceId]
        })

        const accessQuery = executor.query.mock.calls.find(([sql]) => String(sql).includes("COALESCE(w.status, 'active')"))
        expect(accessQuery?.[1]).toEqual(['018f8a78-7b8f-7c1d-a111-222233334482', true])
        expect(String(accessQuery?.[0])).toContain(`($2::boolean = true AND w.workspace_type <> 'personal' AND w.personal_user_id IS NULL)`)
    })

    it('still lists explicit membership rows regardless of the allowUnassigned shared-only filter', async () => {
        const { executor } = createMockDbExecutor()
        const schemaName = 'app_018f8a787b8f7c1da111222233334480'
        const invitedPersonalWorkspaceId = '018f8a78-7b8f-7c1d-a111-222233334484'
        const sharedWorkspaceId = '018f8a78-7b8f-7c1d-a111-222233334483'

        executor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('FROM information_schema.tables')) {
                return [{ exists: true }]
            }
            if (sql.includes(`"${schemaName}"."_app_workspace_user_roles"`)) {
                // Membership-held rows remain visible even without the bypass.
                // The admin here explicitly holds two rows: an invitation into
                // a personal workspace and a shared workspace row.
                return [
                    { workspaceId: invitedPersonalWorkspaceId, isDefaultWorkspace: false },
                    { workspaceId: sharedWorkspaceId, isDefaultWorkspace: true }
                ]
            }
            return []
        })

        await expect(
            resolveRuntimeWorkspaceAccess(executor, {
                schemaName,
                workspacesEnabled: true,
                userId: '018f8a78-7b8f-7c1d-a111-222233334482',
                ensurePersonalWorkspace: false,
                allowUnassigned: true
            })
        ).resolves.toEqual({
            membershipState: 'joined',
            defaultWorkspaceId: sharedWorkspaceId,
            allowedWorkspaceIds: [invitedPersonalWorkspaceId, sharedWorkspaceId]
        })
    })

    it('adds workspace foreign keys and scoped policies to runtime object tables', async () => {
        const { executor } = createMockDbExecutor()
        let generatedIdCounter = 0
        const schemaName = 'app_018f8a787b8f7c1da111222233334440'

        executor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('SELECT public.uuid_generate_v7() AS id')) {
                generatedIdCounter += 1
                return [{ id: `018f8a78-7b8f-7c1d-a111-22223333444${generatedIdCounter}` }]
            }

            if (sql.includes(`INSERT INTO "${schemaName}"."_app_workspace_roles"`)) {
                return [{ id: params?.[0] }]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_workspace_roles"`)) {
                return []
            }

            if (sql.includes('FROM applications.rel_application_users')) {
                return []
            }

            if (sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                return []
            }

            if (sql.includes(`FROM "${schemaName}"."_app_workspace_user_roles"`)) {
                return []
            }

            return []
        })

        await ensureApplicationRuntimeWorkspaceSchema(executor, {
            schemaName,
            applicationId: '018f8a78-7b8f-7c1d-a111-222233334440',
            actorUserId: '018f8a78-7b8f-7c1d-a111-222233334441',
            entities: [
                {
                    id: '018f8a78-7b8f-7c1d-a111-222233334442',
                    codename: 'orders',
                    kind: 'object',
                    fields: [
                        {
                            id: '018f8a78-7b8f-7c1d-a111-222233334443',
                            codename: 'items',
                            dataType: 'TABLE'
                        }
                    ]
                } as never,
                {
                    id: '018f8a78-7b8f-7c1d-a111-222233334460',
                    codename: 'progressledger',
                    kind: 'ledger',
                    physicalTablePrefix: 'led',
                    capabilities: {
                        dataSchema: {
                            enabled: true
                        },
                        physicalTable: {
                            enabled: true
                        },
                        ledgerSchema: {
                            enabled: true
                        }
                    },
                    config: {
                        ledger: {
                            idempotency: { keyFields: ['source_object_id', 'source_row_id'] }
                        }
                    },
                    fields: [
                        {
                            id: '018f8a78-7b8f-7c1d-a111-222233334461',
                            codename: 'SourceObjectId',
                            dataType: 'STRING'
                        },
                        {
                            id: '018f8a78-7b8f-7c1d-a111-222233334462',
                            codename: 'SourceRowId',
                            dataType: 'STRING'
                        }
                    ]
                } as never
            ]
        })

        const executedSql = executor.query.mock.calls.map(([sql]) => String(sql)).join('\n')

        expect(executedSql).toContain(`SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables`)
        expect(executedSql).toContain(`CREATE TABLE "${schemaName}"."_app_workspaces"`)
        expect(executedSql).not.toContain(`INSERT INTO "${schemaName}"."_app_workspaces"`)
        expect(executedSql).not.toContain(`'shared', 'active'`)
        expect(executedSql).toContain(`CREATE TABLE "${schemaName}"."_app_limits"`)
        expect(executedSql).toContain(`CREATE TABLE "${schemaName}"."_app_workspace_settings"`)
        expect(executedSql).toContain(`CREATE TABLE "${schemaName}"."_app_workspace_operation_audit"`)
        expect(executedSql).toContain("operation_kind IN ('seed_reset', 'personal_to_shared_conversion')")
        expect(executedSql).toContain(`CREATE INDEX IF NOT EXISTS "_app_workspace_operation_audit_workspace_created_idx"`)
        expect(executedSql).toContain('_upl_locked BOOLEAN NOT NULL DEFAULT false')
        expect(executedSql).toContain(`CREATE UNIQUE INDEX IF NOT EXISTS "_app_workspace_settings_workspace_key_active_uidx"`)
        expect(executedSql).not.toContain('DO $$')
        expect(executedSql).toContain('ADD COLUMN IF NOT EXISTS "_seed_source_key" TEXT NULL')
        expect(executedSql).toContain('ADD COLUMN IF NOT EXISTS "_seed_source_owned" BOOLEAN NOT NULL DEFAULT true')
        expect(executedSql).toContain('ADD CONSTRAINT "obj_018f8a787b8f7c1da111222233334442_workspace_id_fk"')
        expect(executedSql).toContain(`FOREIGN KEY ("workspace_id") REFERENCES "${schemaName}"."_app_workspaces"(id) ON DELETE RESTRICT`)
        expect(executedSql).toContain(`CREATE POLICY "workspace_select" ON "${schemaName}"."obj_018f8a787b8f7c1da111222233334442"`)
        expect(executedSql).toContain(`CREATE POLICY "workspace_insert" ON "${schemaName}"."tbl_018f8a787b8f7c1da111222233334443"`)
        expect(executedSql).toContain(`CREATE UNIQUE INDEX IF NOT EXISTS "led_018f8a787b8f7c1da111222233334460_ledger_idempotency_uidx"`)
        expect(executedSql).toContain(
            `ON "${schemaName}"."led_018f8a787b8f7c1da111222233334460"("workspace_id", "cmp_018f8a787b8f7c1da111222233334461", "cmp_018f8a787b8f7c1da111222233334462")`
        )
        expect(executedSql).toContain(
            `WHERE "cmp_018f8a787b8f7c1da111222233334461" IS NOT NULL AND "cmp_018f8a787b8f7c1da111222233334462" IS NOT NULL`
        )

        // Two-tier reconciliation: the schema bootstrap pass materializes the
        // baseline `member` rows for every active application member of every
        // active shared workspace (idempotent, no `is_public` coupling).
        const baselineStatement = executor.query.mock.calls.map(([sql]) => String(sql)).find((sql) => sql.includes('WITH activeMembers'))
        expect(baselineStatement).toBeDefined()
        expect(baselineStatement).toContain('FROM applications.rel_application_users au')
        expect(baselineStatement).toContain('au.application_id = $1')
        expect(baselineStatement).toContain(`w.workspace_type <> 'personal'`)
        expect(baselineStatement).toContain('w.personal_user_id IS NULL')
        expect(baselineStatement).toContain(`r.codename = 'member'`)
        expect(baselineStatement).toContain('ON CONFLICT (workspace_id, user_id)')
        expect(baselineStatement).toContain('WHERE _upl_deleted = false AND _app_deleted = false')
        expect(baselineStatement).toContain('DO NOTHING')
        expect(baselineStatement).not.toContain('is_public')
    })

    describe('ensurePersonalWorkspaceForUser conversion guard', () => {
        const SCHEMA_NAME = 'app_018f8a787b8f7c1da111222233334400'
        const USER_ID = '018f8a78-7b8f-7c1d-a111-222233334401'
        const CONVERTED_WORKSPACE_ID = '018f8a78-7b8f-7c1d-a111-222233334402'

        const markerSelectSql = (sql: string): boolean =>
            sql.includes('converted_from_user_id') && sql.includes('SELECT id') && sql.includes(`FROM "${SCHEMA_NAME}"."_app_workspaces"`)

        it('returns the converted workspace without INSERT when the marker exists', async () => {
            const { executor } = createMockDbExecutor()

            executor.query.mockImplementation(async (sql: string, _params?: unknown[]) => {
                if (sql.includes(`WHERE workspace_type = 'personal'`)) return []
                if (markerSelectSql(sql)) return [{ id: CONVERTED_WORKSPACE_ID }]
                return []
            })

            const { workspaceId } = await ensurePersonalWorkspaceForUser(executor, {
                schemaName: SCHEMA_NAME,
                userId: USER_ID,
                actorUserId: USER_ID
            })

            expect(workspaceId).toBe(CONVERTED_WORKSPACE_ID)

            const inserts = executor.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO'))
            expect(inserts).toHaveLength(0)
        })

        it('creates the personal workspace with the same advisory-lock key family as the conversion', async () => {
            const { executor } = createMockDbExecutor()

            executor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
                if (sql.includes(`WHERE workspace_type = 'personal'`)) return []
                if (markerSelectSql(sql)) return []
                if (sql.includes('SELECT public.uuid_generate_v7() AS id')) {
                    return [{ id: '018f8a78-7b8f-7c1d-a111-222233334403' }]
                }
                if (sql.includes(`INSERT INTO "${SCHEMA_NAME}"."_app_workspaces"`)) {
                    return [{ id: '018f8a78-7b8f-7c1d-a111-222233334403' }]
                }
                if (sql.includes(`INSERT INTO "${SCHEMA_NAME}"."_app_workspace_roles"`)) {
                    return [{ id: params?.[0] }]
                }
                return []
            })

            const { workspaceId } = await ensurePersonalWorkspaceForUser(executor, {
                schemaName: SCHEMA_NAME,
                userId: USER_ID,
                actorUserId: USER_ID
            })

            expect(workspaceId).toBe('018f8a78-7b8f-7c1d-a111-222233334403')

            // createMockDbExecutor delegates nested-transaction queries to the
            // parent mock, so every query (including the advisory lock probe)
            // is visible on the parent's call log.
            const lockKeyCalls = executor.query.mock.calls.filter(
                (call) =>
                    String(call[0]).includes('pg_advisory_xact_lock') && call[1]?.[0] === `personal-workspace:${SCHEMA_NAME}:${USER_ID}`
            )
            expect(lockKeyCalls).toHaveLength(1)
        })
    })

    describe('ensureSharedWorkspaceBaselineMembership', () => {
        const SCHEMA_NAME = 'app_018f8a787b8f7c1da111222233334400'

        it('materializes rows with owner-row preservation and reports the inserted count', async () => {
            const { executor } = createMockDbExecutor()
            executor.query.mockImplementation(async (sql: string) => {
                if (sql.includes('WITH activeMembers')) return [{ inserted: 3 }]
                return []
            })

            const inserted = await ensureSharedWorkspaceBaselineMembership(executor, {
                schemaName: SCHEMA_NAME,
                applicationId: '018f8a78-7b8f-7c1d-a111-222233334401',
                actorUserId: '018f8a78-7b8f-7c1d-a111-222233334402'
            })

            expect(inserted).toBe(3)
            // The set-based enrollment is serialized against the other
            // membership/workspace writers through the shared advisory key.
            const lockSql = executor.query.mock.calls[0]?.[0] as string
            expect(lockSql).toContain('pg_advisory_xact_lock')
            const sql = executor.query.mock.calls[1]?.[0] as string
            expect(sql).toContain(`FROM applications.rel_application_users au`)
            expect(sql).toContain(`w.workspace_type <> 'personal'`)
            expect(sql).toContain('w.personal_user_id IS NULL')
            expect(sql).toContain('ON CONFLICT (workspace_id, user_id)')
            expect(sql).toContain('WHERE _upl_deleted = false AND _app_deleted = false')
            expect(sql).toContain('DO NOTHING')
            expect(sql).not.toContain("r.codename = 'owner'")
        })

        it('materializes through the SQL-first statement with is_public decoupled', async () => {
            const { executor } = createMockDbExecutor()
            executor.query.mockImplementation(async (sql: string) => {
                if (sql.includes('WITH activeMembers')) return [{ inserted: 0 }]
                return []
            })

            expect(
                await ensureSharedWorkspaceBaselineMembership(executor, {
                    schemaName: SCHEMA_NAME,
                    applicationId: '018f8a78-7b8f-7c1d-a111-222233334401'
                })
            ).toBe(0)
            expect(String(executor.query.mock.calls[1]?.[0])).not.toContain('is_public')
        })
    })

    describe('removeSharedWorkspaceBaselineMembership', () => {
        const SCHEMA_NAME = 'app_018f8a787b8f7c1da111222233334400'

        it('soft-deletes only baseline member rows of active shared workspaces', async () => {
            const { executor } = createMockDbExecutor()
            executor.query.mockImplementation(async (sql: string) => {
                if (sql.includes('UPDATE') && sql.includes(`_app_workspace_user_roles`)) return [{ id: '1' }, { id: '2' }]
                return []
            })

            const removed = await removeSharedWorkspaceBaselineMembership(executor, {
                schemaName: SCHEMA_NAME,
                applicationId: '018f8a78-7b8f-7c1d-a111-222233334401',
                userId: '018f8a78-7b8f-7c1d-a111-222233334401'
            })

            expect(removed).toBe(2)
            const lockSql = executor.query.mock.calls[0]?.[0] as string
            expect(lockSql).toContain('pg_advisory_xact_lock')
            const sql = executor.query.mock.calls[1]?.[0] as string
            expect(sql).toContain(`r.codename = 'member'`)
            expect(sql).not.toContain(`r.codename = 'owner'`)
            expect(sql).toContain(`w.workspace_type <> 'personal'`)
            expect(sql).toContain('w.personal_user_id IS NULL')
            expect(sql).toContain('COALESCE(w.status,')
            expect(sql).toContain('RETURNING wur.id')
        })
    })

    describe('assertUserIsNotLastSharedWorkspaceOwner', () => {
        const SCHEMA_NAME = 'app_018f8a787b8f7c1da111222233334400'
        const APPLICATION_ID = '018f8a78-7b8f-7c1d-a111-222233334403'
        const USER_ID = '018f8a78-7b8f-7c1d-a111-222233334401'

        it('blocks the leave path when the user holds the only owner row of an active shared workspace', async () => {
            const { executor } = createMockDbExecutor()
            executor.query.mockImplementation(async (sql: string) => {
                if (sql.includes('ORDER BY w.id ASC')) return [{ id: '018f8a78-7b8f-7c1d-a111-222233334402' }]
                return []
            })

            await expect(
                assertUserIsNotLastSharedWorkspaceOwner(executor, {
                    schemaName: SCHEMA_NAME,
                    applicationId: APPLICATION_ID,
                    userId: USER_ID
                })
            ).rejects.toMatchObject({ code: 'APPLICATION_MEMBER_WORKSPACE_OWNERSHIP_REQUIRED' })
        })

        it('does not block when a different active owner exists', async () => {
            const { executor } = createMockDbExecutor()
            executor.query.mockImplementation(async (sql: string) => {
                if (sql.includes('ORDER BY w.id ASC')) return []
                return []
            })

            await expect(
                assertUserIsNotLastSharedWorkspaceOwner(executor, {
                    schemaName: SCHEMA_NAME,
                    applicationId: APPLICATION_ID,
                    userId: USER_ID
                })
            ).resolves.toBeUndefined()
        })

        it('never trusts a second owner row whose user already left the application', async () => {
            const { executor } = createMockDbExecutor()
            executor.query.mockImplementation(async (sql: string) => {
                if (sql.includes('ORDER BY w.id ASC')) return []
                return []
            })

            await expect(
                assertUserIsNotLastSharedWorkspaceOwner(executor, {
                    schemaName: SCHEMA_NAME,
                    applicationId: APPLICATION_ID,
                    userId: USER_ID
                })
            ).resolves.toBeUndefined()

            // Stale `owner` rows of departed users are invisible to the
            // guard: the protecting-owner subquery requires an active
            // application membership row.
            const sql = executor.query.mock.calls[0]?.[0] as string
            expect(sql).toContain('applications.rel_application_users au')
            expect(sql).toContain('au.application_id = $2')
            expect(String(executor.query.mock.calls[0]?.[1])).toContain(APPLICATION_ID)
        })
    })
})
