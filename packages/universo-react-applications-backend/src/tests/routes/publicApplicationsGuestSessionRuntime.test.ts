import {
    applicationId,
    schemaName,
    contentNodeId,
    accessLinkId,
    quizId,
    workspaceId1,
    workspaceId2,
    withPublicApplication,
    buildDataSource,
    buildApp,
    request,
    hashGuestSecret,
    codenameVlc,
    installPublicApplicationsTestHooks
} from './publicApplicationsRoutes.testSupport'

describe('Public Applications Routes: guest runtime sessions and progress', () => {
    installPublicApplicationsTestHooks()

    it('accepts guest runtime session credentials from headers and binds reads to the token workspace', async () => {
        let currentWorkspaceId = workspaceId1
        const studentId = 'af8a5659-4155-4681-aa2f-a7605809cbf0'
        const sessionToken = Buffer.from(
            JSON.stringify({
                participantId: studentId,
                linkId: accessLinkId,
                secret: 'guest-secret',
                workspaceId: workspaceId2
            }),
            'utf8'
        ).toString('base64url')

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
                            return [
                                {
                                    id: 'object-links',
                                    codename: codenameVlc('AccessLinks'),
                                    kind: 'object',
                                    table_name: 'access_links_table'
                                }
                            ]
                        }

                        if (params[0] === 'Students') {
                            return [
                                { id: 'object-students', codename: codenameVlc('Students'), kind: 'object', table_name: 'students_table' }
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
                                },
                                {
                                    id: 'attr-show-first-name',
                                    codename: codenameVlc('ShowFirstName'),
                                    column_name: 'show_first_name',
                                    data_type: 'BOOLEAN',
                                    parent_component_id: null
                                }
                            ]
                        }

                        if (params[0] === 'object-students') {
                            return [
                                {
                                    id: 'attr-1',
                                    codename: codenameVlc('GuestSessionToken'),
                                    column_name: 'guest_session_token',
                                    data_type: 'STRING',
                                    parent_component_id: null
                                },
                                {
                                    id: 'attr-2',
                                    codename: codenameVlc('IsGuest'),
                                    column_name: 'is_guest',
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

                    if (sql.includes(`FROM "${schemaName}"."students_table"`)) {
                        return currentWorkspaceId === workspaceId2
                            ? [
                                  {
                                      id: studentId,
                                      guest_session_token: JSON.stringify({
                                          participantId: studentId,
                                          linkId: accessLinkId,
                                          secretHash: hashGuestSecret('guest-secret'),
                                          expiresAt: '2099-01-01T00:00:00.000Z',
                                          workspaceId: workspaceId2
                                      })
                                  }
                              ]
                            : []
                    }

                    if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                        return currentWorkspaceId === workspaceId2
                            ? [
                                  {
                                      id: accessLinkId,
                                      slug: 'demo-content',
                                      target_type: 'content',
                                      target_id: contentNodeId,
                                      is_active: true,
                                      shows_first_name: true
                                  }
                              ]
                            : []
                    }

                    if (sql.includes(`FROM "${schemaName}"."learning_resources_table"`)) {
                        return currentWorkspaceId === workspaceId2
                            ? [{ id: contentNodeId, title: 'Header-auth content', description: 'Shared lesson' }]
                            : []
                    }

                    if (sql.includes(`FROM "${schemaName}"."_app_values"`)) {
                        return [{ id: 'value-text', object_id: 'enum-content-type', codename: codenameVlc('Text') }]
                    }

                    if (sql.includes(`FROM "${schemaName}"."content_items"`)) {
                        return currentWorkspaceId === workspaceId2
                            ? [
                                  {
                                      id: 'row-1',
                                      _tp_parent_id: contentNodeId,
                                      _tp_sort_order: 1,
                                      item_type: 'value-text',
                                      item_title: 'Header-auth item',
                                      item_content: 'Workspace-safe content'
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
        const response = await request(app)
            .get(`/public/a/${applicationId}/runtime?slug=demo-content`)
            .set('X-Guest-Participant-Id', studentId)
            .set('X-Guest-Session-Token', sessionToken)
            .expect(200)

        expect(response.body).toMatchObject({
            type: 'content',
            id: contentNodeId,
            title: 'Header-auth content'
        })
        expect(response.body.contentItems).toEqual([
            expect.objectContaining({
                itemType: 'text',
                itemTitle: 'Header-auth item',
                itemContent: 'Workspace-safe content'
            })
        ])
        expect(currentWorkspaceId).toBe(workspaceId2)
    })

    it('rejects guest runtime tokens when the transport link id is tampered', async () => {
        const studentId = 'af8a5659-4155-4681-aa2f-a7605809cbf0'
        const tamperedLinkId = 'f3a1c528-0868-44b6-a30b-7e63a9f963da'
        const sessionToken = Buffer.from(
            JSON.stringify({
                participantId: studentId,
                linkId: tamperedLinkId,
                secret: 'guest-secret',
                workspaceId: null
            }),
            'utf8'
        ).toString('base64url')

        const dataSource = buildDataSource(
            withPublicApplication((sql, params) => {
                if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                    if (params[0] === 'Students') {
                        return [{ id: 'object-students', codename: codenameVlc('Students'), kind: 'object', table_name: 'students_table' }]
                    }
                    return []
                }

                if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                    return [
                        {
                            id: 'attr-1',
                            codename: codenameVlc('GuestSessionToken'),
                            column_name: 'guest_session_token',
                            data_type: 'STRING',
                            parent_component_id: null
                        },
                        {
                            id: 'attr-2',
                            codename: codenameVlc('IsGuest'),
                            column_name: 'is_guest',
                            data_type: 'BOOLEAN',
                            parent_component_id: null
                        }
                    ]
                }

                if (sql.includes(`FROM "${schemaName}"."students_table"`)) {
                    return [
                        {
                            id: studentId,
                            guest_session_token: JSON.stringify({
                                participantId: studentId,
                                linkId: accessLinkId,
                                secretHash: hashGuestSecret('guest-secret'),
                                expiresAt: '2099-01-01T00:00:00.000Z',
                                workspaceId: null
                            })
                        }
                    ]
                }

                return undefined
            })
        )

        const app = buildApp(dataSource)
        await request(app)
            .get(`/public/a/${applicationId}/runtime?slug=demo-content`)
            .set('X-Guest-Student-Id', studentId)
            .set('X-Guest-Session-Token', sessionToken)
            .expect(403)
    })

    it('requires quiz-intake evidence before returning quiz questions or starting an attempt from a legacy session', async () => {
        const studentId = 'af8a5659-4155-4681-aa2f-a7605809cbf0'
        const secret = 'legacy-content-session-secret'
        const sessionToken = Buffer.from(
            JSON.stringify({ participantId: studentId, linkId: accessLinkId, secret, workspaceId: null }),
            'utf8'
        ).toString('base64url')
        const quizQueries: string[] = []
        const dataSource = buildDataSource(
            withPublicApplication((sql, params) => {
                if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                    const objectName = String(params[0])
                    if (objectName === 'Students' || objectName === 'Participants') {
                        return [{ id: 'object-students', codename: codenameVlc(objectName), kind: 'object', table_name: 'students_table' }]
                    }
                    if (objectName === 'AccessLinks') {
                        return [{ id: 'object-links', codename: codenameVlc(objectName), kind: 'object', table_name: 'access_links_table' }]
                    }
                    if (objectName === 'Quizzes' || objectName === 'Assessments') {
                        quizQueries.push(sql)
                    }
                    return []
                }
                if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                    if (params[0] === 'object-students') {
                        return [
                            {
                                id: 'student-token',
                                codename: codenameVlc('GuestSessionToken'),
                                column_name: 'guest_session_token',
                                parent_component_id: null
                            },
                            { id: 'student-guest', codename: codenameVlc('IsGuest'), column_name: 'is_guest', parent_component_id: null },
                            {
                                id: 'student-terms-version',
                                codename: codenameVlc('TermsVersion'),
                                column_name: 'terms_version',
                                parent_component_id: null
                            },
                            {
                                id: 'student-terms-at',
                                codename: codenameVlc('TermsAcceptedAt'),
                                column_name: 'terms_accepted_at',
                                parent_component_id: null
                            },
                            {
                                id: 'student-privacy-version',
                                codename: codenameVlc('PrivacyVersion'),
                                column_name: 'privacy_version',
                                parent_component_id: null
                            },
                            {
                                id: 'student-privacy-at',
                                codename: codenameVlc('PrivacyAcceptedAt'),
                                column_name: 'privacy_accepted_at',
                                parent_component_id: null
                            }
                        ]
                    }
                    if (params[0] === 'object-links') {
                        return [
                            { id: 'link-slug', codename: codenameVlc('Slug'), column_name: 'slug', parent_component_id: null },
                            { id: 'link-type', codename: codenameVlc('TargetType'), column_name: 'target_type', parent_component_id: null },
                            { id: 'link-target', codename: codenameVlc('TargetId'), column_name: 'target_id', parent_component_id: null },
                            { id: 'link-active', codename: codenameVlc('IsActive'), column_name: 'is_active', parent_component_id: null },
                            {
                                id: 'link-show-first-name',
                                codename: codenameVlc('ShowFirstName'),
                                column_name: 'show_first_name',
                                parent_component_id: null
                            }
                        ]
                    }
                    return []
                }
                if (sql.includes(`FROM "${schemaName}"."students_table"`)) {
                    return [
                        {
                            id: studentId,
                            guest_session_token: JSON.stringify({
                                participantId: studentId,
                                linkId: accessLinkId,
                                secretHash: hashGuestSecret(secret),
                                expiresAt: '2099-01-01T00:00:00.000Z',
                                workspaceId: null
                            }),
                            terms_version: null,
                            terms_accepted_at: null,
                            privacy_version: null,
                            privacy_accepted_at: null
                        }
                    ]
                }
                if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                    return [
                        {
                            id: accessLinkId,
                            slug: 'demo-quiz',
                            target_type: 'quiz',
                            target_id: quizId,
                            is_active: true,
                            shows_first_name: true
                        }
                    ]
                }
                if (sql.includes(`FROM "${schemaName}"."quiz_table"`)) quizQueries.push(sql)
                return []
            })
        )
        const app = buildApp(dataSource)
        const credentials = {
            'X-Guest-Participant-Id': studentId,
            'X-Guest-Session-Token': sessionToken
        }

        const runtimeResponse = await request(app)
            .get(`/public/a/${applicationId}/runtime?slug=demo-quiz&locale=en`)
            .set(credentials)
            .expect(403)
        expect(runtimeResponse.headers['cache-control']).toBe('no-store')
        expect(runtimeResponse.body).toEqual({
            error: 'Quiz access requires recorded guest consent',
            code: 'GUEST_QUIZ_INTAKE_REQUIRED'
        })

        const attemptResponse = await request(app)
            .post(`/public/a/${applicationId}/runtime/attempts/start?locale=en`)
            .set(credentials)
            .send({ participantId: studentId, sessionToken, assessmentId: quizId })
            .expect(403)
        expect(attemptResponse.headers['cache-control']).toBe('no-store')
        expect(attemptResponse.body).toEqual({
            error: 'Quiz access requires recorded guest consent',
            code: 'GUEST_QUIZ_INTAKE_REQUIRED'
        })
        expect(quizQueries).toHaveLength(0)
    })

    it('does not expose the legacy bulk quiz submission endpoint', async () => {
        const dataSource = buildDataSource(withPublicApplication(() => undefined))
        const app = buildApp(dataSource)

        await request(app).post(`/public/a/${applicationId}/runtime/guest-submit`).send({}).expect(404)
    })

    it('rejects mismatched legacy guest aliases at the request boundary', async () => {
        const dataSource = buildDataSource(withPublicApplication(() => undefined))
        const app = buildApp(dataSource)

        const response = await request(app)
            .post(`/public/a/${applicationId}/runtime/guest-progress`)
            .send({
                participantId: 'af8a5659-4155-4681-aa2f-a7605809cbf0',
                studentId: 'bf8a5659-4155-4681-aa2f-a7605809cbf0',
                sessionToken: 'session-token',
                contentNodeId: contentNodeId,
                action: 'view'
            })
            .expect(400)

        expect(response.body).toMatchObject({ error: 'Invalid request body' })
        expect(JSON.stringify(response.body.details)).toContain('studentId')
    })

    it('rejects browser-owned guest progress status and percent at the request boundary', async () => {
        const dataSource = buildDataSource(withPublicApplication(() => undefined))
        const app = buildApp(dataSource)

        const response = await request(app)
            .post(`/public/a/${applicationId}/runtime/guest-progress`)
            .send({
                participantId: 'af8a5659-4155-4681-aa2f-a7605809cbf0',
                sessionToken: 'session-token',
                contentNodeId,
                action: 'complete',
                progressPercent: 50,
                status: 'completed'
            })
            .expect(400)

        expect(response.body).toMatchObject({ error: 'Invalid request body' })
        expect(JSON.stringify(response.body.details)).toContain('progressPercent')
        expect(JSON.stringify(response.body.details)).toContain('status')
    })

    it('preserves existing guest progress item index when recalculation update fails closed', async () => {
        const studentId = 'af8a5659-4155-4681-aa2f-a7605809cbf0'
        const progressRowId = '018f8a78-7b8f-7c1d-a111-222233334550'
        const sessionToken = Buffer.from(
            JSON.stringify({
                participantId: studentId,
                linkId: accessLinkId,
                secret: 'guest-secret',
                workspaceId: null
            }),
            'utf8'
        ).toString('base64url')
        let updateAttempted = false
        let progressLockAttempted = false

        const dataSource = buildDataSource(
            withPublicApplication((sql, params) => {
                if (sql.includes('pg_advisory_xact_lock')) {
                    progressLockAttempted = true
                    expect(String(params[0])).toContain('guest-progress')
                    return []
                }

                if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                    const objectByCodename: Record<string, { id: string; tableName: string }> = {
                        AccessLinks: { id: 'object-links', tableName: 'access_links_table' },
                        Students: { id: 'object-students', tableName: 'students_table' },
                        LearningResources: { id: 'object-learning-resources', tableName: 'learning_resources_table' },
                        ContentProgress: { id: 'object-content-progress', tableName: 'content_progress_table' }
                    }
                    const match = objectByCodename[String(params[0])]
                    return match
                        ? [
                              {
                                  id: match.id,
                                  codename: String(params[0]),
                                  kind: 'object',
                                  table_name: match.tableName
                              }
                          ]
                        : []
                }

                if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                    if (params[0] === 'object-links') {
                        return [
                            { id: 'link-slug', codename: 'Slug', column_name: 'slug', data_type: 'STRING', parent_component_id: null },
                            {
                                id: 'link-target-type',
                                codename: 'TargetType',
                                column_name: 'target_type',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'link-target-id',
                                codename: 'TargetId',
                                column_name: 'target_id',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'link-active',
                                codename: 'IsActive',
                                column_name: 'is_active',
                                data_type: 'BOOLEAN',
                                parent_component_id: null
                            },
                            {
                                id: 'link-show-first-name',
                                codename: 'ShowFirstName',
                                column_name: 'show_first_name',
                                data_type: 'BOOLEAN',
                                parent_component_id: null
                            }
                        ]
                    }

                    if (params[0] === 'object-students') {
                        return [
                            {
                                id: 'student-name',
                                codename: 'DisplayName',
                                column_name: 'display_name',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'student-guest',
                                codename: 'IsGuest',
                                column_name: 'is_guest',
                                data_type: 'BOOLEAN',
                                parent_component_id: null
                            },
                            {
                                id: 'student-token',
                                codename: 'GuestSessionToken',
                                column_name: 'guest_session_token',
                                data_type: 'STRING',
                                parent_component_id: null
                            }
                        ]
                    }

                    if (params[0] === 'object-content-progress') {
                        return [
                            {
                                id: 'progress-student',
                                codename: 'ProgressStudentId',
                                column_name: 'student_id',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'progress-content',
                                codename: 'ContentNodeId',
                                column_name: 'content_node_id',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'progress-status',
                                codename: 'ProgressStatus',
                                column_name: 'status',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'progress-percent',
                                codename: 'ProgressPercent',
                                column_name: 'progress_percent',
                                data_type: 'NUMBER',
                                parent_component_id: null
                            },
                            {
                                id: 'progress-started',
                                codename: 'StartedAt',
                                column_name: 'started_at',
                                data_type: 'DATE',
                                parent_component_id: null
                            },
                            {
                                id: 'progress-completed',
                                codename: 'CompletedAt',
                                column_name: 'completed_at',
                                data_type: 'DATE',
                                parent_component_id: null
                            },
                            {
                                id: 'progress-item',
                                codename: 'LastAccessedItemIndex',
                                column_name: 'last_accessed_item_index',
                                data_type: 'NUMBER',
                                parent_component_id: null
                            }
                        ]
                    }

                    if (params[0] === 'object-learning-resources') {
                        return [
                            {
                                id: 'resource-title',
                                codename: 'Title',
                                column_name: 'title',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'resource-description',
                                codename: 'Description',
                                column_name: 'description',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            {
                                id: 'resource-content-items',
                                codename: 'ContentItems',
                                column_name: 'content_items',
                                data_type: 'TABLE',
                                parent_component_id: null
                            },
                            {
                                id: 'content-item-title',
                                codename: 'ItemTitle',
                                column_name: 'item_title',
                                data_type: 'STRING',
                                parent_component_id: 'resource-content-items'
                            },
                            {
                                id: 'content-item-type',
                                codename: 'ItemType',
                                column_name: 'item_type',
                                data_type: 'STRING',
                                parent_component_id: 'resource-content-items'
                            },
                            {
                                id: 'content-item-content',
                                codename: 'ItemContent',
                                column_name: 'item_content',
                                data_type: 'STRING',
                                parent_component_id: 'resource-content-items'
                            },
                            {
                                id: 'content-item-quiz',
                                codename: 'QuizId',
                                column_name: 'quiz_id',
                                data_type: 'STRING',
                                parent_component_id: 'resource-content-items'
                            },
                            {
                                id: 'content-item-sort-order',
                                codename: 'SortOrder',
                                column_name: 'sort_order',
                                data_type: 'NUMBER',
                                parent_component_id: 'resource-content-items'
                            }
                        ]
                    }

                    return []
                }

                if (sql.includes(`FROM "${schemaName}"."students_table"`)) {
                    return [
                        {
                            id: studentId,
                            guest_session_token: JSON.stringify({
                                participantId: studentId,
                                linkId: accessLinkId,
                                secretHash: hashGuestSecret('guest-secret'),
                                expiresAt: '2099-01-01T00:00:00.000Z',
                                workspaceId: null
                            })
                        }
                    ]
                }

                if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                    return [
                        {
                            id: accessLinkId,
                            slug: 'demo-content',
                            target_type: 'content',
                            target_id: contentNodeId,
                            is_active: true,
                            shows_first_name: true
                        }
                    ]
                }

                if (sql.includes(`FROM "${schemaName}"."learning_resources_table"`)) {
                    return [{ id: contentNodeId, title: 'Guest content', description: 'Guest content description' }]
                }

                if (sql.includes(`FROM "${schemaName}"."content_items"`)) {
                    return [
                        { id: '018f8a78-7b8f-7c1d-a111-222233334551', item_title: 'Intro' },
                        { id: '018f8a78-7b8f-7c1d-a111-222233334552', item_title: 'Practice' }
                    ]
                }

                if (sql.includes(`FROM "${schemaName}"."content_progress_table"`)) {
                    return [{ id: progressRowId, lastAccessedItemIndex: 1 }]
                }

                if (sql.includes(`UPDATE "${schemaName}"."content_progress_table"`)) {
                    updateAttempted = true
                    expect(sql).toContain('RETURNING id')
                    expect(sql).toContain('_upl_deleted = false AND _app_deleted = false')
                    expect(params.slice(2, 5)).toEqual(['completed', 100, 1])
                    return []
                }

                return undefined
            })
        )

        const app = buildApp(dataSource)
        const response = await request(app)
            .post(`/public/a/${applicationId}/runtime/guest-progress`)
            .send({
                participantId: studentId,
                sessionToken,
                contentNodeId,
                action: 'recalculate'
            })
            .expect(409)

        expect(response.body).toMatchObject({
            error: 'Guest progress row was not updated',
            code: 'GUEST_PROGRESS_UPDATE_FAILED'
        })
        expect(updateAttempted).toBe(true)
        expect(progressLockAttempted).toBe(true)
    })
})
