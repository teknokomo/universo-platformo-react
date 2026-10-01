import { ensurePersonalWorkspaceForUser } from '../../services/applicationWorkspaces'
import { createMockDbExecutor } from '../utils/dbMocks'

describe('applicationWorkspaces seed reference remapping', () => {
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
})
