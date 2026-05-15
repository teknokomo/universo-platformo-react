jest.mock('../../guards/ensureGlobalAccess', () => ({
    createEnsureGlobalAccess: () => () => (_req: unknown, _res: unknown, next: (error?: unknown) => void) => next()
}))

jest.mock('../../persistence/localesStore', () => ({
    listLocales: jest.fn(),
    findLocaleById: jest.fn(),
    findLocaleByCode: jest.fn(),
    createLocale: jest.fn(),
    updateLocale: jest.fn(),
    deleteLocale: jest.fn(),
    transformLocaleRow: jest.fn((row: unknown) => row),
    listEnabledContentLocales: jest.fn(),
    listEnabledUiLocales: jest.fn()
}))

import express from 'express'
const request = require('supertest')

import { createLocalesRoutes } from '../../routes/localesRoutes'
import { createPublicLocalesRoutes } from '../../routes/publicLocalesRoutes'
import {
    listLocales,
    findLocaleById,
    findLocaleByCode,
    createLocale,
    updateLocale,
    deleteLocale,
    listEnabledContentLocales,
    listEnabledUiLocales
} from '../../persistence/localesStore'

const mockListLocales = listLocales as jest.MockedFunction<typeof listLocales>
const mockFindById = findLocaleById as jest.MockedFunction<typeof findLocaleById>
const mockFindByCode = findLocaleByCode as jest.MockedFunction<typeof findLocaleByCode>
const mockCreateLocale = createLocale as jest.MockedFunction<typeof createLocale>
const mockUpdateLocale = updateLocale as jest.MockedFunction<typeof updateLocale>
const mockDeleteLocale = deleteLocale as jest.MockedFunction<typeof deleteLocale>
const mockListContent = listEnabledContentLocales as jest.MockedFunction<typeof listEnabledContentLocales>
const mockListUi = listEnabledUiLocales as jest.MockedFunction<typeof listEnabledUiLocales>

const VALID_UUID = '00000000-0000-4000-a000-000000000001'

function vlcString(text: string) {
    const now = new Date().toISOString()
    return {
        _schema: '1' as const,
        _primary: 'en',
        locales: {
            en: { content: text, version: 1, isActive: true, createdAt: now, updatedAt: now }
        }
    }
}

function buildAuthApp() {
    const app = express()
    app.use(express.json())
    app.use((req, _res, next) => {
        ;(req as never as Record<string, unknown>).user = { id: 'admin-1' }
        ;(req as never as Record<string, unknown>).dbContext = {
            session: { query: jest.fn(), isReleased: jest.fn(() => false) },
            isReleased: () => false,
            query: jest.fn()
        }
        next()
    })
    app.use(
        '/locales',
        createLocalesRoutes({
            globalAccessService: {} as never,
            permissionService: {} as never,
            getDbExecutor: () => ({ query: jest.fn(), transaction: jest.fn() } as never)
        })
    )
    return app
}

function buildPublicApp() {
    const app = express()
    app.use(
        '/public-locales',
        createPublicLocalesRoutes({
            getDbExecutor: () => ({ query: jest.fn(), transaction: jest.fn() } as never)
        })
    )
    return app
}

describe('localesRoutes', () => {
    beforeEach(() => jest.clearAllMocks())

    // ── GET / ──────────────────────────────────────────────────
    it('lists locales', async () => {
        mockListLocales.mockResolvedValue({ items: [{ id: VALID_UUID, code: 'en' }], total: 1 } as never)

        const res = await request(buildAuthApp()).get('/locales')
        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(res.body.data.total).toBe(1)
    })

    // ── GET /:id ───────────────────────────────────────────────
    it('returns locale by id', async () => {
        mockFindById.mockResolvedValue({ id: VALID_UUID, code: 'en' } as never)

        const res = await request(buildAuthApp()).get(`/locales/${VALID_UUID}`)
        expect(res.status).toBe(200)
    })

    it('rejects invalid UUID format', async () => {
        const res = await request(buildAuthApp()).get('/locales/not-a-uuid')
        expect(res.status).toBe(400)
        expect(res.body.error).toContain('UUID')
    })

    it('returns 404 for missing locale', async () => {
        mockFindById.mockResolvedValue(null as never)

        const res = await request(buildAuthApp()).get(`/locales/${VALID_UUID}`)
        expect(res.status).toBe(404)
    })

    // ── POST / ─────────────────────────────────────────────────
    it('creates a new locale', async () => {
        mockFindByCode.mockResolvedValue(null as never)
        mockCreateLocale.mockResolvedValue({ id: VALID_UUID, code: 'fr' } as never)

        const res = await request(buildAuthApp())
            .post('/locales')
            .send({
                code: 'fr',
                name: vlcString('French'),
                nativeName: 'Français'
            })

        expect(res.status).toBe(201)
        expect(mockCreateLocale).toHaveBeenCalledTimes(1)
    })

    it('rejects duplicate locale code', async () => {
        mockFindByCode.mockResolvedValue({ id: VALID_UUID, code: 'en' } as never)

        const res = await request(buildAuthApp())
            .post('/locales')
            .send({
                code: 'en',
                name: vlcString('English'),
                nativeName: 'English'
            })

        expect(res.status).toBe(409)
    })

    // ── PATCH /:id ─────────────────────────────────────────────
    it('updates locale fields', async () => {
        mockFindById.mockResolvedValue({ id: VALID_UUID, code: 'en' } as never)
        mockUpdateLocale.mockResolvedValue({ id: VALID_UUID, code: 'en', sortOrder: 5 } as never)

        const res = await request(buildAuthApp()).patch(`/locales/${VALID_UUID}`).send({ sortOrder: 5 })
        expect(res.status).toBe(200)
    })

    it('returns 400 when disabling last enabled locale', async () => {
        mockFindById.mockResolvedValue({ id: VALID_UUID, code: 'en' } as never)
        mockUpdateLocale.mockRejectedValue(new Error('LAST_ENABLED_LOCALE'))

        const res = await request(buildAuthApp()).patch(`/locales/${VALID_UUID}`).send({ isEnabledContent: false })
        expect(res.status).toBe(400)
        expect(res.body.error).toContain('only enabled content locale')
    })

    // ── DELETE /:id ────────────────────────────────────────────
    it('deletes a regular locale', async () => {
        mockFindById.mockResolvedValue({
            id: VALID_UUID,
            code: 'fr',
            is_system: false,
            is_default_content: false,
            is_default_ui: false
        } as never)
        mockDeleteLocale.mockResolvedValue(undefined as never)

        const res = await request(buildAuthApp()).delete(`/locales/${VALID_UUID}`)
        expect(res.status).toBe(204)
    })

    it('rejects deleting system locale', async () => {
        mockFindById.mockResolvedValue({
            id: VALID_UUID,
            code: 'en',
            is_system: true,
            is_default_content: false,
            is_default_ui: false
        } as never)

        const res = await request(buildAuthApp()).delete(`/locales/${VALID_UUID}`)
        expect(res.status).toBe(403)
    })

    it('rejects deleting default locale', async () => {
        mockFindById.mockResolvedValue({
            id: VALID_UUID,
            code: 'en',
            is_system: false,
            is_default_content: true,
            is_default_ui: false
        } as never)

        const res = await request(buildAuthApp()).delete(`/locales/${VALID_UUID}`)
        expect(res.status).toBe(400)
        expect(res.body.error).toContain('default locale')
    })

    it('returns 404 when deleting non-existent locale', async () => {
        mockFindById.mockResolvedValue(null as never)

        const res = await request(buildAuthApp()).delete(`/locales/${VALID_UUID}`)
        expect(res.status).toBe(404)
    })
})

describe('publicLocalesRoutes', () => {
    beforeEach(() => jest.clearAllMocks())

    it('returns public content locales with cache header', async () => {
        mockListContent.mockResolvedValue([
            { code: 'en', native_name: 'English', is_default_content: true },
            { code: 'ru', native_name: 'Русский', is_default_content: false }
        ] as never)

        const res = await request(buildPublicApp()).get('/public-locales/content')

        expect(res.status).toBe(200)
        expect(res.headers['cache-control']).toContain('max-age=300')
        expect(res.body.defaultLocale).toBe('en')
        expect(res.body.locales).toHaveLength(2)
        expect(res.body.locales[0].label).toBe('English')
    })

    it('returns public UI locales with cache header', async () => {
        mockListUi.mockResolvedValue([{ code: 'en', native_name: 'English', is_default_ui: true }] as never)

        const res = await request(buildPublicApp()).get('/public-locales/ui')

        expect(res.status).toBe(200)
        expect(res.headers['cache-control']).toContain('max-age=300')
        expect(res.body.defaultLocale).toBe('en')
    })

    it('falls back to code.toUpperCase() when native_name is empty', async () => {
        mockListContent.mockResolvedValue([{ code: 'fr', native_name: '', is_default_content: true }] as never)

        const res = await request(buildPublicApp()).get('/public-locales/content')

        expect(res.status).toBe(200)
        expect(res.body.locales[0].label).toBe('FR')
    })
})
