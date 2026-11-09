import type { NextFunction, Request, RequestHandler, Response } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'

const express = require('express') as typeof import('express')
const request = require('supertest') as typeof import('supertest')

jest.mock('../../routes/guards', () => ({
    ensureApplicationAccess: jest.fn()
}))

import { ensureApplicationAccess } from '../../routes/guards'
import { createThemePresetsRoutes } from '../../routes/themePresetsRoutes'
import { isThemePresetsEnabled, getThemePresetsConfig } from '@universo-react/utils/env'
import { findFileThemePreset } from '@universo-react/theme'
import { themeTokensSchema } from '@universo-react/types'
import type { DbExecutor, SqlQueryable } from '@universo-react/utils'

const mockedEnsureApplicationAccess = jest.mocked(ensureApplicationAccess)

const preset = findFileThemePreset('universo-default')!
const validTokens = themeTokensSchema.parse(preset.tokens)

const applicationId = '019ccefc-2f7b-7b36-82f4-85cdb1312268'
const presetId = '019ccefc-2f7b-7b36-82f4-85cdb1312269'
const userId = '019ccefc-2f7b-7b36-82f4-85cdb1312270'

type QueryHandler = (sql: string, params?: unknown[]) => unknown[]

interface MockExecutor extends DbExecutor {
    calls: Array<{ sql: string; params?: unknown[] }>
}

/**
 * Minimal DbExecutor stub (applicationThemePresetsService.test.ts idiom):
 * dispatches canned results by SQL substring and records every query so
 * authorization failure paths can assert they never touched the database.
 */
const createMockExecutor = (handlers: Record<string, QueryHandler> = {}): MockExecutor => {
    const calls: Array<{ sql: string; params?: unknown[] }> = []
    const run = (sql: string, params?: unknown[]): unknown[] => {
        for (const [needle, handler] of Object.entries(handlers)) {
            if (sql.includes(needle)) return handler(sql, params)
        }
        return []
    }
    const executor = {
        calls,
        query: <T>(sql: string, params?: unknown[]): Promise<T[]> => {
            calls.push({ sql, params })
            return Promise.resolve(run(sql, params) as T[])
        },
        transaction: async <T>(work: (tx: SqlQueryable) => Promise<T>): Promise<T> => work(executor as unknown as SqlQueryable)
    }
    return executor as unknown as MockExecutor
}

const mockRateLimiter: RateLimitRequestHandler = ((_req: Request, _res: Response, next: NextFunction) => next()) as RateLimitRequestHandler

const buildApp = (options: { authenticate?: boolean; executor?: MockExecutor } = {}) => {
    const executor = options.executor ?? createMockExecutor()
    const app = express()
    app.use(express.json())
    const ensureAuth: RequestHandler = (req, _res, next) => {
        if (options.authenticate !== false) {
            ;(req as Request & { user?: { id: string } }).user = { id: userId }
        }
        next()
    }
    app.use(
        '/',
        createThemePresetsRoutes(
            ensureAuth,
            () => executor,
            mockRateLimiter,
            mockRateLimiter,
            () => executor
        )
    )
    return app
}

// Store SQL needles (distinct substrings of the themePresetsStore statements).
const GET_BY_ID = 'AND p.id = $2'
const COUNT = 'COUNT(*)::int AS count'
const INSERT = 'INSERT INTO applications.obj_theme_presets'
const AUDIT = 'rel_theme_preset_audits'

describe('theme presets routes', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockedEnsureApplicationAccess.mockResolvedValue({
            membership: { userId, applicationId, role: 'owner', _uplCreatedAt: new Date() },
            entityId: applicationId,
            applicationId
        } as never)
    })

    it('returns 401 without an authenticated user and never touches the database', async () => {
        const executor = createMockExecutor()
        const response = await request(buildApp({ authenticate: false, executor }))
            .post(`/applications/${applicationId}/theme-presets`)
            .send({ codename: 'corp-brand', name: { en: 'Corp' }, tokens: validTokens })

        expect(response.status).toBe(401)
        expect(response.body).toEqual({ error: 'Unauthorized' })
        expect(executor.calls).toHaveLength(0)
    })

    it('returns 403 when the user lacks the layouts read policy (only the policy lookup touches the database)', async () => {
        const executor = createMockExecutor()
        mockedEnsureApplicationAccess.mockRejectedValue(
            Object.assign(new Error('Insufficient permissions'), { statusCode: 403, status: 403 })
        )

        const response = await request(buildApp({ executor })).get(`/applications/${applicationId}/theme-presets`)

        expect(response.status).toBe(403)
        expect(mockedEnsureApplicationAccess).toHaveBeenCalledWith(executor, userId, applicationId, ['owner', 'admin'])
        // Exactly one authorization lookup (the read-policy settings query);
        // no preset data was read.
        expect(executor.calls).toHaveLength(1)
        expect(executor.calls[0].sql).toContain('SELECT settings')
    })

    it('creates a preset and returns 201 with the persisted record', async () => {
        const executor = createMockExecutor({
            [COUNT]: () => [{ count: 0 }],
            [INSERT]: () => [
                {
                    id: presetId,
                    applicationId,
                    codename: 'corp-brand',
                    name: { en: 'Corp' },
                    description: {},
                    tokens: validTokens,
                    basePresetId: null,
                    basePresetCodename: null,
                    schemaVersion: 1,
                    version: 1,
                    archived: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ],
            [AUDIT]: () => [{ id: 'audit-1' }]
        })

        const response = await request(buildApp({ executor }))
            .post(`/applications/${applicationId}/theme-presets`)
            .send({ codename: 'corp-brand', name: { en: 'Corp' }, tokens: validTokens })

        expect(response.status).toBe(201)
        expect(response.body).toMatchObject({ codename: 'corp-brand', applicationId, version: 1 })
    })

    it('accepts basePresetCodename through the strict create schema and persists the origin (copy-to-application contract)', async () => {
        const insertParams: unknown[] = []
        const origin = `metahub:0190a9b5-0000-7000-8000-000000000003`
        const executor = createMockExecutor({
            'SELECT schema_name': () => [{ schemaName: 'app_c0ffee' }],
            [COUNT]: () => [{ count: 1 }],
            [INSERT]: (_sql: string, params?: unknown[]) => {
                insertParams.push(...(params ?? []))
                return [
                    {
                        id: presetId,
                        applicationId,
                        codename: 'layout-copy',
                        name: { en: 'Layout theme copy' },
                        description: {},
                        tokens: validTokens,
                        basePresetId: null,
                        basePresetCodename: origin,
                        schemaVersion: 1,
                        version: 1,
                        archived: false,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                ]
            },
            [AUDIT]: () => [{ id: 'audit-1' }]
        })

        // The strict create schema must ACCEPT the provenance field: dropping
        // it would silently 400 the copy-to-application UI mutation.
        const response = await request(buildApp({ executor }))
            .post(`/applications/${applicationId}/theme-presets`)
            .send({
                codename: 'layout-copy',
                name: { en: 'Layout theme copy' },
                tokens: validTokens,
                basePresetCodename: origin
            })

        expect(response.status).toBe(201)
        expect(response.body.basePresetCodename).toBe(origin)
        expect(response.body.basePresetId).toBeNull()
        expect(insertParams).toContain(origin)
    })

    it('maps THEME_PRESET_LIMIT_REACHED to HTTP 409 with the code in the body', async () => {
        const executor = createMockExecutor({ [COUNT]: () => [{ count: 100 }] })

        const response = await request(buildApp({ executor }))
            .post(`/applications/${applicationId}/theme-presets`)
            .send({ codename: 'one-too-many', name: { en: 'X' }, tokens: validTokens })

        expect(response.status).toBe(409)
        expect(response.body.code).toBe('THEME_PRESET_LIMIT_REACHED')
        expect(response.body.details).toEqual({ limit: 100 })
    })

    it('serves the library to a reader per the layouts read policy and keeps mutations owner/admin', async () => {
        // Settings configure the layouts read policy to include members.
        const executor = createMockExecutor({
            'SELECT settings': () => [{ settings: { applicationLayouts: { readRoles: ['owner', 'admin', 'editor', 'member'] } } }],
            'SELECT schema_name': () => [{ schemaName: 'app_c0ffee' }],
            'FROM applications.obj_theme_presets p': () => [
                {
                    id: presetId,
                    applicationId,
                    codename: 'corp-brand',
                    name: { en: 'Corp' },
                    description: {},
                    tokens: validTokens,
                    basePresetId: null,
                    basePresetCodename: null,
                    schemaVersion: 1,
                    version: 1,
                    archived: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ],
            [COUNT]: () => [{ count: 1 }],
            [INSERT]: () => []
        })

        // Read: allowed for a member under the configured policy.
        const listResponse = await request(buildApp({ executor })).get(`/applications/${applicationId}/theme-presets`)
        expect(listResponse.status).toBe(200)
        expect(mockedEnsureApplicationAccess).toHaveBeenCalledWith(executor, userId, applicationId, ['owner', 'admin', 'editor', 'member'])

        const detailResponse = await request(buildApp({ executor })).get(`/applications/${applicationId}/theme-presets/${presetId}`)
        expect(detailResponse.status).toBe(200)

        // Mutation: still owner/admin — a member is rejected before any write.
        mockedEnsureApplicationAccess.mockClear()
        mockedEnsureApplicationAccess.mockRejectedValue(
            Object.assign(new Error('Insufficient permissions'), { statusCode: 403, status: 403 })
        )
        const createResponse = await request(buildApp({ executor }))
            .post(`/applications/${applicationId}/theme-presets`)
            .send({ codename: 'member-attempt', name: { en: 'X' }, tokens: validTokens })
        expect(createResponse.status).toBe(403)
        expect(mockedEnsureApplicationAccess).toHaveBeenCalledWith(executor, userId, applicationId, ['owner', 'admin'])
        const insertCalls = executor.calls.filter((call) => call.sql.includes(INSERT))
        expect(insertCalls).toHaveLength(0)
    })

    it('denies the library to a member when the layouts read policy stays owner/admin', async () => {
        const executor = createMockExecutor({
            'SELECT settings': () => [{ settings: null }]
        })
        // The real guard rejects a member against owner/admin-only roles.
        mockedEnsureApplicationAccess.mockRejectedValue(
            Object.assign(new Error('Insufficient permissions'), { statusCode: 403, status: 403 })
        )

        const response = await request(buildApp({ executor })).get(`/applications/${applicationId}/theme-presets`)

        expect(response.status).toBe(403)
        expect(mockedEnsureApplicationAccess).toHaveBeenCalledWith(executor, userId, applicationId, ['owner', 'admin'])
    })

    it('maps an unknown preset to 404 THEME_PRESET_NOT_FOUND through toErrorBody', async () => {
        const executor = createMockExecutor({ 'SELECT schema_name': () => [{ schemaName: 'app_c0ffee' }], [GET_BY_ID]: () => [] })

        const response = await request(buildApp({ executor })).get(`/applications/${applicationId}/theme-presets/${presetId}/export`)

        expect(response.status).toBe(404)
        expect(response.body.code).toBe('THEME_PRESET_NOT_FOUND')
        expect(response.body.error).toBe('Theme preset was not found in this application scope')
    })
})

describe('theme presets feature flag (TZ §15.4)', () => {
    // NOTE: the helper reads THEME_PRESETS_ENABLED (plural PRESETS), not
    // THEME_PRESET_ENABLED — see universo-react-utils/src/env/themePresetsConfig.ts.
    const FLAG_KEY = 'THEME_PRESETS_ENABLED'
    const previousFlag = process.env[FLAG_KEY]

    beforeEach(() => {
        delete process.env[FLAG_KEY]
    })

    afterAll(() => {
        if (previousFlag === undefined) {
            delete process.env[FLAG_KEY]
        } else {
            process.env[FLAG_KEY] = previousFlag
        }
    })

    it('is enabled by default when the environment variable is unset or empty', () => {
        expect(FLAG_KEY in process.env).toBe(false)
        expect(isThemePresetsEnabled()).toBe(true)
        expect(getThemePresetsConfig()).toEqual({ themePresetsEnabled: true })

        process.env[FLAG_KEY] = ''
        expect(isThemePresetsEnabled()).toBe(true)
    })

    it('treats THEME_PRESETS_ENABLED=false as disabled', () => {
        process.env[FLAG_KEY] = 'false'
        expect(isThemePresetsEnabled()).toBe(false)
        expect(getThemePresetsConfig()).toEqual({ themePresetsEnabled: false })
    })

    it('treats "1" as enabled and any other non-empty value as disabled', () => {
        process.env[FLAG_KEY] = '1'
        expect(isThemePresetsEnabled()).toBe(true)

        process.env[FLAG_KEY] = '0'
        expect(isThemePresetsEnabled()).toBe(false)
    })
})
