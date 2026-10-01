import { ensurePersonalWorkspaceForUser } from '../../services/applicationWorkspaces'
import { createMockDbExecutor } from '../utils/dbMocks'

describe('applicationWorkspaces seed creation and normalization', () => {
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
        expect(String(workspaceInsertCall?.[0])).toContain('ON CONFLICT (personal_user_id)')

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
})
