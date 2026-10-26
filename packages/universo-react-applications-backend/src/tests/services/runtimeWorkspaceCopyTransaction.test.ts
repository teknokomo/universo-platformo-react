import { copyWorkspace } from '../../services/runtimeWorkspaceService'
import { copyWorkspaceOperation } from '../../services/runtimeWorkspaceCopyService'
import { createMockDbExecutor } from '../utils/dbMocks'

const schemaName = 'app_018f8a787b8f7c1da111222233334441'

const vlc = (content: string) => ({
    _schema: '1' as const,
    _primary: 'en' as const,
    locales: {
        en: {
            content,
            version: 1,
            isActive: true,
            createdAt: new Date(0).toISOString(),
            updatedAt: new Date(0).toISOString()
        }
    }
})

describe('workspace copy transaction behavior', () => {
    it('resolves the shared application layout once and persists widget settings under that owner', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const applicationLayoutId = '018f8a78-7b8f-7c1d-a111-2222333344bc'
        const widgetSettingKey = 'interpretationNetwork.cellStylePolicy.editable.fillColor'
        let layoutResolutionCount = 0

        txExecutor.query.mockImplementation(async (sql: string) => {
            if (sql.includes(`FROM "${schemaName}"."_app_workspaces"`) && sql.includes('WHERE id = $1') && sql.includes('FOR SHARE')) {
                return [{ id: 'workspace-source' }]
            }

            if (sql.includes('FROM workspace_copy_source_settings')) {
                return [
                    {
                        key: widgetSettingKey,
                        targetKind: 'widget',
                        targetOwnerId: applicationLayoutId,
                        targetKey: 'matrix-main',
                        value: true
                    }
                ]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_layouts" layout_row`)) {
                layoutResolutionCount += 1
                return [
                    {
                        layoutId: applicationLayoutId,
                        scopeEntityId: null,
                        instanceKey: 'matrix-main'
                    }
                ]
            }

            if (sql.includes(`INSERT INTO "${schemaName}"."_app_workspace_settings"`)) {
                return [{ id: '019f2000-0000-7000-8000-000000000001' }]
            }

            return []
        })

        const result = await copyWorkspaceOperation(
            executor,
            {
                schemaName,
                applicationId: '018f8a78-7b8f-7c1d-a111-222233334444',
                sourceWorkspaceId: 'workspace-source',
                name: vlc('Workspace copy'),
                description: vlc('Workspace copy description'),
                userId: 'user-1',
                actorUserId: 'user-1',
                applicationSettings: {
                    workspaceOverrides: {
                        allowedAddresses: [{ key: widgetSettingKey, target: { kind: 'widget', instanceKey: 'matrix-main' } }],
                        lockedAddresses: []
                    }
                }
            },
            {
                createWorkspace: async () => ({ id: 'workspace-copy' }),
                createError: (code, message) => new Error(`${code}: ${message}`)
            }
        )

        expect(result).toEqual({ id: 'workspace-copy' })
        expect(layoutResolutionCount).toBe(1)

        const insertCall = txExecutor.query.mock.calls.find(([sql]) =>
            String(sql).includes(`INSERT INTO "${schemaName}"."_app_workspace_settings"`)
        )
        expect(insertCall).toBeDefined()
        expect(JSON.parse(String(insertCall?.[1]?.[0]))).toEqual([
            {
                target_kind: 'widget',
                target_owner_id: applicationLayoutId,
                target_key: 'matrix-main',
                key: widgetSettingKey,
                value: true
            }
        ])
        expect(insertCall?.[1]?.slice(1)).toEqual(['workspace-copy', 'user-1'])
    })

    it('rolls back a request-scoped savepoint after a post-create failure while retaining the workspace row lock', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const generatedIds = ['workspace-copy', 'relation-copy', 'setting-copy']
        const copyFailure = new Error('workspace settings write failed')
        let savepointRollbackObserved = false
        let workspaceRows = new Set(['workspace-source'])
        let workspaceRowsAtOuterFailure: string[] | null = null
        let transactionDepth = 0
        let workspaceLockDepth = -1

        executor.transaction.mockImplementation(async (fn: (exec: typeof txExecutor) => Promise<unknown>) => {
            try {
                return await fn(txExecutor)
            } catch (error) {
                workspaceRowsAtOuterFailure = [...workspaceRows]
                throw error
            }
        })
        txExecutor.transaction.mockImplementation(async (fn: (exec: typeof txExecutor) => Promise<unknown>) => {
            const rowsBeforeSavepoint = new Set(workspaceRows)
            transactionDepth += 1
            try {
                return await fn(txExecutor)
            } catch (error) {
                const createdWorkspaceWasPending = workspaceRows.has('workspace-copy') && !rowsBeforeSavepoint.has('workspace-copy')
                workspaceRows = rowsBeforeSavepoint
                savepointRollbackObserved = createdWorkspaceWasPending && !workspaceRows.has('workspace-copy')
                throw error
            } finally {
                transactionDepth -= 1
            }
        })
        txExecutor.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
            if (sql.includes('FROM "applications"."rel_application_users"')) return [{ user_id: 'user-1' }]
            if (sql.includes(`INSERT INTO "${schemaName}"."_app_workspaces"`)) {
                workspaceRows.add(String(params[0]))
                return []
            }
            if (sql.includes('SELECT id') && sql.includes(`FROM "${schemaName}"."_app_workspaces"`) && sql.includes('WHERE id = $1')) {
                if (sql.includes('FOR SHARE')) workspaceLockDepth = transactionDepth
                return [{ id: 'workspace-source' }]
            }
            if (sql.includes('information_schema.columns') && sql.includes("column_name = 'workspace_id'")) return []
            if (sql.includes('SELECT public.uuid_generate_v7() AS id')) {
                const id = generatedIds.shift()
                return id ? [{ id }] : []
            }
            if (sql.includes(`FROM "${schemaName}"."_app_workspace_roles"`)) return [{ id: 'role-owner' }]
            if (sql.includes(`INSERT INTO "${schemaName}"."_app_workspace_settings"`)) throw copyFailure
            if (sql.includes('FROM workspace_copy_source_settings')) {
                return [
                    {
                        key: 'sectionLinksEnabled',
                        targetKind: 'global',
                        targetOwnerId: 'workspace-source',
                        targetKey: '',
                        value: true
                    }
                ]
            }
            return []
        })

        await expect(
            copyWorkspace(executor, {
                schemaName,
                applicationId: '018f8a78-7b8f-7c1d-a111-222233334444',
                sourceWorkspaceId: 'workspace-source',
                name: vlc('Workspace copy'),
                description: vlc('Workspace copy description'),
                userId: 'user-1',
                applicationSettings: {
                    sectionLinksEnabled: true,
                    workspaceOverrides: {
                        allowedAddresses: [{ key: 'sectionLinksEnabled', target: { kind: 'global' } }],
                        lockedAddresses: []
                    }
                },
                actorUserId: 'user-1'
            })
        ).rejects.toBe(copyFailure)

        expect(savepointRollbackObserved).toBe(true)
        expect(workspaceRowsAtOuterFailure).toEqual(['workspace-source'])
        expect([...workspaceRows]).toEqual(['workspace-source'])
        expect(workspaceLockDepth).toBe(1)
        const queries = txExecutor.query.mock.calls.map(([sql]) => String(sql))
        const lockIndex = queries.findIndex((sql) => sql.includes(`FROM "${schemaName}"."_app_workspaces"`) && sql.includes('FOR SHARE'))
        const mapIndex = queries.findIndex((sql) => sql.includes('CREATE TEMP TABLE workspace_copy_id_map'))
        expect(lockIndex).toBeGreaterThanOrEqual(0)
        expect(lockIndex).toBeLessThan(mapIndex)
        expect(queries.some((sql) => sql.includes(`INSERT INTO "${schemaName}"."_app_workspaces"`))).toBe(true)
    })
})
