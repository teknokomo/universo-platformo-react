jest.mock('../../guards/ensureGlobalAccess', () => ({
    createEnsureGlobalAccess: () => () => (_req: unknown, _res: unknown, next: (error?: unknown) => void) => next()
}))

jest.mock('../../persistence/settingsStore', () => ({
    listSettings: jest.fn(),
    findSetting: jest.fn(),
    upsertSetting: jest.fn(),
    bulkUpsertSettings: jest.fn(),
    deleteSetting: jest.fn(),
    transformSettingRow: jest.fn((row: unknown) => row)
}))

import express from 'express'
const request = require('supertest')

import { createAdminSettingsRoutes } from '../../routes/adminSettingsRoutes'
import { listSettings, findSetting, upsertSetting, bulkUpsertSettings, deleteSetting } from '../../persistence/settingsStore'

const mockListSettings = listSettings as jest.MockedFunction<typeof listSettings>
const mockFindSetting = findSetting as jest.MockedFunction<typeof findSetting>
const mockUpsertSetting = upsertSetting as jest.MockedFunction<typeof upsertSetting>
const mockBulkUpsertSettings = bulkUpsertSettings as jest.MockedFunction<typeof bulkUpsertSettings>
const mockDeleteSetting = deleteSetting as jest.MockedFunction<typeof deleteSetting>

function buildApp() {
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
        '/settings',
        createAdminSettingsRoutes({
            globalAccessService: {} as never,
            permissionService: {} as never,
            getDbExecutor: () => ({ query: jest.fn(), transaction: jest.fn() } as never)
        })
    )
    return app
}

describe('adminSettingsRoutes', () => {
    beforeEach(() => jest.clearAllMocks())

    // ── GET / ──────────────────────────────────────────────────
    it('lists all settings', async () => {
        const rows = [{ id: '1', category: 'metahubs', key: 'codenameStyle', value: 'pascal-case' }]
        mockListSettings.mockResolvedValue(rows as never)

        const res = await request(buildApp()).get('/settings')

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(mockListSettings).toHaveBeenCalledTimes(1)
    })

    // ── GET /:category ─────────────────────────────────────────
    it('lists settings by category', async () => {
        mockListSettings.mockResolvedValue([] as never)

        const res = await request(buildApp()).get('/settings/metahubs')
        expect(res.status).toBe(200)
        expect(mockListSettings).toHaveBeenCalledWith(expect.anything(), 'metahubs')
    })

    it('rejects invalid category with special chars', async () => {
        const res = await request(buildApp()).get('/settings/bad%20cat!')
        expect(res.status).toBe(400)
    })

    // ── GET /:category/:key ────────────────────────────────────
    it('returns a single setting', async () => {
        mockFindSetting.mockResolvedValue({ id: '1', category: 'metahubs', key: 'codenameStyle', value: 'pascal-case' } as never)

        const res = await request(buildApp()).get('/settings/metahubs/codenameStyle')
        expect(res.status).toBe(200)
        expect(mockFindSetting).toHaveBeenCalledWith(expect.anything(), 'metahubs', 'codenameStyle')
    })

    it('returns 404 for missing setting', async () => {
        mockFindSetting.mockResolvedValue(null as never)

        const res = await request(buildApp()).get('/settings/metahubs/nonexistent')
        expect(res.status).toBe(404)
    })

    // ── PUT /:category (bulk) ──────────────────────────────────
    it('bulk-upserts settings', async () => {
        mockBulkUpsertSettings.mockResolvedValue([{ id: '1', category: 'metahubs', key: 'codenameStyle', value: 'kebab-case' }] as never)

        const res = await request(buildApp())
            .put('/settings/metahubs')
            .send({ values: { codenameStyle: 'kebab-case' } })

        expect(res.status).toBe(200)
        expect(mockBulkUpsertSettings).toHaveBeenCalledTimes(1)
    })

    it('rejects bulk upsert with empty values', async () => {
        const res = await request(buildApp()).put('/settings/metahubs').send({ values: {} })
        expect(res.status).toBe(400)
    })

    it('rejects unknown metahubs setting key', async () => {
        const res = await request(buildApp())
            .put('/settings/metahubs')
            .send({ values: { unknownKey: true } })
        expect(res.status).toBe(400)
        expect(res.body.error).toContain('Unknown metahubs setting key')
    })

    it('rejects invalid metahubs setting value type', async () => {
        const res = await request(buildApp())
            .put('/settings/metahubs')
            .send({ values: { codenameStyle: 'invalid-style' } })
        expect(res.status).toBe(400)
    })

    // ── PUT /:category/:key ────────────────────────────────────
    it('upserts a single setting', async () => {
        mockUpsertSetting.mockResolvedValue({ id: '1', category: 'general', key: 'dialogSizePreset', value: 'large' } as never)

        const res = await request(buildApp()).put('/settings/general/dialogSizePreset').send({ value: 'large' })

        expect(res.status).toBe(200)
        expect(mockUpsertSetting).toHaveBeenCalledWith(expect.anything(), 'general', 'dialogSizePreset', 'large')
    })

    it('validates metahubs-specific setting key', async () => {
        const res = await request(buildApp()).put('/settings/metahubs/unknownKey').send({ value: true })
        expect(res.status).toBe(400)
        expect(res.body.error).toContain('Unknown metahubs setting key')
    })

    it('validates general dialog setting values', async () => {
        const res = await request(buildApp()).put('/settings/general/dialogSizePreset').send({ value: 'huge' })
        expect(res.status).toBe(400)
    })

    // ── DELETE /:category/:key ─────────────────────────────────
    it('deletes an existing setting', async () => {
        mockFindSetting.mockResolvedValue({ id: '1', category: 'general', key: 'siteName', value: 'Test' } as never)
        mockDeleteSetting.mockResolvedValue(undefined as never)

        const res = await request(buildApp()).delete('/settings/general/siteName')
        expect(res.status).toBe(200)
        expect(mockDeleteSetting).toHaveBeenCalledTimes(1)
    })

    it('returns 404 when deleting non-existent setting', async () => {
        mockFindSetting.mockResolvedValue(null as never)

        const res = await request(buildApp()).delete('/settings/general/missing')
        expect(res.status).toBe(404)
    })
})
