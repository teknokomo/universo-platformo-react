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
    getGuestCaptchaConfig: jest.fn(() => ({ enabled: false, siteKey: null, testMode: false })),
    isCaptchaRequired: jest.fn(() => false),
    validateLoginCaptcha: jest.fn().mockResolvedValue({ success: true }),
    getLoginCaptchaConfig: jest.fn(() => ({ enabled: false, siteKey: null, testMode: false })),
    isLoginCaptchaRequired: jest.fn(() => false)
}))

jest.mock('@universo-react/utils/auth', () => ({
    getAuthFeatureConfig: jest.fn(() => ({ registrationEnabled: true, loginEnabled: true, emailConfirmationRequired: false })),
    isRegistrationEnabled: jest.fn(() => true),
    isLoginEnabled: jest.fn(() => true)
}))

import { createAuthRouter } from '../../routes/auth'
import { getGuestCaptchaConfig } from '../../services/captchaService'

const passThrough: RequestHandler = (_req, _res, next) => next()

describe('createAuthRouter registration rollback', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        process.env.SUPABASE_URL = 'https://example.supabase.co'
        process.env.SUPABASE_ANON_KEY = 'anon-key'
        process.env.LEGAL_TERMS_VERSION = 'terms-2026.10'
        process.env.LEGAL_PRIVACY_VERSION = 'privacy-2026.10'
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    it('exposes only the public guest CAPTCHA widget configuration', async () => {
        const config = { enabled: true, siteKey: 'public-site-key', testMode: false }
        jest.mocked(getGuestCaptchaConfig).mockReturnValue(config)
        const logSpy = jest.spyOn(console, 'info').mockImplementation(() => undefined)
        const app = express()
        app.use('/auth', createAuthRouter(passThrough, passThrough))

        const response = await request(app)
            .get('/auth/captcha-config')
            .set('Referer', 'https://universo.example/register?guest-token=private-value')
            .expect(200)

        expect(response.body.guest).toEqual(config)
        expect(logSpy.mock.calls.flat()).not.toContain('public-site-key')
        expect(JSON.stringify(logSpy.mock.calls)).not.toContain('guest-token')
        expect(JSON.stringify(logSpy.mock.calls)).not.toContain('private-value')
    })

    it('records the exact configured legal versions in signup metadata and the profile audit', async () => {
        const termsVersion = 'terms 2026.10'
        const privacyVersion = 'privacy 2026.10'
        process.env.LEGAL_TERMS_VERSION = termsVersion
        process.env.LEGAL_PRIVACY_VERSION = privacyVersion
        mockSignUp.mockResolvedValue({
            data: { user: { id: 'user-2', email: 'neo@example.com' } },
            error: null
        })

        const exec = {
            query: jest
                .fn()
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([{ user_id: 'user-2' }])
        }
        const app = express()
        app.use(express.json())
        app.use('/auth', createAuthRouter(passThrough, passThrough, { getDbExecutor: () => exec as never }))

        const response = await request(app).post('/auth/register').send({
            email: 'neo@example.com',
            password: 'password123',
            termsAccepted: true,
            privacyAccepted: true
        })

        expect(response.status).toBe(201)
        expect(mockSignUp).toHaveBeenCalledWith({
            email: 'neo@example.com',
            password: 'password123',
            options: {
                data: expect.objectContaining({
                    terms_accepted: true,
                    privacy_accepted: true,
                    terms_version: termsVersion,
                    privacy_version: privacyVersion
                })
            }
        })
        expect(exec.query).toHaveBeenNthCalledWith(2, expect.stringContaining('terms_version = $5'), [
            true,
            expect.any(Date),
            true,
            expect.any(Date),
            termsVersion,
            privacyVersion,
            'user-2'
        ])
    })

    it.each([
        ['missing Terms version', undefined, 'privacy-2026.10'],
        ['blank Privacy version', 'terms-2026.10', '   '],
        ['oversized Terms version', 't'.repeat(51), 'privacy-2026.10']
    ])('fails closed when legal version configuration is invalid (%s)', async (_case, termsVersion, privacyVersion) => {
        if (termsVersion === undefined) {
            delete process.env.LEGAL_TERMS_VERSION
        } else {
            process.env.LEGAL_TERMS_VERSION = termsVersion
        }
        if (privacyVersion === undefined) {
            delete process.env.LEGAL_PRIVACY_VERSION
        } else {
            process.env.LEGAL_PRIVACY_VERSION = privacyVersion
        }
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)

        const app = express()
        app.use(express.json())
        app.use('/auth', createAuthRouter(passThrough, passThrough))

        const response = await request(app).post('/auth/register').send({
            email: 'private@example.com',
            password: 'sensitive-password',
            captchaToken: 'captcha-secret-token',
            termsAccepted: true,
            privacyAccepted: true
        })

        expect(response.status).toBe(500)
        expect(response.body).toEqual({ error: 'Server error' })
        expect(mockSignUp).not.toHaveBeenCalled()
        expect(errorSpy.mock.calls.flat().join(' ')).not.toContain('private@example.com')
        expect(errorSpy.mock.calls.flat().join(' ')).not.toContain('sensitive-password')
        expect(errorSpy.mock.calls.flat().join(' ')).not.toContain('captcha-secret-token')
    })

    it('keeps required consent validation ahead of legal configuration resolution', async () => {
        delete process.env.LEGAL_TERMS_VERSION

        const app = express()
        app.use(express.json())
        app.use('/auth', createAuthRouter(passThrough, passThrough))

        const response = await request(app).post('/auth/register').send({
            email: 'neo@example.com',
            password: 'password123',
            termsAccepted: false,
            privacyAccepted: true
        })

        expect(response.status).toBe(400)
        expect(response.body.error).toBe('Terms of Service must be accepted')
        expect(mockSignUp).not.toHaveBeenCalled()
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
            roleCodename: 'Registered',
            reason: 'auto-assigned on registration'
        })
        expect(deleteAuthUser).toHaveBeenCalledWith('user-1')
        expect(exec.query).toHaveBeenLastCalledWith(expect.stringContaining('UPDATE profiles.obj_profiles'), ['user-1', null])
    })
})
