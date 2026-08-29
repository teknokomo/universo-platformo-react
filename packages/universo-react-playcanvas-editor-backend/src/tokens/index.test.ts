import { describe, expect, it } from 'vitest'
import { PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE, PLAYCANVAS_EDITOR_FULL_BOOT_MODE } from '@universo-react/types'
import {
    PLAYCANVAS_EDITOR_MAX_DOCUMENT_ID,
    createCompatibilityCsrfToken,
    createPlayCanvasEditorCompatibilityTokenService,
    encodeTokenPart,
    parseCanonicalPlayCanvasEditorDocumentId,
    signTokenPart,
    validateCompatibilityCsrfToken
} from './index'

const projectId = '019e9146-fd1b-7d1d-a858-d1e96485d901'
const sceneId = '019e9147-16c4-738c-ab0f-b98c443ee676'

describe('PlayCanvas Editor compatibility token boundaries', () => {
    it('accepts only canonical positive decimal document ids', () => {
        for (const value of [1, '1', PLAYCANVAS_EDITOR_MAX_DOCUMENT_ID, String(PLAYCANVAS_EDITOR_MAX_DOCUMENT_ID)]) {
            expect(parseCanonicalPlayCanvasEditorDocumentId(value)).toBe(Number(value))
        }
        for (const value of ['01', '001', '1e3', '0x3e8', '+1', ' 1', '1 ', '0', 0, -1, 1.5, Infinity, null, undefined]) {
            expect(parseCanonicalPlayCanvasEditorDocumentId(value)).toBeNull()
        }
    })

    it('requires a canonical origin for REST and full-boot tokens', () => {
        const service = createPlayCanvasEditorCompatibilityTokenService()
        expect(() =>
            service.create({
                metahubId: 'metahub-1',
                projectId,
                userId: 'user-1',
                packageSlug: 'playcanvas-editor',
                mode: PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE
            })
        ).toThrow(/canonical HTTP\(S\) origin/)

        const rest = service.create({
            metahubId: 'metahub-1',
            projectId,
            userId: 'user-1',
            packageSlug: 'playcanvas-editor',
            mode: PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE,
            origin: 'https://platform.example.test/'
        })
        expect(rest.claims.origin).toBe('https://platform.example.test')
        expect(service.read(rest.token)).toMatchObject({
            mode: PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE,
            origin: 'https://platform.example.test'
        })

        const legacyOriginlessClaims = {
            metahubId: 'metahub-1',
            projectId,
            userId: 'user-1',
            packageSlug: 'playcanvas-editor',
            mode: PLAYCANVAS_EDITOR_COMPATIBILITY_REST_MODE,
            expiresAt: Date.now() + 60_000
        }
        const legacyPayload = encodeTokenPart(legacyOriginlessClaims)
        expect(service.read(`${legacyPayload}.${signTokenPart(legacyPayload)}`)).toBeNull()

        expect(() =>
            service.create({
                metahubId: 'metahub-1',
                projectId,
                sceneId,
                userId: 'user-1',
                packageSlug: 'playcanvas-editor',
                mode: PLAYCANVAS_EDITOR_FULL_BOOT_MODE
            })
        ).toThrow(/canonical HTTP\(S\) origin/)

        const fullBoot = service.create({
            metahubId: 'metahub-1',
            projectId,
            sceneId,
            userId: 'user-1',
            packageSlug: 'playcanvas-editor',
            mode: PLAYCANVAS_EDITOR_FULL_BOOT_MODE,
            origin: 'https://editor-assets.example.test'
        })
        expect(service.read(fullBoot.token)).toMatchObject({
            mode: PLAYCANVAS_EDITOR_FULL_BOOT_MODE,
            origin: 'https://editor-assets.example.test'
        })
    })

    it('binds compatibility CSRF proofs to the exact token, project, user, origin, and expiry', () => {
        const accessToken = 'signed-editor-token-' + 'a'.repeat(32)
        const now = 1_750_000_000_000
        const csrfToken = createCompatibilityCsrfToken({
            metahubId: 'metahub-1',
            projectId,
            userId: 'user-1',
            accessToken,
            origin: 'https://editor-assets.example.test/',
            now
        })
        expect(csrfToken).toBeTruthy()
        const expected = {
            metahubId: 'metahub-1',
            projectId,
            userId: 'user-1',
            accessToken,
            origin: 'https://editor-assets.example.test',
            now: now + 1
        }
        expect(validateCompatibilityCsrfToken(csrfToken, expected)).toBe(true)
        expect(validateCompatibilityCsrfToken(csrfToken, { ...expected, accessToken: accessToken + 'b' })).toBe(false)
        expect(validateCompatibilityCsrfToken(csrfToken, { ...expected, origin: 'https://attacker.example.test' })).toBe(false)
        expect(validateCompatibilityCsrfToken(csrfToken, { ...expected, now: now + 10 * 60 * 1000 })).toBe(false)
        expect(
            createCompatibilityCsrfToken({
                metahubId: 'metahub-1',
                projectId,
                userId: 'user-1',
                accessToken,
                origin: 'not-an-origin',
                now
            })
        ).toBeNull()
    })
})
