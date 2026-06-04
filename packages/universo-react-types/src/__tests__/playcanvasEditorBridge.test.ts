import { describe, expect, it } from 'vitest'
import {
    PLAYCANVAS_EDITOR_BRIDGE_VERSION,
    playCanvasEditorBridgeCommandSchema,
    playCanvasEditorBridgeErrorSchema,
    playCanvasEditorScenePayloadSchema,
    playCanvasEditorUuidV7Schema
} from '../common/playcanvasEditorBridge'

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
