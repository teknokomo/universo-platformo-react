import { describe, expect, it } from 'vitest'

import { isPublicRoute, isWhitelistedApiPath } from '..'

describe('public UI route matching', () => {
    it('keeps published application runtime requests public while preserving the protected admin branch', () => {
        expect(isPublicRoute('/a/019e8381-8c57-7d73-9f15-a9c27237c703')).toBe(true)
        expect(isPublicRoute('/a/meridian-consortium/campaign/overview')).toBe(true)
        expect(isPublicRoute('/a/meridian-consortium/admin')).toBe(false)
        expect(isPublicRoute('/a/meridian-consortium/admin/settings')).toBe(false)
    })
})

describe('public API route matching', () => {
    it('allows only the exact public application runtime endpoint', () => {
        expect(isWhitelistedApiPath('/api/v1/public/applications/consortium/runtime')).toBe(true)
        expect(isWhitelistedApiPath('/api/v1/public/applications/consortium/runtime?locale=ru')).toBe(false)
        expect(isWhitelistedApiPath('/api/v1/public/applications/consortium/runtime/extra')).toBe(false)
        expect(isWhitelistedApiPath('/api/v1/public/applications/consortium/runtime-malicious')).toBe(false)
    })

    it('allows signed PlayCanvas Editor artifact asset URLs without whitelisting neighboring package routes', () => {
        expect(
            isWhitelistedApiPath(
                '/api/v1/metahub/019e8381-8c57-7d73-9f15-a9c27237c703/packages/playcanvas-editor/editor-artifact-token/signed-token/assets/editor.js'
            )
        ).toBe(true)

        expect(
            isWhitelistedApiPath(
                '/api/v1/metahub/019e8381-8c57-7d73-9f15-a9c27237c703/packages/playcanvas-editor/editor-artifact/index.html'
            )
        ).toBe(false)
        expect(isWhitelistedApiPath('/api/v1/metahub/019e8381-8c57-7d73-9f15-a9c27237c703/packages')).toBe(false)
    })
})
