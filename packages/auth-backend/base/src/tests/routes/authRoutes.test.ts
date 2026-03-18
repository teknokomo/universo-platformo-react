import express from 'express'
import type { RequestHandler } from 'express'
const request = require('supertest')

const mockSignUp = jest.fn()

jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => ({
        auth: {
            signUp: mockSignUp
        }
    }))
}))

jest.mock('../../services/captchaService', () => ({
    validateCaptcha: jest.fn().mockResolvedValue({ success: true }),
    getCaptchaConfig: jest.fn(() => ({ enabled: false, siteKey: null, testMode: false })),
    isCaptchaRequired: jest.fn(() => false),
    validateLoginCaptcha: jest.fn().mockResolvedValue({ success: true }),
    getLoginCaptchaConfig: jest.fn(() => ({ enabled: false, siteKey: null, testMode: false })),
    isLoginCaptchaRequired: jest.fn(() => false)
}))

jest.mock('@universo/utils/auth', () => ({
    getAuthFeatureConfig: jest.fn(() => ({ registrationEnabled: true, loginEnabled: true, emailConfirmationRequired: false })),
    isRegistrationEnabled: jest.fn(() => true),
    isLoginEnabled: jest.fn(() => true)
}))

import { createAuthRouter } from '../../routes/auth'

const passThrough: RequestHandler = (_req, _res, next) => next()

describe('createAuthRouter registration rollback', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        process.env.SUPABASE_URL = 'https://example.supabase.co'
        process.env.SUPABASE_ANON_KEY = 'anon-key'
    })

    it('rolls back the new account when registered role assignment fails after signup', async () => {
        mockSignUp.mockResolvedValue({
            data: {
                user: {
                    id: 'user-1',
                    email: 'neo@example.com'
                }
            },
            error: null
        })

        const exec = {
            query: jest
                .fn()
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([{ user_id: 'user-1' }])
                .mockResolvedValueOnce([])
        }
        const deleteAuthUser = jest.fn().mockResolvedValue(undefined)
        const assignSystemRole = jest.fn().mockRejectedValue(new Error('role assignment failed'))

        const app = express()
        app.use(express.json())
        app.use(
            '/auth',
            createAuthRouter(passThrough, passThrough, {
                getDbExecutor: () => exec as never,
                assignSystemRole,
                deleteAuthUser
            })
        )

        const response = await request(app).post('/auth/register').send({
            email: 'neo@example.com',
            password: 'password123',
            termsAccepted: true,
            privacyAccepted: true
        })

        expect(response.status).toBe(500)
        expect(response.body.error).toContain('rolled back')
        expect(assignSystemRole).toHaveBeenCalledWith({
            userId: 'user-1',
            roleCodename: 'registered',
            reason: 'auto-assigned on registration'
        })
        expect(deleteAuthUser).toHaveBeenCalledWith('user-1')
        expect(exec.query).toHaveBeenLastCalledWith(expect.stringContaining('UPDATE profiles.cat_profiles'), ['user-1', null])
    })
})