import {
    archivePersonalWorkspaceForUser,
    ensureApplicationRuntimeWorkspaceSchema,
    listWorkspaceScopedBusinessTables,
    resetWorkspaceSeededElements,
    syncWorkspaceSeededElements
} from '../../services/applicationWorkspaces'
import { WORKSPACE_SEED_RESET_ERROR_CODES, WorkspaceSeedResetError } from '../../services/runtimeWorkspaceErrors'
import { createMockDbExecutor } from '../utils/dbMocks'

describe('applicationWorkspaces lifecycle and seed reset', () => {
    it('defers predefined runtime row seeding during workspace schema bootstrap and seeds through explicit sync', async () => {
        const { executor } = createMockDbExecutor()
        const schemaName = 'app_018f8a787b8f7c1da111222233334445'
        const generatedIds = [
            '018f8a78-7b8f-7c1d-a111-222233334446',
            '018f8a78-7b8f-7c1d-a111-222233334447',
            '018f8a78-7b8f-7c1d-a111-222233334448',
            '018f8a78-7b8f-7c1d-a111-222233334449',
            '018f8a78-7b8f-7c1d-a111-222233334450',
            '018f8a78-7b8f-7c1d-a111-222233334451',
            '018f8a78-7b8f-7c1d-a111-222233334452'
        ]

        executor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('SELECT public.uuid_generate_v7() AS id')) {
                const id = generatedIds.shift()
                return id ? [{ id }] : []
            }

            if (sql.includes(`INSERT INTO "${schemaName}"."_app_workspace_roles"`)) {
                return [{ id: params?.[0] }]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_workspace_roles"`)) {
                return []
            }

            if (sql.includes('FROM applications.rel_application_users')) {
                return [{ userId: '018f8a78-7b8f-7c1d-a111-222233334441' }]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                return []
            }

            if (sql.includes(`FROM "${schemaName}"."_app_workspace_user_roles"`)) {
                return []
            }

            if (sql.includes(`FROM "${schemaName}"."_app_settings"`)) {
                return [
                    {
                        value: {
                            version: 1,
                            elements: {
                                '018f8a78-7b8f-7c1d-a111-222233334470': [
                                    {
                                        id: 'shared-seed-row',
                                        data: {
                                            title: {
                                                en: 'Shared starter',
                                                ru: 'Общий старт'
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    }
                ]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                return [
                    {
                        objectId: '018f8a78-7b8f-7c1d-a111-222233334470',
                        codename: 'accesslinks',
                        tableName: 'obj_018f8a787b8f7c1da111222233334470'
                    }
                ]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                return [
                    {
                        objectId: '018f8a78-7b8f-7c1d-a111-222233334470',
                        componentId: '018f8a78-7b8f-7c1d-a111-222233334471',
                        parentComponentId: null,
                        codename: 'title',
                        columnName: 'col_018f8a787b8f7c1da111222233334471',
                        dataType: 'STRING',
                        uiConfig: {
                            stringMode: 'vlc'
                        },
                        targetObjectId: null,
                        targetObjectKind: null
                    }
                ]
            }

            if (sql.includes('FROM information_schema.columns')) {
                return [
                    {
                        tableName: 'obj_018f8a787b8f7c1da111222233334470',
                        columnName: 'col_018f8a787b8f7c1da111222233334471',
                        udtName: 'jsonb'
                    }
                ]
            }

            if (sql.includes('SELECT id, _seed_source_key AS "seedSourceKey"')) {
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
                    id: '018f8a78-7b8f-7c1d-a111-222233334470',
                    codename: 'accesslinks',
                    kind: 'object',
                    fields: []
                } as never
            ]
        })

        const roleInsertCall = executor.query.mock.calls.find(([sql]) =>
            String(sql).includes(`INSERT INTO "${schemaName}"."_app_workspace_roles"`)
        )
        expect(roleInsertCall).toBeDefined()
        expect(String(roleInsertCall?.[0])).toContain('ON CONFLICT (codename)')

        const membershipInsertCall = executor.query.mock.calls.find(([sql]) =>
            String(sql).includes(`INSERT INTO "${schemaName}"."_app_workspace_user_roles"`)
        )
        expect(membershipInsertCall).toBeDefined()
        expect(String(membershipInsertCall?.[0])).toContain('ON CONFLICT (workspace_id, user_id)')

        expect(
            executor.query.mock.calls.find(([sql]) =>
                String(sql).includes(`INSERT INTO "${schemaName}"."obj_018f8a787b8f7c1da111222233334470"`)
            )
        ).toBeUndefined()

        await syncWorkspaceSeededElements(executor, {
            schemaName,
            workspaceId: '018f8a78-7b8f-7c1d-a111-222233334499',
            actorUserId: '018f8a78-7b8f-7c1d-a111-222233334441'
        })

        const runtimeSeedInsertCall = executor.query.mock.calls.find(([sql]) =>
            String(sql).includes(`INSERT INTO "${schemaName}"."obj_018f8a787b8f7c1da111222233334470"`)
        )

        expect(runtimeSeedInsertCall).toBeDefined()
        expect(runtimeSeedInsertCall?.[1]).toEqual(
            expect.arrayContaining([
                '018f8a78-7b8f-7c1d-a111-222233334499',
                'shared-seed-row',
                JSON.stringify({
                    en: 'Shared starter',
                    ru: 'Общий старт'
                })
            ])
        )
    })

    it('archives workspace-scoped runtime rows before archiving the personal workspace itself', async () => {
        const { executor } = createMockDbExecutor()
        const schemaName = 'app_018f8a787b8f7c1da111222233334550'

        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                return [{ id: '018f8a78-7b8f-7c1d-a111-222233334551' }]
            }

            if (sql.includes('FROM information_schema.columns')) {
                return [
                    {
                        tableName: 'obj_018f8a787b8f7c1da111222233334552',
                        objectId: '018f8a78-7b8f-7c1d-a111-222233334552'
                    },
                    {
                        tableName: 'led_018f8a787b8f7c1da111222233334556',
                        objectId: '018f8a78-7b8f-7c1d-a111-222233334556'
                    }
                ]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                return [{ componentId: '018f8a78-7b8f-7c1d-a111-222233334553' }]
            }

            if (sql.includes('FROM information_schema.tables')) {
                return [
                    { tableName: 'obj_018f8a787b8f7c1da111222233334552' },
                    { tableName: 'tbl_018f8a787b8f7c1da111222233334553' },
                    { tableName: 'led_018f8a787b8f7c1da111222233334556' }
                ]
            }

            return []
        })

        await archivePersonalWorkspaceForUser(executor, {
            schemaName,
            userId: '018f8a78-7b8f-7c1d-a111-222233334554',
            actorUserId: '018f8a78-7b8f-7c1d-a111-222233334555'
        })

        const executedSql = executor.query.mock.calls.map(([sql]) => String(sql)).join('\n')

        expect(executedSql).toContain(`UPDATE "${schemaName}"."obj_018f8a787b8f7c1da111222233334552"`)
        expect(executedSql).toContain(`UPDATE "${schemaName}"."tbl_018f8a787b8f7c1da111222233334553"`)
        expect(executedSql).toContain(`UPDATE "${schemaName}"."led_018f8a787b8f7c1da111222233334556"`)
        expect(executedSql).toContain(`UPDATE "${schemaName}"."_app_workspace_settings"`)
        expect(executedSql).toContain('RETURNING id')
        expect(executedSql).toContain('WHERE "workspace_id" = ANY($1::uuid[])')
        expect(executedSql).toContain(`UPDATE "${schemaName}"."_app_workspaces"`)
    })

    it('discovers materialized TABLE child tables for workspace lifecycle operations', async () => {
        const { executor } = createMockDbExecutor()
        const schemaName = 'app_018f8a787b8f7c1da111222233334557'
        const childTableName = 'tbl_018f8a787b8f7c1da111222233334558'

        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM information_schema.columns')) {
                return [{ tableName: 'obj_018f8a787b8f7c1da111222233334559', objectId: '018f8a78-7b8f-7c1d-a111-222233334559' }]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                return [{ componentId: '018f8a78-7b8f-7c1d-a111-222233334558' }]
            }
            if (sql.includes('FROM information_schema.tables')) {
                return [{ tableName: 'obj_018f8a787b8f7c1da111222233334559' }, { tableName: childTableName }]
            }
            return []
        })

        await expect(listWorkspaceScopedBusinessTables(executor, schemaName)).resolves.toEqual([
            'obj_018f8a787b8f7c1da111222233334559',
            childTableName
        ])
    })

    it('includes inactive metadata tables when archiving a workspace', async () => {
        const { executor } = createMockDbExecutor()
        const schemaName = 'app_018f8a787b8f7c1da111222233334560'

        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM information_schema.columns')) {
                return [{ tableName: 'obj_archived', objectId: '018f8a78-7b8f-7c1d-a111-222233334561' }]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                return [{ componentId: '018f8a78-7b8f-7c1d-a111-222233334562' }]
            }
            if (sql.includes('FROM information_schema.tables')) {
                return [{ tableName: 'obj_archived' }, { tableName: 'tbl_018f8a787b8f7c1da111222233334562' }]
            }
            return []
        })

        await expect(listWorkspaceScopedBusinessTables(executor, schemaName, { includeInactiveMetadata: true })).resolves.toEqual([
            'obj_archived',
            'tbl_018f8a787b8f7c1da111222233334562'
        ])

        const objectQuery = executor.query.mock.calls.find(([sql]) => String(sql).includes('SELECT DISTINCT'))
        const componentQuery = executor.query.mock.calls.find(([sql]) => String(sql).includes('SELECT DISTINCT c.id'))
        expect(String(objectQuery?.[0])).not.toContain('o._upl_deleted = false')
        expect(String(componentQuery?.[0])).not.toContain('c._upl_deleted = false')
    })

    it('keeps an existing workspace seed row unchanged on subsequent synchronization', async () => {
        const { executor } = createMockDbExecutor()
        const schemaName = 'app_018f8a787b8f7c1da111222233334575'

        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('COUNT(*)::text AS count')) return [{ count: '0' }]
            if (sql.includes(`FROM "${schemaName}"."_app_settings"`)) {
                return [{ value: { version: 1, elements: { objectId: [{ id: 'seed-row-1', data: { title: 'Source value' } }] } } }]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                return [{ objectId: 'objectId', codename: 'MarketingPageFeature', tableName: 'obj_features' }]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                return [
                    {
                        objectId: 'objectId',
                        componentId: 'componentId',
                        parentComponentId: null,
                        codename: 'title',
                        columnName: 'title_column',
                        dataType: 'STRING',
                        uiConfig: null,
                        validationRules: null,
                        targetObjectId: null,
                        targetObjectKind: null
                    }
                ]
            }
            if (sql.includes('FROM information_schema.tables')) {
                return [{ tableName: 'obj_features' }]
            }
            if (sql.includes('FROM information_schema.columns')) {
                return [{ tableName: 'obj_features', columnName: 'title_column', udtName: 'text' }]
            }
            if (sql.includes('SELECT id, _seed_source_key AS "seedSourceKey"')) {
                return [{ id: 'existing-row', seedSourceKey: 'seed-row-1' }]
            }
            return []
        })

        await syncWorkspaceSeededElements(executor, {
            schemaName,
            workspaceId: '018f8a78-7b8f-7c1d-a111-222233334576',
            actorUserId: '018f8a78-7b8f-7c1d-a111-222233334577'
        })

        const executedSql = executor.query.mock.calls.map(([sql]) => String(sql)).join('\n')
        expect(executedSql).not.toContain(`INSERT INTO "${schemaName}"."obj_features"`)
        expect(executedSql).not.toContain(`UPDATE "${schemaName}"."obj_features"`)
    })

    it('does not overwrite an authored seed-linked row during an explicit reset', async () => {
        const { executor } = createMockDbExecutor()
        const schemaName = 'app_018f8a787b8f7c1da111222233334578'

        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('COUNT(*)::text AS count')) return [{ count: '0' }]
            if (sql.includes(`FROM "${schemaName}"."_app_settings"`)) {
                return [{ value: { version: 1, elements: { objectId: [{ id: 'seed-row-1', data: { title: 'Source value' } }] } } }]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                return [{ objectId: 'objectId', codename: 'MarketingPageFeature', tableName: 'obj_features' }]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_components"`)) return []
            if (sql.includes('FROM information_schema.columns')) return []
            if (sql.includes('SELECT id, _seed_source_key AS "seedSourceKey"')) {
                return [{ id: 'authored-row', seedSourceKey: 'seed-row-1', seedSourceOwned: false }]
            }
            return []
        })

        await syncWorkspaceSeededElements(executor, {
            schemaName,
            workspaceId: '018f8a78-7b8f-7c1d-a111-222233334579',
            actorUserId: '018f8a78-7b8f-7c1d-a111-22223333457a',
            overwriteExisting: true
        })

        const executedSql = executor.query.mock.calls.map(([sql]) => String(sql)).join('\n')
        expect(executedSql).not.toContain(`INSERT INTO "${schemaName}"."obj_features"`)
        expect(executedSql).not.toContain(`UPDATE "${schemaName}"."obj_features"`)
    })

    it('resets seed-owned workspace rows transactionally and leaves authored rows untouched', async () => {
        const { executor } = createMockDbExecutor()
        executor.transaction.mockImplementation(async (fn: (exec: typeof executor) => Promise<unknown>) => fn(executor))
        const schemaName = 'app_018f8a787b8f7c1da111222233334580'
        const workspaceId = '018f8a78-7b8f-7c1d-a111-222233334581'

        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('COUNT(*)::text AS count')) return [{ count: '0' }]
            if (sql.includes(`INSERT INTO "${schemaName}"."_app_workspace_operation_audit"`)) {
                return [{ id: '018f8a78-7b8f-7c1d-a111-222233334586' }]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                return [{ id: workspaceId }]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_settings"`)) {
                return [{ value: { version: 1, elements: { objectId: [{ id: 'seed-row-1', data: { title: 'Source value' } }] } } }]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                return [{ objectId: 'objectId', codename: 'MarketingPageFeature', tableName: 'obj_features' }]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                return [
                    {
                        objectId: 'objectId',
                        componentId: 'componentId',
                        parentComponentId: null,
                        codename: 'title',
                        columnName: 'title_column',
                        dataType: 'STRING',
                        uiConfig: null,
                        validationRules: null,
                        targetObjectId: null,
                        targetObjectKind: null
                    }
                ]
            }
            if (sql.includes('FROM information_schema.tables')) {
                return [{ tableName: 'obj_features' }]
            }
            if (sql.includes('FROM information_schema.columns')) {
                return [{ tableName: 'obj_features', columnName: 'title_column', udtName: 'text' }]
            }
            if (sql.includes('SELECT id, _seed_source_key AS "seedSourceKey"')) {
                return [{ id: 'existing-row', seedSourceKey: 'seed-row-1' }]
            }
            if (sql.includes(`UPDATE "${schemaName}"."obj_features"`)) {
                return [{ id: 'existing-row' }]
            }
            return []
        })

        await expect(
            resetWorkspaceSeededElements(executor, {
                schemaName,
                workspaceId,
                actorUserId: '018f8a78-7b8f-7c1d-a111-222233334582',
                currentUserId: '018f8a78-7b8f-7c1d-a111-222233334582'
            })
        ).resolves.toEqual({ resetRows: 1, operationId: '018f8a78-7b8f-7c1d-a111-222233334586' })

        // The reset must open a nested (savepoint) transaction so a failure
        // under a reused request transaction cannot leave partial deletes.
        expect(executor.transaction).toHaveBeenCalledTimes(2)

        const resetSql = executor.query.mock.calls
            .map(([sql]) => String(sql))
            .find((sql) => sql.includes(`UPDATE "${schemaName}"."obj_features"`))
        expect(resetSql).toContain('"workspace_id" = $1')
        expect(resetSql).toContain('"_seed_source_key" IS NOT NULL')
        expect(resetSql).toContain('COALESCE("_seed_source_owned", true) = true')
        expect(resetSql).toContain('RETURNING id')
        expect(executor.query.mock.calls.some(([sql]) => String(sql).includes(`UPDATE "${schemaName}"."obj_features"`))).toBe(true)
        const auditSql = executor.query.mock.calls
            .map(([sql]) => String(sql))
            .find((sql) => sql.includes(`INSERT INTO "${schemaName}"."_app_workspace_operation_audit"`))
        expect(auditSql).toContain('public.uuid_generate_v7()')
        expect(auditSql).toContain('operation_kind')
        expect(auditSql).toContain('affected_rows')
    })

    it('returns a typed not-found error before touching seeded tables', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        const schemaName = 'app_018f8a787b8f7c1da111222233334583'
        const workspaceId = '018f8a78-7b8f-7c1d-a111-222233334584'

        txExecutor.query.mockResolvedValue([])

        await expect(
            resetWorkspaceSeededElements(executor, {
                schemaName,
                workspaceId,
                actorUserId: '018f8a78-7b8f-7c1d-a111-222233334585',
                currentUserId: '018f8a78-7b8f-7c1d-a111-222233334585'
            })
        ).rejects.toMatchObject<Partial<WorkspaceSeedResetError>>({
            name: 'WorkspaceSeedResetError',
            code: WORKSPACE_SEED_RESET_ERROR_CODES.workspaceNotFound,
            message: 'Workspace not found'
        })

        expect(txExecutor.query).toHaveBeenCalledTimes(1)
        expect(String(txExecutor.query.mock.calls[0]?.[0])).toContain('SELECT id')
    })
})
