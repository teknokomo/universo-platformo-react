import { afterEach, describe, expect, it } from 'vitest'

import { getApiBaseURL, getUIBaseURL, getEnv, getGlobalMigrationCatalogConfig, isGlobalMigrationCatalogEnabled } from '../index'

const ORIGINAL_PUBLIC_ENV = globalThis.__UNIVERSO_PUBLIC_ENV__
const ORIGINAL_API_BASE_URL = process.env.VITE_API_BASE_URL
const ORIGINAL_UI_BASE_URL = process.env.VITE_UI_BASE_URL
const ORIGINAL_CUSTOM_VALUE = process.env.UNIVERSO_CUSTOM_TEST_VALUE
const ORIGINAL_GLOBAL_MIGRATION_CATALOG_ENABLED = process.env.UPL_GLOBAL_MIGRATION_CATALOG_ENABLED
const ORIGINAL_WINDOW = globalThis.window

describe('env index', () => {
    afterEach(() => {
        globalThis.__UNIVERSO_PUBLIC_ENV__ = ORIGINAL_PUBLIC_ENV

        if (ORIGINAL_API_BASE_URL === undefined) {
            delete process.env.VITE_API_BASE_URL
        } else {
            process.env.VITE_API_BASE_URL = ORIGINAL_API_BASE_URL
        }

        if (ORIGINAL_UI_BASE_URL === undefined) {
            delete process.env.VITE_UI_BASE_URL
        } else {
            process.env.VITE_UI_BASE_URL = ORIGINAL_UI_BASE_URL
        }

        if (ORIGINAL_CUSTOM_VALUE === undefined) {
            delete process.env.UNIVERSO_CUSTOM_TEST_VALUE
        } else {
            process.env.UNIVERSO_CUSTOM_TEST_VALUE = ORIGINAL_CUSTOM_VALUE
        }

        if (ORIGINAL_GLOBAL_MIGRATION_CATALOG_ENABLED === undefined) {
            delete process.env.UPL_GLOBAL_MIGRATION_CATALOG_ENABLED
        } else {
            process.env.UPL_GLOBAL_MIGRATION_CATALOG_ENABLED = ORIGINAL_GLOBAL_MIGRATION_CATALOG_ENABLED
        }

        if (ORIGINAL_WINDOW === undefined) {
            delete globalThis.window
        } else {
            globalThis.window = ORIGINAL_WINDOW
        }
    })

    it('prefers host-provided public env values over process env for browser-safe overrides', () => {
        process.env.VITE_API_BASE_URL = 'http://process-api.example.com'
        process.env.VITE_UI_BASE_URL = 'http://process-ui.example.com'
        process.env.UNIVERSO_CUSTOM_TEST_VALUE = 'process-custom'

        globalThis.__UNIVERSO_PUBLIC_ENV__ = {
            VITE_API_BASE_URL: 'http://public-api.example.com',
            VITE_UI_BASE_URL: 'http://public-ui.example.com',
            UNIVERSO_CUSTOM_TEST_VALUE: 'public-custom'
        }

        expect(getApiBaseURL()).toBe('http://public-api.example.com')
        expect(getUIBaseURL()).toBe('http://public-ui.example.com')
        expect(getEnv('UNIVERSO_CUSTOM_TEST_VALUE', 'fallback')).toBe('public-custom')
    })

    it('falls back to process env values when no host-provided public env is defined', () => {
        process.env.VITE_API_BASE_URL = 'http://process-api.example.com'
        process.env.VITE_UI_BASE_URL = 'http://process-ui.example.com'
        process.env.UNIVERSO_CUSTOM_TEST_VALUE = 'process-custom'

        delete globalThis.__UNIVERSO_PUBLIC_ENV__

        expect(getApiBaseURL()).toBe('http://process-api.example.com')
        expect(getUIBaseURL()).toBe('http://process-ui.example.com')
        expect(getEnv('UNIVERSO_CUSTOM_TEST_VALUE', 'fallback')).toBe('process-custom')
    })

    it('falls back to browser origin and explicit fallback when runtime env values are absent', () => {
        delete process.env.VITE_API_BASE_URL
        delete process.env.VITE_UI_BASE_URL
        delete process.env.UNIVERSO_CUSTOM_TEST_VALUE
        delete globalThis.__UNIVERSO_PUBLIC_ENV__

        globalThis.window = {
            location: {
                origin: 'http://browser-origin.example.com'
            }
        } as Window & typeof globalThis

        expect(getApiBaseURL()).toBe('http://browser-origin.example.com')
        expect(getUIBaseURL()).toBe('http://browser-origin.example.com')
        expect(getEnv('UNIVERSO_CUSTOM_TEST_VALUE', 'fallback')).toBe('fallback')
    })

    it('parses the global migration catalog flag through the shared helper', () => {
        delete process.env.UPL_GLOBAL_MIGRATION_CATALOG_ENABLED
        expect(getGlobalMigrationCatalogConfig()).toEqual({ enabled: false })
        expect(isGlobalMigrationCatalogEnabled()).toBe(false)

        process.env.UPL_GLOBAL_MIGRATION_CATALOG_ENABLED = 'true'
        expect(getGlobalMigrationCatalogConfig()).toEqual({ enabled: true })
        expect(isGlobalMigrationCatalogEnabled()).toBe(true)

        process.env.UPL_GLOBAL_MIGRATION_CATALOG_ENABLED = '1'
        expect(isGlobalMigrationCatalogEnabled()).toBe(true)

        process.env.UPL_GLOBAL_MIGRATION_CATALOG_ENABLED = 'false'
        expect(isGlobalMigrationCatalogEnabled()).toBe(false)
    })
})
