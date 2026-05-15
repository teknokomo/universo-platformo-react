jest.mock('../../guards/ensureGlobalAccess', () => ({
    createEnsureGlobalAccess: () => () => (_req: unknown, _res: unknown, next: (error?: unknown) => void) => next()
}))

jest.mock('../../persistence/rolesStore', () => ({
    listRoles: jest.fn(),
    listAssignableRoles: jest.fn(),
    findRoleById: jest.fn(),
    findRoleByCodename: jest.fn(),
    createRole: jest.fn(),
    updateRole: jest.fn(),
    deleteRole: jest.fn(),
    replacePermissions: jest.fn(),
    countUsersByRoleId: jest.fn(),
    listRoleUsers: jest.fn()
}))

jest.mock('../../persistence/settingsStore', () => ({
    findSetting: jest.fn()
}))

jest.mock('@universo/utils', () => {
    const original = jest.requireActual('@universo/utils')
    return {
        ...original,
        getRequestDbExecutor: (_req: unknown, fallback: unknown) => fallback
    }
})

jest.mock('@universo/utils/vlc', () => {
    const original = jest.requireActual('@universo/utils/vlc')
    return {
        ...original,
        enforceSingleLocaleCodename: jest.fn((c: unknown) => c)
    }
})

jest.mock('@universo/utils/database', () => {
    const original = jest.requireActual('@universo/utils/database')
    return {
        ...original,
        isUniqueViolation: jest.fn(() => false)
    }
})

import express from 'express'
const request = require('supertest')

import { createRolesRoutes } from '../../routes/rolesRoutes'
import {
    listRoles,
    listAssignableRoles,
    findRoleById,
    findRoleByCodename,
    createRole,
    updateRole,
    deleteRole,
    countUsersByRoleId,
    listRoleUsers
} from '../../persistence/rolesStore'
import { findSetting } from '../../persistence/settingsStore'
import { isUniqueViolation } from '@universo/utils/database'

const mockListRoles = listRoles as jest.MockedFunction<typeof listRoles>
const mockListAssignable = listAssignableRoles as jest.MockedFunction<typeof listAssignableRoles>
const mockFindById = findRoleById as jest.MockedFunction<typeof findRoleById>
const mockFindByCodename = findRoleByCodename as jest.MockedFunction<typeof findRoleByCodename>
const mockCreateRole = createRole as jest.MockedFunction<typeof createRole>
const mockUpdateRole = updateRole as jest.MockedFunction<typeof updateRole>
const mockDeleteRole = deleteRole as jest.MockedFunction<typeof deleteRole>
const mockCountUsers = countUsersByRoleId as jest.MockedFunction<typeof countUsersByRoleId>
const mockListRoleUsers = listRoleUsers as jest.MockedFunction<typeof listRoleUsers>
const mockFindSetting = findSetting as jest.MockedFunction<typeof findSetting>
const mockIsUniqueViolation = isUniqueViolation as jest.MockedFunction<typeof isUniqueViolation>

const VALID_UUID = '00000000-0000-4000-a000-000000000001'
const VALID_UUID_2 = '00000000-0000-4000-a000-000000000002'

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
    const mockExec = {
        query: jest.fn(),
        transaction: jest.fn(async (fn: (trx: unknown) => Promise<unknown>) => fn({ query: jest.fn() }))
    }
    app.use(
        '/roles',
        createRolesRoutes({
            globalAccessService: {} as never,
            permissionService: {} as never,
            getDbExecutor: () => mockExec as never
        })
    )
    return app
}

const validCodename = vlcString('editor')
const sampleRole = {
    id: VALID_UUID,
    codename: validCodename,
    name: { en: 'Editor' },
    color: '#9e9e9e',
    is_system: false,
    is_superuser: false
}

describe('rolesRoutes', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockFindSetting.mockResolvedValue(null as never)
    })

    // ── GET /assignable ────────────────────────────────────────
    it('lists assignable roles', async () => {
        mockListAssignable.mockResolvedValue([sampleRole] as never)

        const res = await request(buildApp()).get('/roles/assignable')
        expect(res.status).toBe(200)
        expect(res.body.data).toHaveLength(1)
        expect(res.body.data[0].id).toBe(VALID_UUID)
    })

    // ── GET / ──────────────────────────────────────────────────
    it('lists roles with pagination headers', async () => {
        mockListRoles.mockResolvedValue({ items: [sampleRole], total: 1 } as never)

        const res = await request(buildApp()).get('/roles?limit=10&offset=0')
        expect(res.status).toBe(200)
        expect(res.headers['x-total-count']).toBe('1')
        expect(res.headers['x-pagination-has-more']).toBe('false')
    })

    it('rejects invalid list query params', async () => {
        const res = await request(buildApp()).get('/roles?limit=-1')
        expect(res.status).toBe(400)
    })

    // ── GET /:id ───────────────────────────────────────────────
    it('returns role by id', async () => {
        mockFindById.mockResolvedValue(sampleRole as never)

        const res = await request(buildApp()).get(`/roles/${VALID_UUID}`)
        expect(res.status).toBe(200)
        expect(res.body.data.id).toBe(VALID_UUID)
    })

    it('rejects invalid UUID', async () => {
        const res = await request(buildApp()).get('/roles/not-a-uuid')
        expect(res.status).toBe(400)
        expect(res.body.error).toContain('UUID')
    })

    it('returns 404 for missing role', async () => {
        mockFindById.mockResolvedValue(null as never)

        const res = await request(buildApp()).get(`/roles/${VALID_UUID}`)
        expect(res.status).toBe(404)
    })

    // ── POST / (create) ───────────────────────────────────────
    it('creates a new role', async () => {
        mockFindByCodename.mockResolvedValue(null as never)
        mockCreateRole.mockResolvedValue({ id: VALID_UUID_2 } as never)
        mockFindById.mockResolvedValue({ ...sampleRole, id: VALID_UUID_2 } as never)

        const res = await request(buildApp())
            .post('/roles')
            .send({ codename: vlcString('Reviewer'), name: vlcString('Reviewer'), color: '#9e9e9e', isSuperuser: false })

        expect(res.status).toBe(201)
        expect(mockCreateRole).toHaveBeenCalledTimes(1)
    })

    it('rejects role codename that conflicts with the configured runtime settings', async () => {
        const res = await request(buildApp())
            .post('/roles')
            .send({ codename: vlcString('роль-редактор'), name: vlcString('Reviewer'), color: '#9e9e9e', isSuperuser: false })

        expect(res.status).toBe(400)
        expect(res.body.details[0].message).toContain('configured')
    })

    it('accepts role codename that matches the configured runtime settings', async () => {
        mockFindSetting.mockImplementation(async (_exec, _category, key) => {
            if (key === 'codenameStyle') return { value: { _value: 'kebab-case' } } as never
            if (key === 'codenameAlphabet') return { value: { _value: 'ru' } } as never
            if (key === 'codenameAllowMixedAlphabets') return { value: { _value: false } } as never
            return null as never
        })
        mockFindByCodename.mockResolvedValue(null as never)
        mockCreateRole.mockResolvedValue({ id: VALID_UUID_2 } as never)
        mockFindById.mockResolvedValue({ ...sampleRole, id: VALID_UUID_2 } as never)

        const res = await request(buildApp())
            .post('/roles')
            .send({ codename: vlcString('роль-редактор'), name: vlcString('Reviewer'), color: '#9e9e9e', isSuperuser: false })

        expect(res.status).toBe(201)
        expect(mockCreateRole).toHaveBeenCalledTimes(1)
    })

    it('rejects duplicate codename on create', async () => {
        mockFindByCodename.mockResolvedValue(sampleRole as never)

        const res = await request(buildApp())
            .post('/roles')
            .send({ codename: validCodename, name: vlcString('Dup'), color: '#9e9e9e', isSuperuser: false })

        expect(res.status).toBe(409)
    })

    // ── POST /:id/copy ────────────────────────────────────────
    it('copies a role', async () => {
        const copyCn = vlcString('EditorCopy')
        mockFindById.mockResolvedValueOnce(sampleRole as never)
        mockFindByCodename.mockResolvedValue(null as never)
        mockCreateRole.mockResolvedValue({ id: VALID_UUID_2 } as never)
        mockFindById.mockResolvedValueOnce({ ...sampleRole, id: VALID_UUID_2, codename: copyCn } as never)

        const res = await request(buildApp())
            .post(`/roles/${VALID_UUID}/copy`)
            .send({ codename: copyCn, name: vlcString('Editor Copy') })

        expect(res.status).toBe(201)
    })

    it('returns 404 when source role for copy not found', async () => {
        mockFindById.mockResolvedValue(null as never)
        mockFindByCodename.mockResolvedValue(null as never)

        const copyCn = vlcString('Nope')
        const res = await request(buildApp())
            .post(`/roles/${VALID_UUID}/copy`)
            .send({ codename: copyCn, name: vlcString('Nope') })

        expect(res.status).toBe(404)
    })

    // ── PATCH /:id ─────────────────────────────────────────────
    it('updates role fields', async () => {
        mockFindById.mockResolvedValueOnce(sampleRole as never)
        mockUpdateRole.mockResolvedValue(undefined as never)
        mockFindById.mockResolvedValueOnce({ ...sampleRole, color: '#ff0000' } as never)

        const res = await request(buildApp()).patch(`/roles/${VALID_UUID}`).send({ color: '#ff0000' })
        expect(res.status).toBe(200)
    })

    it('protects system role from codename changes', async () => {
        const systemRole = { ...sampleRole, is_system: true }
        mockFindById.mockResolvedValue(systemRole as never)

        const newCn = vlcString('Changed')
        const res = await request(buildApp()).patch(`/roles/${VALID_UUID}`).send({ codename: newCn })

        expect(res.status).toBe(403)
        expect(res.body.error).toContain('system role')
    })

    it('returns 404 for patching non-existent role', async () => {
        mockFindById.mockResolvedValue(null as never)

        const res = await request(buildApp()).patch(`/roles/${VALID_UUID}`).send({ color: '#ff0000' })
        expect(res.status).toBe(404)
    })

    // ── DELETE /:id ────────────────────────────────────────────
    it('deletes a non-system role with no users', async () => {
        mockFindById.mockResolvedValue(sampleRole as never)
        mockCountUsers.mockResolvedValue(0 as never)
        mockDeleteRole.mockResolvedValue(undefined as never)

        const res = await request(buildApp()).delete(`/roles/${VALID_UUID}`)
        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
    })

    it('rejects deleting a system role', async () => {
        mockFindById.mockResolvedValue({ ...sampleRole, is_system: true } as never)

        const res = await request(buildApp()).delete(`/roles/${VALID_UUID}`)
        expect(res.status).toBe(403)
    })

    it('rejects deleting a role with assigned users', async () => {
        mockFindById.mockResolvedValue(sampleRole as never)
        mockCountUsers.mockResolvedValue(3 as never)

        const res = await request(buildApp()).delete(`/roles/${VALID_UUID}`)
        expect(res.status).toBe(409)
        expect(res.body.error).toContain('3 user(s)')
    })

    // ── GET /:id/users ────────────────────────────────────────
    it('lists users for a role', async () => {
        mockFindById.mockResolvedValue(sampleRole as never)
        mockListRoleUsers.mockResolvedValue({
            items: [
                {
                    user_id: 'u-1',
                    email: 'a@b.com',
                    full_name: 'Alice',
                    _upl_created_at: '2025-01-01',
                    granted_by: null,
                    status: 'active'
                }
            ],
            total: 1
        } as never)

        const res = await request(buildApp()).get(`/roles/${VALID_UUID}/users`)
        expect(res.status).toBe(200)
        expect(res.body.data.users).toHaveLength(1)
        expect(res.body.data.roleId).toBe(VALID_UUID)
    })

    it('returns 404 for users of non-existent role', async () => {
        mockFindById.mockResolvedValue(null as never)

        const res = await request(buildApp()).get(`/roles/${VALID_UUID}/users`)
        expect(res.status).toBe(404)
    })
})
