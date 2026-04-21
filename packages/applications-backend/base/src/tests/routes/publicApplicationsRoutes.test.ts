import type { NextFunction, Request, Response } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'

const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

import { createMockDbExecutor } from '../utils/dbMocks'
import { createPublicApplicationsRoutes } from '../../routes/publicApplicationsRoutes'

type QueryScope = 'root' | 'tx'
type QueryHandler = (sql: string, params: unknown[], scope: QueryScope) => unknown[] | undefined

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
    const respond = async (sql: string, params: unknown[] = [], scope: QueryScope) => {
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

describe('Public Applications Routes', () => {
    const applicationId = '2a15af4d-54ef-4b65-b5fd-8274d0d1de1b'
    const schemaName = 'app_018f8a787b8f7c1da111222233334442'
    const moduleId = '8f1c1880-2b67-4d79-b02b-a53db0a85453'
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
            if (sql.includes('FROM applications.cat_applications')) {
                return [{ id: 'application-1', schemaName, isPublic: true, workspacesEnabled: false, ...applicationOverrides }]
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
                        return [{ id: 'object-1', codename: codenameVlc('AccessLinks'), kind: 'catalog', table_name: 'access_links_table' }]
                    }

                    if (sql.includes(`FROM "${schemaName}"."_app_attributes"`)) {
                        return [
                            { id: 'attr-1', codename: codenameVlc('Slug'), column_name: 'slug', data_type: 'STRING', parent_attribute_id: null },
                            { id: 'attr-2', codename: codenameVlc('TargetType'), column_name: 'target_type', data_type: 'STRING', parent_attribute_id: null },
                            { id: 'attr-3', codename: codenameVlc('TargetId'), column_name: 'target_id', data_type: 'STRING', parent_attribute_id: null },
                            { id: 'attr-4', codename: codenameVlc('IsActive'), column_name: 'is_active', data_type: 'BOOLEAN', parent_attribute_id: null }
                        ]
                    }

                    if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                        return currentWorkspaceId === workspaceId2
                            ? [{ id: accessLinkId, slug: 'demo-module', target_type: 'module', target_id: moduleId, is_active: true }]
                            : []
                    }

                    return undefined
                },
                { workspacesEnabled: true }
            )
        )

        const app = buildApp(dataSource)
        const response = await request(app).get(`/public/a/${applicationId}/links/demo-module`).expect(200)

        expect(response.body.id).toBe(accessLinkId)
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
                        return [{ id: 'object-1', codename: codenameVlc('AccessLinks'), kind: 'catalog', table_name: 'access_links_table' }]
                    }

                    if (sql.includes(`FROM "${schemaName}"."_app_attributes"`)) {
                        return [
                            { id: 'attr-1', codename: codenameVlc('Slug'), column_name: 'slug', data_type: 'STRING', parent_attribute_id: null },
                            { id: 'attr-2', codename: codenameVlc('TargetType'), column_name: 'target_type', data_type: 'STRING', parent_attribute_id: null },
                            { id: 'attr-3', codename: codenameVlc('TargetId'), column_name: 'target_id', data_type: 'STRING', parent_attribute_id: null },
                            { id: 'attr-4', codename: codenameVlc('IsActive'), column_name: 'is_active', data_type: 'BOOLEAN', parent_attribute_id: null }
                        ]
                    }

                    if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                        return scope === 'tx' && txWorkspaceId === workspaceId2
                            ? [{ id: accessLinkId, slug: 'demo-module', target_type: 'module', target_id: moduleId, is_active: true }]
                            : []
                    }

                    return undefined
                },
                { workspacesEnabled: true }
            )
        )

        const app = buildApp(dataSource)
        const response = await request(app).get(`/public/a/${applicationId}/links/demo-module`).expect(200)

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
                        return [{ id: 'object-1', codename: codenameVlc('AccessLinks'), kind: 'catalog', table_name: 'access_links_table' }]
                    }

                    if (sql.includes(`FROM "${schemaName}"."_app_attributes"`)) {
                        return [
                            { id: 'attr-1', codename: codenameVlc('Slug'), column_name: 'slug', data_type: 'STRING', parent_attribute_id: null },
                            { id: 'attr-2', codename: codenameVlc('TargetType'), column_name: 'target_type', data_type: 'STRING', parent_attribute_id: null },
                            { id: 'attr-3', codename: codenameVlc('TargetId'), column_name: 'target_id', data_type: 'STRING', parent_attribute_id: null },
                            { id: 'attr-4', codename: codenameVlc('IsActive'), column_name: 'is_active', data_type: 'BOOLEAN', parent_attribute_id: null }
                        ]
                    }

                    if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                        return currentWorkspaceId === workspaceId1
                            ? [{ id: accessLinkId, slug: 'demo-module', target_type: 'module', target_id: moduleId, is_active: true }]
                            : []
                    }

                    return undefined
                },
                { workspacesEnabled: true }
            )
        )

        const app = buildApp(dataSource)
        await request(app).get(`/public/a/${applicationId}/links/demo-module`).expect(404)
    })

    it('resolves an active public access link by slug', async () => {
        const dataSource = buildDataSource(
            withPublicApplication((sql) => {
                if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                    return [{ id: 'object-1', codename: codenameVlc('AccessLinks'), kind: 'catalog', table_name: 'access_links_table' }]
                }

                if (sql.includes(`FROM "${schemaName}"."_app_attributes"`)) {
                    return [
                        {
                            id: 'attr-1',
                            codename: codenameVlc('Slug'),
                            column_name: 'slug',
                            data_type: 'STRING',
                            parent_attribute_id: null
                        },
                        {
                            id: 'attr-2',
                            codename: codenameVlc('TargetType'),
                            column_name: 'target_type',
                            data_type: 'STRING',
                            parent_attribute_id: null
                        },
                        {
                            id: 'attr-3',
                            codename: codenameVlc('TargetId'),
                            column_name: 'target_id',
                            data_type: 'STRING',
                            parent_attribute_id: null
                        },
                        {
                            id: 'attr-4',
                            codename: codenameVlc('IsActive'),
                            column_name: 'is_active',
                            data_type: 'BOOLEAN',
                            parent_attribute_id: null
                        },
                        {
                            id: 'attr-5',
                            codename: codenameVlc('UseCount'),
                            column_name: 'use_count',
                            data_type: 'NUMBER',
                            parent_attribute_id: null
                        },
                        {
                            id: 'attr-6',
                            codename: codenameVlc('MaxUses'),
                            column_name: 'max_uses',
                            data_type: 'NUMBER',
                            parent_attribute_id: null
                        },
                        {
                            id: 'attr-7',
                            codename: codenameVlc('LinkTitle'),
                            column_name: 'title',
                            data_type: 'STRING',
                            parent_attribute_id: null
                        }
                    ]
                }

                if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                    return [
                        {
                            id: accessLinkId,
                            slug: 'demo-module',
                            target_type: 'module',
                            target_id: moduleId,
                            is_active: true,
                            expires_at: null,
                            max_uses: 5,
                            use_count: 0,
                            title: localizedTextVlc('Demo module', 'Демо-модуль'),
                            class_id: null
                        }
                    ]
                }

                return undefined
            })
        )

        const app = buildApp(dataSource)
        const response = await request(app).get(`/public/a/${applicationId}/links/demo-module`).expect(200)

        expect(response.body).toMatchObject({
            id: accessLinkId,
            slug: 'demo-module',
            targetType: 'module',
            title: 'Demo module'
        })
    })

    it('localizes public access link titles when locale is provided', async () => {
        const dataSource = buildDataSource(
            withPublicApplication((sql) => {
                if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                    return [{ id: 'object-1', codename: codenameVlc('AccessLinks'), kind: 'catalog', table_name: 'access_links_table' }]
                }

                if (sql.includes(`FROM "${schemaName}"."_app_attributes"`)) {
                    return [
                        { id: 'attr-1', codename: codenameVlc('Slug'), column_name: 'slug', data_type: 'STRING', parent_attribute_id: null },
                        { id: 'attr-2', codename: codenameVlc('TargetType'), column_name: 'target_type', data_type: 'STRING', parent_attribute_id: null },
                        { id: 'attr-3', codename: codenameVlc('TargetId'), column_name: 'target_id', data_type: 'STRING', parent_attribute_id: null },
                        { id: 'attr-4', codename: codenameVlc('IsActive'), column_name: 'is_active', data_type: 'BOOLEAN', parent_attribute_id: null },
                        { id: 'attr-5', codename: codenameVlc('LinkTitle'), column_name: 'title', data_type: 'STRING', parent_attribute_id: null }
                    ]
                }

                if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                    return [
                        {
                            id: accessLinkId,
                            slug: 'demo-module',
                            target_type: 'module',
                            target_id: moduleId,
                            is_active: true,
                            title: localizedTextVlc('Docking drill', 'Стыковочная тренировка')
                        }
                    ]
                }

                return undefined
            })
        )

        const app = buildApp(dataSource)
        const response = await request(app).get(`/public/a/${applicationId}/links/demo-module?locale=ru`).expect(200)

        expect(response.body.title).toBe('Стыковочная тренировка')
    })

    it('rejects inactive access links', async () => {
        const dataSource = buildDataSource(
            withPublicApplication((sql) => {
                if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                    return [{ id: 'object-1', codename: 'AccessLinks', kind: 'catalog', table_name: 'access_links_table' }]
                }
                if (sql.includes(`FROM "${schemaName}"."_app_attributes"`)) {
                    return [
                        { id: 'attr-1', codename: 'Slug', column_name: 'slug', data_type: 'STRING', parent_attribute_id: null },
                        {
                            id: 'attr-2',
                            codename: 'TargetType',
                            column_name: 'target_type',
                            data_type: 'STRING',
                            parent_attribute_id: null
                        },
                        { id: 'attr-3', codename: 'TargetId', column_name: 'target_id', data_type: 'STRING', parent_attribute_id: null },
                        { id: 'attr-4', codename: 'IsActive', column_name: 'is_active', data_type: 'BOOLEAN', parent_attribute_id: null }
                    ]
                }
                if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                    return [{ id: accessLinkId, slug: 'demo-module', target_type: 'module', target_id: moduleId, is_active: false }]
                }
                return undefined
            })
        )

        const app = buildApp(dataSource)
        await request(app).get(`/public/a/${applicationId}/links/demo-module`).expect(403)
    })

    it('requires an accessLinkId to create a guest session', async () => {
        const dataSource = buildDataSource(withPublicApplication(() => undefined))
        const app = buildApp(dataSource)

        await request(app).post(`/public/a/${applicationId}/guest-session`).send({ displayName: 'Guest Learner' }).expect(400)
    })

    it('creates a guest session for an active link and stores only the secret token server-side', async () => {
        let persistedState: unknown = null

        const dataSource = buildDataSource(
            withPublicApplication((sql, params) => {
                if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                    if (params[0] === 'AccessLinks') {
                        return [{ id: 'object-links', codename: 'AccessLinks', kind: 'catalog', table_name: 'access_links_table' }]
                    }
                    return [{ id: 'object-students', codename: 'Students', kind: 'catalog', table_name: 'students_table' }]
                }

                if (sql.includes(`FROM "${schemaName}"."_app_attributes"`)) {
                    if (params[0] === 'object-links') {
                        return [
                            { id: 'attr-1', codename: 'Slug', column_name: 'slug', data_type: 'STRING', parent_attribute_id: null },
                            {
                                id: 'attr-2',
                                codename: 'TargetType',
                                column_name: 'target_type',
                                data_type: 'STRING',
                                parent_attribute_id: null
                            },
                            {
                                id: 'attr-3',
                                codename: 'TargetId',
                                column_name: 'target_id',
                                data_type: 'STRING',
                                parent_attribute_id: null
                            },
                            {
                                id: 'attr-4',
                                codename: 'IsActive',
                                column_name: 'is_active',
                                data_type: 'BOOLEAN',
                                parent_attribute_id: null
                            },
                            {
                                id: 'attr-5',
                                codename: 'UseCount',
                                column_name: 'use_count',
                                data_type: 'NUMBER',
                                parent_attribute_id: null
                            },
                            { id: 'attr-6', codename: 'MaxUses', column_name: 'max_uses', data_type: 'NUMBER', parent_attribute_id: null }
                        ]
                    }

                    return [
                        {
                            id: 'attr-1',
                            codename: 'DisplayName',
                            column_name: 'display_name',
                            data_type: 'STRING',
                            parent_attribute_id: null
                        },
                        { id: 'attr-2', codename: 'IsGuest', column_name: 'is_guest', data_type: 'BOOLEAN', parent_attribute_id: null },
                        {
                            id: 'attr-3',
                            codename: 'GuestSessionToken',
                            column_name: 'guest_session_token',
                            data_type: 'STRING',
                            parent_attribute_id: null
                        }
                    ]
                }

                if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                    return [
                        {
                            id: accessLinkId,
                            slug: 'demo-module',
                            target_type: 'module',
                            target_id: moduleId,
                            is_active: true,
                            expires_at: null,
                            max_uses: 5,
                            use_count: 0,
                            title: 'Demo module',
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

        expect(response.body.studentId).toEqual(expect.any(String))
        expect(response.body.sessionToken).toEqual(expect.any(String))
        expect(typeof persistedState).toBe('string')
        expect(persistedState).not.toBe(response.body.sessionToken)
        expect(JSON.parse(String(persistedState))).toEqual(
            expect.objectContaining({
                secret: expect.any(String),
                expiresAt: expect.any(String)
            })
        )
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
                            return [{ id: 'object-links', codename: 'AccessLinks', kind: 'catalog', table_name: 'access_links_table' }]
                        }
                        return [{ id: 'object-students', codename: 'Students', kind: 'catalog', table_name: 'students_table' }]
                    }

                    if (sql.includes(`FROM "${schemaName}"."_app_attributes"`)) {
                        if (params[0] === 'object-links') {
                            return [
                                { id: 'attr-1', codename: 'Slug', column_name: 'slug', data_type: 'STRING', parent_attribute_id: null },
                                { id: 'attr-2', codename: 'TargetType', column_name: 'target_type', data_type: 'STRING', parent_attribute_id: null },
                                { id: 'attr-3', codename: 'TargetId', column_name: 'target_id', data_type: 'STRING', parent_attribute_id: null },
                                { id: 'attr-4', codename: 'IsActive', column_name: 'is_active', data_type: 'BOOLEAN', parent_attribute_id: null },
                                { id: 'attr-5', codename: 'UseCount', column_name: 'use_count', data_type: 'NUMBER', parent_attribute_id: null },
                                { id: 'attr-6', codename: 'MaxUses', column_name: 'max_uses', data_type: 'NUMBER', parent_attribute_id: null }
                            ]
                        }

                        return [
                            { id: 'attr-1', codename: 'DisplayName', column_name: 'display_name', data_type: 'STRING', parent_attribute_id: null },
                            { id: 'attr-2', codename: 'IsGuest', column_name: 'is_guest', data_type: 'BOOLEAN', parent_attribute_id: null },
                            { id: 'attr-3', codename: 'GuestSessionToken', column_name: 'guest_session_token', data_type: 'STRING', parent_attribute_id: null }
                        ]
                    }

                    if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                        return currentWorkspaceId === workspaceId2
                            ? [{ id: accessLinkId, slug: 'demo-module', target_type: 'module', target_id: moduleId, is_active: true, max_uses: 5, use_count: 0 }]
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
                            return [{ id: 'object-links', codename: codenameVlc('AccessLinks'), kind: 'catalog', table_name: 'access_links_table' }]
                        }

                        if (params[0] === 'Students') {
                            return [{ id: 'object-students', codename: codenameVlc('Students'), kind: 'catalog', table_name: 'students_table' }]
                        }

                        return [{ id: 'object-modules', codename: codenameVlc('Modules'), kind: 'catalog', table_name: 'modules_table' }]
                    }

                    if (sql.includes(`FROM "${schemaName}"."_app_attributes"`)) {
                        if (params[0] === 'object-links') {
                            return [
                                { id: 'attr-1', codename: codenameVlc('Slug'), column_name: 'slug', data_type: 'STRING', parent_attribute_id: null },
                                { id: 'attr-2', codename: codenameVlc('TargetType'), column_name: 'target_type', data_type: 'STRING', parent_attribute_id: null },
                                { id: 'attr-3', codename: codenameVlc('TargetId'), column_name: 'target_id', data_type: 'STRING', parent_attribute_id: null },
                                { id: 'attr-4', codename: codenameVlc('IsActive'), column_name: 'is_active', data_type: 'BOOLEAN', parent_attribute_id: null }
                            ]
                        }

                        if (params[0] === 'object-students') {
                            return [
                                { id: 'attr-1', codename: codenameVlc('GuestSessionToken'), column_name: 'guest_session_token', data_type: 'STRING', parent_attribute_id: null },
                                { id: 'attr-2', codename: codenameVlc('IsGuest'), column_name: 'is_guest', data_type: 'BOOLEAN', parent_attribute_id: null }
                            ]
                        }

                        return [
                            { id: 'attr-title', codename: codenameVlc('Title'), column_name: 'title', data_type: 'STRING', parent_attribute_id: null },
                            { id: 'attr-description', codename: codenameVlc('Description'), column_name: 'description', data_type: 'STRING', parent_attribute_id: null },
                            { id: 'attr-content', codename: codenameVlc('ContentItems'), column_name: 'content_items', data_type: 'TABLE', parent_attribute_id: null },
                            { id: 'child-type', codename: codenameVlc('ItemType'), column_name: 'item_type', data_type: 'REF', parent_attribute_id: 'attr-content', target_object_id: 'enum-content-type', target_object_kind: 'enumeration' },
                            { id: 'child-title', codename: codenameVlc('ItemTitle'), column_name: 'item_title', data_type: 'STRING', parent_attribute_id: 'attr-content' },
                            { id: 'child-content', codename: codenameVlc('ItemContent'), column_name: 'item_content', data_type: 'STRING', parent_attribute_id: 'attr-content' },
                            { id: 'child-sort', codename: codenameVlc('SortOrder'), column_name: 'sort_order', data_type: 'NUMBER', parent_attribute_id: 'attr-content' }
                        ]
                    }

                    if (sql.includes(`FROM "${schemaName}"."students_table"`)) {
                        return currentWorkspaceId === workspaceId2
                            ? [
                                  {
                                      id: studentId,
                                      guest_session_token: JSON.stringify({
                                          secret: 'guest-secret',
                                          expiresAt: '2099-01-01T00:00:00.000Z'
                                      })
                                  }
                              ]
                            : []
                    }

                    if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                        return currentWorkspaceId === workspaceId2
                            ? [{ id: accessLinkId, slug: 'demo-module', target_type: 'module', target_id: moduleId, is_active: true }]
                            : []
                    }

                    if (sql.includes(`FROM "${schemaName}"."modules_table"`)) {
                        return currentWorkspaceId === workspaceId2
                            ? [{ id: moduleId, title: 'Header-auth module', description: 'Shared lesson' }]
                            : []
                    }

                    if (sql.includes(`FROM "${schemaName}"."_app_values"`)) {
                        return [{ id: 'value-text', object_id: 'enum-content-type', codename: codenameVlc('Text') }]
                    }

                    if (sql.includes(`FROM "${schemaName}"."content_items"`)) {
                        return currentWorkspaceId === workspaceId2
                            ? [{ id: 'row-1', _tp_parent_id: moduleId, _tp_sort_order: 1, item_type: 'value-text', item_title: 'Header-auth item', item_content: 'Workspace-safe content' }]
                            : []
                    }

                    return undefined
                },
                { workspacesEnabled: true }
            )
        )

        const app = buildApp(dataSource)
        const response = await request(app)
            .get(`/public/a/${applicationId}/runtime?slug=demo-module`)
            .set('X-Guest-Student-Id', studentId)
            .set('X-Guest-Session-Token', sessionToken)
            .expect(200)

        expect(response.body).toMatchObject({
            type: 'module',
            id: moduleId,
            title: 'Header-auth module'
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

    it('rejects direct runtime access without a slug', async () => {
        const dataSource = buildDataSource(withPublicApplication(() => undefined))
        const app = buildApp(dataSource)

        await request(app).get(`/public/a/${applicationId}/runtime?targetType=module&targetId=${moduleId}`).expect(400)
    })

    it('rejects runtime targets that are not linked from the requested access link', async () => {
        const dataSource = buildDataSource(
            withPublicApplication((sql, params) => {
                if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                    if (params[0] === 'AccessLinks') {
                        return [{ id: 'object-links', codename: 'AccessLinks', kind: 'catalog', table_name: 'access_links_table' }]
                    }
                    return [{ id: 'object-modules', codename: 'Modules', kind: 'catalog', table_name: 'modules_table' }]
                }

                if (sql.includes(`FROM "${schemaName}"."_app_attributes"`)) {
                    if (params[0] === 'object-links') {
                        return [
                            { id: 'attr-1', codename: 'Slug', column_name: 'slug', data_type: 'STRING', parent_attribute_id: null },
                            {
                                id: 'attr-2',
                                codename: 'TargetType',
                                column_name: 'target_type',
                                data_type: 'STRING',
                                parent_attribute_id: null
                            },
                            {
                                id: 'attr-3',
                                codename: 'TargetId',
                                column_name: 'target_id',
                                data_type: 'STRING',
                                parent_attribute_id: null
                            },
                            {
                                id: 'attr-4',
                                codename: 'IsActive',
                                column_name: 'is_active',
                                data_type: 'BOOLEAN',
                                parent_attribute_id: null
                            }
                        ]
                    }

                    return [
                        { id: 'attr-title', codename: 'Title', column_name: 'title', data_type: 'STRING', parent_attribute_id: null },
                        {
                            id: 'attr-description',
                            codename: 'Description',
                            column_name: 'description',
                            data_type: 'STRING',
                            parent_attribute_id: null
                        },
                        {
                            id: 'attr-content',
                            codename: 'ContentItems',
                            column_name: 'content_items',
                            data_type: 'TABLE',
                            parent_attribute_id: null
                        },
                        {
                            id: 'child-type',
                            codename: 'ItemType',
                            column_name: 'item_type',
                            data_type: 'REF',
                            parent_attribute_id: 'attr-content',
                            target_object_id: 'enum-content-type',
                            target_object_kind: 'enumeration'
                        },
                        {
                            id: 'child-title',
                            codename: 'ItemTitle',
                            column_name: 'item_title',
                            data_type: 'STRING',
                            parent_attribute_id: 'attr-content'
                        },
                        {
                            id: 'child-content',
                            codename: 'ItemContent',
                            column_name: 'item_content',
                            data_type: 'STRING',
                            parent_attribute_id: 'attr-content'
                        },
                        {
                            id: 'child-quiz',
                            codename: 'QuizId',
                            column_name: 'quiz_id',
                            data_type: 'STRING',
                            parent_attribute_id: 'attr-content'
                        },
                        {
                            id: 'child-sort',
                            codename: 'SortOrder',
                            column_name: 'sort_order',
                            data_type: 'NUMBER',
                            parent_attribute_id: 'attr-content'
                        }
                    ]
                }

                if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                    return [{ id: accessLinkId, slug: 'demo-module', target_type: 'module', target_id: moduleId, is_active: true }]
                }

                if (sql.includes(`FROM "${schemaName}"."modules_table"`)) {
                    return [{ id: moduleId, title: 'Demo module', description: 'Lesson' }]
                }

                if (sql.includes(`FROM "${schemaName}"."_app_values"`)) {
                    return [{ id: 'value-quiz-ref', object_id: 'enum-content-type', codename: 'QuizRef' }]
                }

                if (sql.includes(`FROM "${schemaName}"."content_items"`)) {
                    return [
                        {
                            id: 'row-1',
                            parent_record_id: moduleId,
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
            .get(`/public/a/${applicationId}/runtime?slug=demo-module&targetType=quiz&targetId=018f8a78-7b8f-7c1d-a111-222233334444`)
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
                            return [{ id: 'object-links', codename: 'AccessLinks', kind: 'catalog', table_name: 'access_links_table' }]
                        }
                        return [{ id: 'object-modules', codename: 'Modules', kind: 'catalog', table_name: 'modules_table' }]
                    }

                    if (sql.includes(`FROM "${schemaName}"."_app_attributes"`)) {
                        if (params[0] === 'object-links') {
                            return [
                                { id: 'attr-1', codename: 'Slug', column_name: 'slug', data_type: 'STRING', parent_attribute_id: null },
                                { id: 'attr-2', codename: 'TargetType', column_name: 'target_type', data_type: 'STRING', parent_attribute_id: null },
                                { id: 'attr-3', codename: 'TargetId', column_name: 'target_id', data_type: 'STRING', parent_attribute_id: null },
                                { id: 'attr-4', codename: 'IsActive', column_name: 'is_active', data_type: 'BOOLEAN', parent_attribute_id: null }
                            ]
                        }

                        return [
                            { id: 'attr-title', codename: 'Title', column_name: 'title', data_type: 'STRING', parent_attribute_id: null },
                            { id: 'attr-description', codename: 'Description', column_name: 'description', data_type: 'STRING', parent_attribute_id: null },
                            { id: 'attr-content', codename: 'ContentItems', column_name: 'content_items', data_type: 'TABLE', parent_attribute_id: null },
                            {
                                id: 'child-type',
                                codename: 'ItemType',
                                column_name: 'item_type',
                                data_type: 'REF',
                                parent_attribute_id: 'attr-content',
                                target_object_id: 'enum-content-type',
                                target_object_kind: 'enumeration'
                            },
                            { id: 'child-title', codename: 'ItemTitle', column_name: 'item_title', data_type: 'STRING', parent_attribute_id: 'attr-content' },
                            { id: 'child-content', codename: 'ItemContent', column_name: 'item_content', data_type: 'STRING', parent_attribute_id: 'attr-content' },
                            { id: 'child-sort', codename: 'SortOrder', column_name: 'sort_order', data_type: 'NUMBER', parent_attribute_id: 'attr-content' }
                        ]
                    }

                    if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                        return currentWorkspaceId === workspaceId2
                            ? [{ id: accessLinkId, slug: 'demo-module', target_type: 'module', target_id: moduleId, is_active: true }]
                            : []
                    }

                    if (sql.includes(`FROM "${schemaName}"."modules_table"`)) {
                        return currentWorkspaceId === workspaceId2 ? [{ id: moduleId, title: 'Scoped module', description: 'Scoped lesson' }] : []
                    }

                    if (sql.includes(`FROM "${schemaName}"."_app_values"`)) {
                        return [{ id: 'value-text', object_id: 'enum-content-type', codename: 'Text' }]
                    }

                    if (sql.includes(`FROM "${schemaName}"."content_items"`)) {
                        return currentWorkspaceId === workspaceId2
                            ? [{ id: 'row-1', _tp_parent_id: moduleId, _tp_sort_order: 1, item_type: 'value-text', item_title: 'Scoped item', item_content: 'Workspace-bound content', quiz_id: null }]
                            : []
                    }

                    return undefined
                },
                { workspacesEnabled: true }
            )
        )

        const app = buildApp(dataSource)
        const response = await request(app).get(`/public/a/${applicationId}/runtime?slug=demo-module`).expect(200)

        expect(response.body).toMatchObject({
            type: 'module',
            id: moduleId,
            title: 'Scoped module'
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
        const personalModuleId = '31b2d8e1-2b7c-4f9f-8b8e-4f1c8f1d55aa'
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
                            return [{ id: 'object-links', codename: 'AccessLinks', kind: 'catalog', table_name: 'access_links_table' }]
                        }
                        return [{ id: 'object-modules', codename: 'Modules', kind: 'catalog', table_name: 'modules_table' }]
                    }

                    if (sql.includes(`FROM "${schemaName}"."_app_attributes"`)) {
                        if (params[0] === 'object-links') {
                            return [
                                { id: 'attr-1', codename: 'Slug', column_name: 'slug', data_type: 'STRING', parent_attribute_id: null },
                                { id: 'attr-2', codename: 'TargetType', column_name: 'target_type', data_type: 'STRING', parent_attribute_id: null },
                                { id: 'attr-3', codename: 'TargetId', column_name: 'target_id', data_type: 'STRING', parent_attribute_id: null },
                                { id: 'attr-4', codename: 'IsActive', column_name: 'is_active', data_type: 'BOOLEAN', parent_attribute_id: null }
                            ]
                        }

                        return [
                            { id: 'attr-title', codename: 'Title', column_name: 'title', data_type: 'STRING', parent_attribute_id: null },
                            { id: 'attr-description', codename: 'Description', column_name: 'description', data_type: 'STRING', parent_attribute_id: null },
                            { id: 'attr-content', codename: 'ContentItems', column_name: 'content_items', data_type: 'TABLE', parent_attribute_id: null },
                            {
                                id: 'child-type',
                                codename: 'ItemType',
                                column_name: 'item_type',
                                data_type: 'REF',
                                parent_attribute_id: 'attr-content',
                                target_object_id: 'enum-content-type',
                                target_object_kind: 'enumeration'
                            },
                            { id: 'child-title', codename: 'ItemTitle', column_name: 'item_title', data_type: 'STRING', parent_attribute_id: 'attr-content' },
                            { id: 'child-content', codename: 'ItemContent', column_name: 'item_content', data_type: 'STRING', parent_attribute_id: 'attr-content' },
                            { id: 'child-quiz', codename: 'QuizId', column_name: 'quiz_id', data_type: 'STRING', parent_attribute_id: 'attr-content' },
                            { id: 'child-sort', codename: 'SortOrder', column_name: 'sort_order', data_type: 'NUMBER', parent_attribute_id: 'attr-content' }
                        ]
                    }

                    if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                        if (currentWorkspaceId === workspaceId2) {
                            currentWorkspaceId = workspaceId1
                            return [{ id: accessLinkId, slug: 'demo-module', target_type: 'module', target_id: moduleId, is_active: true }]
                        }

                        if (currentWorkspaceId === workspaceId1) {
                            return [{ id: 'personal-link', slug: 'demo-module', target_type: 'module', target_id: personalModuleId, is_active: true }]
                        }

                        return []
                    }

                    if (sql.includes(`FROM "${schemaName}"."modules_table"`)) {
                        return currentWorkspaceId === workspaceId2
                            ? [{ id: moduleId, title: 'Shared module', description: 'Shared lesson' }]
                            : [{ id: personalModuleId, title: 'Personal module', description: 'Personal lesson' }]
                    }

                    if (sql.includes(`FROM "${schemaName}"."_app_values"`)) {
                        return [{ id: 'value-quiz-ref', object_id: 'enum-content-type', codename: 'QuizRef' }]
                    }

                    if (sql.includes(`FROM "${schemaName}"."content_items"`)) {
                        return currentWorkspaceId === workspaceId2
                            ? [
                                  {
                                      id: 'shared-row',
                                      _tp_parent_id: moduleId,
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
                                      _tp_parent_id: personalModuleId,
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
        const response = await request(app).get(`/public/a/${applicationId}/runtime?slug=demo-module`).expect(200)

        expect(response.body).toMatchObject({
            type: 'module',
            id: moduleId,
            title: 'Shared module'
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
                        return [{ id: 'object-links', codename: codenameVlc('AccessLinks'), kind: 'catalog', table_name: 'access_links_table' }]
                    }
                    return [{ id: 'object-modules', codename: codenameVlc('Modules'), kind: 'catalog', table_name: 'modules_table' }]
                }

                if (sql.includes(`FROM "${schemaName}"."_app_attributes"`)) {
                    if (params[0] === 'object-links') {
                        return [
                            { id: 'attr-1', codename: codenameVlc('Slug'), column_name: 'slug', data_type: 'STRING', parent_attribute_id: null },
                            { id: 'attr-2', codename: codenameVlc('TargetType'), column_name: 'target_type', data_type: 'STRING', parent_attribute_id: null },
                            { id: 'attr-3', codename: codenameVlc('TargetId'), column_name: 'target_id', data_type: 'STRING', parent_attribute_id: null },
                            { id: 'attr-4', codename: codenameVlc('IsActive'), column_name: 'is_active', data_type: 'BOOLEAN', parent_attribute_id: null }
                        ]
                    }

                    return [
                        { id: 'attr-title', codename: codenameVlc('Title'), column_name: 'title', data_type: 'STRING', parent_attribute_id: null },
                        { id: 'attr-description', codename: codenameVlc('Description'), column_name: 'description', data_type: 'STRING', parent_attribute_id: null },
                        { id: 'attr-content', codename: codenameVlc('ContentItems'), column_name: 'content_items', data_type: 'TABLE', parent_attribute_id: null },
                        {
                            id: 'child-type',
                            codename: codenameVlc('ItemType'),
                            column_name: 'item_type',
                            data_type: 'REF',
                            parent_attribute_id: 'attr-content',
                            target_object_id: 'enum-content-type',
                            target_object_kind: 'enumeration'
                        },
                        { id: 'child-title', codename: codenameVlc('ItemTitle'), column_name: 'item_title', data_type: 'STRING', parent_attribute_id: 'attr-content' },
                        { id: 'child-quiz', codename: codenameVlc('QuizId'), column_name: 'quiz_id', data_type: 'STRING', parent_attribute_id: 'attr-content' },
                        { id: 'child-content', codename: codenameVlc('ItemContent'), column_name: 'item_content', data_type: 'STRING', parent_attribute_id: 'attr-content' },
                        { id: 'child-sort', codename: codenameVlc('SortOrder'), column_name: 'sort_order', data_type: 'NUMBER', parent_attribute_id: 'attr-content' }
                    ]
                }

                if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                    return [{ id: accessLinkId, slug: 'demo-module', target_type: 'module', target_id: moduleId, is_active: true }]
                }

                if (sql.includes(`FROM "${schemaName}"."modules_table"`)) {
                    return [{ id: moduleId, title: 'Localized module', description: 'Localized lesson' }]
                }

                if (sql.includes(`FROM "${schemaName}"."_app_values"`)) {
                    return [{ id: 'value-quiz-ref', object_id: 'enum-content-type', codename: codenameVlc('QuizRef') }]
                }

                if (sql.includes(`FROM "${schemaName}"."content_items"`)) {
                    return [
                        {
                            id: 'row-1',
                            _tp_parent_id: moduleId,
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
        const response = await request(app).get(`/public/a/${applicationId}/runtime?slug=demo-module`).expect(200)

        expect(response.body).toMatchObject({
            type: 'module',
            id: moduleId,
            title: 'Localized module'
        })
        expect(response.body.contentItems).toEqual([
            expect.objectContaining({
                itemType: 'quiz_ref',
                itemTitle: 'Localized quiz'
            })
        ])
    })

    it('localizes runtime module payloads when locale is provided', async () => {
        const dataSource = buildDataSource(
            withPublicApplication((sql, params) => {
                if (sql.includes(`FROM "${schemaName}"."_app_objects"`)) {
                    if (params[0] === 'AccessLinks') {
                        return [{ id: 'object-links', codename: codenameVlc('AccessLinks'), kind: 'catalog', table_name: 'access_links_table' }]
                    }
                    return [{ id: 'object-modules', codename: codenameVlc('Modules'), kind: 'catalog', table_name: 'modules_table' }]
                }

                if (sql.includes(`FROM "${schemaName}"."_app_attributes"`)) {
                    if (params[0] === 'object-links') {
                        return [
                            { id: 'attr-1', codename: codenameVlc('Slug'), column_name: 'slug', data_type: 'STRING', parent_attribute_id: null },
                            { id: 'attr-2', codename: codenameVlc('TargetType'), column_name: 'target_type', data_type: 'STRING', parent_attribute_id: null },
                            { id: 'attr-3', codename: codenameVlc('TargetId'), column_name: 'target_id', data_type: 'STRING', parent_attribute_id: null },
                            { id: 'attr-4', codename: codenameVlc('IsActive'), column_name: 'is_active', data_type: 'BOOLEAN', parent_attribute_id: null }
                        ]
                    }

                    return [
                        { id: 'attr-title', codename: codenameVlc('Title'), column_name: 'title', data_type: 'STRING', parent_attribute_id: null },
                        { id: 'attr-description', codename: codenameVlc('Description'), column_name: 'description', data_type: 'STRING', parent_attribute_id: null },
                        { id: 'attr-content', codename: codenameVlc('ContentItems'), column_name: 'content_items', data_type: 'TABLE', parent_attribute_id: null },
                        {
                            id: 'child-type',
                            codename: codenameVlc('ItemType'),
                            column_name: 'item_type',
                            data_type: 'REF',
                            parent_attribute_id: 'attr-content',
                            target_object_id: 'enum-content-type',
                            target_object_kind: 'enumeration'
                        },
                        { id: 'child-title', codename: codenameVlc('ItemTitle'), column_name: 'item_title', data_type: 'STRING', parent_attribute_id: 'attr-content' },
                        { id: 'child-quiz', codename: codenameVlc('QuizId'), column_name: 'quiz_id', data_type: 'STRING', parent_attribute_id: 'attr-content' },
                        { id: 'child-content', codename: codenameVlc('ItemContent'), column_name: 'item_content', data_type: 'STRING', parent_attribute_id: 'attr-content' },
                        { id: 'child-sort', codename: codenameVlc('SortOrder'), column_name: 'sort_order', data_type: 'NUMBER', parent_attribute_id: 'attr-content' }
                    ]
                }

                if (sql.includes(`FROM "${schemaName}"."access_links_table"`)) {
                    return [{ id: accessLinkId, slug: 'demo-module', target_type: 'module', target_id: moduleId, is_active: true }]
                }

                if (sql.includes(`FROM "${schemaName}"."modules_table"`)) {
                    return [
                        {
                            id: moduleId,
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
                            _tp_parent_id: moduleId,
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
        const response = await request(app).get(`/public/a/${applicationId}/runtime?slug=demo-module&locale=ru`).expect(200)

        expect(response.body).toMatchObject({
            type: 'module',
            id: moduleId,
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
