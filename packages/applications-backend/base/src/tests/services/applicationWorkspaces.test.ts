import {
    archivePersonalWorkspaceForUser,
    ensureApplicationRuntimeWorkspaceSchema,
    ensurePersonalWorkspaceForUser,
    syncWorkspaceSeededElements
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
                } as never,
                {
                    id: '018f8a78-7b8f-7c1d-a111-222233334460',
                    codename: 'progressledger',
                    kind: 'ledger',
                    physicalTablePrefix: 'led',
                    components: {
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
        expect(executedSql).not.toContain('DO $$')
        expect(executedSql).toContain('ADD COLUMN IF NOT EXISTS "_seed_source_key" TEXT NULL')
        expect(executedSql).toContain('ADD CONSTRAINT "cat_018f8a787b8f7c1da111222233334442_workspace_id_fk"')
        expect(executedSql).toContain(`FOREIGN KEY ("workspace_id") REFERENCES "${schemaName}"."_app_workspaces"(id) ON DELETE RESTRICT`)
        expect(executedSql).toContain(`CREATE POLICY "workspace_select" ON "${schemaName}"."cat_018f8a787b8f7c1da111222233334442"`)
        expect(executedSql).toContain(`CREATE POLICY "workspace_insert" ON "${schemaName}"."tbl_018f8a787b8f7c1da111222233334443"`)
        expect(executedSql).toContain(`CREATE UNIQUE INDEX IF NOT EXISTS "led_018f8a787b8f7c1da111222233334460_ledger_idempotency_uidx"`)
        expect(executedSql).toContain(
            `ON "${schemaName}"."led_018f8a787b8f7c1da111222233334460"("workspace_id", "attr_018f8a787b8f7c1da111222233334461", "attr_018f8a787b8f7c1da111222233334462")`
        )
        expect(executedSql).toContain(
            `WHERE "attr_018f8a787b8f7c1da111222233334461" IS NOT NULL AND "attr_018f8a787b8f7c1da111222233334462" IS NOT NULL`
        )
    })

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

        executor.query.mockImplementation(async (sql: string, _params?: unknown[]) => {
            if (sql.includes('SELECT public.uuid_generate_v7() AS id')) {
                const id = generatedIds.shift()
                return id ? [{ id }] : []
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
                        tableName: 'cat_018f8a787b8f7c1da111222233334470'
                    }
                ]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_attributes"`)) {
                return [
                    {
                        objectId: '018f8a78-7b8f-7c1d-a111-222233334470',
                        attributeId: '018f8a78-7b8f-7c1d-a111-222233334471',
                        parentAttributeId: null,
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
                        tableName: 'cat_018f8a787b8f7c1da111222233334470',
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
                    kind: 'catalog',
                    fields: []
                } as never
            ]
        })

        expect(
            executor.query.mock.calls.find(([sql]) =>
                String(sql).includes(`INSERT INTO "${schemaName}"."cat_018f8a787b8f7c1da111222233334470"`)
            )
        ).toBeUndefined()

        await syncWorkspaceSeededElements(executor, {
            schemaName,
            workspaceId: '018f8a78-7b8f-7c1d-a111-222233334499',
            actorUserId: '018f8a78-7b8f-7c1d-a111-222233334441'
        })

        const runtimeSeedInsertCall = executor.query.mock.calls.find(([sql]) =>
            String(sql).includes(`INSERT INTO "${schemaName}"."cat_018f8a787b8f7c1da111222233334470"`)
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
                    { tableName: 'cat_018f8a787b8f7c1da111222233334552' },
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

        expect(executedSql).toContain(`UPDATE "${schemaName}"."cat_018f8a787b8f7c1da111222233334552"`)
        expect(executedSql).toContain(`UPDATE "${schemaName}"."tbl_018f8a787b8f7c1da111222233334553"`)
        expect(executedSql).toContain(`UPDATE "${schemaName}"."led_018f8a787b8f7c1da111222233334556"`)
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

    it('remaps workspace seed refs for catalog-like objects even when kind metadata is not literal catalog', async () => {
        const { executor } = createMockDbExecutor()
        const schemaName = 'app_018f8a787b8f7c1da111222233334750'
        const generatedIds = [
            '018f8a78-7b8f-7c1d-a111-222233334751',
            '018f8a78-7b8f-7c1d-a111-222233334752',
            '018f8a78-7b8f-7c1d-a111-222233334753',
            '018f8a78-7b8f-7c1d-a111-222233334754'
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
                    return [{ id: '018f8a78-7b8f-7c1d-a111-222233334760', codename: 'owner' }]
                }
                if (params?.[0] === 'member') {
                    return [{ id: '018f8a78-7b8f-7c1d-a111-222233334761', codename: 'member' }]
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
                                classObject: [
                                    {
                                        id: 'class-seed-row',
                                        data: {
                                            title: 'Starter class'
                                        }
                                    }
                                ],
                                accessObject: [
                                    {
                                        id: 'access-seed-row',
                                        data: {
                                            linkClassId: 'class-seed-row',
                                            status: 'enum-option-1'
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
                        objectId: 'accessObject',
                        tableName: 'cat_access_object'
                    },
                    {
                        objectId: 'classObject',
                        tableName: 'cat_class_object'
                    }
                ]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_attributes"`)) {
                return [
                    {
                        objectId: 'accessObject',
                        attributeId: 'access-ref-attr',
                        parentAttributeId: null,
                        codename: 'linkClassId',
                        columnName: 'col_link_class_id',
                        dataType: 'REF',
                        uiConfig: null,
                        targetObjectId: 'classObject',
                        targetObjectKind: 'linked_collection'
                    },
                    {
                        objectId: 'accessObject',
                        attributeId: 'access-status-attr',
                        parentAttributeId: null,
                        codename: 'status',
                        columnName: 'col_status',
                        dataType: 'REF',
                        uiConfig: null,
                        targetObjectId: 'enumObject',
                        targetObjectKind: 'enumeration'
                    },
                    {
                        objectId: 'classObject',
                        attributeId: 'class-title-attr',
                        parentAttributeId: null,
                        codename: 'title',
                        columnName: 'col_title',
                        dataType: 'STRING',
                        uiConfig: null,
                        targetObjectId: null,
                        targetObjectKind: null
                    }
                ]
            }

            if (sql.includes('FROM information_schema.columns')) {
                return [
                    {
                        tableName: 'cat_access_object',
                        columnName: 'col_link_class_id',
                        udtName: 'uuid'
                    },
                    {
                        tableName: 'cat_access_object',
                        columnName: 'col_status',
                        udtName: 'uuid'
                    },
                    {
                        tableName: 'cat_class_object',
                        columnName: 'col_title',
                        udtName: 'text'
                    }
                ]
            }

            if (sql.includes('SELECT id, _seed_source_key AS "seedSourceKey"')) {
                return []
            }

            return []
        })

        await ensurePersonalWorkspaceForUser(executor, {
            schemaName,
            userId: '018f8a78-7b8f-7c1d-a111-222233334780',
            actorUserId: '018f8a78-7b8f-7c1d-a111-222233334781',
            defaultRoleCodename: 'owner'
        })

        const classInsertCall = executor.query.mock.calls.find(([sql]) =>
            String(sql).includes(`INSERT INTO "${schemaName}"."cat_class_object"`)
        )
        const accessInsertCall = executor.query.mock.calls.find(([sql]) =>
            String(sql).includes(`INSERT INTO "${schemaName}"."cat_access_object"`)
        )

        expect(classInsertCall).toBeDefined()
        expect(accessInsertCall).toBeDefined()
        expect(accessInsertCall?.[1]).toEqual(
            expect.arrayContaining([
                '018f8a78-7b8f-7c1d-a111-222233334753',
                'access-seed-row',
                '018f8a78-7b8f-7c1d-a111-222233334754',
                'enum-option-1'
            ])
        )
        expect(accessInsertCall?.[1]).not.toEqual(expect.arrayContaining(['class-seed-row']))
    })

    it('remaps public access-link target ids to workspace-scoped module rows', async () => {
        const { executor } = createMockDbExecutor()
        const schemaName = 'app_018f8a787b8f7c1da111222233334850'
        const generatedIds = [
            '018f8a78-7b8f-7c1d-a111-222233334851',
            '018f8a78-7b8f-7c1d-a111-222233334852',
            '018f8a78-7b8f-7c1d-a111-222233334853',
            '018f8a78-7b8f-7c1d-a111-222233334854'
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
                    return [{ id: '018f8a78-7b8f-7c1d-a111-222233334860', codename: 'owner' }]
                }
                if (params?.[0] === 'member') {
                    return [{ id: '018f8a78-7b8f-7c1d-a111-222233334861', codename: 'member' }]
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
                                moduleObject: [
                                    {
                                        id: 'module-seed-row',
                                        data: {
                                            Title: 'Learning Portal Basics'
                                        }
                                    }
                                ],
                                accessObject: [
                                    {
                                        id: 'access-seed-row',
                                        data: {
                                            TargetType: 'module',
                                            TargetId: 'module-seed-row'
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
                        objectId: 'accessObject',
                        codename: 'AccessLinks',
                        tableName: 'cat_access_object'
                    },
                    {
                        objectId: 'moduleObject',
                        codename: 'Modules',
                        tableName: 'cat_module_object'
                    }
                ]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_attributes"`)) {
                return [
                    {
                        objectId: 'accessObject',
                        attributeId: 'access-target-type-attr',
                        parentAttributeId: null,
                        codename: 'TargetType',
                        columnName: 'col_target_type',
                        dataType: 'STRING',
                        uiConfig: null,
                        targetObjectId: null,
                        targetObjectKind: null
                    },
                    {
                        objectId: 'accessObject',
                        attributeId: 'access-target-id-attr',
                        parentAttributeId: null,
                        codename: 'TargetId',
                        columnName: 'col_target_id',
                        dataType: 'STRING',
                        uiConfig: null,
                        targetObjectId: null,
                        targetObjectKind: null
                    },
                    {
                        objectId: 'moduleObject',
                        attributeId: 'module-title-attr',
                        parentAttributeId: null,
                        codename: 'Title',
                        columnName: 'col_title',
                        dataType: 'STRING',
                        uiConfig: null,
                        targetObjectId: null,
                        targetObjectKind: null
                    }
                ]
            }

            if (sql.includes('FROM information_schema.columns')) {
                return [
                    {
                        tableName: 'cat_access_object',
                        columnName: 'col_target_type',
                        udtName: 'text'
                    },
                    {
                        tableName: 'cat_access_object',
                        columnName: 'col_target_id',
                        udtName: 'text'
                    },
                    {
                        tableName: 'cat_module_object',
                        columnName: 'col_title',
                        udtName: 'text'
                    }
                ]
            }

            if (sql.includes('SELECT id, _seed_source_key AS "seedSourceKey"')) {
                return []
            }

            return []
        })

        await ensurePersonalWorkspaceForUser(executor, {
            schemaName,
            userId: '018f8a78-7b8f-7c1d-a111-222233334880',
            actorUserId: '018f8a78-7b8f-7c1d-a111-222233334881',
            defaultRoleCodename: 'owner'
        })

        const moduleInsertCall = executor.query.mock.calls.find(([sql]) =>
            String(sql).includes(`INSERT INTO "${schemaName}"."cat_module_object"`)
        )
        const accessInsertCall = executor.query.mock.calls.find(([sql]) =>
            String(sql).includes(`INSERT INTO "${schemaName}"."cat_access_object"`)
        )

        expect(moduleInsertCall).toBeDefined()
        expect(accessInsertCall).toBeDefined()
        expect(accessInsertCall?.[1]).toEqual(
            expect.arrayContaining([
                '018f8a78-7b8f-7c1d-a111-222233334854',
                'access-seed-row',
                'module',
                '018f8a78-7b8f-7c1d-a111-222233334853'
            ])
        )
        expect(accessInsertCall?.[1]).not.toEqual(expect.arrayContaining(['module-seed-row']))
    })

    it('does not re-promote the personal workspace to default when another workspace is already default', async () => {
        const { executor } = createMockDbExecutor()
        const schemaName = 'app_018f8a787b8f7c1da111222233334890'

        executor.query.mockImplementation(async (sql: string, params?: unknown[]) => {
            if (sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                return [{ id: 'personal-workspace-id' }]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_workspace_roles"`)) {
                if (params?.[0] === 'owner') {
                    return [{ id: 'owner-role-id', codename: 'owner' }]
                }
                if (params?.[0] === 'member') {
                    return [{ id: 'member-role-id', codename: 'member' }]
                }
            }

            if (
                sql.includes(`FROM "${schemaName}"."_app_workspace_user_roles"`) &&
                sql.includes('WHERE workspace_id = $1') &&
                sql.includes('AND user_id = $2')
            ) {
                return [
                    {
                        workspaceId: 'personal-workspace-id',
                        userId: 'user-id',
                        isDefaultWorkspace: false
                    }
                ]
            }

            if (
                sql.includes(`FROM "${schemaName}"."_app_workspace_user_roles"`) &&
                sql.includes('WHERE user_id = $1') &&
                sql.includes('is_default_workspace = true')
            ) {
                return [{ workspaceId: 'shared-workspace-id' }]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_settings"`)) {
                return []
            }

            return []
        })

        const result = await ensurePersonalWorkspaceForUser(executor, {
            schemaName,
            userId: 'user-id',
            actorUserId: 'actor-id',
            defaultRoleCodename: 'owner'
        })

        expect(result.workspaceId).toBe('personal-workspace-id')

        const promotedPersonalWorkspaceCall = executor.query.mock.calls.find(
            ([sql]) =>
                String(sql).includes(`UPDATE "${schemaName}"."_app_workspace_user_roles"`) &&
                String(sql).includes('SET is_default_workspace = true')
        )
        expect(promotedPersonalWorkspaceCall).toBeUndefined()
    })

    it('remaps module content-item quiz ids to workspace-scoped quiz rows', async () => {
        const { executor } = createMockDbExecutor()
        const schemaName = 'app_018f8a787b8f7c1da111222233334950'
        const generatedIds = [
            '018f8a78-7b8f-7c1d-a111-222233334951',
            '018f8a78-7b8f-7c1d-a111-222233334952',
            '018f8a78-7b8f-7c1d-a111-222233334953',
            '018f8a78-7b8f-7c1d-a111-222233334954',
            '018f8a78-7b8f-7c1d-a111-222233334955'
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
                    return [{ id: '018f8a78-7b8f-7c1d-a111-222233334960', codename: 'owner' }]
                }
                if (params?.[0] === 'member') {
                    return [{ id: '018f8a78-7b8f-7c1d-a111-222233334961', codename: 'member' }]
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
                                moduleObject: [
                                    {
                                        id: 'module-seed-row',
                                        data: {
                                            Title: 'Learning Portal Basics',
                                            ContentItems: [
                                                {
                                                    QuizId: 'quiz-seed-row',
                                                    ItemTitle: 'Readiness check',
                                                    Metadata: { weight: 1, required: true }
                                                }
                                            ]
                                        }
                                    }
                                ],
                                quizObject: [
                                    {
                                        id: 'quiz-seed-row',
                                        data: {
                                            Title: 'Transfer burn readiness'
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
                        objectId: 'moduleObject',
                        codename: 'Modules',
                        tableName: 'cat_module_object'
                    },
                    {
                        objectId: 'quizObject',
                        codename: 'Quizzes',
                        tableName: 'cat_quiz_object'
                    }
                ]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_attributes"`)) {
                return [
                    {
                        objectId: 'moduleObject',
                        attributeId: 'module-title-attr',
                        parentAttributeId: null,
                        codename: 'Title',
                        columnName: 'col_title',
                        dataType: 'STRING',
                        uiConfig: null,
                        targetObjectId: null,
                        targetObjectKind: null
                    },
                    {
                        objectId: 'moduleObject',
                        attributeId: 'module-content-items-attr',
                        parentAttributeId: null,
                        codename: 'ContentItems',
                        columnName: 'col_content_items',
                        dataType: 'TABLE',
                        uiConfig: null,
                        targetObjectId: null,
                        targetObjectKind: null
                    },
                    {
                        objectId: 'moduleObject',
                        attributeId: 'module-content-item-quiz-attr',
                        parentAttributeId: 'module-content-items-attr',
                        codename: 'QuizId',
                        columnName: 'col_quiz_id',
                        dataType: 'STRING',
                        uiConfig: null,
                        targetObjectId: null,
                        targetObjectKind: null
                    },
                    {
                        objectId: 'moduleObject',
                        attributeId: 'module-content-item-title-attr',
                        parentAttributeId: 'module-content-items-attr',
                        codename: 'ItemTitle',
                        columnName: 'col_item_title',
                        dataType: 'STRING',
                        uiConfig: null,
                        targetObjectId: null,
                        targetObjectKind: null
                    },
                    {
                        objectId: 'moduleObject',
                        attributeId: 'module-content-item-metadata-attr',
                        parentAttributeId: 'module-content-items-attr',
                        codename: 'Metadata',
                        columnName: 'col_metadata',
                        dataType: 'JSON',
                        uiConfig: null,
                        targetObjectId: null,
                        targetObjectKind: null
                    },
                    {
                        objectId: 'quizObject',
                        attributeId: 'quiz-title-attr',
                        parentAttributeId: null,
                        codename: 'Title',
                        columnName: 'col_title',
                        dataType: 'STRING',
                        uiConfig: null,
                        targetObjectId: null,
                        targetObjectKind: null
                    }
                ]
            }

            if (sql.includes('FROM information_schema.columns')) {
                expect(params?.[1]).toEqual(expect.arrayContaining(['cat_module_object', 'cat_quiz_object', 'tbl_modulecontentitemsattr']))
                return [
                    {
                        tableName: 'cat_module_object',
                        columnName: 'col_title',
                        udtName: 'text'
                    },
                    {
                        tableName: 'cat_quiz_object',
                        columnName: 'col_title',
                        udtName: 'text'
                    },
                    {
                        tableName: 'tbl_modulecontentitemsattr',
                        columnName: 'col_quiz_id',
                        udtName: 'text'
                    },
                    {
                        tableName: 'tbl_modulecontentitemsattr',
                        columnName: 'col_item_title',
                        udtName: 'text'
                    },
                    {
                        tableName: 'tbl_modulecontentitemsattr',
                        columnName: 'col_metadata',
                        udtName: 'jsonb'
                    }
                ]
            }

            if (sql.includes('SELECT id, _seed_source_key AS "seedSourceKey"')) {
                return []
            }

            return []
        })

        await ensurePersonalWorkspaceForUser(executor, {
            schemaName,
            userId: '018f8a78-7b8f-7c1d-a111-222233334980',
            actorUserId: '018f8a78-7b8f-7c1d-a111-222233334981',
            defaultRoleCodename: 'owner'
        })

        const quizInsertCall = executor.query.mock.calls.find(([sql]) =>
            String(sql).includes(`INSERT INTO "${schemaName}"."cat_quiz_object"`)
        )
        const childInsertCall = executor.query.mock.calls.find(([sql]) =>
            String(sql).includes(`INSERT INTO "${schemaName}"."tbl_modulecontentitemsattr"`)
        )

        expect(quizInsertCall).toBeDefined()
        expect(childInsertCall).toBeDefined()
        expect(childInsertCall?.[1]).toEqual(
            expect.arrayContaining([
                '018f8a78-7b8f-7c1d-a111-222233334955',
                'module-seed-row:module-content-items-attr:0',
                '018f8a78-7b8f-7c1d-a111-222233334953',
                'Readiness check',
                JSON.stringify({ weight: 1, required: true })
            ])
        )
        expect(String(childInsertCall?.[0])).toContain('::jsonb')
        expect(childInsertCall?.[1]).not.toEqual(expect.arrayContaining(['quiz-seed-row']))
    })
})
