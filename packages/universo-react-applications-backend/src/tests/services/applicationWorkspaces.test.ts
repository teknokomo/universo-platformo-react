import { generateChildTableName } from '@universo-react/schema-ddl'
import {
    ensureApplicationRuntimeWorkspaceSchema,
    resetWorkspaceSeededElements,
    resolveRuntimeWorkspaceAccess
} from '../../services/applicationWorkspaces'
import { createMockDbExecutor } from '../utils/dbMocks'

describe('applicationWorkspaces access and schema behavior', () => {
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

    it('can include active workspaces for an application administrator without membership', async () => {
        const { executor } = createMockDbExecutor()
        const schemaName = 'app_018f8a787b8f7c1da111222233334480'
        const personalWorkspaceId = '018f8a78-7b8f-7c1d-a111-222233334481'
        const sharedWorkspaceId = '018f8a78-7b8f-7c1d-a111-222233334483'

        executor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('FROM information_schema.tables')) {
                return [{ exists: true }]
            }
            if (sql.includes(`"${schemaName}"."_app_workspace_user_roles"`)) {
                if (params?.[1] === true) {
                    return [
                        { workspaceId: personalWorkspaceId, isDefaultWorkspace: false },
                        { workspaceId: sharedWorkspaceId, isDefaultWorkspace: false }
                    ]
                }
                return [{ workspaceId: personalWorkspaceId, isDefaultWorkspace: true }]
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
            defaultWorkspaceId: personalWorkspaceId,
            allowedWorkspaceIds: [personalWorkspaceId, sharedWorkspaceId]
        })

        const accessQuery = executor.query.mock.calls.find(([sql]) => String(sql).includes("COALESCE(w.status, 'active')"))
        expect(accessQuery?.[1]).toEqual(['018f8a78-7b8f-7c1d-a111-222233334482', true])
        expect(String(accessQuery?.[0])).toContain('wur.id IS NOT NULL OR $2::boolean = true')
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
        expect(executedSql).toContain("operation_kind IN ('seed_reset')")
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
    })
})
