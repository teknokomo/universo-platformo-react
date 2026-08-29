import { afterEach, describe, expect, it } from 'vitest'

import { isAllowedArtifactOrigin, resolveAllowedArtifactOrigins, resolveLoopbackSiblingOrigin } from './index'

const originalFullBootOrigins = process.env.PLAYCANVAS_EDITOR_FULL_BOOT_WS_ORIGINS
const originalArtifactOrigins = process.env.PLAYCANVAS_EDITOR_ARTIFACT_ALLOWED_ORIGINS

afterEach(() => {
    if (originalFullBootOrigins === undefined) {
        delete process.env.PLAYCANVAS_EDITOR_FULL_BOOT_WS_ORIGINS
    } else {
        process.env.PLAYCANVAS_EDITOR_FULL_BOOT_WS_ORIGINS = originalFullBootOrigins
    }
    if (originalArtifactOrigins === undefined) {
        delete process.env.PLAYCANVAS_EDITOR_ARTIFACT_ALLOWED_ORIGINS
    } else {
        process.env.PLAYCANVAS_EDITOR_ARTIFACT_ALLOWED_ORIGINS = originalArtifactOrigins
    }
})

describe('PlayCanvas Editor loopback origins', () => {
    it('maps an IPv6 loopback origin to a distinct localhost sibling', () => {
        expect(resolveLoopbackSiblingOrigin('http://[::1]:3100')).toBe('http://localhost:3100')
    })

    it('does not treat an arbitrary caller origin as an artifact allow-list entry', () => {
        delete process.env.PLAYCANVAS_EDITOR_ARTIFACT_ALLOWED_ORIGINS

        expect(resolveAllowedArtifactOrigins('https://attacker.example.test', 'https://platform.example.test')).toEqual(
            new Set(['https://platform.example.test'])
        )
        expect(
            isAllowedArtifactOrigin('https://attacker.example.test', 'https://attacker.example.test', 'https://platform.example.test')
        ).toBe(false)
    })

    it('allows a configured artifact origin and the canonical loopback sibling', () => {
        process.env.PLAYCANVAS_EDITOR_ARTIFACT_ALLOWED_ORIGINS = 'https://editor-assets.example.test'

        expect(
            isAllowedArtifactOrigin('https://editor-assets.example.test', 'https://attacker.example.test', 'https://platform.example.test')
        ).toBe(true)
        expect(isAllowedArtifactOrigin('http://localhost:3100', 'http://localhost:3100', 'http://127.0.0.1:3100')).toBe(true)
    })

    it('adds the IPv6 sibling when full-boot origins are configured', async () => {
        process.env.PLAYCANVAS_EDITOR_FULL_BOOT_WS_ORIGINS = 'http://[::1]:3100'
        const { resolveAllowedFullBootUpgradeOrigins } = await import('../realtime/index')

        expect(resolveAllowedFullBootUpgradeOrigins()).toEqual(new Set(['http://[::1]:3100', 'http://localhost:3100']))
    })
})
