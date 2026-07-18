import {
    archivePersonalWorkspaceForUser,
    ensureApplicationRuntimeWorkspaceSchema,
    ensurePersonalWorkspaceForUser,
    resolveRuntimeWorkspaceAccess,
    syncWorkspaceSeededElements
} from '../../services/applicationWorkspaces'
import { createMockDbExecutor } from '../utils/dbMocks'

describe('applicationWorkspaces service', () => {
    it('can resolve runtime workspace access without creating personal workspace rows', async () => {
        const { executor } = createMockDbExecutor()
        const schemaName = 'app_018f8a787b8f7c1da111222233334480'

        executor.query.mockImplementation(async (sql: string) => {
            if (sql.includes('FROM information_schema.tables')) {
                return [{ exists: true }]
            }
            if (sql.includes(`FROM "${schemaName}"."_app_workspace_user_roles"`)) {
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

    it('adds workspace foreign keys and scoped policies to runtime object tables', async () => {
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
        expect(executedSql).toContain('_upl_locked BOOLEAN NOT NULL DEFAULT false')
        expect(executedSql).toContain(`CREATE UNIQUE INDEX IF NOT EXISTS "_app_workspace_settings_workspace_key_active_uidx"`)
        expect(executedSql).not.toContain('DO $$')
        expect(executedSql).toContain('ADD COLUMN IF NOT EXISTS "_seed_source_key" TEXT NULL')
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
                        tableName: 'obj_018f8a787b8f7c1da111222233334670'
                    }
                ]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                return [
                    {
                        objectId: '018f8a78-7b8f-7c1d-a111-222233334670',
                        componentId: '018f8a78-7b8f-7c1d-a111-222233334671',
                        parentComponentId: null,
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
                        tableName: 'obj_018f8a787b8f7c1da111222233334670',
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
            String(sql).includes(`INSERT INTO "${schemaName}"."obj_018f8a787b8f7c1da111222233334670"`)
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

    it('normalizes hex-color workspace seed values through the same semantic contract as runtime writes', async () => {
        const { executor } = createMockDbExecutor()
        const schemaName = 'app_018f8a787b8f7c1da111222233334690'
        const generatedIds = [
            '018f8a78-7b8f-7c1d-a111-222233334691',
            '018f8a78-7b8f-7c1d-a111-222233334692',
            '018f8a78-7b8f-7c1d-a111-222233334693'
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
                    return [{ id: '018f8a78-7b8f-7c1d-a111-222233334694', codename: 'owner' }]
                }
                if (params?.[0] === 'member') {
                    return [{ id: '018f8a78-7b8f-7c1d-a111-222233334695', codename: 'member' }]
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
                                colorObject: [
                                    {
                                        id: 'color-seed-row',
                                        data: {
                                            Title: 'Styled cell',
                                            CellFillColor: '#abc',
                                            TextColor: '#1e88e5'
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
                        objectId: 'colorObject',
                        codename: 'ColorRows',
                        tableName: 'obj_color_object'
                    }
                ]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                return [
                    {
                        objectId: 'colorObject',
                        componentId: 'title-cmp',
                        parentComponentId: null,
                        codename: 'Title',
                        columnName: 'col_title',
                        dataType: 'STRING',
                        uiConfig: null,
                        validationRules: null,
                        targetObjectId: null,
                        targetObjectKind: null
                    },
                    {
                        objectId: 'colorObject',
                        componentId: 'fill-cmp',
                        parentComponentId: null,
                        codename: 'CellFillColor',
                        columnName: 'col_fill',
                        dataType: 'STRING',
                        uiConfig: null,
                        validationRules: { format: 'hexColor' },
                        targetObjectId: null,
                        targetObjectKind: null
                    },
                    {
                        objectId: 'colorObject',
                        componentId: 'text-cmp',
                        parentComponentId: null,
                        codename: 'TextColor',
                        columnName: 'col_text',
                        dataType: 'STRING',
                        uiConfig: null,
                        validationRules: { format: 'hexColor' },
                        targetObjectId: null,
                        targetObjectKind: null
                    }
                ]
            }

            if (sql.includes('FROM information_schema.columns')) {
                return [
                    { tableName: 'obj_color_object', columnName: 'col_title', udtName: 'text' },
                    { tableName: 'obj_color_object', columnName: 'col_fill', udtName: 'text' },
                    { tableName: 'obj_color_object', columnName: 'col_text', udtName: 'text' }
                ]
            }

            if (sql.includes('SELECT id, _seed_source_key AS "seedSourceKey"')) {
                return []
            }

            return []
        })

        await ensurePersonalWorkspaceForUser(executor, {
            schemaName,
            userId: '018f8a78-7b8f-7c1d-a111-222233334696',
            actorUserId: '018f8a78-7b8f-7c1d-a111-222233334697',
            defaultRoleCodename: 'owner'
        })

        const colorInsertCall = executor.query.mock.calls.find(([sql]) =>
            String(sql).includes(`INSERT INTO "${schemaName}"."obj_color_object"`)
        )

        expect(colorInsertCall).toBeDefined()
        expect(colorInsertCall?.[1]).toEqual(expect.arrayContaining(['#AABBCC', '#1E88E5']))
    })

    it('remaps workspace seed refs for object-like objects even when kind metadata is not literal object', async () => {
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
                        tableName: 'obj_access_object'
                    },
                    {
                        objectId: 'classObject',
                        tableName: 'obj_class_object'
                    }
                ]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                return [
                    {
                        objectId: 'accessObject',
                        componentId: 'access-ref-cmp',
                        parentComponentId: null,
                        codename: 'linkClassId',
                        columnName: 'col_link_class_id',
                        dataType: 'REF',
                        uiConfig: null,
                        targetObjectId: 'classObject',
                        targetObjectKind: 'linked_collection'
                    },
                    {
                        objectId: 'accessObject',
                        componentId: 'access-status-cmp',
                        parentComponentId: null,
                        codename: 'status',
                        columnName: 'col_status',
                        dataType: 'REF',
                        uiConfig: null,
                        targetObjectId: 'enumObject',
                        targetObjectKind: 'enumeration'
                    },
                    {
                        objectId: 'classObject',
                        componentId: 'class-title-cmp',
                        parentComponentId: null,
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
                        tableName: 'obj_access_object',
                        columnName: 'col_link_class_id',
                        udtName: 'uuid'
                    },
                    {
                        tableName: 'obj_access_object',
                        columnName: 'col_status',
                        udtName: 'uuid'
                    },
                    {
                        tableName: 'obj_class_object',
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
            String(sql).includes(`INSERT INTO "${schemaName}"."obj_class_object"`)
        )
        const accessInsertCall = executor.query.mock.calls.find(([sql]) =>
            String(sql).includes(`INSERT INTO "${schemaName}"."obj_access_object"`)
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

    it('remaps public access-link target ids to workspace-scoped learning resource rows', async () => {
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
                                contentObject: [
                                    {
                                        id: 'content-seed-row',
                                        data: {
                                            Title: 'Learning Portal Basics'
                                        }
                                    }
                                ],
                                accessObject: [
                                    {
                                        id: 'access-seed-row',
                                        data: {
                                            TargetType: 'content',
                                            TargetId: 'content-seed-row'
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
                        tableName: 'obj_access_object'
                    },
                    {
                        objectId: 'contentObject',
                        codename: 'LearningResources',
                        tableName: 'obj_content_object'
                    }
                ]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                return [
                    {
                        objectId: 'accessObject',
                        componentId: 'access-target-type-cmp',
                        parentComponentId: null,
                        codename: 'TargetType',
                        columnName: 'col_target_type',
                        dataType: 'STRING',
                        uiConfig: null,
                        targetObjectId: null,
                        targetObjectKind: null
                    },
                    {
                        objectId: 'accessObject',
                        componentId: 'access-target-id-cmp',
                        parentComponentId: null,
                        codename: 'TargetId',
                        columnName: 'col_target_id',
                        dataType: 'STRING',
                        uiConfig: null,
                        targetObjectId: null,
                        targetObjectKind: null
                    },
                    {
                        objectId: 'contentObject',
                        componentId: 'content-title-cmp',
                        parentComponentId: null,
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
                        tableName: 'obj_access_object',
                        columnName: 'col_target_type',
                        udtName: 'text'
                    },
                    {
                        tableName: 'obj_access_object',
                        columnName: 'col_target_id',
                        udtName: 'text'
                    },
                    {
                        tableName: 'obj_content_object',
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

        const contentInsertCall = executor.query.mock.calls.find(([sql]) =>
            String(sql).includes(`INSERT INTO "${schemaName}"."obj_content_object"`)
        )
        const accessInsertCall = executor.query.mock.calls.find(([sql]) =>
            String(sql).includes(`INSERT INTO "${schemaName}"."obj_access_object"`)
        )

        expect(contentInsertCall).toBeDefined()
        expect(accessInsertCall).toBeDefined()
        const contentRowId = contentInsertCall?.[1]?.[0]
        expect(accessInsertCall?.[1]).toEqual(expect.arrayContaining(['access-seed-row', 'content', contentRowId]))
        expect(accessInsertCall?.[1]).not.toEqual(expect.arrayContaining(['content-seed-row']))
    })

    it('remaps polymorphic course enrollment target ids to workspace-scoped course rows', async () => {
        const { executor } = createMockDbExecutor()
        const schemaName = 'app_018f8a787b8f7c1da111222233334870'
        const generatedIds = [
            '018f8a78-7b8f-7c1d-a111-222233334871',
            '018f8a78-7b8f-7c1d-a111-222233334872',
            '018f8a78-7b8f-7c1d-a111-222233334873',
            '018f8a78-7b8f-7c1d-a111-222233334874'
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
                    return [{ id: '018f8a78-7b8f-7c1d-a111-222233334875', codename: 'owner' }]
                }
                if (params?.[0] === 'member') {
                    return [{ id: '018f8a78-7b8f-7c1d-a111-222233334876', codename: 'member' }]
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
                                courseObject: [
                                    {
                                        id: 'course-seed-row',
                                        data: {
                                            Title: 'Compliance Refresh Course'
                                        }
                                    }
                                ],
                                enrollmentObject: [
                                    {
                                        id: 'enrollment-seed-row',
                                        data: {
                                            TargetType: 'course',
                                            TargetId: 'course-seed-row',
                                            AssignedUserId: '{{runtime.currentUserId}}'
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
                        objectId: 'enrollmentObject',
                        codename: 'Enrollments',
                        tableName: 'obj_enrollment_object'
                    },
                    {
                        objectId: 'courseObject',
                        codename: 'Courses',
                        tableName: 'obj_course_object'
                    }
                ]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                return [
                    {
                        objectId: 'enrollmentObject',
                        componentId: 'enrollment-target-type-cmp',
                        parentComponentId: null,
                        codename: 'TargetType',
                        columnName: 'col_target_type',
                        dataType: 'STRING',
                        uiConfig: null,
                        targetObjectId: null,
                        targetObjectKind: null
                    },
                    {
                        objectId: 'enrollmentObject',
                        componentId: 'enrollment-target-id-cmp',
                        parentComponentId: null,
                        codename: 'TargetId',
                        columnName: 'col_target_id',
                        dataType: 'STRING',
                        uiConfig: null,
                        targetObjectId: null,
                        targetObjectKind: null
                    },
                    {
                        objectId: 'enrollmentObject',
                        componentId: 'enrollment-assigned-user-cmp',
                        parentComponentId: null,
                        codename: 'AssignedUserId',
                        columnName: 'col_assigned_user_id',
                        dataType: 'STRING',
                        uiConfig: null,
                        targetObjectId: null,
                        targetObjectKind: null
                    },
                    {
                        objectId: 'courseObject',
                        componentId: 'course-title-cmp',
                        parentComponentId: null,
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
                        tableName: 'obj_enrollment_object',
                        columnName: 'col_target_type',
                        udtName: 'text'
                    },
                    {
                        tableName: 'obj_enrollment_object',
                        columnName: 'col_target_id',
                        udtName: 'text'
                    },
                    {
                        tableName: 'obj_enrollment_object',
                        columnName: 'col_assigned_user_id',
                        udtName: 'text'
                    },
                    {
                        tableName: 'obj_course_object',
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
            userId: '018f8a78-7b8f-7c1d-a111-222233334877',
            actorUserId: '018f8a78-7b8f-7c1d-a111-222233334878',
            defaultRoleCodename: 'owner'
        })

        const courseInsertCall = executor.query.mock.calls.find(([sql]) =>
            String(sql).includes(`INSERT INTO "${schemaName}"."obj_course_object"`)
        )
        const enrollmentInsertCall = executor.query.mock.calls.find(([sql]) =>
            String(sql).includes(`INSERT INTO "${schemaName}"."obj_enrollment_object"`)
        )

        expect(courseInsertCall).toBeDefined()
        expect(enrollmentInsertCall).toBeDefined()
        expect(enrollmentInsertCall?.[1]).toEqual(expect.arrayContaining(['018f8a78-7b8f-7c1d-a111-222233334873', 'course']))
        expect(enrollmentInsertCall?.[1]).toEqual(expect.arrayContaining(['018f8a78-7b8f-7c1d-a111-222233334877']))
        expect(enrollmentInsertCall?.[1]).not.toEqual(expect.arrayContaining(['course-seed-row']))
        expect(enrollmentInsertCall?.[1]).not.toEqual(expect.arrayContaining(['{{runtime.currentUserId}}']))
    })

    it('remaps runtime record picker target ids to workspace-scoped content rows', async () => {
        const { executor } = createMockDbExecutor()
        const schemaName = 'app_018f8a787b8f7c1da111222233334900'
        const generatedIds = [
            '018f8a78-7b8f-7c1d-a111-222233334901',
            '018f8a78-7b8f-7c1d-a111-222233334902',
            '018f8a78-7b8f-7c1d-a111-222233334903',
            '018f8a78-7b8f-7c1d-a111-222233334904'
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
                    return [{ id: '018f8a78-7b8f-7c1d-a111-222233334905', codename: 'owner' }]
                }
                if (params?.[0] === 'member') {
                    return [{ id: '018f8a78-7b8f-7c1d-a111-222233334906', codename: 'member' }]
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
                                learningResourceObject: [
                                    {
                                        id: 'resource-seed-row',
                                        data: {
                                            Title: 'Course overview page'
                                        }
                                    }
                                ],
                                courseItemObject: [
                                    {
                                        id: 'course-item-seed-row',
                                        data: {
                                            Title: 'Start with the course overview',
                                            TargetObjectCodename: 'LearningResources',
                                            TargetRecordId: 'resource-seed-row'
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
                        objectId: 'learningResourceObject',
                        codename: 'LearningResources',
                        tableName: 'obj_learning_resource_object'
                    },
                    {
                        objectId: 'courseItemObject',
                        codename: 'CourseItems',
                        tableName: 'obj_course_item_object'
                    }
                ]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                return [
                    {
                        objectId: 'learningResourceObject',
                        componentId: 'resource-title-cmp',
                        parentComponentId: null,
                        codename: 'Title',
                        columnName: 'col_resource_title',
                        dataType: 'STRING',
                        uiConfig: null,
                        targetObjectId: null,
                        targetObjectKind: null
                    },
                    {
                        objectId: 'courseItemObject',
                        componentId: 'item-title-cmp',
                        parentComponentId: null,
                        codename: 'Title',
                        columnName: 'col_item_title',
                        dataType: 'STRING',
                        uiConfig: null,
                        targetObjectId: null,
                        targetObjectKind: null
                    },
                    {
                        objectId: 'courseItemObject',
                        componentId: 'item-target-object-cmp',
                        parentComponentId: null,
                        codename: 'TargetObjectCodename',
                        columnName: 'col_target_object',
                        dataType: 'STRING',
                        uiConfig: null,
                        targetObjectId: null,
                        targetObjectKind: null
                    },
                    {
                        objectId: 'courseItemObject',
                        componentId: 'item-target-record-cmp',
                        parentComponentId: null,
                        codename: 'TargetRecordId',
                        columnName: 'col_target_record',
                        dataType: 'STRING',
                        uiConfig: {
                            widget: 'runtimeRecordPicker',
                            runtimeRecordPicker: {
                                targetObjectCodenameField: 'TargetObjectCodename',
                                allowedObjectCodenames: ['LearningResources']
                            }
                        },
                        targetObjectId: null,
                        targetObjectKind: null
                    }
                ]
            }

            if (sql.includes('FROM information_schema.columns')) {
                return [
                    {
                        tableName: 'obj_learning_resource_object',
                        columnName: 'col_resource_title',
                        udtName: 'text'
                    },
                    {
                        tableName: 'obj_course_item_object',
                        columnName: 'col_item_title',
                        udtName: 'text'
                    },
                    {
                        tableName: 'obj_course_item_object',
                        columnName: 'col_target_object',
                        udtName: 'text'
                    },
                    {
                        tableName: 'obj_course_item_object',
                        columnName: 'col_target_record',
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
            userId: '018f8a78-7b8f-7c1d-a111-222233334907',
            actorUserId: '018f8a78-7b8f-7c1d-a111-222233334908',
            defaultRoleCodename: 'owner'
        })

        const courseItemInsertCall = executor.query.mock.calls.find(([sql]) =>
            String(sql).includes(`INSERT INTO "${schemaName}"."obj_course_item_object"`)
        )

        expect(courseItemInsertCall).toBeDefined()
        expect(courseItemInsertCall?.[1]).toEqual(expect.arrayContaining(['018f8a78-7b8f-7c1d-a111-222233334903']))
        expect(courseItemInsertCall?.[1]).not.toEqual(expect.arrayContaining(['resource-seed-row']))
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

    it('remaps learning resource content-item quiz ids to workspace-scoped quiz rows', async () => {
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
                                contentObject: [
                                    {
                                        id: 'content-seed-row',
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
                        objectId: 'contentObject',
                        codename: 'LearningResources',
                        tableName: 'obj_content_object'
                    },
                    {
                        objectId: 'quizObject',
                        codename: 'Quizzes',
                        tableName: 'obj_quiz_object'
                    }
                ]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                return [
                    {
                        objectId: 'contentObject',
                        componentId: 'content-title-cmp',
                        parentComponentId: null,
                        codename: 'Title',
                        columnName: 'col_title',
                        dataType: 'STRING',
                        uiConfig: null,
                        targetObjectId: null,
                        targetObjectKind: null
                    },
                    {
                        objectId: 'contentObject',
                        componentId: 'content-items-cmp',
                        parentComponentId: null,
                        codename: 'ContentItems',
                        columnName: 'col_content_items',
                        dataType: 'TABLE',
                        uiConfig: null,
                        targetObjectId: null,
                        targetObjectKind: null
                    },
                    {
                        objectId: 'contentObject',
                        componentId: 'content-item-quiz-cmp',
                        parentComponentId: 'content-items-cmp',
                        codename: 'QuizId',
                        columnName: 'col_quiz_id',
                        dataType: 'STRING',
                        uiConfig: null,
                        targetObjectId: null,
                        targetObjectKind: null
                    },
                    {
                        objectId: 'contentObject',
                        componentId: 'content-item-title-cmp',
                        parentComponentId: 'content-items-cmp',
                        codename: 'ItemTitle',
                        columnName: 'col_item_title',
                        dataType: 'STRING',
                        uiConfig: null,
                        targetObjectId: null,
                        targetObjectKind: null
                    },
                    {
                        objectId: 'contentObject',
                        componentId: 'content-item-metadata-cmp',
                        parentComponentId: 'content-items-cmp',
                        codename: 'Metadata',
                        columnName: 'col_metadata',
                        dataType: 'JSON',
                        uiConfig: null,
                        targetObjectId: null,
                        targetObjectKind: null
                    },
                    {
                        objectId: 'quizObject',
                        componentId: 'quiz-title-cmp',
                        parentComponentId: null,
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
                expect(params?.[1]).toEqual(expect.arrayContaining(['obj_content_object', 'obj_quiz_object', 'tbl_contentitemscmp']))
                return [
                    {
                        tableName: 'obj_content_object',
                        columnName: 'col_title',
                        udtName: 'text'
                    },
                    {
                        tableName: 'obj_quiz_object',
                        columnName: 'col_title',
                        udtName: 'text'
                    },
                    {
                        tableName: 'tbl_contentitemscmp',
                        columnName: 'col_quiz_id',
                        udtName: 'text'
                    },
                    {
                        tableName: 'tbl_contentitemscmp',
                        columnName: 'col_item_title',
                        udtName: 'text'
                    },
                    {
                        tableName: 'tbl_contentitemscmp',
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
            String(sql).includes(`INSERT INTO "${schemaName}"."obj_quiz_object"`)
        )
        const childInsertCall = executor.query.mock.calls.find(([sql]) =>
            String(sql).includes(`INSERT INTO "${schemaName}"."tbl_contentitemscmp"`)
        )

        expect(quizInsertCall).toBeDefined()
        expect(childInsertCall).toBeDefined()
        const quizRowId = quizInsertCall?.[1]?.[0]
        expect(childInsertCall?.[1]).toEqual(
            expect.arrayContaining([
                'content-seed-row:content-items-cmp:0',
                quizRowId,
                'Readiness check',
                JSON.stringify({ weight: 1, required: true })
            ])
        )
        expect(String(childInsertCall?.[0])).toContain('::jsonb')
        expect(childInsertCall?.[1]).not.toEqual(expect.arrayContaining(['quiz-seed-row']))
    })

    it('orders workspace seed objects by object refs declared inside table child components', async () => {
        const { executor } = createMockDbExecutor()
        const schemaName = 'app_018f8a787b8f7c1da111222233335050'
        const generatedIds = [
            '018f8a78-7b8f-7c1d-a111-222233335051',
            '018f8a78-7b8f-7c1d-a111-222233335052',
            '018f8a78-7b8f-7c1d-a111-222233335053',
            '018f8a78-7b8f-7c1d-a111-222233335054',
            '018f8a78-7b8f-7c1d-a111-222233335055'
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
                    return [{ id: '018f8a78-7b8f-7c1d-a111-222233335060', codename: 'owner' }]
                }
                if (params?.[0] === 'member') {
                    return [{ id: '018f8a78-7b8f-7c1d-a111-222233335061', codename: 'member' }]
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
                                trackObject: [
                                    {
                                        id: 'track-seed-row',
                                        data: {
                                            Title: 'Onboarding track',
                                            TrackItems: [
                                                {
                                                    ContentNodeId: 'content-seed-row',
                                                    Required: true
                                                }
                                            ]
                                        }
                                    }
                                ],
                                contentObject: [
                                    {
                                        id: 'content-seed-row',
                                        data: {
                                            Title: 'Learning Path 101'
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
                        objectId: 'trackObject',
                        codename: 'LearningTracks',
                        tableName: 'obj_track_object'
                    },
                    {
                        objectId: 'contentObject',
                        codename: 'LearningResources',
                        tableName: 'obj_content_object'
                    }
                ]
            }

            if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                return [
                    {
                        objectId: 'trackObject',
                        componentId: 'track-title-cmp',
                        parentComponentId: null,
                        codename: 'Title',
                        columnName: 'col_title',
                        dataType: 'STRING',
                        uiConfig: null,
                        targetObjectId: null,
                        targetObjectKind: null
                    },
                    {
                        objectId: 'trackObject',
                        componentId: 'track-items-cmp',
                        parentComponentId: null,
                        codename: 'TrackItems',
                        columnName: 'col_track_items',
                        dataType: 'TABLE',
                        uiConfig: null,
                        targetObjectId: null,
                        targetObjectKind: null
                    },
                    {
                        objectId: 'trackItemsObject',
                        componentId: 'track-item-content-cmp',
                        parentComponentId: 'track-items-cmp',
                        codename: 'ContentNodeId',
                        columnName: 'col_content_node_id',
                        dataType: 'REF',
                        uiConfig: null,
                        targetObjectId: 'contentObject',
                        targetObjectKind: 'object'
                    },
                    {
                        objectId: 'trackItemsObject',
                        componentId: 'track-item-required-cmp',
                        parentComponentId: 'track-items-cmp',
                        codename: 'Required',
                        columnName: 'col_required',
                        dataType: 'BOOLEAN',
                        uiConfig: null,
                        targetObjectId: null,
                        targetObjectKind: null
                    },
                    {
                        objectId: 'contentObject',
                        componentId: 'content-title-cmp',
                        parentComponentId: null,
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
                        tableName: 'obj_track_object',
                        columnName: 'col_title',
                        udtName: 'text'
                    },
                    {
                        tableName: 'obj_content_object',
                        columnName: 'col_title',
                        udtName: 'text'
                    },
                    {
                        tableName: 'tbl_trackitemscmp',
                        columnName: 'col_content_node_id',
                        udtName: 'uuid'
                    },
                    {
                        tableName: 'tbl_trackitemscmp',
                        columnName: 'col_required',
                        udtName: 'bool'
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
            userId: '018f8a78-7b8f-7c1d-a111-222233335080',
            actorUserId: '018f8a78-7b8f-7c1d-a111-222233335081',
            defaultRoleCodename: 'owner'
        })

        const insertCalls = executor.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO'))
        const contentInsertIndex = insertCalls.findIndex(([sql]) =>
            String(sql).includes(`INSERT INTO "${schemaName}"."obj_content_object"`)
        )
        const trackInsertIndex = insertCalls.findIndex(([sql]) => String(sql).includes(`INSERT INTO "${schemaName}"."obj_track_object"`))
        const childInsertCall = insertCalls.find(([sql]) => String(sql).includes(`INSERT INTO "${schemaName}"."tbl_trackitemscmp"`))

        expect(contentInsertIndex).toBeGreaterThanOrEqual(0)
        expect(trackInsertIndex).toBeGreaterThanOrEqual(0)
        expect(contentInsertIndex).toBeLessThan(trackInsertIndex)
        expect(childInsertCall?.[1]).toEqual(
            expect.arrayContaining(['track-seed-row:track-items-cmp:0', '018f8a78-7b8f-7c1d-a111-222233335053', true])
        )
        expect(childInsertCall?.[1]).not.toEqual(expect.arrayContaining(['content-seed-row']))
    })
})
