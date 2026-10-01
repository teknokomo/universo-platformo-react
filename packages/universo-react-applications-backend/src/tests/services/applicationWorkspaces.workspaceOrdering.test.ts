import { ensurePersonalWorkspaceForUser } from '../../services/applicationWorkspaces'
import { createMockDbExecutor } from '../utils/dbMocks'

describe('applicationWorkspaces workspace defaults and seed ordering', () => {
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
