import { describe, expect, it } from 'vitest'

import { isPublicRoute, isWhitelistedApiPath } from '..'

describe('public UI route matching', () => {
    it('does not treat the dual anonymous/authenticated application runtime URL as public', () => {
        // `/a/:applicationRef/*` serves the anonymous public probe and the
        // authenticated fallback on the same URL. Marking it public would
        // suppress the 401 -> /auth redirect for expired member sessions.
        expect(isPublicRoute('/a/019e8381-8c57-7d73-9f15-a9c27237c703')).toBe(false)
        expect(isPublicRoute('/a/meridian-consortium/campaign/overview')).toBe(false)
        expect(isPublicRoute('/a/meridian-consortium/admin')).toBe(false)
        expect(isPublicRoute('/a/meridian-consortium/admin/settings')).toBe(false)
    })

    it('keeps the genuinely anonymous UI routes public', () => {
        expect(isPublicRoute('/')).toBe(true)
        expect(isPublicRoute('/auth')).toBe(true)
        expect(isPublicRoute('/terms')).toBe(true)
        expect(isPublicRoute('/p/sample-publication')).toBe(true)
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
