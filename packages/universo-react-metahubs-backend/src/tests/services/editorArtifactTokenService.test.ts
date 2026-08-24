import { PlayCanvasEditorBridgeSessionService } from '../../domains/playcanvas-projects/services/PlayCanvasEditorBridgeSessionService'
import {
    artifactTokenAbsoluteTtlMs,
    artifactTokenGraceWindowMs,
    artifactTokenTtlMs,
    createArtifactToken,
    readArtifactTokenPayload,
    registerEditorArtifactIssuance,
    renewEditorArtifactToken
} from '../../domains/packages/services/editorArtifactTokenService'

const T0 = 1_800_000_000_000
const parentOrigin = 'https://platform.example.test'
const assetOrigin = 'https://editor-assets.example.test'

const decodeArtifactPayload = (token: string): Record<string, unknown> =>
    JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8')) as Record<string, unknown>

const mintClaims = (overrides: Record<string, unknown> = {}) => ({
    metahubId: 'metahub-1',
    packageSlug: 'playcanvas-editor',
    userId: 'user-1',
    parentOrigin,
    apiOrigin: parentOrigin,
    bridgeSessionId: null as string | null,
    issuedAt: T0,
    ...overrides
})

describe('editorArtifactTokenService', () => {
    let advanceTime: (value: number) => void
    let restoreTime: () => void

    beforeEach(() => {
        let current = T0
        const spy = jest.spyOn(Date, 'now').mockImplementation(() => current)
        advanceTime = (value) => {
            current = value
        }
        restoreTime = () => {
            spy.mockRestore()
        }
    })

    afterEach(() => {
        restoreTime()
    })

    describe('mint and validate', () => {
        it('round-trips an unexpired token without requiring any liveness lookup', () => {
            const minted = createArtifactToken(mintClaims())
            expect(minted).not.toBeNull()
            expect(minted?.payload.expiresAt).toBe(T0 + artifactTokenTtlMs)
            expect(minted?.token.split('.')).toHaveLength(2)

            const payload = readArtifactTokenPayload(minted!.token)
            expect(payload?.metahubId).toBe('metahub-1')
            expect(payload?.packageSlug).toBe('playcanvas-editor')
            expect(payload?.userId).toBe('user-1')
            expect(payload?.parentOrigin).toBe(parentOrigin)
            expect(payload?.apiOrigin).toBe(parentOrigin)
            expect(payload?.issuedAt).toBe(T0)
            expect(payload?.bridgeSessionId).toBeNull()
        })

        it('rejects tokens with a future issuedAt claim', () => {
            const minted = createArtifactToken(mintClaims({ issuedAt: T0 + 10_000 }))
            // Minting rewinds the clock so the forged claim is validated on read.
            advanceTime(T0)
            expect(readArtifactTokenPayload(minted!.token)).toBeNull()
        })

        it('accepts an expired token inside the grace window only while its bridge session is still alive', () => {
            const sessions = new PlayCanvasEditorBridgeSessionService()
            // The session is registered while the clock sits just past the token
            // expiry, mirroring a renewal that slid its liveness forward.
            advanceTime(T0 + artifactTokenTtlMs + 60_000)
            const session = sessions.create({
                metahubId: 'metahub-1',
                packageSlug: 'playcanvas-editor',
                projectId: null,
                userId: 'user-1',
                capabilities: []
            })
            advanceTime(T0)
            const minted = createArtifactToken(mintClaims({ bridgeSessionId: session.payload.sessionId }))
            advanceTime(T0 + artifactTokenTtlMs + 60_000)

            const payload = readArtifactTokenPayload(minted!.token, {
                isBridgeSessionAlive: (bridgeSessionId) => sessions.isAlive(bridgeSessionId)
            })
            expect(sessions.isAlive(session.payload.sessionId)).toBe(true)
            expect(payload?.bridgeSessionId).toBe(session.payload.sessionId)
        })

        it('rejects a token expired beyond the grace window even when its bridge session is still alive', () => {
            const sessions = new PlayCanvasEditorBridgeSessionService()
            advanceTime(T0 + artifactTokenTtlMs + artifactTokenGraceWindowMs + 60_000)
            const session = sessions.create({
                metahubId: 'metahub-1',
                packageSlug: 'playcanvas-editor',
                projectId: null,
                userId: 'user-1',
                capabilities: []
            })
            advanceTime(T0)
            const minted = createArtifactToken(mintClaims({ bridgeSessionId: session.payload.sessionId }))
            advanceTime(T0 + artifactTokenTtlMs + artifactTokenGraceWindowMs + 60_000)

            expect(
                readArtifactTokenPayload(minted!.token, {
                    isBridgeSessionAlive: (bridgeSessionId) => sessions.isAlive(bridgeSessionId)
                })
            ).toBeNull()
        })

        it('rejects an expired token inside the grace window when its bridge session is dead or unknown', () => {
            const sessions = new PlayCanvasEditorBridgeSessionService()
            advanceTime(T0)
            const session = sessions.create({
                metahubId: 'metahub-1',
                packageSlug: 'playcanvas-editor',
                projectId: null,
                userId: 'user-1',
                capabilities: []
            })
            const minted = createArtifactToken(mintClaims({ bridgeSessionId: session.payload.sessionId }))
            // No sliding touch happened: the registry entry expired together
            // with the token, so the grace window must fail closed.
            advanceTime(T0 + artifactTokenTtlMs + 60_000)
            expect(sessions.isAlive(session.payload.sessionId)).toBe(false)
            expect(
                readArtifactTokenPayload(minted!.token, {
                    isBridgeSessionAlive: (bridgeSessionId) => sessions.isAlive(bridgeSessionId)
                })
            ).toBeNull()
        })

        it('rejects an expired token inside the grace window when no liveness checker is provided', () => {
            const minted = createArtifactToken(mintClaims({ bridgeSessionId: '019f0000-0000-7000-8000-00000000dead' }))
            advanceTime(T0 + artifactTokenTtlMs + 60_000)
            expect(readArtifactTokenPayload(minted!.token)).toBeNull()
        })

        it('never grants the grace window to expired tokens without a bound bridge session', () => {
            const minted = createArtifactToken(mintClaims({ bridgeSessionId: null }))
            advanceTime(T0 + artifactTokenTtlMs + 60_000)
            expect(
                readArtifactTokenPayload(minted!.token, {
                    isBridgeSessionAlive: () => true
                })
            ).toBeNull()
        })
    })

    describe('absolute lifetime cap', () => {
        it('refuses to mint once the original issuedAt reaches the absolute cap', () => {
            expect(createArtifactToken(mintClaims())).not.toBeNull()

            advanceTime(T0 + artifactTokenAbsoluteTtlMs - 1)
            expect(createArtifactToken(mintClaims())).not.toBeNull()

            advanceTime(T0 + artifactTokenAbsoluteTtlMs)
            expect(createArtifactToken(mintClaims())).toBeNull()
        })

        it('refuses renewals beyond the absolute cap even for live sessions and matching bindings', () => {
            const cappedSessionId = '019f0000-0000-7000-8000-00000000cap0'
            registerEditorArtifactIssuance(cappedSessionId, {
                metahubId: 'metahub-1',
                packageSlug: 'playcanvas-editor',
                userId: 'user-1',
                parentOrigin,
                apiOrigin: parentOrigin,
                issuedAt: T0
            })
            advanceTime(T0 + artifactTokenAbsoluteTtlMs + 60_000)

            expect(
                renewEditorArtifactToken({
                    requestOrigin: parentOrigin,
                    artifactOrigin: assetOrigin,
                    metahubId: 'metahub-1',
                    userId: 'user-1',
                    bridgeSessionId: cappedSessionId,
                    isBridgeSessionAlive: () => true
                })
            ).toBeNull()
        })
    })

    describe('renewal', () => {
        const setupRenewableSession = () => {
            const sessions = new PlayCanvasEditorBridgeSessionService()
            const session = sessions.create({
                metahubId: 'metahub-1',
                packageSlug: 'playcanvas-editor',
                projectId: null,
                userId: 'user-1',
                capabilities: []
            })
            registerEditorArtifactIssuance(session.payload.sessionId, {
                metahubId: 'metahub-1',
                packageSlug: 'playcanvas-editor',
                userId: 'user-1',
                parentOrigin,
                apiOrigin: parentOrigin,
                issuedAt: T0
            })
            return { sessions, sessionId: session.payload.sessionId }
        }

        it('mints a fresh token bound to the same session with a later expiresAt and the same issuedAt', () => {
            const { sessions, sessionId } = setupRenewableSession()
            const initial = createArtifactToken(mintClaims({ bridgeSessionId: sessionId }))

            advanceTime(T0 + 120_000)
            const renewed = renewEditorArtifactToken({
                requestOrigin: parentOrigin,
                artifactOrigin: assetOrigin,
                metahubId: 'metahub-1',
                userId: 'user-1',
                bridgeSessionId: sessionId,
                isBridgeSessionAlive: (bridgeSessionId) => sessions.isAlive(bridgeSessionId)
            })

            expect(renewed).not.toBeNull()
            expect(initial).not.toBeNull()
            expect(renewed!.token).not.toBe(initial!.token)
            expect(decodeArtifactPayload(renewed!.token)).toMatchObject({
                metahubId: 'metahub-1',
                packageSlug: 'playcanvas-editor',
                userId: 'user-1',
                parentOrigin,
                apiOrigin: parentOrigin,
                bridgeSessionId: sessionId,
                issuedAt: T0,
                expiresAt: T0 + 120_000 + artifactTokenTtlMs
            })
            expect(renewed!.payload.expiresAt).toBeGreaterThan(initial!.payload.expiresAt)
        })

        it('slides the bridge session liveness window through the renewal liveness callback', () => {
            const { sessions, sessionId } = setupRenewableSession()
            advanceTime(T0 + 240_000)
            const renewed = renewEditorArtifactToken({
                requestOrigin: parentOrigin,
                artifactOrigin: assetOrigin,
                metahubId: 'metahub-1',
                userId: 'user-1',
                bridgeSessionId: sessionId,
                isBridgeSessionAlive: (bridgeSessionId) => sessions.touch(bridgeSessionId)
            })
            expect(renewed).not.toBeNull()
            advanceTime(T0 + 300_000 + 240_000 - 1)
            expect(sessions.isAlive(sessionId)).toBe(true)
        })

        it('refuses renewal for a different user than the original issuance', () => {
            const { sessionId } = setupRenewableSession()
            expect(
                renewEditorArtifactToken({
                    requestOrigin: parentOrigin,
                    artifactOrigin: assetOrigin,
                    metahubId: 'metahub-1',
                    userId: 'user-2',
                    bridgeSessionId: sessionId,
                    isBridgeSessionAlive: () => true
                })
            ).toBeNull()
        })

        it('refuses renewal from a parent origin other than the originally bound one', () => {
            const { sessionId } = setupRenewableSession()
            expect(
                renewEditorArtifactToken({
                    requestOrigin: 'https://other-platform.example.test',
                    artifactOrigin: assetOrigin,
                    metahubId: 'metahub-1',
                    userId: 'user-1',
                    bridgeSessionId: sessionId,
                    isBridgeSessionAlive: () => true
                })
            ).toBeNull()
        })

        it('refuses renewal when the artifact origin is not cross-origin relative to the parent origin', () => {
            const { sessionId } = setupRenewableSession()
            expect(
                renewEditorArtifactToken({
                    requestOrigin: parentOrigin,
                    artifactOrigin: parentOrigin,
                    metahubId: 'metahub-1',
                    userId: 'user-1',
                    bridgeSessionId: sessionId,
                    isBridgeSessionAlive: () => true
                })
            ).toBeNull()
        })

        it('refuses renewal when the bound bridge session is dead', () => {
            const { sessionId } = setupRenewableSession()
            expect(
                renewEditorArtifactToken({
                    requestOrigin: parentOrigin,
                    artifactOrigin: assetOrigin,
                    metahubId: 'metahub-1',
                    userId: 'user-1',
                    bridgeSessionId: sessionId,
                    isBridgeSessionAlive: () => false
                })
            ).toBeNull()
        })

        it('refuses renewal without a bridge session id or without a recorded issuance', () => {
            const { sessionId } = setupRenewableSession()
            const renewalInput = {
                requestOrigin: parentOrigin,
                artifactOrigin: assetOrigin,
                metahubId: 'metahub-1',
                userId: 'user-1',
                bridgeSessionId: '',
                isBridgeSessionAlive: () => true
            }
            expect(renewEditorArtifactToken(renewalInput)).toBeNull()

            expect(
                renewEditorArtifactToken({
                    ...renewalInput,
                    bridgeSessionId: '019f0000-0000-7000-8000-000000000000',
                    isBridgeSessionAlive: () => true
                })
            ).toBeNull()

            void sessionId
        })
    })
})
