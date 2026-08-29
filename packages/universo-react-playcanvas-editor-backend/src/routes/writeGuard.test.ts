import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import { PLAYCANVAS_EDITOR_FULL_BOOT_MODE } from '@universo-react/types'
import {
    createCompatibilityCsrfToken,
    createPlayCanvasEditorCompatibilityTokenService,
    encodeTokenPart,
    signTokenPart
} from '../tokens/index'
import { createEditorCompatibilityWriteGuard } from './index'

const projectId = '019e9146-fd1b-7d1d-a858-d1e96485d901'
const routePath = `/metahub/metahub-1/playcanvas/editor-compatible/projects/${projectId}/assets`
const tokenService = createPlayCanvasEditorCompatibilityTokenService()

const makeRequest = (
    headers: Record<string, string>,
    token = headers['x-playcanvas-editor-token'],
    identity: { requestUserId?: string; sessionUserId?: string } = {}
): Request => {
    const allHeaders = { ...headers, ...(token ? { 'x-playcanvas-editor-token': token } : {}) }
    const request = {
        method: 'POST',
        path: routePath,
        originalUrl: routePath,
        params: { metahubId: 'metahub-1', projectId },
        protocol: 'https',
        headers: allHeaders,
        get: function (name: string) {
            return this.headers[name.toLowerCase()]
        }
    } as unknown as Request & { user?: { id: string }; session?: { passport?: { user?: { id: string } } } }
    if (identity.requestUserId) request.user = { id: identity.requestUserId }
    if (identity.sessionUserId) request.session = { passport: { user: { id: identity.sessionUserId } } }
    return request
}

const makeResponse = () => {
    const response = {
        status: vi.fn(),
        json: vi.fn()
    }
    response.status.mockReturnValue(response)
    response.json.mockReturnValue(response)
    return response as unknown as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> }
}

describe('PlayCanvas Editor compatibility write guard', () => {
    it('fails closed instead of falling back to session CSRF for an origin-mismatched REST token', () => {
        const { token } = tokenService.create({
            metahubId: 'metahub-1',
            projectId,
            userId: 'user-1',
            packageSlug: 'playcanvas-editor',
            origin: 'https://platform.example.test'
        })
        const request = makeRequest({
            origin: 'https://attacker.example.test',
            'x-playcanvas-editor-token': token,
            'x-csrf-token': 'session-token'
        })
        const response = makeResponse()
        const next = vi.fn()
        const csrfProtection = vi.fn()

        createEditorCompatibilityWriteGuard({ tokenService, csrfProtection })(request, response, next)

        expect(response.status).toHaveBeenCalledWith(401)
        expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'playcanvasEditor.compatibility.invalidToken' }))
        expect(csrfProtection).not.toHaveBeenCalled()
        expect(next).not.toHaveBeenCalled()
    })

    it('rejects an originless legacy HMAC token before the CSRF middleware', () => {
        const payload = encodeTokenPart({
            metahubId: 'metahub-1',
            projectId,
            userId: 'user-1',
            packageSlug: 'playcanvas-editor',
            mode: 'universo-compatibility-rest-minimal',
            expiresAt: Date.now() + 60_000
        })
        const token = `${payload}.${signTokenPart(payload)}`
        const request = makeRequest({ origin: 'https://platform.example.test', 'x-playcanvas-editor-token': token })
        const response = makeResponse()
        const next = vi.fn()
        const csrfProtection = vi.fn()

        createEditorCompatibilityWriteGuard({ tokenService, csrfProtection })(request, response, next)

        expect(response.status).toHaveBeenCalledWith(401)
        expect(csrfProtection).not.toHaveBeenCalled()
        expect(next).not.toHaveBeenCalled()
    })

    it('accepts a current REST token with its separately signed origin-bound CSRF proof', () => {
        const origin = 'https://platform.example.test'
        const { token } = tokenService.create({
            metahubId: 'metahub-1',
            projectId,
            userId: 'user-1',
            packageSlug: 'playcanvas-editor',
            origin
        })
        const csrfToken = createCompatibilityCsrfToken({
            metahubId: 'metahub-1',
            projectId,
            userId: 'user-1',
            accessToken: token,
            origin
        })
        const request = makeRequest({ origin, 'x-playcanvas-editor-token': token, 'x-csrf-token': csrfToken ?? '' })
        const response = makeResponse()
        const next = vi.fn()
        const csrfProtection = vi.fn()

        createEditorCompatibilityWriteGuard({ tokenService, csrfProtection })(request, response, next)

        expect(next).toHaveBeenCalledTimes(1)
        expect(csrfProtection).not.toHaveBeenCalled()
        expect(response.status).not.toHaveBeenCalled()
    })

    it('does not let an invalid compatibility proof recurse into the editor-token CSRF bypass', () => {
        const origin = 'https://platform.example.test'
        const { token } = tokenService.create({
            metahubId: 'metahub-1',
            projectId,
            userId: 'user-1',
            packageSlug: 'playcanvas-editor',
            origin
        })
        const request = makeRequest({ origin, 'x-playcanvas-editor-token': token, 'x-csrf-token': 'session-token' }, token, {
            requestUserId: 'user-1'
        })
        const response = makeResponse()
        const next = vi.fn()
        const csrfProtection = vi.fn((csrfRequest: Request, _csrfResponse: Response, csrfNext: () => void) => {
            expect(csrfRequest.get('x-playcanvas-editor-token')).toBeUndefined()
            csrfNext()
        })

        createEditorCompatibilityWriteGuard({ tokenService, csrfProtection })(request, response, next)

        expect(csrfProtection).toHaveBeenCalledTimes(1)
        expect(next).toHaveBeenCalledTimes(1)
        expect(request.get('x-playcanvas-editor-token')).toBe(token)
    })

    it('rejects a full-boot token when the session CSRF identity belongs to another user', () => {
        const origin = 'https://platform.example.test'
        const { token } = tokenService.create({
            metahubId: 'metahub-1',
            projectId,
            sceneId: '019e9147-16c4-738c-ab0f-b98c443ee676',
            userId: 'user-1',
            packageSlug: 'playcanvas-editor',
            mode: PLAYCANVAS_EDITOR_FULL_BOOT_MODE,
            origin,
            sessionId: 'session-1',
            nonce: 'nonce-1'
        })
        const request = makeRequest({ origin, 'x-playcanvas-editor-token': token, 'x-csrf-token': 'session-token' }, token, {
            sessionUserId: 'user-2'
        })
        const response = makeResponse()
        const next = vi.fn()
        const csrfProtection = vi.fn()

        createEditorCompatibilityWriteGuard({ tokenService, csrfProtection })(request, response, next)

        expect(response.status).toHaveBeenCalledWith(401)
        expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'playcanvasEditor.compatibility.invalidToken' }))
        expect(csrfProtection).not.toHaveBeenCalled()
        expect(next).not.toHaveBeenCalled()
    })

    it('requires a matching request identity when a signed token falls back to session CSRF', () => {
        const origin = 'https://platform.example.test'
        const { token } = tokenService.create({
            metahubId: 'metahub-1',
            projectId,
            userId: 'user-1',
            packageSlug: 'playcanvas-editor',
            origin
        })
        const request = makeRequest({ origin, 'x-playcanvas-editor-token': token, 'x-csrf-token': 'session-token' })
        const response = makeResponse()
        const next = vi.fn()
        const csrfProtection = vi.fn()

        createEditorCompatibilityWriteGuard({ tokenService, csrfProtection })(request, response, next)

        expect(response.status).toHaveBeenCalledWith(401)
        expect(csrfProtection).not.toHaveBeenCalled()
        expect(next).not.toHaveBeenCalled()
    })
})
