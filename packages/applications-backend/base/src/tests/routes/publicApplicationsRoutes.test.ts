import type { NextFunction, Request, Response } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import { createHash } from 'node:crypto'

const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

import { createMockDbExecutor } from '../utils/dbMocks'
import { createPublicApplicationsRoutes } from '../../routes/publicApplicationsRoutes'

type QueryScope = 'root' | 'tx'
type QueryHandler = (sql: string, params: unknown[], scope: QueryScope) => unknown[] | undefined

const hashGuestSecret = (secret: string): string => createHash('sha256').update(secret, 'utf8').digest('hex')

const mockRateLimiter: RateLimitRequestHandler = ((_req: Request, _res: Response, next: NextFunction) => {
    next()
}) as RateLimitRequestHandler

const errorHandler = (err: Error & { statusCode?: number; status?: number }, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) {
        return _next(err)
    }
    res.status(err.statusCode ?? err.status ?? 500).json({ error: err.message || 'Internal Server Error' })
}

const buildDataSource = (handler?: QueryHandler) => {
    const { executor, txExecutor } = createMockDbExecutor()
    let generatedUuidIndex = 0
    const respond = async (sql: string, params: unknown[] = [], scope: QueryScope) => {
        if (sql.includes('SELECT public.uuid_generate_v7() AS id')) {
            generatedUuidIndex += 1
            return [{ id: `018f8a78-7b8f-7c1d-a111-22223333${String(4000 + generatedUuidIndex).padStart(4, '0')}` }]
        }
        const override = handler?.(sql, params, scope)
        if (override !== undefined) {
            return override
        }
        return []
    }

    ;(executor.query as jest.Mock).mockImplementation((sql: string, params: unknown[] = []) => respond(sql, params, 'root'))
    ;(txExecutor.query as jest.Mock).mockImplementation((sql: string, params: unknown[] = []) => respond(sql, params, 'tx'))
    ;(executor.transaction as jest.Mock).mockImplementation(async (callback: (trx: typeof txExecutor) => Promise<unknown>) =>
        callback(txExecutor)
    )

    return executor
}

const buildApp = (dataSource: ReturnType<typeof buildDataSource>) => {
    const app = express()
    app.use(express.json())
    app.use(
        '/',
        createPublicApplicationsRoutes(() => dataSource, mockRateLimiter, mockRateLimiter)
    )
    app.use(errorHandler)
    return app
}

const codenameVlc = (value: string) => ({
    _primary: 'en',
    locales: {
        en: { content: value }
    }
})

const localizedTextVlc = (en: string, ru: string) => ({
    _primary: 'en',
    locales: {
        en: { content: en },
        ru: { content: ru }
    }
})

const publicGuestRuntimeSettings = {
    publicRuntime: {
        guest: {
            objects: {
                accessLinks: 'AccessLinks',
                participants: 'Students',
                assessments: 'Quizzes',
                contentNodes: 'LearningResources',
                assessmentResponses: 'QuizResponses',
                contentProgress: 'ContentProgress'
            },
            fields: {
                accessLink: {
                    slug: 'Slug',
                    targetType: 'TargetType',
                    targetId: 'TargetId',
                    contentNodeIdRef: 'ContentNodeIdRef',
                    isActive: 'IsActive',
                    expiresAt: 'ExpiresAt',
                    maxUses: 'MaxUses',
                    useCount: 'UseCount',
                    title: 'LinkTitle',
                    classId: 'LinkClassId'
                },
                participant: {
                    displayName: 'DisplayName',
                    isGuest: 'IsGuest',
                    guestSessionToken: 'GuestSessionToken'
                },
                contentNode: {
                    title: 'Title',
                    description: 'Description',
                    contentItems: 'ContentItems'
                },
                contentPart: {
                    itemType: 'ItemType',
                    itemTitle: 'ItemTitle',
                    itemContent: 'ItemContent',
                    quizId: 'QuizId',
                    sortOrder: 'SortOrder'
                },
                assessment: {
                    title: 'Title',
                    description: 'Description',
                    passingScorePercent: 'PassingScorePercent',
                    questions: 'Questions'
                },
                assessmentQuestion: {
                    prompt: 'Prompt',
                    description: 'QuestionDescription',
                    questionType: 'QuestionType',
                    explanation: 'Explanation',
                    sortOrder: 'SortOrder',
                    options: 'Options'
                },
                assessmentResponse: {
                    studentId: 'StudentId',
                    quizId: 'QuizId',
                    questionId: 'QuestionId',
                    selectedOptionIds: 'SelectedOptionIds',
                    isCorrect: 'IsCorrect',
                    attemptNumber: 'AttemptNumber',
                    submittedAt: 'SubmittedAt'
                },
                contentProgress: {
                    studentId: 'ProgressStudentId',
                    contentNodeId: 'ContentNodeId',
                    status: 'ProgressStatus',
                    progressPercent: 'ProgressPercent',
                    startedAt: 'StartedAt',
                    completedAt: 'CompletedAt',
                    lastAccessedItemIndex: 'LastAccessedItemIndex'
                }
            }
        }
    }
}

describe('Public Applications Routes', () => {
    const applicationId = '2a15af4d-54ef-4b65-b5fd-8274d0d1de1b'
    const schemaName = 'app_018f8a787b8f7c1da111222233334442'
    const contentNodeId = '8f1c1880-2b67-4d79-b02b-a53db0a85453'
    const quizId = '16fe6f92-497d-47dd-a1bc-faf7fe55d765'
    const accessLinkId = '3ea1c528-0868-44b6-a30b-7e63a9f963da'
    const workspaceId1 = '018f8a78-7b8f-7c1d-a111-222233334441'
    const workspaceId2 = '018f8a78-7b8f-7c1d-a111-222233334442'

    beforeEach(() => {
        jest.clearAllMocks()
    })

    const withPublicApplication =
        (handler: QueryHandler, applicationOverrides: Record<string, unknown> = {}): QueryHandler =>
        (sql, params, scope) => {
            if (sql.includes('FROM applications.obj_applications')) {
                return [
                    {
                        id: 'application-1',
                        schemaName,
                        isPublic: true,
                        workspacesEnabled: false,
                        settings: publicGuestRuntimeSettings,
                        ...applicationOverrides
                    }
                ]
            }
            return handler(sql, params, scope)
        }

    it('resolves a public access link from the workspace that actually owns the link', async () => {
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
                        return [{ id: 'object-1', codename: codenameVlc('AccessLinks'), kind: 'object', table_name: 'access_links_table' }]
                    }

                    if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
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
                                id: 'attr-content-ref',
                                codename: codenameVlc('ContentNodeIdRef'),
                                column_name: 'content_node_id_ref',
                                data_type: 'REF',
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

                    if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                        return currentWorkspaceId === workspaceId2
                            ? [
                                  {
                                      id: accessLinkId,
                                      slug: 'demo-content',
                                      target_type: 'content',
                                      target_id: quizId,
                                      content_node_id_ref: contentNodeId,
                                      is_active: true
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
        const response = await request(app).get(`/public/a/${applicationId}/links/demo-content`).expect(200)

        expect(response.body.id).toBe(accessLinkId)
        expect(response.body.targetId).toBe(contentNodeId)
        expect(currentWorkspaceId).toBe(workspaceId2)
    })

    it('pins workspace-aware public link resolution to one transaction-scoped executor', async () => {
        let rootWorkspaceId = ''
        let txWorkspaceId = ''

        const dataSource = buildDataSource(
            withPublicApplication(
                (sql, params, scope) => {
                    if (sql.includes(`FROM "${schemaName}"."_app_workspaces"`)) {
                        return [{ id: workspaceId2 }, { id: workspaceId1 }]
                    }

                    if (sql.includes("set_config('app.current_workspace_id'")) {
                        if (scope === 'tx') {
                            txWorkspaceId = String(params[0] ?? '')
                        } else {
                            rootWorkspaceId = String(params[0] ?? '')
                        }
                        return []
                    }

                    if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                        return [{ id: 'object-1', codename: codenameVlc('AccessLinks'), kind: 'object', table_name: 'access_links_table' }]
                    }

                    if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
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

                    if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                        return scope === 'tx' && txWorkspaceId === workspaceId2
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

                    return undefined
                },
                { workspacesEnabled: true }
            )
        )

        const app = buildApp(dataSource)
        const response = await request(app).get(`/public/a/${applicationId}/links/demo-content`).expect(200)

        expect(response.body.id).toBe(accessLinkId)
        expect(txWorkspaceId).toBe(workspaceId2)
        expect(rootWorkspaceId).toBe('')
    })

    it('does not resolve public access links from personal workspaces', async () => {
        let currentWorkspaceId = ''

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
                        return [{ id: 'object-1', codename: codenameVlc('AccessLinks'), kind: 'object', table_name: 'access_links_table' }]
                    }

                    if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
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

                    if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                        return currentWorkspaceId === workspaceId1
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

                    return undefined
                },
                { workspacesEnabled: true }
            )
        )

        const app = buildApp(dataSource)
        await request(app).get(`/public/a/${applicationId}/links/demo-content`).expect(404)
    })

    it('resolves an active public access link by slug', async () => {
        const dataSource = buildDataSource(
            withPublicApplication((sql) => {
                if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                    return [{ id: 'object-1', codename: codenameVlc('AccessLinks'), kind: 'object', table_name: 'access_links_table' }]
                }

                if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
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
                            id: 'attr-5',
                            codename: codenameVlc('UseCount'),
                            column_name: 'use_count',
                            data_type: 'NUMBER',
                            parent_component_id: null
                        },
                        {
                            id: 'attr-6',
                            codename: codenameVlc('MaxUses'),
                            column_name: 'max_uses',
                            data_type: 'NUMBER',
                            parent_component_id: null
                        },
                        {
                            id: 'attr-7',
                            codename: codenameVlc('LinkTitle'),
                            column_name: 'title',
                            data_type: 'STRING',
                            parent_component_id: null
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
                            expires_at: null,
                            max_uses: 5,
                            use_count: 0,
                            title: localizedTextVlc('Demo content', 'Демо-модуль'),
                            class_id: null
                        }
                    ]
                }

                return undefined
            })
        )

        const app = buildApp(dataSource)
        const response = await request(app).get(`/public/a/${applicationId}/links/demo-content`).expect(200)

        expect(response.body).toMatchObject({
            id: accessLinkId,
            slug: 'demo-content',
            targetType: 'content',
            title: 'Demo content'
        })
    })

    it('localizes public access link titles when locale is provided', async () => {
        const dataSource = buildDataSource(
            withPublicApplication((sql) => {
                if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                    return [{ id: 'object-1', codename: codenameVlc('AccessLinks'), kind: 'object', table_name: 'access_links_table' }]
                }

                if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
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
                            id: 'attr-5',
                            codename: codenameVlc('LinkTitle'),
                            column_name: 'title',
                            data_type: 'STRING',
                            parent_component_id: null
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
                            title: localizedTextVlc('Docking drill', 'Стыковочная тренировка')
                        }
                    ]
                }

                return undefined
            })
        )

        const app = buildApp(dataSource)
        const response = await request(app).get(`/public/a/${applicationId}/links/demo-content?locale=ru`).expect(200)

        expect(response.body.title).toBe('Стыковочная тренировка')
    })

    it('rejects inactive access links', async () => {
        const dataSource = buildDataSource(
            withPublicApplication((sql) => {
                if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                    return [{ id: 'object-1', codename: 'AccessLinks', kind: 'object', table_name: 'access_links_table' }]
                }
                if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                    return [
                        { id: 'attr-1', codename: 'Slug', column_name: 'slug', data_type: 'STRING', parent_component_id: null },
                        {
                            id: 'attr-2',
                            codename: 'TargetType',
                            column_name: 'target_type',
                            data_type: 'STRING',
                            parent_component_id: null
                        },
                        { id: 'attr-3', codename: 'TargetId', column_name: 'target_id', data_type: 'STRING', parent_component_id: null },
                        { id: 'attr-4', codename: 'IsActive', column_name: 'is_active', data_type: 'BOOLEAN', parent_component_id: null }
                    ]
                }
                if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                    return [{ id: accessLinkId, slug: 'demo-content', target_type: 'content', target_id: contentNodeId, is_active: false }]
                }
                return undefined
            })
        )

        const app = buildApp(dataSource)
        await request(app).get(`/public/a/${applicationId}/links/demo-content`).expect(403)
    })

    it('rejects expired access links', async () => {
        const dataSource = buildDataSource(
            withPublicApplication((sql) => {
                if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                    return [{ id: 'object-1', codename: 'AccessLinks', kind: 'object', table_name: 'access_links_table' }]
                }
                if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                    return [
                        { id: 'attr-1', codename: 'Slug', column_name: 'slug', data_type: 'STRING', parent_component_id: null },
                        {
                            id: 'attr-2',
                            codename: 'TargetType',
                            column_name: 'target_type',
                            data_type: 'STRING',
                            parent_component_id: null
                        },
                        { id: 'attr-3', codename: 'TargetId', column_name: 'target_id', data_type: 'STRING', parent_component_id: null },
                        { id: 'attr-4', codename: 'IsActive', column_name: 'is_active', data_type: 'BOOLEAN', parent_component_id: null },
                        { id: 'attr-5', codename: 'ExpiresAt', column_name: 'expires_at', data_type: 'DATETIME', parent_component_id: null }
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
                            expires_at: '2000-01-01T00:00:00.000Z'
                        }
                    ]
                }
                return undefined
            })
        )

        const app = buildApp(dataSource)
        await request(app).get(`/public/a/${applicationId}/links/demo-content`).expect(403)
    })

    it('rejects exhausted access links before creating a guest session', async () => {
        const dataSource = buildDataSource(
            withPublicApplication((sql) => {
                if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                    return [{ id: 'object-1', codename: 'AccessLinks', kind: 'object', table_name: 'access_links_table' }]
                }
                if (sql.includes(`FROM "${schemaName}"."_app_components"`)) {
                    return [
                        { id: 'attr-1', codename: 'Slug', column_name: 'slug', data_type: 'STRING', parent_component_id: null },
                        {
                            id: 'attr-2',
                            codename: 'TargetType',
                            column_name: 'target_type',
                            data_type: 'STRING',
                            parent_component_id: null
                        },
                        { id: 'attr-3', codename: 'TargetId', column_name: 'target_id', data_type: 'STRING', parent_component_id: null },
                        { id: 'attr-4', codename: 'IsActive', column_name: 'is_active', data_type: 'BOOLEAN', parent_component_id: null },
                        { id: 'attr-5', codename: 'UseCount', column_name: 'use_count', data_type: 'NUMBER', parent_component_id: null },
                        { id: 'attr-6', codename: 'MaxUses', column_name: 'max_uses', data_type: 'NUMBER', parent_component_id: null }
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
                            max_uses: 1,
                            use_count: 1
                        }
                    ]
                }
                return undefined
            })
        )

        const app = buildApp(dataSource)
        await request(app).post(`/public/a/${applicationId}/guest-session`).send({ displayName: 'Guest Learner', accessLinkId }).expect(403)
    })

    it('requires an accessLinkId to create a guest session', async () => {
        const dataSource = buildDataSource(withPublicApplication(() => undefined))
        const app = buildApp(dataSource)

        await request(app).post(`/public/a/${applicationId}/guest-session`).send({ displayName: 'Guest Learner' }).expect(400)
    })

    it('creates a guest session for an active link and stores only a secret hash server-side', async () => {
        let persistedState: unknown = null

        const dataSource = buildDataSource(
            withPublicApplication((sql, params) => {
                if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                    if (params[0] === 'AccessLinks') {
                        return [{ id: 'object-links', codename: 'AccessLinks', kind: 'object', table_name: 'access_links_table' }]
                    }
                    return [{ id: 'object-students', codename: 'Students', kind: 'object', table_name: 'students_table' }]
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
                            },
                            {
                                id: 'attr-5',
                                codename: 'UseCount',
                                column_name: 'use_count',
                                data_type: 'NUMBER',
                                parent_component_id: null
                            },
                            { id: 'attr-6', codename: 'MaxUses', column_name: 'max_uses', data_type: 'NUMBER', parent_component_id: null }
                        ]
                    }

                    return [
                        {
                            id: 'attr-1',
                            codename: 'DisplayName',
                            column_name: 'display_name',
                            data_type: 'STRING',
                            parent_component_id: null
                        },
                        { id: 'attr-2', codename: 'IsGuest', column_name: 'is_guest', data_type: 'BOOLEAN', parent_component_id: null },
                        {
                            id: 'attr-3',
                            codename: 'GuestSessionToken',
                            column_name: 'guest_session_token',
                            data_type: 'STRING',
                            parent_component_id: null
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
                            expires_at: null,
                            max_uses: 5,
                            use_count: 0,
                            title: 'Demo content',
                            class_id: null
                        }
                    ]
                }

                if (sql.includes(`UPDATE "${schemaName}"."access_links_table"`)) {
                    return [{ id: accessLinkId }]
                }

                if (sql.includes(`INSERT INTO "${schemaName}"."students_table"`)) {
                    persistedState = params[2]
                    return []
                }

                return undefined
            })
        )

        const app = buildApp(dataSource)
        const response = await request(app)
            .post(`/public/a/${applicationId}/guest-session`)
            .send({ displayName: 'Guest Learner', accessLinkId })
            .expect(201)

        expect(response.body.participantId).toEqual(expect.any(String))
        expect(response.body.studentId).toEqual(expect.any(String))
        expect(response.body.participantId).toBe(response.body.studentId)
        expect(response.body.sessionToken).toEqual(expect.any(String))
        expect(typeof persistedState).toBe('string')
        expect(persistedState).not.toBe(response.body.sessionToken)
        expect(JSON.parse(String(persistedState))).toEqual(
            expect.objectContaining({
                linkId: accessLinkId,
                secretHash: expect.stringMatching(/^[a-f0-9]{64}$/),
                expiresAt: expect.any(String),
                workspaceId: null
            })
        )
        expect(JSON.parse(String(persistedState))).not.toEqual(expect.objectContaining({ secret: expect.any(String) }))
    })

    it('includes the resolved workspace id inside guest session transport tokens for workspace-enabled apps', async () => {
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
                        return [{ id: 'object-students', codename: 'Students', kind: 'object', table_name: 'students_table' }]
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
                                },
                                {
                                    id: 'attr-5',
                                    codename: 'UseCount',
                                    column_name: 'use_count',
                                    data_type: 'NUMBER',
                                    parent_component_id: null
                                },
                                {
                                    id: 'attr-6',
                                    codename: 'MaxUses',
                                    column_name: 'max_uses',
                                    data_type: 'NUMBER',
                                    parent_component_id: null
                                }
                            ]
                        }

                        return [
                            {
                                id: 'attr-1',
                                codename: 'DisplayName',
                                column_name: 'display_name',
                                data_type: 'STRING',
                                parent_component_id: null
                            },
                            { id: 'attr-2', codename: 'IsGuest', column_name: 'is_guest', data_type: 'BOOLEAN', parent_component_id: null },
                            {
                                id: 'attr-3',
                                codename: 'GuestSessionToken',
                                column_name: 'guest_session_token',
                                data_type: 'STRING',
                                parent_component_id: null
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
                                      is_active: true,
                                      max_uses: 5,
                                      use_count: 0
                                  }
                              ]
                            : []
                    }

                    if (sql.includes(`UPDATE "${schemaName}"."access_links_table"`)) {
                        return currentWorkspaceId === workspaceId2 ? [{ id: accessLinkId }] : []
                    }

                    if (sql.includes(`INSERT INTO "${schemaName}"."students_table"`)) {
                        return []
                    }

                    return undefined
                },
                { workspacesEnabled: true }
            )
        )

        const app = buildApp(dataSource)
        const response = await request(app)
            .post(`/public/a/${applicationId}/guest-session`)
            .send({ displayName: 'Guest Learner', accessLinkId })
            .expect(201)

        const decodedToken = JSON.parse(Buffer.from(response.body.sessionToken, 'base64url').toString('utf8'))
        expect(decodedToken.workspaceId).toBe(workspaceId2)
    })

    it('accepts guest runtime session credentials from headers and binds reads to the token workspace', async () => {
        let currentWorkspaceId = workspaceId1
        const studentId = 'af8a5659-4155-4681-aa2f-a7605809cbf0'
        const sessionToken = Buffer.from(
            JSON.stringify({
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
                                      is_active: true
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

    it('rejects oversized guest assessment answer payloads before touching runtime storage', async () => {
        const dataSource = buildDataSource(withPublicApplication(() => undefined))
        const app = buildApp(dataSource)
        const answers = Object.fromEntries(
            Array.from({ length: 201 }, (_value, index) => [
                `018f8a78-7b8f-7c1d-a111-22223333${String(5000 + index).padStart(4, '0')}`,
                ['018f8a78-7b8f-7c1d-a111-222233334999']
            ])
        )

        const response = await request(app)
            .post(`/public/a/${applicationId}/runtime/guest-submit`)
            .send({
                participantId: 'af8a5659-4155-4681-aa2f-a7605809cbf0',
                sessionToken: 'session-token',
                assessmentId: quizId,
                answers
            })
            .expect(400)

        expect(response.body).toMatchObject({ error: 'Invalid request body' })
        expect(JSON.stringify(response.body.details)).toContain('answers')
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
                progressPercent: 50,
                lastAccessedItemIndex: 1,
                status: 'in_progress'
            })
            .expect(400)

        expect(response.body).toMatchObject({ error: 'Invalid request body' })
        expect(JSON.stringify(response.body.details)).toContain('studentId')
    })

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
