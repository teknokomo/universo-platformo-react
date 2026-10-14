import { afterEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
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
        vi.restoreAllMocks()
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

    it('validates tokens with a form-encoded POST and keeps credentials out of the URL', async () => {
        const serverKey = 'private-server-key-for-test'
        const token = 'captcha-token-for-test'
        const ip = '192.0.2.10'
        vi.stubEnv('SMARTCAPTCHA_SERVER_KEY', serverKey)

        const postSpy = vi.spyOn(axios, 'post').mockResolvedValueOnce({
            status: 200,
            data: { status: 'ok' }
        } as never)
        const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined)

        await expect(
            validateCaptchaToken(token, ip, {
                enabledEnvVar: 'SMARTCAPTCHA_GUEST_INTAKE_ENABLED',
                logPrefix: '[test]',
                forceRequired: true
            })
        ).resolves.toEqual({ success: true })

        expect(postSpy).toHaveBeenCalledOnce()
        const [url, body, config] = postSpy.mock.calls[0]
        expect(url).toBe('https://smartcaptcha.cloud.yandex.ru/validate')
        expect(new URL(url).search).toBe('')
        expect(body).toBeTypeOf('string')
        expect(new URLSearchParams(body as string).toString()).toBe(new URLSearchParams({ secret: serverKey, token, ip }).toString())
        expect(config?.headers).toMatchObject({ 'Content-Type': 'application/x-www-form-urlencoded' })
        expect(JSON.stringify(infoSpy.mock.calls)).not.toContain(serverKey)
        expect(JSON.stringify(infoSpy.mock.calls)).not.toContain(token)
        expect(JSON.stringify(infoSpy.mock.calls)).not.toContain(ip)
    })

    it('does not expose credentials from a rejected request in logs', async () => {
        const serverKey = 'private-server-key-for-test'
        const token = 'captcha-token-for-test'
        const ip = '192.0.2.10'
        vi.stubEnv('SMARTCAPTCHA_SERVER_KEY', serverKey)
        const postSpy = vi.spyOn(axios, 'post').mockRejectedValueOnce(
            Object.assign(new Error(`Request failed: secret=${serverKey} token=${token} ip=${ip}`), {
                isAxiosError: true,
                code: 'ERR_NETWORK'
            })
        )
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

        await expect(
            validateCaptchaToken(token, ip, {
                enabledEnvVar: 'SMARTCAPTCHA_GUEST_INTAKE_ENABLED',
                logPrefix: '[test]',
                forceRequired: true
            })
        ).resolves.toEqual({ success: false, error: 'Captcha service unavailable' })

        expect(postSpy).toHaveBeenCalledOnce()
        expect(errorSpy).toHaveBeenCalledWith('[test] Request failed')
        const loggedOutput = JSON.stringify(errorSpy.mock.calls)
        expect(loggedOutput).not.toContain(serverKey)
        expect(loggedOutput).not.toContain(token)
        expect(loggedOutput).not.toContain(ip)
    })
})
