import { describe, expect, it } from 'vitest'

import { isWhitelistedApiPath } from '..'

describe('public API route matching', () => {
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
