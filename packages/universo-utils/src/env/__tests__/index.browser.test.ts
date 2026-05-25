import { afterEach, describe, expect, it } from 'vitest'

import { getApiBaseURL, getEnv, getUIBaseURL } from '../index.browser'

const ORIGINAL_PUBLIC_ENV = globalThis.__UNIVERSO_PUBLIC_ENV__
const ORIGINAL_API_BASE_URL = import.meta.env.VITE_API_BASE_URL
const ORIGINAL_UI_BASE_URL = import.meta.env.VITE_UI_BASE_URL
const ORIGINAL_CUSTOM_VALUE = import.meta.env.UNIVERSO_CUSTOM_TEST_VALUE
const ORIGINAL_WINDOW = globalThis.window

describe('env index browser', () => {
    afterEach(() => {
        globalThis.__UNIVERSO_PUBLIC_ENV__ = ORIGINAL_PUBLIC_ENV

        if (ORIGINAL_API_BASE_URL === undefined) {
            delete import.meta.env.VITE_API_BASE_URL
        } else {
            import.meta.env.VITE_API_BASE_URL = ORIGINAL_API_BASE_URL
        }

        if (ORIGINAL_UI_BASE_URL === undefined) {
            delete import.meta.env.VITE_UI_BASE_URL
        } else {
            import.meta.env.VITE_UI_BASE_URL = ORIGINAL_UI_BASE_URL
        }

        if (ORIGINAL_CUSTOM_VALUE === undefined) {
            delete import.meta.env.UNIVERSO_CUSTOM_TEST_VALUE
        } else {
            import.meta.env.UNIVERSO_CUSTOM_TEST_VALUE = ORIGINAL_CUSTOM_VALUE
        }

        if (ORIGINAL_WINDOW === undefined) {
            delete globalThis.window
        } else {
            globalThis.window = ORIGINAL_WINDOW
        }
    })

    it('prefers host-provided public env values over import.meta.env overrides', () => {
        import.meta.env.VITE_API_BASE_URL = 'http://vite-api.example.com'
        import.meta.env.VITE_UI_BASE_URL = 'http://vite-ui.example.com'
        import.meta.env.UNIVERSO_CUSTOM_TEST_VALUE = 'vite-custom'

        globalThis.__UNIVERSO_PUBLIC_ENV__ = {
            VITE_API_BASE_URL: 'http://public-api.example.com',
            VITE_UI_BASE_URL: 'http://public-ui.example.com',
            UNIVERSO_CUSTOM_TEST_VALUE: 'public-custom'
        }

        expect(getApiBaseURL()).toBe('http://public-api.example.com')
        expect(getUIBaseURL()).toBe('http://public-ui.example.com')
        expect(getEnv('UNIVERSO_CUSTOM_TEST_VALUE', 'fallback')).toBe('public-custom')
    })

    it('uses import.meta.env values when host overrides are absent', () => {
        delete globalThis.__UNIVERSO_PUBLIC_ENV__
        import.meta.env.VITE_API_BASE_URL = 'http://vite-api.example.com'
        import.meta.env.VITE_UI_BASE_URL = 'http://vite-ui.example.com'
        import.meta.env.UNIVERSO_CUSTOM_TEST_VALUE = 'vite-custom'

        expect(getApiBaseURL()).toBe('http://vite-api.example.com')
        expect(getUIBaseURL()).toBe('http://vite-ui.example.com')
        expect(getEnv('UNIVERSO_CUSTOM_TEST_VALUE', 'fallback')).toBe('vite-custom')
    })
})
