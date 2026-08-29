import { describe, expect, it } from 'vitest'
import type { PackageAttachmentConfig } from '../common/packages'
import {
    PLAYCANVAS_EDITOR_PACKAGE_NAME,
    PLAYCANVAS_PROJECT_FILE_BASE64_MAX_CHARS,
    PLAYCANVAS_PROJECT_FILE_ROOT,
    MMOOMM_VISUAL_LAB_MAX_LOW_POLY_BANDS,
    normalizeMmoommRuntimeMetadata,
    playCanvasProjectMetadataSchema,
    playCanvasProjectParsedAttributesSchema,
    playCanvasProjectPayloadSchema,
    playCanvasProjectSchema,
    playCanvasProjectSettingsSchema,
    playCanvasProjectSnapshotSectionSchema,
    playCanvasRuntimeManifestSchema,
    isPortablePlayCanvasRuntimeDataUrl,
    isPortablePlayCanvasScriptDataUrl,
    isPlayCanvasAssetFileReference,
    isPlayCanvasGeneratedArtifactFileReference,
    isPlayCanvasImageFileReference,
    isPlayCanvasScenePayloadFileReference,
    isPlayCanvasSourceFileReference,
    isPlayCanvasScriptFileReference
} from '../common/playcanvasProjects'

const hash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'

const vlc = (content: string) => ({
    _schema: '1' as const,
    _primary: 'en',
    locales: {
        en: {
            content,
            version: 1,
            isActive: true,
            createdAt: '2026-06-03T00:00:00.000Z',
            updatedAt: '2026-06-03T00:00:00.000Z'
        }
    }
})

describe('PlayCanvas project contracts', () => {
    it('rejects oversized and deeply nested project JSON fields', () => {
        const deep: Record<string, unknown> = {}
        let cursor = deep
        for (let index = 0; index < 25; index += 1) {
            const child: Record<string, unknown> = {}
            cursor.child = child
            cursor = child
        }

        const oversized = { source: 'x'.repeat(4097) }
        expect(playCanvasProjectMetadataSchema.safeParse({ deep }).success).toBe(false)
        expect(playCanvasProjectSettingsSchema.safeParse({ deep }).success).toBe(false)
        expect(playCanvasProjectPayloadSchema.safeParse({ deep }).success).toBe(false)
        expect(playCanvasProjectParsedAttributesSchema.safeParse({ deep }).success).toBe(false)
        expect(playCanvasProjectMetadataSchema.safeParse(oversized).success).toBe(false)
        expect(playCanvasProjectSettingsSchema.safeParse(oversized).success).toBe(false)
        expect(playCanvasProjectPayloadSchema.safeParse(oversized).success).toBe(false)
        expect(playCanvasProjectParsedAttributesSchema.safeParse(oversized).success).toBe(false)
    })

    it('allows repeated references but rejects circular project JSON values', () => {
        const shared = { opacity: 0.42 }
        expect(
            playCanvasProjectPayloadSchema.safeParse({
                data: shared,
                metadata: { data: shared }
            }).success
        ).toBe(true)

        const circular: Record<string, unknown> = {}
        circular.self = circular
        expect(playCanvasProjectPayloadSchema.safeParse({ circular }).success).toBe(false)
    })

    it('rejects prototype-pollution keys at metadata boundaries', () => {
        const unsafe = JSON.parse('{"__proto__":{"polluted":true}}') as Record<string, unknown>
        expect(playCanvasProjectMetadataSchema.safeParse(unsafe).success).toBe(false)
        expect(playCanvasProjectSettingsSchema.safeParse(unsafe).success).toBe(false)
        expect(playCanvasProjectPayloadSchema.safeParse(unsafe).success).toBe(false)
        expect(playCanvasProjectParsedAttributesSchema.safeParse(unsafe).success).toBe(false)
    })

    it('validates a project envelope', () => {
        const parsed = playCanvasProjectSchema.parse({
            schemaVersion: '1',
            id: '018f3f98-7a63-7b4a-9a5a-20c9a5b2d104',
            codename: vlc('main-project'),
            displayName: vlc('Main project'),
            packageRef: {
                packageName: PLAYCANVAS_EDITOR_PACKAGE_NAME,
                version: '0.1.0',
                compatibilityStatus: 'compatible'
            },
            settings: {},
            defaultSceneId: null,
            publicationConfig: {}
        })

        expect(parsed.packageRef.packageName).toBe(PLAYCANVAS_EDITOR_PACKAGE_NAME)
    })

    it('validates a runtime manifest', () => {
        const parsed = playCanvasRuntimeManifestSchema.parse({
            schemaVersion: '1',
            projectId: '018f3f98-7a63-7b4a-9a5a-20c9a5b2d104',
            sceneId: null,
            checksum: hash,
            assets: [
                {
                    id: 'scene-json',
                    type: 'scene',
                    name: 'Scene',
                    url: '/metahub/project/assets/scene.json',
                    hash
                }
            ],
            scripts: [
                {
                    id: 'script-1',
                    scriptName: 'FlightController',
                    scriptKind: 'esm',
                    artifactHash: hash,
                    attributes: {}
                }
            ]
        })

        expect(parsed.assets[0].type).toBe('scene')
    })

    it('accepts only bounded base64 data URLs for portable runtime files', () => {
        expect(isPortablePlayCanvasRuntimeDataUrl('data:application/json;base64,eyJzY2VuZSI6MX0=')).toBe(true)
        expect(isPortablePlayCanvasRuntimeDataUrl('data:image/png;base64,AA==')).toBe(true)
        expect(isPortablePlayCanvasRuntimeDataUrl('https://cdn.example.test/scene.json')).toBe(false)
        expect(isPortablePlayCanvasRuntimeDataUrl('data:text/plain,scene')).toBe(false)
        expect(isPortablePlayCanvasRuntimeDataUrl('data:application/json;base64,not-base64')).toBe(false)
        expect(
            isPortablePlayCanvasRuntimeDataUrl(`data:application/json;base64,${'A'.repeat(PLAYCANVAS_PROJECT_FILE_BASE64_MAX_CHARS + 1)}`)
        ).toBe(false)
    })

    it('requires a JavaScript MIME for portable script artifacts', () => {
        expect(isPortablePlayCanvasScriptDataUrl('data:text/javascript;base64,ZXhwb3J0IGNvbnN0IHg9MQ==')).toBe(true)
        expect(isPortablePlayCanvasScriptDataUrl('data:application/javascript;base64,ZXhwb3J0IGNvbnN0IHg9MQ==')).toBe(false)
        expect(isPortablePlayCanvasScriptDataUrl('data:application/json;base64,eyJ4IjoxfQ==')).toBe(false)
    })

    it('normalizes MMOOMM visual lab runtime metadata and strips authoring-only fields', () => {
        const parsed = normalizeMmoommRuntimeMetadata({
            visualLab: {
                projectRole: 'visual-linkup-lab',
                variantCount: 1,
                objectTypes: ['ship'],
                internalEditorPath: 'playcanvas-projects/private/scene.json',
                objects: [
                    {
                        id: 'ship-core',
                        name: 'Linkup Lab 01 ship Core',
                        variant: 'white-link-halo',
                        family: 'softWhiteLinkup',
                        objectType: 'ship',
                        primitive: 'box',
                        position: { x: 0, y: 0, z: 0 },
                        scale: { x: 5, y: 1.5, z: 1.2 },
                        coreOpacity: 0.55,
                        glowColor: { r: 0.15, g: 0.85, b: 1 },
                        glowOpacity: 0.16,
                        shellScale: 1.1,
                        lowPolyBands: MMOOMM_VISUAL_LAB_MAX_LOW_POLY_BANDS,
                        storageRoot: 'playcanvas-projects/private'
                    }
                ]
            }
        })

        expect(parsed?.visualLab?.objects[0].lowPolyBands).toBe(MMOOMM_VISUAL_LAB_MAX_LOW_POLY_BANDS)
        expect(parsed?.visualLab).not.toHaveProperty('internalEditorPath')
        expect(parsed?.visualLab?.objects[0]).not.toHaveProperty('storageRoot')
    })

    it('keeps the authored camera role in MMOOMM runtime scene metadata', () => {
        const parsed = normalizeMmoommRuntimeMetadata({
            scene: {
                controlledObjectId: 'ship',
                targetObjectId: 'station',
                objects: [
                    {
                        id: 'ship',
                        position: { x: 0, y: 0, z: 0 },
                        scale: { x: 12, y: 4, z: 4 },
                        selectable: true
                    },
                    {
                        id: 'station',
                        position: { x: 72, y: 0, z: -48 },
                        scale: { x: 48, y: 16, z: 16 },
                        selectable: true,
                        guard: true
                    },
                    {
                        id: 'camera',
                        role: 'camera',
                        position: { x: 0, y: 28, z: 48 },
                        scale: { x: 1, y: 1, z: 1 },
                        selectable: false
                    }
                ]
            }
        })

        expect(parsed?.scene?.objects?.find((object) => object.id === 'camera')).toMatchObject({ role: 'camera' })
    })

    it('rejects unbounded MMOOMM visual lab geometry metadata', () => {
        const parsed = normalizeMmoommRuntimeMetadata({
            visualLab: {
                projectRole: 'visual-linkup-lab',
                variantCount: 1,
                objectTypes: ['rockAsteroid'],
                objects: [
                    {
                        id: 'rock-core',
                        name: 'Linkup Lab 01 rockAsteroid Core',
                        variant: 'lowpoly-radar',
                        family: 'lowPolyRetrowave',
                        objectType: 'rockAsteroid',
                        primitive: 'sphere',
                        position: { x: 0, y: 0, z: 0 },
                        scale: { x: 2, y: 2, z: 2 },
                        coreOpacity: 0.5,
                        glowColor: { r: 1, g: 0.58, b: 0.18 },
                        glowOpacity: 0.14,
                        shellScale: 1.12,
                        lowPolyBands: MMOOMM_VISUAL_LAB_MAX_LOW_POLY_BANDS + 1
                    }
                ]
            }
        })

        expect(parsed).toBeNull()
    })

    it('keeps package config as pointer-only metadata', () => {
        const config: PackageAttachmentConfig = {
            schemaVersion: '1',
            kind: 'display',
            display: {
                mode: 'embeddedIframe',
                showArtifactOnlyNotice: true
            },
            playcanvasProject: {
                defaultProjectId: '018f3f98-7a63-7b4a-9a5a-20c9a5b2d104'
            }
        }

        expect(config.playcanvasProject?.defaultProjectId).toBeTruthy()
        expect('scenes' in config).toBe(false)
        expect('assets' in config).toBe(false)
    })

    it('validates snapshot section version', () => {
        const parsed = playCanvasProjectSnapshotSectionSchema.parse({
            schemaVersion: 1,
            projects: [],
            scenes: [],
            assets: [],
            scriptAssets: [],
            sceneScriptBindings: [],
            generatedArtifacts: [],
            runtimeManifests: []
        })

        expect(parsed.schemaVersion).toBe(1)
        expect(PLAYCANVAS_PROJECT_FILE_ROOT).toBe('playcanvas-projects')
    })

    it('classifies scene payload file references as JSON files under the scene namespace', () => {
        expect(
            isPlayCanvasScenePayloadFileReference({
                path: 'playcanvas-projects/018f3f98-7a63-7b4a-9a5a-20c9a5b2d104/scenes/scene-one.json',
                mime: 'application/json'
            })
        ).toBe(true)
        expect(
            isPlayCanvasScenePayloadFileReference({
                path: 'playcanvas-projects/018f3f98-7a63-7b4a-9a5a-20c9a5b2d104/generated/scene-one.json',
                mime: 'application/json'
            })
        ).toBe(false)
        expect(
            isPlayCanvasScenePayloadFileReference({
                path: 'playcanvas-projects/018f3f98-7a63-7b4a-9a5a-20c9a5b2d104/scenes/scene-one.mjs',
                mime: 'text/javascript'
            })
        ).toBe(false)
        expect(
            isPlayCanvasScenePayloadFileReference({
                path: 'playcanvas-projects/018f3f98-7a63-7b4a-9a5a-20c9a5b2d104/scenes/scene-one.json',
                mime: null
            })
        ).toBe(false)
    })

    it('classifies PlayCanvas asset and script file references by asset namespace and MIME class', () => {
        expect(
            isPlayCanvasAssetFileReference({
                path: 'playcanvas-projects/018f3f98-7a63-7b4a-9a5a-20c9a5b2d104/assets/flight-controller.mjs',
                mime: 'text/javascript'
            })
        ).toBe(true)
        expect(
            isPlayCanvasScriptFileReference({
                path: 'playcanvas-projects/018f3f98-7a63-7b4a-9a5a-20c9a5b2d104/assets/flight-controller.mjs',
                mime: 'text/javascript'
            })
        ).toBe(true)
        expect(
            isPlayCanvasScriptFileReference({
                path: 'playcanvas-projects/018f3f98-7a63-7b4a-9a5a-20c9a5b2d104/assets/flight-controller.json',
                mime: 'application/json'
            })
        ).toBe(false)
        expect(
            isPlayCanvasScriptFileReference({
                path: 'playcanvas-projects/018f3f98-7a63-7b4a-9a5a-20c9a5b2d104/assets/flight-controller.mjs',
                mime: null
            })
        ).toBe(false)
        expect(
            isPlayCanvasAssetFileReference({
                path: 'playcanvas-projects/018f3f98-7a63-7b4a-9a5a-20c9a5b2d104/generated/flight-controller.mjs',
                mime: 'text/javascript'
            })
        ).toBe(false)
    })

    it('classifies PlayCanvas image asset file references by extension and MIME class', () => {
        expect(
            isPlayCanvasImageFileReference({
                path: 'playcanvas-projects/018f3f98-7a63-7b4a-9a5a-20c9a5b2d104/assets/crosshair.png',
                mime: 'image/png'
            })
        ).toBe(true)
        expect(
            isPlayCanvasImageFileReference({
                path: 'playcanvas-projects/018f3f98-7a63-7b4a-9a5a-20c9a5b2d104/assets/crosshair.jpg',
                mime: 'image/jpeg'
            })
        ).toBe(true)
        expect(
            isPlayCanvasImageFileReference({
                path: 'playcanvas-projects/018f3f98-7a63-7b4a-9a5a-20c9a5b2d104/assets/crosshair.webp',
                mime: 'image/webp'
            })
        ).toBe(true)
        expect(
            isPlayCanvasImageFileReference({
                path: 'playcanvas-projects/018f3f98-7a63-7b4a-9a5a-20c9a5b2d104/assets/crosshair.png',
                mime: 'image/jpeg'
            })
        ).toBe(false)
    })

    it('classifies generated artifact references as JavaScript files under the generated namespace', () => {
        expect(
            isPlayCanvasGeneratedArtifactFileReference({
                path: 'playcanvas-projects/018f3f98-7a63-7b4a-9a5a-20c9a5b2d104/generated/flight-controller.mjs',
                mime: 'text/javascript'
            })
        ).toBe(true)
        expect(
            isPlayCanvasGeneratedArtifactFileReference({
                path: 'playcanvas-projects/018f3f98-7a63-7b4a-9a5a-20c9a5b2d104/scenes/flight-controller.mjs',
                mime: 'text/javascript'
            })
        ).toBe(false)
        expect(
            isPlayCanvasGeneratedArtifactFileReference({
                path: 'playcanvas-projects/018f3f98-7a63-7b4a-9a5a-20c9a5b2d104/generated/flight-controller.json',
                mime: 'application/json'
            })
        ).toBe(false)
        expect(
            isPlayCanvasGeneratedArtifactFileReference({
                path: 'playcanvas-projects/018f3f98-7a63-7b4a-9a5a-20c9a5b2d104/generated/flight-controller.mjs',
                mime: null
            })
        ).toBe(false)
    })

    it('classifies sourcefile references as JavaScript files under the sourcefiles namespace', () => {
        expect(
            isPlayCanvasSourceFileReference({
                path: 'playcanvas-projects/018f3f98-7a63-7b4a-9a5a-20c9a5b2d104/sourcefiles/flight-controller.mjs',
                mime: 'text/javascript'
            })
        ).toBe(true)
        expect(
            isPlayCanvasSourceFileReference({
                path: 'playcanvas-projects/018f3f98-7a63-7b4a-9a5a-20c9a5b2d104/generated/flight-controller.mjs',
                mime: 'text/javascript'
            })
        ).toBe(false)
        expect(
            isPlayCanvasSourceFileReference({
                path: 'playcanvas-projects/018f3f98-7a63-7b4a-9a5a-20c9a5b2d104/sourcefiles/flight-controller.json',
                mime: 'application/json'
            })
        ).toBe(false)
    })
})
