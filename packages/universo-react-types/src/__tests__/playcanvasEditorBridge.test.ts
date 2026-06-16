import { describe, expect, it } from 'vitest'
import {
    PLAYCANVAS_EDITOR_COMPATIBILITY_MODE,
    PLAYCANVAS_EDITOR_COMPATIBILITY_VERSION,
    PLAYCANVAS_EDITOR_BRIDGE_VERSION,
    playCanvasEditorBridgeCommandSchema,
    playCanvasEditorBridgeErrorSchema,
    playCanvasEditorBridgeSessionClaimsSchema,
    playCanvasEditorCompatibilityProtocolDescriptorSchema,
    playCanvasEditorScenePayloadSchema,
    playCanvasEditorUuidV7Schema
} from '../common/playcanvasEditorBridge'
import { playCanvasEditorCompatibilityScenePayloadSchema } from '../common/playcanvasEditorCompatibility'

const uuidV7 = '018f3f98-7a63-7b4a-9a5a-20c9a5b2d104'
const uuidV4 = '018f3f98-7a63-4b4a-9a5a-20c9a5b2d104'
const checksum = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const nonce = 'a'.repeat(32)

describe('PlayCanvas Editor bridge contracts', () => {
    it('accepts UUID v7 values and rejects other UUID versions for bridge ids', () => {
        expect(playCanvasEditorUuidV7Schema.safeParse(uuidV7).success).toBe(true)
        expect(playCanvasEditorUuidV7Schema.safeParse(uuidV4).success).toBe(false)
    })

    it('validates a scene save command with a bounded strict payload', () => {
        const parsed = playCanvasEditorBridgeCommandSchema.safeParse({
            type: 'scene.save',
            requestId: uuidV7,
            sessionId: uuidV7,
            nonce,
            projectId: uuidV7,
            sceneId: uuidV7,
            expectedCurrentChecksum: checksum,
            payload: {
                schemaVersion: '1',
                entities: [
                    {
                        id: 'root',
                        name: 'Root',
                        position: [0, 1, 2],
                        rotation: [0, 90, 0],
                        scale: [1, 2, 3],
                        components: {
                            camera: {
                                clearColor: [0, 0, 0]
                            }
                        }
                    }
                ],
                assets: [
                    {
                        id: 'settings-json',
                        type: 'json',
                        mime: 'application/json'
                    }
                ]
            }
        })

        expect(parsed.success).toBe(true)
    })

    it('rejects unknown top-level scene payload fields', () => {
        const parsed = playCanvasEditorScenePayloadSchema.safeParse({
            schemaVersion: '1',
            entities: [],
            rawEditorEnvelope: {}
        })

        expect(parsed.success).toBe(false)
    })

    it('rejects malformed scene entity transforms', () => {
        const parsed = playCanvasEditorScenePayloadSchema.safeParse({
            schemaVersion: '1',
            entities: [
                {
                    id: 'ship',
                    position: [0, 0],
                    rotation: [0, Number.NaN, 0],
                    scale: [1, 1, 1]
                }
            ]
        })

        expect(parsed.success).toBe(false)
    })

    it('rejects overly deep scene payloads', () => {
        let nested: Record<string, unknown> = { value: 'leaf' }
        for (let index = 0; index < 30; index += 1) {
            nested = { next: nested }
        }

        const parsed = playCanvasEditorScenePayloadSchema.safeParse({
            schemaVersion: '1',
            entities: [
                {
                    id: 'root',
                    components: {
                        script: nested
                    }
                }
            ]
        })

        expect(parsed.success).toBe(false)
    })

    it('applies the same depth and serialized size safeguards to compatibility REST scene payloads', () => {
        let nested: Record<string, unknown> = { value: 'leaf' }
        for (let index = 0; index < 30; index += 1) {
            nested = { next: nested }
        }
        const tooDeep = playCanvasEditorCompatibilityScenePayloadSchema.safeParse({
            schemaVersion: '1',
            entities: [
                {
                    id: 'root',
                    components: {
                        script: nested
                    }
                }
            ]
        })
        const tooLarge = playCanvasEditorCompatibilityScenePayloadSchema.safeParse({
            schemaVersion: '1',
            entities: [
                {
                    id: 'root',
                    components: {
                        data: 'x'.repeat(6 * 1024 * 1024)
                    }
                }
            ]
        })
        const nonJsonAssetMime = playCanvasEditorCompatibilityScenePayloadSchema.safeParse({
            schemaVersion: '1',
            entities: [],
            assets: [
                {
                    id: 'texture',
                    type: 'texture',
                    mime: 'image/png'
                }
            ]
        })

        expect(tooDeep.success).toBe(false)
        expect(tooLarge.success).toBe(false)
        expect(nonJsonAssetMime.success).toBe(false)
    })

    it('rejects unknown command fields and validates editor.ready capability envelope', () => {
        const validReady = playCanvasEditorBridgeCommandSchema.safeParse({
            type: 'editor.ready',
            requestId: uuidV7,
            sessionId: uuidV7,
            nonce,
            bridgeVersion: PLAYCANVAS_EDITOR_BRIDGE_VERSION,
            capabilities: ['scene.save']
        })
        const invalidReady = playCanvasEditorBridgeCommandSchema.safeParse({
            type: 'editor.ready',
            requestId: uuidV7,
            sessionId: uuidV7,
            nonce,
            bridgeVersion: PLAYCANVAS_EDITOR_BRIDGE_VERSION,
            capabilities: ['scene.save'],
            rawSession: uuidV7
        })

        expect(validReady.success).toBe(true)
        expect(invalidReady.success).toBe(false)
    })

    it('validates protocol describe as a first-slice compatibility capability', () => {
        const parsed = playCanvasEditorBridgeCommandSchema.safeParse({
            type: 'protocol.describe',
            requestId: uuidV7,
            sessionId: uuidV7,
            nonce
        })

        expect(parsed.success).toBe(true)
        expect(PLAYCANVAS_EDITOR_COMPATIBILITY_MODE).toBe('universo-bridge-minimal')
        expect(PLAYCANVAS_EDITOR_COMPATIBILITY_VERSION).toBe('1')
    })

    it('validates the minimal compatibility descriptor without synthetic admin claims', () => {
        const parsed = playCanvasEditorCompatibilityProtocolDescriptorSchema.safeParse({
            schemaVersion: PLAYCANVAS_EDITOR_COMPATIBILITY_VERSION,
            mode: PLAYCANVAS_EDITOR_COMPATIBILITY_MODE,
            upstream: {
                repository: 'https://github.com/playcanvas/editor',
                minimumTag: 'v2.24.2'
            },
            project: null,
            defaultSceneId: null,
            identity: {
                self: { id: 'user-1', role: 'designer' },
                owner: { id: 'metahub-1', type: 'metahub' },
                permissions: { read: true, write: true, admin: false },
                branch: { id: uuidV7, name: 'Main', active: true },
                teams: [],
                organizations: []
            },
            endpoints: {
                rest: { status: 'disabled', reason: 'notRequiredForUniversoBridgeMinimal' },
                realtime: { status: 'disabled', reason: 'notRequiredForUniversoBridgeMinimal' },
                messenger: { status: 'disabled', reason: 'notRequiredForUniversoBridgeMinimal' }
            },
            shareDb: {
                requiredCollections: ['scenes', 'assets', 'settings', 'user_data'],
                persisted: false,
                persistence: 'not-implemented',
                sceneStorage: 'metahub-playcanvas-project-storage'
            },
            cloudOnly: {
                store: { status: 'stubbed', reason: 'cloudOnlySurfaceOutsideFirstSlice' },
                jobs: { status: 'stubbed', reason: 'cloudOnlySurfaceOutsideFirstSlice' },
                branchesCheckpoints: { status: 'stubbed', reason: 'cloudOnlySurfaceOutsideFirstSlice' },
                sourcefiles: { status: 'stubbed', reason: 'cloudOnlySurfaceOutsideFirstSlice' },
                publishing: { status: 'stubbed', reason: 'cloudOnlySurfaceOutsideFirstSlice' },
                usersCollaboration: { status: 'stubbed', reason: 'cloudOnlySurfaceOutsideFirstSlice' },
                assetPipeline: { status: 'stubbed', reason: 'cloudOnlySurfaceOutsideFirstSlice' }
            },
            documents: {
                codeEditorSourcefiles: { status: 'unsupported', reason: 'codeEditorSourcefilesOutsideFirstSlice' }
            },
            settingsDocuments: {
                user: 'user_user-1',
                projectUser: `project_${uuidV7}_user-1`,
                projectPrivate: `project-private_${uuidV7}`
            }
        })
        const invalidAdmin = playCanvasEditorCompatibilityProtocolDescriptorSchema.safeParse({
            ...(parsed.success ? parsed.data : {}),
            identity: parsed.success
                ? {
                      ...parsed.data.identity,
                      permissions: { read: true, write: true, admin: true }
                  }
                : undefined
        })

        expect(parsed.success).toBe(true)
        expect(invalidAdmin.success).toBe(false)
    })

    it('validates bridge session claims and rejects unknown token fields', () => {
        const valid = {
            sessionId: uuidV7,
            metahubId: 'metahub-1',
            packageSlug: 'playcanvas-editor',
            projectId: uuidV7,
            defaultSceneId: uuidV7,
            userId: 'auth0|user-1',
            nonce,
            expiresAt: Date.now() + 60_000,
            bridgeVersion: PLAYCANVAS_EDITOR_BRIDGE_VERSION,
            capabilities: ['protocol.describe', 'scene.save']
        }

        expect(playCanvasEditorBridgeSessionClaimsSchema.safeParse(valid).success).toBe(true)
        expect(playCanvasEditorBridgeSessionClaimsSchema.safeParse({ ...valid, rawToken: 'leak' }).success).toBe(false)
    })

    it('keeps bridge errors structured without raw validation details', () => {
        const parsed = playCanvasEditorBridgeErrorSchema.parse({
            ok: false,
            requestId: uuidV7,
            code: 'invalidCommand',
            status: 400,
            safeDetails: {
                reason: 'unsupported'
            }
        })

        expect(parsed).not.toHaveProperty('details')
        expect(parsed).not.toHaveProperty('stack')
    })
})
