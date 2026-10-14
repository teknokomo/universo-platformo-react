import {
    applicationId,
    schemaName,
    contentNodeId,
    quizId,
    accessLinkId,
    workspaceId1,
    workspaceId2,
    withPublicApplication,
    buildDataSource,
    buildApp,
    request,
    codenameVlc,
    localizedTextVlc,
    installPublicApplicationsTestHooks
} from './publicApplicationsRoutes.testSupport'

describe('Public Applications Routes: guest runtime content', () => {
    installPublicApplicationsTestHooks()

    it('rejects direct runtime access without a slug', async () => {
        const dataSource = buildDataSource(withPublicApplication(() => undefined))
        const app = buildApp(dataSource)

        await request(app).get(`/public/a/${applicationId}/runtime?targetType=content&targetId=${contentNodeId}`).expect(400)
    })

    it('rejects runtime targets that are not linked from the requested access link', async () => {
        const dataSource = buildDataSource(
            withPublicApplication((sql, params) => {
                if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                    if (params[0] === 'AccessLinks') {
                        return [{ id: 'object-links', codename: 'AccessLinks', kind: 'object', table_name: 'access_links_table' }]
                    }
                    return [
                        {
                            id: 'object-learning-resources',
                            codename: 'LearningResources',
                            kind: 'object',
                            table_name: 'learning_resources_table'
                        }
                    ]
                }

                if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                    if (params[0] === 'object-links') {
                        return [
                            { id: 'attr-1', codename: 'Slug', column_name: 'slug', data_type: 'STRING', parent_component_id: null },
                            {
                                id: 'attr-2',
                                codename: 'TargetType',
                                column_name: 'target_type',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-3',
                                codename: 'TargetId',
                                column_name: 'target_id',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-4',
                                codename: 'IsActive',
                                column_name: 'is_active',
                                data_type: 'BOOLEAN',
                                parent_component_id: null
                            }
                        ]
                    }

                    return [
                        { id: 'attr-title', codename: 'Title', column_name: 'title', data_type: 'STRING', parent_component_id: null },
                        {
                            id: 'attr-description',
                            codename: 'Description',
                            column_name: 'description',
                            data_type: 'STRING',
                            parent_component_id: null
                        },
                        {
                            id: 'attr-content',
                            codename: 'ContentItems',
                            column_name: 'content_items',
                            data_type: 'TABLE',
                            parent_component_id: null
                        },
                        {
                            id: 'child-type',
                            codename: 'ItemType',
                            column_name: 'item_type',
                            data_type: 'REF',
                            parent_component_id: 'attr-content',
                            target_object_id: 'enum-content-type',
                            target_object_kind: 'enumeration'
                        },
                        {
                            id: 'child-title',
                            codename: 'ItemTitle',
                            column_name: 'item_title',
                            data_type: 'STRING',
                            parent_component_id: 'attr-content'
                        },
                        {
                            id: 'child-content',
                            codename: 'ItemContent',
                            column_name: 'item_content',
                            data_type: 'STRING',
                            parent_component_id: 'attr-content'
                        },
                        {
                            id: 'child-quiz',
                            codename: 'QuizId',
                            column_name: 'quiz_id',
                            data_type: 'STRING',
                            parent_component_id: 'attr-content'
                        },
                        {
                            id: 'child-sort',
                            codename: 'SortOrder',
                            column_name: 'sort_order',
                            data_type: 'NUMBER',
                            parent_component_id: 'attr-content'
                        }
                    ]
                }

                if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                    return [{ id: accessLinkId, slug: 'demo-content', target_type: 'content', target_id: contentNodeId, is_active: true }]
                }

                if (sql.includes(`FROM "${schemaName}"."learning_resources_table"`)) {
                    return [{ id: contentNodeId, title: 'Demo content', description: 'Lesson' }]
                }

                if (sql.includes(`FROM "${schemaName}"."_app_values"`)) {
                    return [{ id: 'value-quiz-ref', object_id: 'enum-content-type', codename: 'QuizRef' }]
                }

                if (sql.includes(`FROM "${schemaName}"."content_items"`)) {
                    return [
                        {
                            id: 'row-1',
                            parent_record_id: contentNodeId,
                            item_type: 'value-quiz-ref',
                            item_title: 'Allowed quiz',
                            item_content: '',
                            quiz_id: quizId,
                            sort_order: 1
                        }
                    ]
                }

                return undefined
            })
        )

        const app = buildApp(dataSource)
        await request(app)
            .get(`/public/a/${applicationId}/runtime?slug=demo-content&targetType=quiz&targetId=018f8a78-7b8f-7c1d-a111-222233334444`)
            .expect(403)
    })

    it('returns content with an empty child list when its optional TABLE component is absent', async () => {
        const executedSql: string[] = []
        const dataSource = buildDataSource(
            withPublicApplication((sql, params) => {
                executedSql.push(sql)

                if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                    if (params[0] === 'AccessLinks') {
                        return [
                            { id: 'object-links', codename: codenameVlc('AccessLinks'), kind: 'object', table_name: 'access_links_table' }
                        ]
                    }
                    return [
                        {
                            id: 'object-learning-resources',
                            codename: codenameVlc('LearningResources'),
                            kind: 'object',
                            table_name: 'learning_resources_table'
                        }
                    ]
                }

                if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                    if (params[0] === 'object-links') {
                        return [
                            {
                                id: 'attr-slug',
                                codename: codenameVlc('Slug'),
                                column_name: 'slug',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-target-type',
                                codename: codenameVlc('TargetType'),
                                column_name: 'target_type',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-target-id',
                                codename: codenameVlc('TargetId'),
                                column_name: 'target_id',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-active',
                                codename: codenameVlc('IsActive'),
                                column_name: 'is_active',
                                data_type: 'BOOLEAN',
                                parent_component_id: null
                            }
                        ]
                    }

                    return [
                        {
                            id: 'attr-title',
                            codename: codenameVlc('Title'),
                            column_name: 'title',
                            data_type: 'STRING',
                            parent_component_id: null
                        },
                        {
                            id: 'attr-description',
                            codename: codenameVlc('Description'),
                            column_name: 'description',
                            data_type: 'STRING',
                            parent_component_id: null
                        }
                    ]
                }

                if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                    return [{ id: accessLinkId, slug: 'demo-content', target_type: 'content', target_id: contentNodeId, is_active: true }]
                }

                if (sql.includes(`FROM "${schemaName}"."learning_resources_table"`)) {
                    return [{ id: contentNodeId, title: 'Content without optional items', description: 'A standalone lesson' }]
                }

                return undefined
            })
        )

        const response = await request(buildApp(dataSource)).get(`/public/a/${applicationId}/runtime?slug=demo-content`).expect(200)

        expect(response.body).toMatchObject({
            type: 'content',
            id: contentNodeId,
            title: 'Content without optional items',
            contentItems: []
        })
        expect(executedSql.some((sql) => sql.includes(`FROM "${schemaName}"."content_items"`))).toBe(false)
    })

    it('keeps runtime reads bound to the workspace resolved from the access link', async () => {
        let currentWorkspaceId = ''

        const dataSource = buildDataSource(
            withPublicApplication(
                (sql, params) => {
                    if (sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                        return [{ id: workspaceId2 }, { id: workspaceId1 }]
                    }

                    if (sql.includes("set_config('app.current_workspace_id'")) {
                        currentWorkspaceId = String(params[0] ?? '')
                        return []
                    }

                    if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                        if (params[0] === 'AccessLinks') {
                            return [{ id: 'object-links', codename: 'AccessLinks', kind: 'object', table_name: 'access_links_table' }]
                        }
                        return [
                            {
                                id: 'object-learning-resources',
                                codename: 'LearningResources',
                                kind: 'object',
                                table_name: 'learning_resources_table'
                            }
                        ]
                    }

                    if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                        if (params[0] === 'object-links') {
                            return [
                                { id: 'attr-1', codename: 'Slug', column_name: 'slug', data_type: 'STRING', parent_component_id: null },
                                {
                                    id: 'attr-2',
                                    codename: 'TargetType',
                                    column_name: 'target_type',
                                    data_type: 'STRING',
                                    parent_component_id: null
                                },
                                {
                                    id: 'attr-3',
                                    codename: 'TargetId',
                                    column_name: 'target_id',
                                    data_type: 'STRING',
                                    parent_component_id: null
                                },
                                {
                                    id: 'attr-4',
                                    codename: 'IsActive',
                                    column_name: 'is_active',
                                    data_type: 'BOOLEAN',
                                    parent_component_id: null
                                }
                            ]
                        }

                        return [
                            { id: 'attr-title', codename: 'Title', column_name: 'title', data_type: 'STRING', parent_component_id: null },
                            {
                                id: 'attr-description',
                                codename: 'Description',
                                column_name: 'description',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-content',
                                codename: 'ContentItems',
                                column_name: 'content_items',
                                data_type: 'TABLE',
                                parent_component_id: null
                            },
                            {
                                id: 'child-type',
                                codename: 'ItemType',
                                column_name: 'item_type',
                                data_type: 'REF',
                                parent_component_id: 'attr-content',
                                target_object_id: 'enum-content-type',
                                target_object_kind: 'enumeration'
                            },
                            {
                                id: 'child-title',
                                codename: 'ItemTitle',
                                column_name: 'item_title',
                                data_type: 'STRING',
                                parent_component_id: 'attr-content'
                            },
                            {
                                id: 'child-content',
                                codename: 'ItemContent',
                                column_name: 'item_content',
                                data_type: 'STRING',
                                parent_component_id: 'attr-content'
                            },
                            {
                                id: 'child-sort',
                                codename: 'SortOrder',
                                column_name: 'sort_order',
                                data_type: 'NUMBER',
                                parent_component_id: 'attr-content'
                            }
                        ]
                    }

                    if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                        return currentWorkspaceId === workspaceId2
                            ? [
                                  {
                                      id: accessLinkId,
                                      slug: 'demo-content',
                                      target_type: 'content',
                                      target_id: contentNodeId,
                                      is_active: true
                                  }
                              ]
                            : []
                    }

                    if (sql.includes(`FROM "${schemaName}"."learning_resources_table"`)) {
                        return currentWorkspaceId === workspaceId2
                            ? [{ id: contentNodeId, title: 'Scoped content', description: 'Scoped lesson' }]
                            : []
                    }

                    if (sql.includes(`FROM "${schemaName}"."_app_values"`)) {
                        return [{ id: 'value-text', object_id: 'enum-content-type', codename: 'Text' }]
                    }

                    if (sql.includes(`FROM "${schemaName}"."content_items"`)) {
                        return currentWorkspaceId === workspaceId2
                            ? [
                                  {
                                      id: 'row-1',
                                      _tp_parent_id: contentNodeId,
                                      _tp_sort_order: 1,
                                      item_type: 'value-text',
                                      item_title: 'Scoped item',
                                      item_content: 'Workspace-bound content',
                                      quiz_id: null
                                  }
                              ]
                            : []
                    }

                    return undefined
                },
                { workspacesEnabled: true }
            )
        )

        const app = buildApp(dataSource)
        const response = await request(app).get(`/public/a/${applicationId}/runtime?slug=demo-content`).expect(200)

        expect(response.body).toMatchObject({
            type: 'content',
            id: contentNodeId,
            title: 'Scoped content'
        })
        expect(response.body.contentItems).toEqual([
            expect.objectContaining({
                itemType: 'text',
                itemTitle: 'Scoped item',
                itemContent: 'Workspace-bound content'
            })
        ])
    })

    it('rebinds runtime payload assembly to the shared public link workspace when ambient workspace state drifts', async () => {
        let currentWorkspaceId = workspaceId1
        const personalContentNodeId = '31b2d8e1-2b7c-4f9f-8b8e-4f1c8f1d55aa'
        const personalQuizId = '64ab92e2-a4c2-44b3-8e94-2a71c4c3a9d9'

        const dataSource = buildDataSource(
            withPublicApplication(
                (sql, params) => {
                    if (sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                        return [{ id: workspaceId2 }]
                    }

                    if (sql.includes("set_config('app.current_workspace_id'")) {
                        currentWorkspaceId = String(params[0] ?? '')
                        return []
                    }

                    if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                        if (params[0] === 'AccessLinks') {
                            return [{ id: 'object-links', codename: 'AccessLinks', kind: 'object', table_name: 'access_links_table' }]
                        }
                        return [
                            {
                                id: 'object-learning-resources',
                                codename: 'LearningResources',
                                kind: 'object',
                                table_name: 'learning_resources_table'
                            }
                        ]
                    }

                    if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                        if (params[0] === 'object-links') {
                            return [
                                { id: 'attr-1', codename: 'Slug', column_name: 'slug', data_type: 'STRING', parent_component_id: null },
                                {
                                    id: 'attr-2',
                                    codename: 'TargetType',
                                    column_name: 'target_type',
                                    data_type: 'STRING',
                                    parent_component_id: null
                                },
                                {
                                    id: 'attr-3',
                                    codename: 'TargetId',
                                    column_name: 'target_id',
                                    data_type: 'STRING',
                                    parent_component_id: null
                                },
                                {
                                    id: 'attr-4',
                                    codename: 'IsActive',
                                    column_name: 'is_active',
                                    data_type: 'BOOLEAN',
                                    parent_component_id: null
                                }
                            ]
                        }

                        return [
                            { id: 'attr-title', codename: 'Title', column_name: 'title', data_type: 'STRING', parent_component_id: null },
                            {
                                id: 'attr-description',
                                codename: 'Description',
                                column_name: 'description',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-content',
                                codename: 'ContentItems',
                                column_name: 'content_items',
                                data_type: 'TABLE',
                                parent_component_id: null
                            },
                            {
                                id: 'child-type',
                                codename: 'ItemType',
                                column_name: 'item_type',
                                data_type: 'REF',
                                parent_component_id: 'attr-content',
                                target_object_id: 'enum-content-type',
                                target_object_kind: 'enumeration'
                            },
                            {
                                id: 'child-title',
                                codename: 'ItemTitle',
                                column_name: 'item_title',
                                data_type: 'STRING',
                                parent_component_id: 'attr-content'
                            },
                            {
                                id: 'child-content',
                                codename: 'ItemContent',
                                column_name: 'item_content',
                                data_type: 'STRING',
                                parent_component_id: 'attr-content'
                            },
                            {
                                id: 'child-quiz',
                                codename: 'QuizId',
                                column_name: 'quiz_id',
                                data_type: 'STRING',
                                parent_component_id: 'attr-content'
                            },
                            {
                                id: 'child-sort',
                                codename: 'SortOrder',
                                column_name: 'sort_order',
                                data_type: 'NUMBER',
                                parent_component_id: 'attr-content'
                            }
                        ]
                    }

                    if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                        if (currentWorkspaceId === workspaceId2) {
                            currentWorkspaceId = workspaceId1
                            return [
                                {
                                    id: accessLinkId,
                                    slug: 'demo-content',
                                    target_type: 'content',
                                    target_id: contentNodeId,
                                    is_active: true
                                }
                            ]
                        }

                        if (currentWorkspaceId === workspaceId1) {
                            return [
                                {
                                    id: 'personal-link',
                                    slug: 'demo-content',
                                    target_type: 'content',
                                    target_id: personalContentNodeId,
                                    is_active: true
                                }
                            ]
                        }

                        return []
                    }

                    if (sql.includes(`FROM "${schemaName}"."learning_resources_table"`)) {
                        return currentWorkspaceId === workspaceId2
                            ? [{ id: contentNodeId, title: 'Shared content', description: 'Shared lesson' }]
                            : [{ id: personalContentNodeId, title: 'Personal content', description: 'Personal lesson' }]
                    }

                    if (sql.includes(`FROM "${schemaName}"."_app_values"`)) {
                        return [{ id: 'value-quiz-ref', object_id: 'enum-content-type', codename: 'QuizRef' }]
                    }

                    if (sql.includes(`FROM "${schemaName}"."content_items"`)) {
                        return currentWorkspaceId === workspaceId2
                            ? [
                                  {
                                      id: 'shared-row',
                                      _tp_parent_id: contentNodeId,
                                      _tp_sort_order: 1,
                                      item_type: 'value-quiz-ref',
                                      item_title: 'Shared quiz',
                                      item_content: '',
                                      quiz_id: quizId
                                  }
                              ]
                            : [
                                  {
                                      id: 'personal-row',
                                      _tp_parent_id: personalContentNodeId,
                                      _tp_sort_order: 1,
                                      item_type: 'value-quiz-ref',
                                      item_title: 'Personal quiz',
                                      item_content: '',
                                      quiz_id: personalQuizId
                                  }
                              ]
                    }

                    return undefined
                },
                { workspacesEnabled: true }
            )
        )

        const app = buildApp(dataSource)
        const response = await request(app).get(`/public/a/${applicationId}/runtime?slug=demo-content`).expect(200)

        expect(response.body).toMatchObject({
            type: 'content',
            id: contentNodeId,
            title: 'Shared content'
        })
        expect(response.body.contentItems).toEqual([
            expect.objectContaining({
                itemType: 'quiz_ref',
                itemTitle: 'Shared quiz',
                quizId
            })
        ])
        expect(currentWorkspaceId).toBe(workspaceId2)
    })

    it('resolves public runtime enumeration codenames from localized value objects', async () => {
        const dataSource = buildDataSource(
            withPublicApplication((sql, params) => {
                if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                    if (params[0] === 'AccessLinks') {
                        return [
                            { id: 'object-links', codename: codenameVlc('AccessLinks'), kind: 'object', table_name: 'access_links_table' }
                        ]
                    }
                    return [
                        {
                            id: 'object-learning-resources',
                            codename: codenameVlc('LearningResources'),
                            kind: 'object',
                            table_name: 'learning_resources_table'
                        }
                    ]
                }

                if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                    if (params[0] === 'object-links') {
                        return [
                            {
                                id: 'attr-1',
                                codename: codenameVlc('Slug'),
                                column_name: 'slug',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-2',
                                codename: codenameVlc('TargetType'),
                                column_name: 'target_type',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-3',
                                codename: codenameVlc('TargetId'),
                                column_name: 'target_id',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-4',
                                codename: codenameVlc('IsActive'),
                                column_name: 'is_active',
                                data_type: 'BOOLEAN',
                                parent_component_id: null
                            }
                        ]
                    }

                    return [
                        {
                            id: 'attr-title',
                            codename: codenameVlc('Title'),
                            column_name: 'title',
                            data_type: 'STRING',
                            parent_component_id: null
                        },
                        {
                            id: 'attr-description',
                            codename: codenameVlc('Description'),
                            column_name: 'description',
                            data_type: 'STRING',
                            parent_component_id: null
                        },
                        {
                            id: 'attr-content',
                            codename: codenameVlc('ContentItems'),
                            column_name: 'content_items',
                            data_type: 'TABLE',
                            parent_component_id: null
                        },
                        {
                            id: 'child-type',
                            codename: codenameVlc('ItemType'),
                            column_name: 'item_type',
                            data_type: 'REF',
                            parent_component_id: 'attr-content',
                            target_object_id: 'enum-content-type',
                            target_object_kind: 'enumeration'
                        },
                        {
                            id: 'child-title',
                            codename: codenameVlc('ItemTitle'),
                            column_name: 'item_title',
                            data_type: 'STRING',
                            parent_component_id: 'attr-content'
                        },
                        {
                            id: 'child-quiz',
                            codename: codenameVlc('QuizId'),
                            column_name: 'quiz_id',
                            data_type: 'STRING',
                            parent_component_id: 'attr-content'
                        },
                        {
                            id: 'child-content',
                            codename: codenameVlc('ItemContent'),
                            column_name: 'item_content',
                            data_type: 'STRING',
                            parent_component_id: 'attr-content'
                        },
                        {
                            id: 'child-sort',
                            codename: codenameVlc('SortOrder'),
                            column_name: 'sort_order',
                            data_type: 'NUMBER',
                            parent_component_id: 'attr-content'
                        }
                    ]
                }

                if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                    return [{ id: accessLinkId, slug: 'demo-content', target_type: 'content', target_id: contentNodeId, is_active: true }]
                }

                if (sql.includes(`FROM "${schemaName}"."learning_resources_table"`)) {
                    return [{ id: contentNodeId, title: 'Localized content', description: 'Localized lesson' }]
                }

                if (sql.includes(`FROM "${schemaName}"."_app_values"`)) {
                    return [{ id: 'value-quiz-ref', object_id: 'enum-content-type', codename: codenameVlc('QuizRef') }]
                }

                if (sql.includes(`FROM "${schemaName}"."content_items"`)) {
                    return [
                        {
                            id: 'row-1',
                            _tp_parent_id: contentNodeId,
                            _tp_sort_order: 1,
                            item_type: 'value-quiz-ref',
                            item_title: 'Localized quiz',
                            item_content: '',
                            quiz_id: quizId
                        }
                    ]
                }

                return undefined
            })
        )

        const app = buildApp(dataSource)
        const response = await request(app).get(`/public/a/${applicationId}/runtime?slug=demo-content`).expect(200)

        expect(response.body).toMatchObject({
            type: 'content',
            id: contentNodeId,
            title: 'Localized content'
        })
        expect(response.body.contentItems).toEqual([
            expect.objectContaining({
                itemType: 'quiz_ref',
                itemTitle: 'Localized quiz'
            })
        ])
    })

    it('localizes runtime learning content payloads when locale is provided', async () => {
        const dataSource = buildDataSource(
            withPublicApplication((sql, params) => {
                if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                    if (params[0] === 'AccessLinks') {
                        return [
                            { id: 'object-links', codename: codenameVlc('AccessLinks'), kind: 'object', table_name: 'access_links_table' }
                        ]
                    }
                    return [
                        {
                            id: 'object-learning-resources',
                            codename: codenameVlc('LearningResources'),
                            kind: 'object',
                            table_name: 'learning_resources_table'
                        }
                    ]
                }

                if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                    if (params[0] === 'object-links') {
                        return [
                            {
                                id: 'attr-1',
                                codename: codenameVlc('Slug'),
                                column_name: 'slug',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-2',
                                codename: codenameVlc('TargetType'),
                                column_name: 'target_type',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-3',
                                codename: codenameVlc('TargetId'),
                                column_name: 'target_id',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'attr-4',
                                codename: codenameVlc('IsActive'),
                                column_name: 'is_active',
                                data_type: 'BOOLEAN',
                                parent_component_id: null
                            }
                        ]
                    }

                    return [
                        {
                            id: 'attr-title',
                            codename: codenameVlc('Title'),
                            column_name: 'title',
                            data_type: 'STRING',
                            parent_component_id: null
                        },
                        {
                            id: 'attr-description',
                            codename: codenameVlc('Description'),
                            column_name: 'description',
                            data_type: 'STRING',
                            parent_component_id: null
                        },
                        {
                            id: 'attr-content',
                            codename: codenameVlc('ContentItems'),
                            column_name: 'content_items',
                            data_type: 'TABLE',
                            parent_component_id: null
                        },
                        {
                            id: 'child-type',
                            codename: codenameVlc('ItemType'),
                            column_name: 'item_type',
                            data_type: 'REF',
                            parent_component_id: 'attr-content',
                            target_object_id: 'enum-content-type',
                            target_object_kind: 'enumeration'
                        },
                        {
                            id: 'child-title',
                            codename: codenameVlc('ItemTitle'),
                            column_name: 'item_title',
                            data_type: 'STRING',
                            parent_component_id: 'attr-content'
                        },
                        {
                            id: 'child-quiz',
                            codename: codenameVlc('QuizId'),
                            column_name: 'quiz_id',
                            data_type: 'STRING',
                            parent_component_id: 'attr-content'
                        },
                        {
                            id: 'child-content',
                            codename: codenameVlc('ItemContent'),
                            column_name: 'item_content',
                            data_type: 'STRING',
                            parent_component_id: 'attr-content'
                        },
                        {
                            id: 'child-sort',
                            codename: codenameVlc('SortOrder'),
                            column_name: 'sort_order',
                            data_type: 'NUMBER',
                            parent_component_id: 'attr-content'
                        }
                    ]
                }

                if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                    return [{ id: accessLinkId, slug: 'demo-content', target_type: 'content', target_id: contentNodeId, is_active: true }]
                }

                if (sql.includes(`FROM "${schemaName}"."learning_resources_table"`)) {
                    return [
                        {
                            id: contentNodeId,
                            title: localizedTextVlc('Orbital lesson', 'Орбитальный урок'),
                            description: localizedTextVlc('English lesson body', 'Русское описание урока')
                        }
                    ]
                }

                if (sql.includes(`FROM "${schemaName}"."_app_values"`)) {
                    return [{ id: 'value-text', object_id: 'enum-content-type', codename: codenameVlc('Text') }]
                }

                if (sql.includes(`FROM "${schemaName}"."content_items"`)) {
                    return [
                        {
                            id: 'row-1',
                            _tp_parent_id: contentNodeId,
                            _tp_sort_order: 1,
                            item_type: 'value-text',
                            item_title: localizedTextVlc('Mission brief', 'Брифинг миссии'),
                            item_content: localizedTextVlc('English content', 'Русский контент'),
                            quiz_id: null
                        }
                    ]
                }

                return undefined
            })
        )

        const app = buildApp(dataSource)
        const response = await request(app).get(`/public/a/${applicationId}/runtime?slug=demo-content&locale=ru`).expect(200)

        expect(response.body).toMatchObject({
            type: 'content',
            id: contentNodeId,
            title: 'Орбитальный урок',
            description: 'Русское описание урока'
        })
        expect(response.body.contentItems).toEqual([
            expect.objectContaining({
                itemType: 'text',
                itemTitle: 'Брифинг миссии',
                itemContent: 'Русский контент'
            })
        ])
    })
})
