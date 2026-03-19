import {
    archivePersonalWorkspaceForUser,
    ensureApplicationRuntimeWorkspaceSchema,
    ensurePersonalWorkspaceForUser
} from '../../services/applicationWorkspaces'
import { createMockDbExecutor } from '../utils/dbMocks'

describe('applicationWorkspaces service', () => {
    it('adds workspace foreign keys and scoped policies to runtime catalog tables', async () => {
        const { executor } = createMockDbExecutor()
        let generatedIdCounter = 0
        const schemaName = 'app_018f8a787b8f7c1da111222233334440'

        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('SELECT public.uuid_generate_v7() AS id')) {
                generatedIdCounter += 1
                return [{ id: `018f8a78-7b8f-7c1d-a111-22223333444${generatedIdCounter}` }]
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
                    kind: 'catalog',
                    fields: [
                        {
                            id: '018f8a78-7b8f-7c1d-a111-222233334443',
                            codename: 'items',
                            dataType: 'TABLE'
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
        expect(executedSql).toContain(`CREATE TABLE "${schemaName}"."_app_limits"`)
        expect(executedSql).not.toContain('DO $$')
        expect(executedSql).toContain('ADD COLUMN IF NOT EXISTS "_seed_source_key" TEXT NULL')
        expect(executedSql).toContain('ADD CONSTRAINT "cat_018f8a787b8f7c1da111222233334442_workspace_id_fk"')
        expect(executedSql).toContain(`FOREIGN KEY ("workspace_id") REFERENCES "${schemaName}"."_app_workspaces"(id) ON DELETE RESTRICT`)
        expect(executedSql).toContain(`CREATE POLICY "workspace_select" ON "${schemaName}"."cat_018f8a787b8f7c1da111222233334442"`)
        expect(executedSql).toContain(`CREATE POLICY "workspace_insert" ON "${schemaName}"."tbl_018f8a787b8f7c1da111222233334443"`)
    })

    it('archives workspace-scoped runtime rows before archiving the personal workspace itself', async () => {
        const { executor } = createMockDbExecutor()
        const schemaName = 'app_018f8a787b8f7c1da111222233334550'

        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                return [{ id: '018f8a78-7b8f-7c1d-a111-222233334551' }]
            }

            if (sql.includes('FROM information_schema.columns')) {
                return [{ tableName: 'cat_018f8a787b8f7c1da111222233334552' }, { tableName: 'tbl_018f8a787b8f7c1da111222233334553' }]
            }

            return []
        })

        await archivePersonalWorkspaceForUser(executor, {
            schemaName,
            userId: '018f8a78-7b8f-7c1d-a111-222233334554',
            actorUserId: '018f8a78-7b8f-7c1d-a111-222233334555'
        })

        const executedSql = executor.query.mock.calls.map(([sql]) => String(sql)).join('\n')

        expect(executedSql).toContain(`UPDATE "${schemaName}"."cat_018f8a787b8f7c1da111222233334552"`)
        expect(executedSql).toContain(`UPDATE "${schemaName}"."tbl_018f8a787b8f7c1da111222233334553"`)
        expect(executedSql).toContain('WHERE "workspace_id" = ANY($1::uuid[])')
        expect(executedSql).toContain(`UPDATE "${schemaName}"."_app_workspaces"`)
    })

    it('seeds predefined runtime rows into a newly created personal workspace', async () => {
        const { executor } = createMockDbExecutor()
        const schemaName = 'app_018f8a787b8f7c1da111222233334650'
        const generatedIds = [
            '018f8a78-7b8f-7c1d-a111-222233334651',
            '018f8a78-7b8f-7c1d-a111-222233334652',
            '018f8a78-7b8f-7c1d-a111-222233334653'
        ]

        executor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes('SELECT public.uuid_generate_v7() AS id')) {
                const id = generatedIds.shift()
                return id ? [{ id }] : []
            }

            if (sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                return []
            }

            if (sql.includes(`FROM "${schemaName}"."_app_workspace_roles"`)) {
                if (params?.[0] === 'owner') {
                    return [{ id: '018f8a78-7b8f-7c1d-a111-222233334660', codename: 'owner' }]
                }
                if (params?.[0] === 'member') {
                    return [{ id: '018f8a78-7b8f-7c1d-a111-222233334661', codename: 'member' }]
                }
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
                                '018f8a78-7b8f-7c1d-a111-222233334670': [
                                    {
                                        id: 'seed-row-1',
                                        data: {
                                            title: {
                                                en: 'Starter',
                                                ru: 'Старт'
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
                        objectId: '018f8a78-7b8f-7c1d-a111-222233334670',
                        tableName: 'cat_018f8a787b8f7c1da111222233334670'
                    }
                ]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_attributes"`)) {
                return [
                    {
                        objectId: '018f8a78-7b8f-7c1d-a111-222233334670',
                        attributeId: '018f8a78-7b8f-7c1d-a111-222233334671',
                        parentAttributeId: null,
                        codename: 'title',
                        columnName: 'col_018f8a787b8f7c1da111222233334671',
                        dataType: 'STRING',
                        uiConfig: {
                            stringMode: 'vlc'
                        },
                        targetObjectKind: null
                    }
                ]
            }

            if (sql.includes('FROM information_schema.columns')) {
                return [
                    {
                        tableName: 'cat_018f8a787b8f7c1da111222233334670',
                        columnName: 'col_018f8a787b8f7c1da111222233334671',
                        udtName: 'jsonb'
                    }
                ]
            }

            if (sql.includes('SELECT id, _seed_source_key AS "seedSourceKey"')) {
                return []
            }

            return []
        })

        const result = await ensurePersonalWorkspaceForUser(executor, {
            schemaName,
            userId: '018f8a78-7b8f-7c1d-a111-222233334680',
            actorUserId: '018f8a78-7b8f-7c1d-a111-222233334681',
            defaultRoleCodename: 'owner'
        })

        expect(result.workspaceId).toBe('018f8a78-7b8f-7c1d-a111-222233334651')

        const workspaceInsertCall = executor.query.mock.calls.find(([sql]) =>
            String(sql).includes(`INSERT INTO "${schemaName}"."_app_workspaces"`)
        )
        expect(workspaceInsertCall).toBeDefined()

        const runtimeSeedInsertCall = executor.query.mock.calls.find(([sql]) =>
            String(sql).includes(`INSERT INTO "${schemaName}"."cat_018f8a787b8f7c1da111222233334670"`)
        )
        expect(runtimeSeedInsertCall).toBeDefined()
        expect(runtimeSeedInsertCall?.[1]).toEqual(
            expect.arrayContaining([
                '018f8a78-7b8f-7c1d-a111-222233334653',
                '018f8a78-7b8f-7c1d-a111-222233334651',
                'seed-row-1',
                JSON.stringify({
                    en: 'Starter',
                    ru: 'Старт'
                })
            ])
        )
    })
})
