import { afterEach, describe, expect, it, vi } from 'vitest'
import { getGuestCaptchaConfig, validateCaptchaToken } from '../index'

describe('getGuestCaptchaConfig', () => {
    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('returns the public site key only when both verification keys are configured', () => {
        vi.stubEnv('SMARTCAPTCHA_SITE_KEY', 'public-site-key')
        vi.stubEnv('SMARTCAPTCHA_SERVER_KEY', 'private-server-key')
        vi.stubEnv('SMARTCAPTCHA_TEST_MODE', 'true')

        expect(getGuestCaptchaConfig()).toEqual({ enabled: true, siteKey: 'public-site-key', testMode: true })
    })

    it('fails closed when the server verification key is missing', () => {
        vi.stubEnv('SMARTCAPTCHA_SITE_KEY', 'public-site-key')
        vi.stubEnv('SMARTCAPTCHA_SERVER_KEY', '')

        expect(getGuestCaptchaConfig()).toEqual({ enabled: false, siteKey: null, testMode: false })
    })
})

describe('validateCaptchaToken', () => {
    afterEach(() => {
        vi.unstubAllEnvs()
    })

    it('fails closed when a link requires CAPTCHA but the token is missing', async () => {
        vi.stubEnv('SMARTCAPTCHA_GUEST_INTAKE_ENABLED', 'false')
        vi.stubEnv('SMARTCAPTCHA_SERVER_KEY', '')

        await expect(
            validateCaptchaToken('', '', {
                enabledEnvVar: 'SMARTCAPTCHA_GUEST_INTAKE_ENABLED',
                logPrefix: '[test]',
                forceRequired: true
            })
        ).resolves.toEqual({ success: false, error: 'Captcha service is not configured' })
    })

    it('rejects a missing guest CAPTCHA token when the service key exists', async () => {
        vi.stubEnv('SMARTCAPTCHA_GUEST_INTAKE_ENABLED', 'false')
        vi.stubEnv('SMARTCAPTCHA_SERVER_KEY', 'test-server-key')

        await expect(
            validateCaptchaToken('', '', {
                enabledEnvVar: 'SMARTCAPTCHA_GUEST_INTAKE_ENABLED',
                logPrefix: '[test]',
                forceRequired: true
            })
        ).resolves.toEqual({ success: false, error: 'Captcha token is required' })
    })
})
